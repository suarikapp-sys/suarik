"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, HelpCircle, Coins, LogIn,
  FileText, Mic, Sparkles, ChevronDown,
  Lock, X, Zap, Check, Brain, Film,
  Music2, Download, FileCode2, Play, Pause,
  Home, BookOpen, Wand2, CloudUpload, Upload,
  SkipBack, SkipForward, Volume2, VolumeX, RefreshCw,
  ArrowLeft, ChevronUp, GripVertical, Flame,
  Eye, EyeOff, TrendingUp, Settings,
} from "lucide-react";
import { saveAs } from "file-saver";
import { useToast, ToastContainer } from "@/components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────
interface VideoOption     { url: string; source?: string; vault_category?: string; thumb?: string; }
interface BackgroundTrack { url: string; title: string; is_premium_vault: boolean; }
interface Scene {
  segment: string; text_chunk?: string; vault_category?: string;
  sound_effect?: string; broll_search_keywords?: string;
  video_url?: string; video_options?: VideoOption[];
  sfx_url?: string; sfx_options?: string[];
  estimated_duration_seconds?: number;
}
interface GenerateResponse {
  project_vibe: string; music_style: string;
  scenes: Scene[]; background_tracks: BackgroundTrack[];
}
// Each individual clip block on the V1 track (a scene may split into multiple clips)
interface TimelineClip {
  id: string;           // unique — used as React key
  sceneIdx: number;
  url: string | null;   // null = gap placeholder (colored, not black)
  thumb?: string;       // static preview image (always visible, no video loading needed)
  triggerWord?: string; // exact keyword that caused this image to be selected
  startSec: number;     // global timeline start
  durSec: number;       // how long this block lasts
  label: string;
  color: string;
}

// ─── SubtitleWord: karaoke timing model ──────────────────────────────────────
interface SubtitleWord {
  word: string;
  startSec: number;
  endSec: number;
  isKeyword: boolean;   // in BROLL_IMAGES (triggers image swap)
  cleanWord: string;    // normalized for lookup
}

// ─── DirectResponseScene: output of the AI Art Director ──────────────────────
// This is the SOURCE OF TRUTH for the timeline. Every clip, subtitle word,
// and SFX event is derived from this structure — not from raw Scene data.
// Media fields (videoUrl, thumbUrl, sfxPreviewUrl, videoOptions) are populated
// server-side by /api/generate-timeline via Pexels + Freesound fetches.
interface DirectResponseScene {
  id:              string;
  textSnippet:     string;        // exact phrase being spoken in this segment
  duration:        number;        // seconds, calculated from reading time (words/2.8)
  emotion:         string;        // e.g. "Revelação", "Urgência", "Choque"
  searchQueries:   string[];      // 3 English Pexels-optimized visual concepts
  suggestedSfx:    string | null; // "riser" | "impact" | "glitch" | "bell" | etc.
  // ── Real media populated by backend ──
  videoUrl?:       string | null; // Pexels HD .mp4 URL
  thumbUrl?:       string | null; // Pexels video cover image URL
  sfxPreviewUrl?:  string | null; // Freesound .mp3 preview URL
  videoOptions?:   Array<{ url: string; thumb: string; query: string }>; // alternatives
}

// ─── SFX Scoring Layer ────────────────────────────────────────────────────────
interface SFXMarker {
  id: string;
  type: "transition" | "emphasis";
  timeSec: number;      // global position in seconds
  label: string;        // tooltip text (e.g. "Caixa Registradora")
  kind: "zap" | "bell"; // zap = whoosh/impact, bell = chime/ding
  color: string;
  keyword?: string;     // which keyword triggered this
}

// Keywords → SFX label + visual style
const SFX_KEYWORDS: Record<string, { label: string; kind: "zap"|"bell"; color: string }> = {
  // 💰 Money
  dinheiro:    { label:"Caixa Registradora",   kind:"bell", color:"#fbbf24" },
  bilhões:     { label:"Caixa Registradora",   kind:"bell", color:"#fbbf24" },
  bilhoes:     { label:"Caixa Registradora",   kind:"bell", color:"#fbbf24" },
  renda:       { label:"Ping de Depósito",      kind:"bell", color:"#fbbf24" },
  lucro:       { label:"Moedas Caindo",         kind:"bell", color:"#fbbf24" },
  indenizações:{ label:"Sela de Contrato",      kind:"bell", color:"#fbbf24" },
  acordo:      { label:"Sela de Contrato",      kind:"bell", color:"#fbbf24" },
  // 🚨 Urgência
  urgente:     { label:"Alarm de Alerta",       kind:"zap",  color:"#ef4444" },
  atenção:     { label:"Bell de Aviso",         kind:"bell", color:"#f59e0b" },
  atencao:     { label:"Bell de Aviso",         kind:"bell", color:"#f59e0b" },
  agora:       { label:"Swoosh Rápido",         kind:"zap",  color:"#8b5cf6" },
  rápido:      { label:"Swoosh Rápido",         kind:"zap",  color:"#8b5cf6" },
  rapido:      { label:"Swoosh Rápido",         kind:"zap",  color:"#8b5cf6" },
  nunca:       { label:"Impact Boom",           kind:"zap",  color:"#ef4444" },
  // 🔒 Poder
  segredo:     { label:"Whoosh Místico",        kind:"zap",  color:"#6366f1" },
  proibido:    { label:"Stamp Impact",          kind:"zap",  color:"#ef4444" },
  revelado:    { label:"Reveal Sting",          kind:"zap",  color:"#ec4899" },
  descoberto:  { label:"Discovery Chime",       kind:"bell", color:"#10b981" },
  grátis:      { label:"Pop de Confirmação",    kind:"bell", color:"#10b981" },
  gratis:      { label:"Pop de Confirmação",    kind:"bell", color:"#10b981" },
  exclusivo:   { label:"Whoosh Premium",        kind:"zap",  color:"#6366f1" },
  verdade:     { label:"Dramatic Sting",        kind:"zap",  color:"#f59e0b" },
  // ✅ Ações
  escrever:    { label:"Teclado Click",         kind:"bell", color:"#22d3ee" },
  resultado:   { label:"Achievement Bell",      kind:"bell", color:"#10b981" },
  verificar:   { label:"Confirmation Beep",     kind:"bell", color:"#10b981" },
  garantido:   { label:"Seal Pop",              kind:"bell", color:"#10b981" },
  confirmar:   { label:"Confirmation Beep",     kind:"bell", color:"#10b981" },
  // 💥 Impacto
  médicos:     { label:"Dramatic Sting",        kind:"zap",  color:"#ef4444" },
  medicos:     { label:"Dramatic Sting",        kind:"zap",  color:"#ef4444" },
  destroi:     { label:"Impact Boom",           kind:"zap",  color:"#ef4444" },
  dissolve:    { label:"Dissolve Whoosh",       kind:"zap",  color:"#8b5cf6" },
  estratégia:  { label:"Tactical Click",        kind:"bell", color:"#22d3ee" },
  estrategia:  { label:"Tactical Click",        kind:"bell", color:"#22d3ee" },
  detecta:     { label:"Ping Eletrônico",       kind:"bell", color:"#22d3ee" },
  bloqueado:   { label:"Block Impact",          kind:"zap",  color:"#ef4444" },
  bug:         { label:"Glitch SFX",            kind:"zap",  color:"#FF7A5C" },
  padrão:      { label:"Reveal Sting",          kind:"zap",  color:"#8b5cf6" },
  padrao:      { label:"Reveal Sting",          kind:"zap",  color:"#8b5cf6" },
  esconder:    { label:"Whoosh Místico",        kind:"zap",  color:"#6366f1" },
  cassino:     { label:"Slot Machine",          kind:"bell", color:"#fbbf24" },
  composto:    { label:"Science Beep",          kind:"bell", color:"#22d3ee" },
  amazônia:    { label:"Nature Ambience",       kind:"bell", color:"#10b981" },
  amazonia:    { label:"Nature Ambience",       kind:"bell", color:"#10b981" },
};

// Scans all scenes, emits SFXMarker for each keyword hit + scene-boundary transitions.
// Debounced: max 1 marker per 1.5s to avoid visual noise.
function buildSFXMarkers(scenes: Scene[]): SFXMarker[] {
  const raw: SFXMarker[] = [];
  let cursor = 0;

  for (let i = 0; i < scenes.length; i++) {
    const sc  = scenes[i];
    const dur = sc.estimated_duration_seconds ?? 5;
    const txt = (sc.text_chunk ?? sc.segment ?? "").toLowerCase();
    const words = txt.split(/\s+/).filter(Boolean);

    // Scene-boundary transition (every scene except first)
    if (i > 0) {
      raw.push({ id:`tr-${i}`, type:"transition", timeSec:cursor,
        label:"Swoosh de Transição", kind:"zap", color:"#E8593C" });
    }
    // Mid-scene transition for long scenes (> 7s)
    if (dur > 7) {
      raw.push({ id:`tr-mid-${i}`, type:"transition", timeSec:cursor + dur / 2,
        label:"Cut de Transição", kind:"zap", color:"#E8593C" });
    }

    // Keyword scan — proportional timestamp within the scene
    words.forEach((word, wi) => {
      const clean = word.replace(/[^a-záéíóúãõçêâîôû]/g, "");
      const def = SFX_KEYWORDS[clean];
      if (def) {
        raw.push({
          id: `kw-${i}-${wi}`,
          type: "emphasis",
          timeSec: cursor + (wi / Math.max(words.length - 1, 1)) * dur,
          label: def.label, kind: def.kind, color: def.color, keyword: clean,
        });
      }
    });

    cursor += dur;
  }

  // Sort chronologically, then debounce (min 1.5s gap)
  raw.sort((a, b) => a.timeSec - b.timeSec);
  const out: SFXMarker[] = [];
  for (const m of raw) {
    const last = out[out.length - 1];
    if (!last || m.timeSec - last.timeSec >= 1.5) out.push(m);
  }
  return out;
}

// ─── Static data ──────────────────────────────────────────────────────────────
const NICHES = [
  { group:"Direct Response", options:[
    {value:"dr_nutra_pain",           label:"Dores Articulares"},
    {value:"dr_nutra_weight",         label:"Emagrecimento / Nutra"},
    {value:"dr_nutra_brain",          label:"Memória / Cognição"},
    {value:"dr_blood_sugar",          label:"Glicemia / Diabetes"},
    {value:"dr_bizopp",               label:"Renda Extra / BizOpp"},
    {value:"dr_financas_indenizacoes",label:"Indenizações / Acordos"},
    {value:"dr_financas_renda_extra", label:"Finanças / Investimentos"},
    {value:"dr_survival",             label:"Sobrevivência"},
    {value:"dr_manifestation",        label:"Espiritualidade"},
  ]},
  {group:"Tradicional & Agência", options:[
    {value:"trad_real_estate",label:"Imobiliário"},
    {value:"trad_corporate",  label:"Corporativo / B2B"},
    {value:"trad_fitness",    label:"Fitness / Saúde"},
    {value:"trad_education",  label:"Educação / Infoproduto"},
  ]},
];

const TEMPLATES = [
  { icon:"💊", label:"Copy Nutra",    copy:`Médicos estão proibindo esta informação porque destrói o mercado de remédios para dores articulares. Um composto natural descoberto na Amazônia dissolve o cristal de urato em apenas 21 dias. Sem cirurgia. Sem efeitos colaterais. Assista até o final — este vídeo pode sair do ar.` },
  { icon:"💰", label:"Copy Finanças", copy:`Existe um bug no sistema financeiro brasileiro que faz dinheiro desaparecer da sua conta sem você perceber. 47 bilhões em acordos judiciais esquecidos pelo governo. Seu nome pode estar na lista. Vou te mostrar como verificar em 3 minutos, de graça, pelo celular.` },
  { icon:"🎰", label:"Copy iGaming",  copy:`A maioria dos jogadores perde porque usa a estratégia errada. Depois de analisar 847 rodadas ao vivo, identificamos o único padrão que os cassinos tentam esconder. Nossa IA detecta o momento exato de entrar e sair. Retorno médio dos últimos 30 dias: +247%.` },
];

const ASPECTS   = ["📺 16:9 · VSL","📱 9:16 · Reels","🎬 Cinemático"];
const CLIP_COLS = ["#E8593C","#D4513A","#FF7A5C","#C44B35","#B8422F","#FF9478"];

// ─── VSL Brain: keyword → premium curated image (exact match, high quality) ──
// Each entry maps a PT-BR trigger word to a Pexels HD photo that visually
// represents that concept. This drives both the timeline rapid-cut thumbnails
// and the karaoke subtitle glow effect.
const BROLL_IMAGES: Record<string, string> = {
  // 👨‍⚕️ Health / Medical — "Médicos estão proibindo..."
  médicos:     "https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&w=1280",
  medicos:     "https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&w=1280",
  médico:      "https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&w=1280",
  medico:      "https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&w=1280",
  cirurgia:    "https://images.pexels.com/photos/4173251/pexels-photo-4173251.jpeg?auto=compress&w=1280",
  remédios:    "https://images.pexels.com/photos/159211/headache-pain-pills-medication-159211.jpeg?auto=compress&w=1280",
  remedios:    "https://images.pexels.com/photos/159211/headache-pain-pills-medication-159211.jpeg?auto=compress&w=1280",
  dores:       "https://images.pexels.com/photos/7176026/pexels-photo-7176026.jpeg?auto=compress&w=1280",
  articulares: "https://images.pexels.com/photos/7176026/pexels-photo-7176026.jpeg?auto=compress&w=1280",
  composto:    "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&w=1280",
  cristal:     "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&w=1280",
  dissolve:    "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&w=1280",
  amazônia:    "https://images.pexels.com/photos/975771/pexels-photo-975771.jpeg?auto=compress&w=1280",
  amazonia:    "https://images.pexels.com/photos/975771/pexels-photo-975771.jpeg?auto=compress&w=1280",
  // 🔒 Secret / Forbidden — "esconder essa informação"
  proibindo:   "https://images.pexels.com/photos/4560133/pexels-photo-4560133.jpeg?auto=compress&w=1280",
  proibido:    "https://images.pexels.com/photos/4560133/pexels-photo-4560133.jpeg?auto=compress&w=1280",
  esconder:    "https://images.pexels.com/photos/5273751/pexels-photo-5273751.jpeg?auto=compress&w=1280",
  escondendo:  "https://images.pexels.com/photos/5273751/pexels-photo-5273751.jpeg?auto=compress&w=1280",
  informação:  "https://images.pexels.com/photos/6863183/pexels-photo-6863183.jpeg?auto=compress&w=1280",
  informacao:  "https://images.pexels.com/photos/6863183/pexels-photo-6863183.jpeg?auto=compress&w=1280",
  segredo:     "https://images.pexels.com/photos/6863183/pexels-photo-6863183.jpeg?auto=compress&w=1280",
  revelado:    "https://images.pexels.com/photos/3771807/pexels-photo-3771807.jpeg?auto=compress&w=1280",
  descoberto:  "https://images.pexels.com/photos/3771807/pexels-photo-3771807.jpeg?auto=compress&w=1280",
  verdade:     "https://images.pexels.com/photos/3771807/pexels-photo-3771807.jpeg?auto=compress&w=1280",
  // 📉 Market Crash — "destrói o mercado"
  mercado:     "https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&w=1280",
  destroi:     "https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&w=1280",
  destrói:     "https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&w=1280",
  queda:       "https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&w=1280",
  // 💰 Finance / Money
  bug:         "https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&w=1280",
  sistema:     "https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&w=1280",
  financeiro:  "https://images.pexels.com/photos/534216/pexels-photo-534216.jpeg?auto=compress&w=1280",
  dinheiro:    "https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=1280",
  conta:       "https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=1280",
  bilhões:     "https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=1280",
  bilhoes:     "https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=1280",
  acordos:     "https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&w=1280",
  judicial:    "https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&w=1280",
  governo:     "https://images.pexels.com/photos/259200/pexels-photo-259200.jpeg?auto=compress&w=1280",
  celular:     "https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&w=1280",
  lista:       "https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&w=1280",
  renda:       "https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&w=1280",
  lucro:       "https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=1280",
  retorno:     "https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=1280",
  // 🎰 iGaming
  cassino:     "https://images.pexels.com/photos/2263436/pexels-photo-2263436.jpeg?auto=compress&w=1280",
  rodadas:     "https://images.pexels.com/photos/2263436/pexels-photo-2263436.jpeg?auto=compress&w=1280",
  jogadores:   "https://images.pexels.com/photos/2263436/pexels-photo-2263436.jpeg?auto=compress&w=1280",
  padrão:      "https://images.pexels.com/photos/2510428/pexels-photo-2510428.jpeg?auto=compress&w=1280",
  padrao:      "https://images.pexels.com/photos/2510428/pexels-photo-2510428.jpeg?auto=compress&w=1280",
  estratégia:  "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&w=1280",
  estrategia:  "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&w=1280",
  // 🌟 Lifestyle / Premium
  exclusivo:   "https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&w=1280",
  lifestyle:   "https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&w=1280",
};

// Returns a guaranteed-visible thumbnail for a scene
function getSceneThumb(sc: Scene, idx: number): string {
  const txt = (sc.text_chunk ?? sc.segment ?? "").toLowerCase();
  for (const w of txt.split(/\s+/)) {
    const clean = w.replace(/[^a-záéíóúãõçêâîôû]/g, "");
    if (BROLL_IMAGES[clean]) return BROLL_IMAGES[clean];
  }
  return GALLERY_CARDS[idx % GALLERY_CARDS.length].src;
}

const GALLERY_TAGS  = ["All","Renda Extra","Saúde","Finanças","Dor","Ansiedade","UGC"];
// ── Mixkit CDN · IDs verificados · formato 360p ──────────────────────────────
// 💰 Renda Extra — pessoas com dinheiro real
const VA = "https://assets.mixkit.co/videos/18296/18296-360.mp4"; // homem contando maço de notas
const VB = "https://assets.mixkit.co/videos/24354/24354-360.mp4"; // mulher contando dólares
// 😣 Saúde / Dor física — pessoas sofrendo de verdade
const VC = "https://assets.mixkit.co/videos/47583/47583-360.mp4"; // mulher massageando têmpora com dor
const VD = "https://assets.mixkit.co/videos/33376/33376-360.mp4"; // garota na cama com dor forte no estômago
// 💻 Finanças / Ansiedade — frustração real no dia a dia
const VE = "https://assets.mixkit.co/videos/25575/25575-360.mp4"; // mulher jovem frustrada na frente do PC
const VF = "https://assets.mixkit.co/videos/5601/5601-360.mp4";   // empresário estressado esfregando os olhos
const GALLERY_CARDS = [
  // 💰 Renda Extra
  {id:1,  tag:"Renda Extra", title:"Hook 'Olha quanto eu recebi hoje'",   src:"https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=400", tall:true,  videoUrl:VA},
  {id:2,  tag:"Renda Extra", title:"Prova Social — Dinheiro na Mão",      src:"https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&w=400", tall:false, videoUrl:VB},
  // 😣 Saúde / Dor
  {id:3,  tag:"Saúde",       title:"Dor de cabeça — gancho Nutra",        src:"https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&w=400", tall:false, videoUrl:VC},
  {id:4,  tag:"Saúde",       title:"Dor abdominal — abertura VSL Saúde",  src:"https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&w=400", tall:true,  videoUrl:VD},
  // 💻 Finanças / Ansiedade
  {id:5,  tag:"Finanças",    title:"Frustração com contas atrasadas",      src:"https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&w=400", tall:false, videoUrl:VE},
  {id:6,  tag:"Finanças",    title:"Estresse financeiro no trabalho",      src:"https://images.pexels.com/photos/259200/pexels-photo-259200.jpeg?auto=compress&w=400",   tall:true,  videoUrl:VF},
  // Cruzamento de nichos (combos de alta conversão)
  {id:7,  tag:"Dor",         title:"Dor que vende — gancho emocional",     src:"https://images.pexels.com/photos/3762800/pexels-photo-3762800.jpeg?auto=compress&w=400", tall:false, videoUrl:VC},
  {id:8,  tag:"Dor",         title:"'Não aguento mais' — abertura forte",  src:"https://images.pexels.com/photos/3771807/pexels-photo-3771807.jpeg?auto=compress&w=400", tall:false, videoUrl:VD},
  {id:9,  tag:"Ansiedade",   title:"Colapso financeiro — cena de abertura",src:"https://images.pexels.com/photos/3684307/pexels-photo-3684307.jpeg?auto=compress&w=400", tall:true,  videoUrl:VE},
  {id:10, tag:"Ansiedade",   title:"Burnout — esgotamento total",          src:"https://images.pexels.com/photos/1166209/pexels-photo-1166209.jpeg?auto=compress&w=400", tall:false, videoUrl:VF},
  {id:11, tag:"UGC",         title:"Prova de renda — notificação ao vivo", src:"https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=400", tall:false, videoUrl:VA},
  {id:12, tag:"UGC",         title:"Depoimento UGC — antes e depois",      src:"https://images.pexels.com/photos/2263436/pexels-photo-2263436.jpeg?auto=compress&w=400", tall:true,  videoUrl:VB},
];

const LOADING_MSGS = [
  "Analisando psicologia da copy…","Detectando gatilhos de retenção…",
  "Cortando silêncios automaticamente…","Adicionando SFX de impacto…",
  "Mapeando Palavras de Poder…","Sincronizando B-rolls com a fala…",
  "Calibrando trilha para tensão máxima…","Finalizando mapa de edição premium…",
];

const POWER_WORDS = new Set([
  "segredo","proibido","nunca","grátis","agora","urgente","exclusivo","revelado",
  "bug","verdade","descoberto","destroi","dissolve","esquecido","padrão","esconder",
  "detecta","estratégia","bloqueado","bilhões","médicos","composto","amazônia",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

// ─── Zero Black Screen + Rapid-Cut algorithm ─────────────────────────────────
// 1) Scans each scene's copy for BROLL_IMAGES keywords → creates 2-3s micro-clips
//    (rapid-cut feel — multiple cuts per sentence, like a DR editor would do)
// 2) Falls back to distributing video_options if < 2 keyword hits
// 3) Never produces a black screen — colored gradient placeholder when no media
function buildTimelineClips(scenes: Scene[]): TimelineClip[] {
  const clips: TimelineClip[] = [];
  let cursor = 0;

  for (let i = 0; i < scenes.length; i++) {
    const sc  = scenes[i];
    const dur = sc.estimated_duration_seconds ?? 5;
    const col = CLIP_COLS[i % CLIP_COLS.length];

    // ── Scan text for keyword-based rapid-cut hits ───────────────────────────
    const txt   = (sc.text_chunk ?? sc.segment ?? "").toLowerCase();
    const words = txt.split(/\s+/);
    const hits: Array<{ word: string; img: string }> = [];
    const seen  = new Set<string>();
    for (const w of words) {
      const clean = w.replace(/[^a-záéíóúãõçêâîôû]/g, "");
      if (BROLL_IMAGES[clean] && !seen.has(clean)) {
        seen.add(clean);
        hits.push({ word: clean, img: BROLL_IMAGES[clean] });
      }
    }

    // ── Collect real video URLs from scene ────────────────────────────────────
    const urls: string[] = [];
    const add = (u?: string | null) => { if (u && !urls.includes(u)) urls.push(u); };
    add(sc.video_url);
    (sc.video_options ?? []).forEach(o => add(o.url));

    if (hits.length >= 2) {
      // ── RAPID-CUT: 2-3s per keyword hit ──────────────────────────────────
      const clipDur = Math.max(1.5, Math.min(3, dur / hits.length));
      hits.forEach((hit, j) => {
        const isLast = j === hits.length - 1;
        const d      = isLast ? Math.max(0.5, dur - j * clipDur) : clipDur;
        clips.push({
          id:          `sc${i}-kw${j}`,
          sceneIdx:    i,
          url:         urls[j % Math.max(urls.length, 1)] ?? null,
          thumb:       hit.img,
          triggerWord: hit.word,   // ← karaoke glow key
          startSec:    cursor + j * clipDur,
          durSec:      d,
          label:       `${sc.segment} · ${hit.word}`,
          color:       col,
        });
      });
    } else if (urls.length > 0) {
      // ── STANDARD: distribute video options evenly ─────────────────────────
      const segDur = dur / urls.length;
      urls.forEach((url, j) =>
        clips.push({
          id: `sc${i}-${j}`, sceneIdx: i, url,
          thumb: getSceneThumb(sc, i),
          startSec: cursor + j * segDur, durSec: segDur,
          label: urls.length > 1 ? `${sc.segment} · ${j+1}/${urls.length}` : sc.segment,
          color: col,
        })
      );
    } else {
      // ── PLACEHOLDER: colored gradient, never black ────────────────────────
      clips.push({
        id: `sc${i}-0`, sceneIdx: i, url: null,
        thumb: getSceneThumb(sc, i),
        startSec: cursor, durSec: dur,
        label: sc.segment, color: col,
      });
    }
    cursor += dur;
  }
  return clips;
}

// ─── Karaoke subtitle model ───────────────────────────────────────────────────
// Divides each scene's text into per-word timestamps so the subtitle renderer
// knows exactly when to highlight each word as the playhead moves.
function buildSubtitleWords(scenes: Scene[]): SubtitleWord[] {
  const out: SubtitleWord[] = [];
  let cursor = 0;
  for (const sc of scenes) {
    const dur  = sc.estimated_duration_seconds ?? 5;
    const text = (sc.text_chunk ?? sc.segment ?? "").trim();
    const raw  = text.split(/\s+/).filter(Boolean);
    if (raw.length === 0) { cursor += dur; continue; }
    // Each word gets an equal slice of the scene duration.
    // Words spoken faster feel more dynamic — matches DR pacing.
    const perWord = dur / raw.length;
    raw.forEach((w, wi) => {
      const clean = w.toLowerCase().replace(/[^a-záéíóúãõçêâîôû]/g, "");
      out.push({
        word:      w,
        startSec:  cursor + wi * perWord,
        endSec:    cursor + (wi + 1) * perWord,
        isKeyword: !!BROLL_IMAGES[clean] || POWER_WORDS.has(clean),
        cleanWord: clean,
      });
    });
    cursor += dur;
  }
  return out;
}

// ─── PEXELS_CONCEPTS: English concept → curated HD image ─────────────────────
// Maps the English search queries emitted by analyzeCopyForDirectResponse
// to guaranteed-visible Pexels photos. English because image banks index
// in English — direct PT-BR translations often return poor results.
const PEXELS_CONCEPTS: Record<string, string> = {
  // Financial system anomaly / hack
  "financial system hack glitch":         "https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&w=1280",
  "money disappearing digital":           "https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=1280",
  "banking vulnerability exposed":        "https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&w=1280",
  // Medical authority suppression
  "serious doctor authority figure":      "https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&w=1280",
  "medical secret forbidden":             "https://images.pexels.com/photos/5273751/pexels-photo-5273751.jpeg?auto=compress&w=1280",
  "pharmaceutical suppression":           "https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&w=1280",
  // Market crash / economic destruction
  "stock market crash red":               "https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&w=1280",
  "financial collapse graph":             "https://images.pexels.com/photos/534216/pexels-photo-534216.jpeg?auto=compress&w=1280",
  "economy destruction system":           "https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&w=1280",
  // Classified / hidden information
  "classified document vault":            "https://images.pexels.com/photos/6863183/pexels-photo-6863183.jpeg?auto=compress&w=1280",
  "secret information hidden":            "https://images.pexels.com/photos/5273751/pexels-photo-5273751.jpeg?auto=compress&w=1280",
  "whistleblower exposure reveal":        "https://images.pexels.com/photos/3771807/pexels-photo-3771807.jpeg?auto=compress&w=1280",
  // Natural / Amazon
  "amazon rainforest dense green":        "https://images.pexels.com/photos/975771/pexels-photo-975771.jpeg?auto=compress&w=1280",
  "natural compound herbal remedy":       "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&w=1280",
  "joint pain relief healing":            "https://images.pexels.com/photos/7176026/pexels-photo-7176026.jpeg?auto=compress&w=1280",
  // Legal / money opportunity
  "legal document court settlement":      "https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&w=1280",
  "government building authority":        "https://images.pexels.com/photos/259200/pexels-photo-259200.jpeg?auto=compress&w=1280",
  "money cash opportunity found":         "https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=1280",
  // CTA / urgency
  "urgency red alert warning":            "https://images.pexels.com/photos/4560133/pexels-photo-4560133.jpeg?auto=compress&w=1280",
  "person looking down phone surprised":  "https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&w=1280",
  "watch video now urgent cta":           "https://images.pexels.com/photos/3762800/pexels-photo-3762800.jpeg?auto=compress&w=1280",
  // Casino / gaming
  "casino gambling strategy":             "https://images.pexels.com/photos/2263436/pexels-photo-2263436.jpeg?auto=compress&w=1280",
  // Pain / suffering
  "joint pain arthritis suffering":       "https://images.pexels.com/photos/7176026/pexels-photo-7176026.jpeg?auto=compress&w=1280",
  "medical problem chronic":              "https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&w=1280",
  // Generic DR cinematic
  "pattern interrupt shock visual":       "https://images.pexels.com/photos/3762800/pexels-photo-3762800.jpeg?auto=compress&w=1280",
  "cinematic dramatic tension":           "https://images.pexels.com/photos/2510428/pexels-photo-2510428.jpeg?auto=compress&w=1280",
  "proof evidence testimonial social":    "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&w=1280",
  "exclusive insider advantage":          "https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&w=1280",
};

// Fuzzy lookup: returns best matching image for any English concept query
function lookupConcept(query: string): string {
  if (PEXELS_CONCEPTS[query]) return PEXELS_CONCEPTS[query];
  const qwords = new Set(query.toLowerCase().split(/\s+/));
  let best = "", bestScore = 0;
  for (const [key, url] of Object.entries(PEXELS_CONCEPTS)) {
    const score = key.toLowerCase().split(/\s+/).filter(w => qwords.has(w)).length;
    if (score > bestScore) { bestScore = score; best = url; }
  }
  return best || GALLERY_CARDS[0].src;
}

// ─── AI Art Director: semantic intent classification ──────────────────────────
// Each rule tests the raw lowercased text and returns visual intent metadata.
// Rules are ordered most-specific → least-specific (first match wins).
// IMPORTANT: visual concepts are in English — not literal PT-BR translations.
// "bug no sistema" → "financial system hack glitch" (NOT "insect in the system").
// "médicos escondendo" → "serious doctor authority figure" (NOT "hiding doctors").
type IntentResult = { emotion: string; searchQueries: string[]; suggestedSfx: string | null };
const SEMANTIC_RULES: Array<{ test: (t: string) => boolean; result: IntentResult }> = [
  {
    test: t => /bug|falha|brecha|exploit/.test(t) && /financ|sistema|banco|dinheiro/.test(t),
    result: { emotion:"Revelação", suggestedSfx:"glitch",
      searchQueries:["financial system hack glitch","money disappearing digital","banking vulnerability exposed"] },
  },
  {
    test: t => /médic|medic|doutor|especialista/.test(t) && /proib|escond|ocult|impedir|pedir/.test(t),
    result: { emotion:"Urgência", suggestedSfx:"riser",
      searchQueries:["serious doctor authority figure","medical secret forbidden","pharmaceutical suppression"] },
  },
  {
    test: t => /destro|colapso|queda|crash|ruin/.test(t) && /mercado|bolsa|econom|financ/.test(t),
    result: { emotion:"Choque", suggestedSfx:"impact",
      searchQueries:["stock market crash red","financial collapse graph","economy destruction system"] },
  },
  {
    test: t => /informaç|informac|segredo|verdade|descobr/.test(t) && /escond|ocult|proib|sigiloso/.test(t),
    result: { emotion:"Mistério", suggestedSfx:"suspense_sting",
      searchQueries:["classified document vault","secret information hidden","whistleblower exposure reveal"] },
  },
  {
    test: t => /composto|natural|erva|planta|amazôn|amazôni|cristal|dissolv/.test(t),
    result: { emotion:"Esperança", suggestedSfx:"bell",
      searchQueries:["amazon rainforest dense green","natural compound herbal remedy","joint pain relief healing"] },
  },
  {
    test: t => /dor|articular|crise|sofr|problema|sintoma/.test(t),
    result: { emotion:"Dor", suggestedSfx:"heartbeat",
      searchQueries:["joint pain arthritis suffering","medical problem chronic","person holding knee pain"] },
  },
  {
    test: t => /bilh|acordo|judicial|indeniz|governo|lista/.test(t),
    result: { emotion:"Oportunidade", suggestedSfx:"cash_register",
      searchQueries:["legal document court settlement","government building authority","money cash opportunity found"] },
  },
  {
    test: t => /cassino|jogador|rodada|padrão|estratégi/.test(t),
    result: { emotion:"Vantagem", suggestedSfx:"bell",
      searchQueries:["casino gambling strategy","pattern recognition winning","exclusive insider advantage"] },
  },
  {
    test: t => /assista|clique|acesse|agora|grátis|gratuito|saiba|vídeo pode sair/.test(t),
    result: { emotion:"CTA", suggestedSfx:"riser",
      searchQueries:["watch video now urgent cta","person looking down phone surprised","urgency red alert warning"] },
  },
  {
    test: () => true,
    result: { emotion:"Gancho", suggestedSfx:null,
      searchQueries:["pattern interrupt shock visual","cinematic dramatic tension","proof evidence testimonial social"] },
  },
];
function classifyIntent(lower: string): IntentResult {
  for (const rule of SEMANTIC_RULES) if (rule.test(lower)) return rule.result;
  return SEMANTIC_RULES[SEMANTIC_RULES.length - 1].result;
}

// ─── analyzeCopyForDirectResponse ────────────────────────────────────────────
// Simulates an LLM Art Director call:
// "Slice this copy into 3-5s retention chunks. For each, identify the
//  emotional subtext and generate English Pexels search queries based on
//  VISUAL CONCEPT — not literal translation. Suggest a sound effect type."
function analyzeCopyForDirectResponse(copyText: string): DirectResponseScene[] {
  // VSL presenters speak ~2.2 words/sec with dramatic pauses between phrases.
  const WPS = 2.2, MIN_DUR = 3.5, MAX_DUR = 9.0;

  // 1. Split on sentence boundaries
  const raw = copyText.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

  // 2. Sub-split long sentences at clause connectors, clamp word count
  const chunks: string[] = [];
  for (const sent of raw) {
    const wc = sent.split(/\s+/).length;
    if (wc <= 13) { chunks.push(sent); continue; }
    const parts = sent.split(/(?<=\w)\s+(?=que |para |porque |enquanto |quando |como )/);
    if (parts.length > 1) { chunks.push(...parts.map(p => p.trim()).filter(Boolean)); continue; }
    const ws = sent.split(/\s+/);
    const h  = Math.ceil(ws.length / 2);
    chunks.push(ws.slice(0, h).join(" "), ws.slice(h).join(" "));
  }

  // 3. Merge chunks that are too short (< 6 words)
  const merged: string[] = [];
  let buf = "";
  for (const chunk of chunks) {
    if (!buf) { buf = chunk; continue; }
    if (buf.split(/\s+/).length < 6) { buf += " " + chunk; }
    else { merged.push(buf); buf = chunk; }
  }
  if (buf) merged.push(buf);

  // 4. Classify each chunk and build DirectResponseScene
  return merged.map((text, i) => {
    const wc = text.split(/\s+/).length;
    // Add dramatic pause at sentence boundaries (VSL pacing feels sluggish without it)
    const pause = /[.!?]$/.test(text.trim()) ? 0.6 : /[…,]$/.test(text.trim()) ? 0.3 : 0;
    const duration = Math.max(MIN_DUR, Math.min(MAX_DUR, wc / WPS + pause));
    const { emotion, searchQueries, suggestedSfx } = classifyIntent(text.toLowerCase());
    return { id:`drs-${i}`, textSnippet:text, duration, emotion, searchQueries, suggestedSfx };
  });
}

// ─── buildTimelineClipsFromDRS ────────────────────────────────────────────────
// ONE B-roll clip per DRS scene — covers ~65% of the scene duration.
// The remaining ~35% is an intentional GAP where only the Avatar/A-Roll shows.
// This creates the natural "breathe" rhythm of professional NLE editing:
//   [B-ROLL 3s] ──── [GAP 1.5s: avatar] ──── [B-ROLL 3s] ──── …
// Cursor advances by the FULL scene duration so subtitles/SFX stay in sync.
function buildTimelineClipsFromDRS(drScenes: DirectResponseScene[]): TimelineClip[] {
  const clips: TimelineClip[] = [];
  let cursor = 0;
  for (let i = 0; i < drScenes.length; i++) {
    const drs   = drScenes[i];
    const col   = CLIP_COLS[i % CLIP_COLS.length];
    const query = drs.searchQueries[0] ?? "";

    const url   = drs.videoUrl ?? null;
    const thumb = drs.thumbUrl ?? lookupConcept(query);

    const shortLabel = drs.textSnippet.split(" ").slice(0, 4).join(" ")
      + (drs.textSnippet.split(" ").length > 4 ? "…" : "");

    // B-roll covers 60–70% of the scene — alternating rhythm feels organic
    const brollRatio = i % 2 === 0 ? 0.65 : 0.60;
    const brollDur   = Math.max(1.5, drs.duration * brollRatio);

    clips.push({
      id:          `drs${i}`,
      sceneIdx:    i,
      url,
      thumb:       thumb || lookupConcept(query),
      triggerWord: query,
      startSec:    cursor,
      durSec:      brollDur,          // ← only covers part of the scene
      label:       `${drs.emotion} · ${shortLabel}`,
      color:       col,
    });
    cursor += drs.duration;           // ← full duration — gap = drs.duration - brollDur
  }
  return clips;
}

// ─── buildSubtitleWordsFromDRS ────────────────────────────────────────────────
function buildSubtitleWordsFromDRS(drScenes: DirectResponseScene[]): SubtitleWord[] {
  const out: SubtitleWord[] = [];
  let cursor = 0;
  for (const drs of drScenes) {
    const raw = drs.textSnippet.trim().split(/\s+/).filter(Boolean);
    if (!raw.length) { cursor += drs.duration; continue; }
    const perWord = drs.duration / raw.length;
    raw.forEach((w, wi) => {
      const clean = w.toLowerCase().replace(/[^a-záéíóúãõçêâîôû]/g, "");
      out.push({
        word:      w,
        startSec:  cursor + wi * perWord,
        endSec:    cursor + (wi + 1) * perWord,
        isKeyword: !!BROLL_IMAGES[clean] || POWER_WORDS.has(clean),
        cleanWord: clean,
      });
    });
    cursor += drs.duration;
  }
  return out;
}

function generateSRT(scenes: Scene[]): string {
  let srt = ""; let idx = 1; let elapsed = 0;
  for (const sc of scenes) {
    const dur = sc.estimated_duration_seconds ?? 5;
    const start = fmtTime(elapsed).replace(":",",") + ",000";
    const end   = fmtTime(elapsed + dur).replace(":",",") + ",000";
    const words = (sc.text_chunk ?? sc.segment ?? "").trim();
    if (words) { srt += `${idx}\n00:${start} --> 00:${end}\n${words}\n\n`; idx++; }
    elapsed += dur;
  }
  return srt;
}

// ─── UploadModal ──────────────────────────────────────────────────────────────
function UploadModal({ onClose }: { onClose: () => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)"}}
      onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden"
        style={{background:"#111",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 40px 100px rgba(0,0,0,0.7)"}}
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{borderColor:"rgba(255,255,255,0.07)"}}>
          <div>
            <h2 className="text-lg font-black text-white" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1.5px"}}>Faça upload dos seus ativos</h2>
            <p className="text-xs text-gray-400 mt-0.5">Locução, takes brutos de vídeo ou trilha</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-600 hover:text-gray-300 hover:bg-white/6 transition-colors"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6">
          <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);}}
            className="flex flex-col items-center justify-center py-14 rounded-2xl border-2 border-dashed transition-all cursor-pointer"
            style={{borderColor:dragging?"rgba(232,89,60,0.7)":"rgba(255,255,255,0.12)",background:dragging?"rgba(232,89,60,0.06)":"rgba(255,255,255,0.02)"}}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all"
              style={{background:dragging?"rgba(232,89,60,0.2)":"rgba(255,255,255,0.05)",border:dragging?"1px solid rgba(232,89,60,0.4)":"1px solid rgba(255,255,255,0.08)",boxShadow:dragging?"0 0 30px rgba(232,89,60,0.3)":"none"}}>
              <CloudUpload className={`w-8 h-8 transition-colors ${dragging?"text-orange-400":"text-gray-500"}`}/>
            </div>
            <p className="text-sm font-semibold text-gray-300 mb-1">Arraste seus arquivos aqui</p>
            <p className="text-xs text-gray-500 text-center max-w-xs leading-relaxed">Suporta <span className="text-gray-400">.mp3 .wav</span> e takes de vídeo <span className="text-gray-400">.mp4 .mov</span></p>
          </div>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{background:"rgba(255,255,255,0.06)"}}/>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">ou</span>
            <div className="flex-1 h-px" style={{background:"rgba(255,255,255,0.06)"}}/>
          </div>
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-gray-300 border transition-all hover:bg-white/6" style={{borderColor:"rgba(255,255,255,0.1)"}}>
            <Upload className="w-4 h-4"/>Procurar arquivos
          </button>
        </div>
        <div className="px-6 pb-5 flex items-center gap-2 flex-wrap">
          {[".mp3",".wav",".mp4",".mov",".mkv"].map(f=>(
            <span key={f} className="text-[9px] font-bold px-2 py-0.5 rounded text-gray-500" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GeneratingView ───────────────────────────────────────────────────────────
function GeneratingView() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fade,   setFade]   = useState(true);
  useEffect(()=>{
    const iv = setInterval(()=>{
      setFade(false);
      setTimeout(()=>{ setMsgIdx(i=>(i+1)%LOADING_MSGS.length); setFade(true); },250);
    },1100);
    return ()=>clearInterval(iv);
  },[]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{background:"radial-gradient(circle,rgba(232,89,60,0.6),transparent)",animationDuration:"1.4s"}}/>
        <div className="absolute inset-2 rounded-full animate-spin" style={{border:"2px solid transparent",borderTopColor:"rgba(232,89,60,0.8)",borderRightColor:"rgba(232,89,60,0.3)",animationDuration:"1s"}}/>
        <div className="absolute inset-5 rounded-full animate-spin" style={{border:"2px solid transparent",borderBottomColor:"rgba(232,89,60,0.9)",borderLeftColor:"rgba(232,89,60,0.3)",animationDuration:"1.8s",animationDirection:"reverse"}}/>
        <Brain className="w-8 h-8 text-orange-400" style={{filter:"drop-shadow(0 0 8px rgba(232,89,60,0.8))"}}/>
      </div>
      <div className="text-center space-y-2">
        <p className={`text-base font-semibold text-white transition-all duration-300 ${fade?"opacity-100 translate-y-0":"opacity-0 translate-y-1"}`} style={{letterSpacing:"-0.01em"}}>{LOADING_MSGS[msgIdx]}</p>
        <p className="text-xs text-gray-500">GPT-4o · Pexels HD · Freesound · Cofre Kraft</p>
      </div>
      <div className="w-48 h-0.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
        <div className="h-full rounded-full animate-pulse" style={{background:"linear-gradient(90deg,#E8593C,#E8593C,#E8593C)",width:"70%"}}/>
      </div>
    </div>
  );
}

// ─── HomeRightPanel — Hooks Virais (grid TikTok, só vídeos) ──────────────────
function HomeRightPanel({ activeTag, setActiveTag }: {
  activeTag: string; setActiveTag:(t:string)=>void;
  onRaioX:(ad:WinningAd)=>void; // mantido na assinatura para compatibilidade
}) {
  const cards = activeTag==="All" ? GALLERY_CARDS : GALLERY_CARDS.filter(c=>c.tag===activeTag);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{background:"#0a0a0a"}}>

      {/* ── Header + filtros ── */}
      <div className="shrink-0 px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{background:"rgba(232,89,60,0.1)",border:"1px solid rgba(232,89,60,0.25)"}}>
              <Film className="w-3 h-3 text-orange-400"/>
              <span className="text-[13px] font-black uppercase tracking-wide" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2px",color:"#FF7A5C"}}>Hooks Virais</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                style={{background:"rgba(232,89,60,0.15)",color:"#FF7A5C",border:"1px solid rgba(232,89,60,0.25)"}}>
                {GALLERY_CARDS.length} clips
              </span>
            </div>
          </div>
          <span className="text-[9px] text-gray-500 italic">autoplay · loop · muted</span>
        </div>

        {/* Tag filters */}
        <div className="flex items-center gap-1.5 pb-3 overflow-x-auto" style={{scrollbarWidth:"none"}}>
          {GALLERY_TAGS.map(tag=>(
            <button key={tag} onClick={()=>setActiveTag(tag)}
              className="shrink-0 px-3 py-1 rounded-full text-[9px] font-black transition-all"
              style={{
                background:activeTag===tag?"rgba(232,89,60,0.18)":"rgba(255,255,255,0.04)",
                border:`1px solid ${activeTag===tag?"rgba(232,89,60,0.5)":"rgba(255,255,255,0.07)"}`,
                color:activeTag===tag?"#FF7A5C":"#4b5563",
                boxShadow:activeTag===tag?"0 0 14px rgba(232,89,60,0.2)":"none",
              }}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de vídeos virais — 3 colunas, masonry por tall ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-4"
        style={{scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.06) transparent"}}>
        <div style={{columnCount:3,columnGap:"8px"}}>
          {cards.map(card=>(
            <div key={card.id} className="break-inside-avoid mb-2 group relative rounded-xl overflow-hidden cursor-pointer"
              style={{border:"1px solid rgba(255,255,255,0.07)",background:"#0e0e0e"}}>

              {/* Vídeo viral rodando — fallback para img se o src bloquear */}
              <video
                src={card.videoUrl}
                autoPlay loop muted playsInline
                className="w-full h-56 object-cover rounded-t-lg"
                style={{aspectRatio:card.tall?"9/13":"4/3",display:"block",filter:"brightness(0.82) saturate(1.15)"}}
                onError={e=>{
                  const v = e.currentTarget;
                  const img = document.createElement("img");
                  img.src = card.src;
                  img.className = v.className;
                  img.style.cssText = v.style.cssText;
                  v.parentNode?.replaceChild(img, v);
                }}
              />

              {/* Gradiente overlay */}
              <div className="absolute inset-0 rounded-xl pointer-events-none"
                style={{background:"linear-gradient(to bottom,rgba(0,0,0,0.25) 0%,transparent 40%,rgba(0,0,0,0.88) 100%)"}}/>

              {/* Tag badge — topo esquerdo */}
              <div className="absolute top-2 left-2">
                <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full"
                  style={{background:"rgba(232,89,60,0.25)",color:"#FF7A5C",border:"1px solid rgba(232,89,60,0.4)",backdropFilter:"blur(6px)"}}>
                  {card.tag}
                </span>
              </div>

              {/* Indicador live — topo direito */}
              <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",border:"1px solid rgba(52,211,153,0.35)"}}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                <span className="text-[7px] font-black text-emerald-400">LIVE</span>
              </div>

              {/* Título embaixo */}
              <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 pt-5">
                <p className="text-[9px] font-black text-white leading-snug"
                  style={{textShadow:"0 1px 6px rgba(0,0,0,0.9)",letterSpacing:"-0.01em"}}>
                  {card.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PaywallModal ─────────────────────────────────────────────────────────────
function PaywallModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.85)",backdropFilter:"blur(14px)"}} onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-2xl p-7 text-center" style={{background:"#0e0e0e",border:"1px solid rgba(232,89,60,0.35)",boxShadow:"0 0 80px rgba(232,89,60,0.2)"}} onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors"><X className="w-4 h-4"/></button>
        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{background:"radial-gradient(ellipse at 50% 0%,rgba(232,89,60,0.2) 0%,transparent 65%)"}}/>
        <div className="relative z-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{background:"rgba(232,89,60,0.15)",border:"1px solid rgba(232,89,60,0.3)"}}>
            <Lock className="w-6 h-6" style={{color:"#E8593C"}}/>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{color:"#E8593C"}}>Recurso PRO</p>
          <h3 className="text-2xl font-black text-white mb-2" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1.5px"}}>Desbloqueie o poder total</h3>
          <p className="text-xs text-gray-500 leading-relaxed mb-5">Exporte e baixe suas mídias com qualidade máxima, sem marca d'água.</p>
          <ul className="space-y-2 mb-6 text-left">
            {["Exportar XML para Premiere","Download de mídias HD","Acervo Kraft Premium","Projetos ilimitados"].map(f=>(
              <li key={f} className="flex items-center gap-2.5 text-xs text-gray-400"><Check className="w-3.5 h-3.5 shrink-0" style={{color:"#E8593C"}}/>{f}</li>
            ))}
          </ul>
          <button onClick={()=>router.push("/pricing")} className="w-full py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2" style={{background:"linear-gradient(135deg,#E8593C,#E8593C)",boxShadow:"0 8px 28px rgba(232,89,60,0.45)"}}>
            <Zap className="w-4 h-4 text-yellow-300"/>⚡ Desbloquear Recursos PRO
          </button>
          <p className="text-[10px] text-gray-500 mt-2.5">Cancele quando quiser · Sem fidelidade</p>
        </div>
      </div>
    </div>
  );
}


// ─── Winning Ads Library — Mock Data ─────────────────────────────────────────
interface WinningAd {
  id: string; title: string; niche: string; daysActive: string;
  thumbnailUrl: string; videoUrl?: string | null;
  hookText: string; views: string; spend: string;
}
const WINNING_ADS: WinningAd[] = [
  {
    id:"w1", title:"VSL – Planilha do Governo",       niche:"Renda Extra",
    daysActive:"Rodando há 67 dias",
    thumbnailUrl:"https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=600",
    videoUrl:"https://player.vimeo.com/external/541258672.sd.mp4?s=4b6c318534ac06b6f0012584d4b1f486663f94e9&profile_id=165",
    views:"2.1M views", spend:"~R$45k investido",
    hookText:"Você sabia que existem planilhas do governo que pagam até R$1.200 por mês sem fazer nada?",
  },
  {
    id:"w2", title:"VSL – Composto Articular 21 Dias", niche:"Saúde",
    daysActive:"Rodando há 112 dias",
    thumbnailUrl:"https://images.pexels.com/photos/7176026/pexels-photo-7176026.jpeg?auto=compress&w=600",
    videoUrl:"https://player.vimeo.com/external/391104990.sd.mp4?s=5517f699f579d98416d86a60a7470659a888a75e&profile_id=165",
    views:"5.8M views", spend:"~R$130k investido",
    hookText:"Médicos odeiam esse truque: composto natural elimina dor articular em 21 dias, sem cirurgia.",
  },
  {
    id:"w3", title:"VSL – Método Slot Secreto",        niche:"iGaming",
    daysActive:"Rodando há 33 dias",
    thumbnailUrl:"https://images.pexels.com/photos/2263436/pexels-photo-2263436.jpeg?auto=compress&w=600",
    videoUrl:"https://player.vimeo.com/external/494285880.sd.mp4?s=7b6c3f6f96216a652e75e92534570077c5e53c40&profile_id=165",
    views:"890k views", spend:"~R$22k investido",
    hookText:"Esse padrão nos slots que os cassinos tentam esconder deu +R$3.200 em apenas 48 horas.",
  },
  {
    id:"w4", title:"VSL – Licença Master PLR",          niche:"PLR",
    daysActive:"Rodando há 89 dias",
    thumbnailUrl:"https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&w=600",
    videoUrl:"https://player.vimeo.com/external/541258672.sd.mp4?s=4b6c318534ac06b6f0012584d4b1f486663f94e9&profile_id=165",
    views:"3.4M views", spend:"~R$78k investido",
    hookText:"Como eu ganho R$8.000 por mês revendendo produtos digitais que eu nunca criei.",
  },
  {
    id:"w5", title:"VSL – Glicemia Controle Total",     niche:"Saúde",
    daysActive:"Rodando há 156 dias",
    thumbnailUrl:"https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&w=600",
    videoUrl:"https://player.vimeo.com/external/391104990.sd.mp4?s=5517f699f579d98416d86a60a7470659a888a75e&profile_id=165",
    views:"12.3M views", spend:"~R$290k investido",
    hookText:"Este fruto amazônico normaliza a glicemia em 14 dias. Farmácias tentam censurar.",
  },
  {
    id:"w6", title:"VSL – Indenização Trabalhista",     niche:"Renda Extra",
    daysActive:"Rodando há 44 dias",
    thumbnailUrl:"https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&w=600",
    videoUrl:"https://player.vimeo.com/external/494285880.sd.mp4?s=7b6c3f6f96216a652e75e92534570077c5e53c40&profile_id=165",
    views:"1.9M views", spend:"~R$51k investido",
    hookText:"47 bilhões em indenizações esquecidas pelo governo. Seu CPF pode estar na lista — confira grátis.",
  },
];
const AD_NICHES  = ["Todos","Renda Extra","Saúde","iGaming","PLR"];
const AD_COLORS: Record<string,string> = {
  "Renda Extra":"#fbbf24","Saúde":"#34d399","iGaming":"#FF7A5C","PLR":"#B8B5AF",
};

// ─── WinningAdsDrawer ─────────────────────────────────────────────────────────
function WinningAdsDrawer({ open, onClose, onRaioX }:{
  open:boolean; onClose:()=>void; onRaioX:(ad:WinningAd)=>void;
}) {
  const [niche, setNiche] = useState("Todos");
  const filtered = niche==="Todos" ? WINNING_ADS : WINNING_ADS.filter(a=>a.niche===niche);

  return(
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background:"rgba(0,0,0,0.55)",
          backdropFilter:"blur(5px)",
          opacity:open?1:0,
          pointerEvents:open?"auto":"none",
        }}/>

      {/* Sliding panel */}
      <div className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width:"420px",
          background:"#0e0e0e",
          borderLeft:"1px solid rgba(255,255,255,0.07)",
          boxShadow:"-32px 0 80px rgba(0,0,0,0.75)",
          transform:open?"translateX(0)":"translateX(100%)",
          transition:"transform 0.34s cubic-bezier(0.22,1,0.36,1)",
        }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b"
          style={{borderColor:"rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.02)"}}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Flame className="w-4 h-4 text-orange-400" style={{filter:"drop-shadow(0 0 6px rgba(251,146,60,0.6))"}}/>
              <span className="text-[16px] font-black text-white" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1.5px"}}>
                Biblioteca de Vencedores
              </span>
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                style={{background:"rgba(251,191,36,0.12)",color:"#fbbf24",border:"1px solid rgba(251,191,36,0.25)"}}>
                SWIPE FILE
              </span>
            </div>
            <p className="text-[9px] text-gray-400 flex items-center gap-1">
              <TrendingUp className="w-2.5 h-2.5"/>
              {WINNING_ADS.length} anúncios vencedores · Alta performance confirmada
            </p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-100 hover:bg-white/6 transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* ── Niche filters ── */}
        <div className="flex items-center gap-1.5 px-4 py-3 shrink-0 border-b overflow-x-auto"
          style={{borderColor:"rgba(255,255,255,0.05)"}}>
          {AD_NICHES.map(n=>{
            const isAct = niche===n;
            const col   = AD_COLORS[n]??"#9ca3af";
            return(
              <button key={n} onClick={()=>setNiche(n)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
                style={{
                  background:isAct?`${col}20`:"rgba(255,255,255,0.04)",
                  border:`1px solid ${isAct?`${col}55`:"rgba(255,255,255,0.07)"}`,
                  color:isAct?col:"#6b7280",
                  boxShadow:isAct?`0 0 14px ${col}25`:"none",
                }}>
                {n==="Todos"?"🌐":n==="Saúde"?"🏥":n==="Renda Extra"?"💰":n==="iGaming"?"🎰":"📦"} {n}
              </button>
            );
          })}
        </div>

        {/* ── Count ── */}
        <div className="px-5 pt-2.5 pb-1 shrink-0">
          <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">
            {filtered.length} anúncio{filtered.length!==1?"s":""} · clique em 🧬 para extrair a estrutura
          </p>
        </div>

        {/* ── Cards ── */}
        <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-4"
          style={{scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.08) transparent"}}>
          {filtered.map(ad=>{
            const col = AD_COLORS[ad.niche]??"#9ca3af";
            return(
              <div key={ad.id} className="rounded-2xl overflow-hidden group/card"
                style={{
                  background:"#111111",
                  border:"1px solid rgba(255,255,255,0.07)",
                  boxShadow:"0 6px 28px rgba(0,0,0,0.45)",
                  transition:"border-color 0.2s",
                }}>

                {/* Thumbnail — 9:16 crop, max 240px tall */}
                <div className="relative overflow-hidden" style={{aspectRatio:"9/16",maxHeight:"240px"}}>
                  {ad.videoUrl
                    ? <video src={ad.videoUrl} autoPlay loop muted playsInline
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                        style={{filter:"brightness(0.8) saturate(1.2)"}}/>
                    : <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ad.thumbnailUrl} alt={ad.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                          style={{filter:"brightness(0.72) saturate(1.15)"}}
                          loading="lazy"/>
                      </>
                  }
                  {/* Gradient */}
                  <div className="absolute inset-0"
                    style={{background:"linear-gradient(to top,rgba(0,0,0,0.93) 0%,rgba(0,0,0,0.25) 55%,transparent 100%)"}}/>
                  {/* Niche badge */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full"
                      style={{background:`${col}25`,color:col,border:`1px solid ${col}40`}}>
                      {ad.niche}
                    </span>
                  </div>
                  {/* Days active */}
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{background:"rgba(0,0,0,0.75)",color:"#34d399",border:"1px solid rgba(52,211,153,0.3)"}}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"/>
                      {ad.daysActive}
                    </span>
                  </div>
                  {/* Play circle */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{background:"rgba(255,255,255,0.14)",border:"1.5px solid rgba(255,255,255,0.3)",backdropFilter:"blur(6px)"}}>
                      <Play className="w-4 h-4 text-white ml-0.5" fill="white"/>
                    </div>
                  </div>
                  {/* Stats row */}
                  <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-white/75 flex items-center gap-1">
                      <Eye className="w-2.5 h-2.5"/>{ad.views}
                    </span>
                    <span className="text-[9px] font-bold" style={{color:"#fbbf24"}}>
                      💰 {ad.spend}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-3.5">
                  {/* Title */}
                  <p className="text-[12px] font-black text-white mb-2" style={{letterSpacing:"-0.01em"}}>
                    {ad.title}
                  </p>
                  {/* Hook text */}
                  <div className="rounded-xl px-3 py-2.5 mb-3"
                    style={{background:"rgba(255,255,255,0.035)",border:"1px solid rgba(255,255,255,0.06)"}}>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5 text-yellow-500"/> Hook dos 3 primeiros segundos
                    </p>
                    <p className="text-[11px] text-gray-300 leading-relaxed" style={{fontStyle:"italic"}}>
                      "{ad.hookText}"
                    </p>
                  </div>
                  {/* Raio-X button */}
                  <button onClick={()=>onRaioX(ad)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black transition-all hover:brightness-125 active:scale-95"
                    style={{
                      background:"linear-gradient(135deg,rgba(232,89,60,0.22),rgba(232,89,60,0.14))",
                      border:"1px solid rgba(232,89,60,0.45)",
                      color:"#FF7A5C",
                      boxShadow:"0 0 24px rgba(232,89,60,0.14)",
                    }}>
                    <span className="text-sm">🧬</span>
                    <span>Extrair Raio-X (Estrutura)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── WorkstationView ──────────────────────────────────────────────────────────
interface WhisperWord { word: string; start: number; end: number; }

function WorkstationView({ result, copy: initialCopy, drScenes: initialDrScenes, initialBgMusicUrl, videoFile, whisperWords: rawWhisperWords, initialTtsUrl, initialAvatarUrl, onBack }: {
  result: GenerateResponse;
  copy: string;
  drScenes: DirectResponseScene[];
  initialBgMusicUrl?: string;
  videoFile?: File | null;
  whisperWords?: WhisperWord[];
  initialTtsUrl?: string | null;
  initialAvatarUrl?: string | null;
  onBack: () => void;
}) {
  // ── Refs ──
  const videoRef         = useRef<HTMLVideoElement>(null);   // B-roll overlay
  const avatarVideoRef   = useRef<HTMLVideoElement>(null);   // UGC / avatar base layer
  const bgAudioRef       = useRef<HTMLAudioElement>(null);   // background suspense track
  const timelineRef      = useRef<HTMLDivElement>(null);     // canvas (fixed pixel width)
  const timelineScrollRef= useRef<HTMLDivElement>(null);     // scrollable outer wrapper
  const musicRefs   = [useRef<HTMLAudioElement>(null), useRef<HTMLAudioElement>(null), useRef<HTMLAudioElement>(null)];
  const rafRef        = useRef<number>(0);
  const globalTimeRef = useRef(0);
  const lastTsRef     = useRef(0);
  const playingRef    = useRef(false);
  const seekOnLoadRef = useRef<number | null>(null);
  const prevClipId    = useRef("");

  // ── State ──
  // localDrScenes is the SOURCE OF TRUTH for timeline layout, durations, and subtitles.
  // localScenes (legacy) is kept for B-Roll media management (video_options, suggestAnother).
  const [localDrScenes,  setLocalDrScenes]  = useState<DirectResponseScene[]>(()=>initialDrScenes.length?initialDrScenes:[]);
  const [localScenes,    setLocalScenes]    = useState<Scene[]>(()=>result.scenes??[]);
  const [loadingClipIds, setLoadingClipIds] = useState<Set<string>>(new Set());
  const [playing,        setPlaying]        = useState(false);
  const [currentTime,    setCurrentTime]    = useState(0);
  const [playheadPct,    setPlayheadPct]    = useState(0);
  const [isDragging,     setIsDragging]     = useState(false);
  const [selectedMusic,  setSelectedMusic]  = useState(0);
  const [playingMusic,   setPlayingMusic]   = useState<number|null>(null);
  const [exportOpen,     setExportOpen]     = useState(false);
  const [paywallOpen,    setPaywallOpen]    = useState(false);
  const [editCopy,       setEditCopy]       = useState(initialCopy);
  const [dragSrcUrl,     setDragSrcUrl]     = useState<string|null>(null);
  const [hoveredAltKey,  setHoveredAltKey]  = useState<string|null>(null); // key = scene+idx for alt hover preview
  const [dragOverClipId, setDragOverClipId] = useState<string|null>(null);
  const [bgVolume,       setBgVolume]       = useState(videoFile ? 0.08 : 0.35);
  const [showAdLib,      setShowAdLib]      = useState(false);
  const [toast,          setToast]          = useState<string|null>(null);
  const [voiceEnabled,   setVoiceEnabled]   = useState(false);
  const voiceEnabledRef  = useRef(false);
  const prevVoiceScene   = useRef(-1);
  const [bgMusicUrl,     setBgMusicUrl]     = useState(
    initialBgMusicUrl ??
    "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3"
  );
  // ── Track visibility / mute / volume controls (NLE-style) ──────────────
  const [trackBrollVisible, setTrackBrollVisible] = useState(true);
  const [trackAVVisible,    setTrackAVVisible]    = useState(true);
  const [trackAVMuted,      setTrackAVMuted]      = useState(false);
  const [trackSfxMuted,     setTrackSfxMuted]     = useState(false);
  const [trackA1Muted,      setTrackA1Muted]      = useState(false);
  const [avatarVolume,      setAvatarVolume]      = useState(1.0);
  // ── Timeline zoom ─────────────────────────────────────────────────────
  const [timelineZoom,      setTimelineZoom]      = useState(1);
  // ── Clip drag-to-reorder (within V2 track) ───────────────────────────
  const [dragClipSceneIdx,  setDragClipSceneIdx]  = useState<number|null>(null);
  // ── Clip overrides: free-drag position/duration on timeline ──────────
  const [clipOverrides, setClipOverrides] = useState<Record<string,{startSec:number;durSec:number}>>({});
  // ── Clip transforms: scale/x/y for preview (CapCut-style) ────────────
  const [clipTransforms, setClipTransforms] = useState<Record<string,{scale:number;x:number;y:number}>>({});
  // ── Left panel tab: "roteiro" | "inspector" ──────────────────────────
  const [leftTab, setLeftTab] = useState<"roteiro"|"inspector">("roteiro");
  // ── Selected layer: "avatar" | "subtitle" | clipId | null ────────────
  const [selectedLayer, setSelectedLayer] = useState<string|null>(null);
  // ── Per-layer transforms ──────────────────────────────────────────────
  const [avatarTransform, setAvatarTransform] = useState({scale:100,x:0,y:0});
  // ── Clip drag state ───────────────────────────────────────────────────
  const [clipDrag, setClipDrag] = useState<{
    clipId:string; mode:"move"|"trim-left"|"trim-right";
    startX:number; origStartSec:number; origDurSec:number;
  }|null>(null);
  // ── Subtitle style config ─────────────────────────────────────────────
  const [subtitleConfig, setSubtitleConfig] = useState<{
    style:"bold"|"minimal"|"neon"|"shadow";
    position:"bottom"|"center"|"top";
    fontSize:number;
  }>({style:"bold",position:"bottom",fontSize:100});
  // ── SFX marker offsets + drag ─────────────────────────────────────────
  const [sfxOffsets, setSfxOffsets] = useState<Record<string,number>>({});
  const [sfxDrag, setSfxDrag] = useState<{id:string;startX:number;origOffset:number}|null>(null);
  // ── Preview direct drag (CapCut-style: drag layer in player) ─────────
  const [previewDrag, setPreviewDrag] = useState<{
    startX:number; startY:number;
    origX:number;  origY:number;
  }|null>(null);
  const previewDraggedRef = useRef(false); // true if mouse actually moved during drag
  const previewRef = useRef<HTMLDivElement>(null);
  const [videoAspect,       setVideoAspect]       = useState<"landscape"|"portrait">("landscape");
  const [videoErrors,       setVideoErrors]       = useState<Record<string,boolean>>({});
  // ── Uploaded UGC Avatar video object URL ─────────────────────────────────
  const [uploadedVideoUrl,  setUploadedVideoUrl]  = useState<string|null>(null);
  // ── TTS synthetic voice ───────────────────────────────────────────────────
  const [ttsAudioUrl,       setTtsAudioUrl]       = useState<string|null>(initialTtsUrl ?? null);
  const [ttsLoading,        setTtsLoading]        = useState(false);
  const [ttsError,          setTtsError]          = useState<string|null>(null);
  const [ttsVoice,          setTtsVoice]          = useState("English_expressive_narrator");
  const [ttsSpeed,          setTtsSpeed]          = useState(1.0);
  const [previewUrl,        setPreviewUrl]        = useState<string|null>(null);
  const [previewLoading,    setPreviewLoading]    = useState(false);
  const [previewError,      setPreviewError]      = useState<string|null>(null);
  const ttsAudioRef    = useRef<HTMLAudioElement>(null);
  const ttsAudioUrlRef = useRef<string|null>(null); // ref copy so callbacks don't need ttsAudioUrl in deps
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  const tracks   = result.background_tracks ?? [];

  // ── Create object URL from uploaded videoFile ─────────────────────────────
  useEffect(()=>{
    if(!videoFile) return;
    const url = URL.createObjectURL(videoFile);
    setUploadedVideoUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[videoFile]);

  // ── Load avatar from pending URL (DreamAct / LipSync result) ─────────────
  useEffect(()=>{
    if(initialAvatarUrl) setUploadedVideoUrl(initialAvatarUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ── Sync avatarVideoRef muted + volume state ─────────────────────────────
  useEffect(()=>{
    if(!avatarVideoRef.current) return;
    avatarVideoRef.current.muted  = trackAVMuted;
    avatarVideoRef.current.volume = avatarVolume;
  },[trackAVMuted, avatarVolume]);

  // ── TTS: sync audio with player ──────────────────────────────────────────
  useEffect(()=>{
    const a = ttsAudioRef.current;
    if(!a || !ttsAudioUrl) return;
    a.src = ttsAudioUrl;
    ttsAudioUrlRef.current = ttsAudioUrl;
  },[ttsAudioUrl]);

  useEffect(()=>{
    const a = ttsAudioRef.current;
    if(!a || !ttsAudioUrl) return;
    if(playing){
      // Sync TTS position to current playhead BEFORE playing (prevents desync after seek)
      if(isFinite(a.duration) && a.duration > 0)
        a.currentTime = Math.min(globalTimeRef.current, a.duration);
      a.play().catch(()=>null);
    } else {
      a.pause();
    }
  },[playing, ttsAudioUrl]);

  useEffect(()=>{
    const a = ttsAudioRef.current;
    if(!a || !ttsAudioUrl) return;
    a.muted = trackA1Muted;
  },[trackA1Muted, ttsAudioUrl]);

  // ── TTS: preview voice ────────────────────────────────────────────────────
  const handlePreviewVoice = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "This is a voice preview sample. How does this sound?",
          voiceId: ttsVoice,
          speed: 1.0
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(()=>({error:"Erro desconhecido"}));
        throw new Error(d.error ?? "Erro ao gerar preview");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      if (previewAudioRef.current) {
        previewAudioRef.current.src = url;
        previewAudioRef.current.play().catch(()=>{});
      }
    } catch(e: unknown) {
      setPreviewError(e instanceof Error ? e.message : "Erro ao gerar preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [ttsVoice]);

  // ── TTS: generate voice ───────────────────────────────────────────────────
  const handleGenerateTTS = useCallback(async (text: string) => {
    setTtsLoading(true);
    setTtsError(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: ttsVoice, speed: ttsSpeed }),
      });
      if (!res.ok) {
        const d = await res.json().catch(()=>({error:"Erro desconhecido"}));
        throw new Error(d.error ?? "Erro ao gerar voz");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      // Revoke old URL
      setTtsAudioUrl(prev => { if(prev) URL.revokeObjectURL(prev); return url; });
    } catch(e: unknown) {
      setTtsError(e instanceof Error ? e.message : "Erro ao gerar voz");
    } finally {
      setTtsLoading(false);
    }
  },[ttsVoice, ttsSpeed]);

  // ── Real video duration (from avatar video) overrides DRS estimates ────────
  const [realVideoDur, setRealVideoDur] = useState<number|null>(null);

  const drsDur = useMemo(()=>
    Math.max(
      localDrScenes.length
        ? localDrScenes.reduce((s, drs) => s + drs.duration, 0)
        : localScenes.reduce((s,sc)=>s+(sc.estimated_duration_seconds??5),0),
      1),
    [localDrScenes, localScenes]
  );

  // When a real UGC video is uploaded, its duration is the source of truth
  const totalDur = (uploadedVideoUrl && realVideoDur && realVideoDur > 0)
    ? realVideoDur
    : drsDur;

  // ── Timeline auto-scroll — keeps playhead ~30% from left edge ────────────
  const lastAutoScrollSec = useRef(-999);
  useEffect(()=>{
    if(!playing||!timelineScrollRef.current) return;
    if(Math.abs(currentTime - lastAutoScrollSec.current) < 1.5) return;
    lastAutoScrollSec.current = currentTime;
    const el = timelineScrollRef.current;
    const canvasW = el.scrollWidth;
    const pct = currentTime / Math.max(totalDur, 1);
    const targetLeft = Math.max(0, pct * canvasW - el.clientWidth * 0.3);
    el.scrollTo({ left: targetLeft, behavior: "smooth" });
  },[playing, currentTime, totalDur]);

  // ── DRS-powered timeline — searchQueries drive clips, not PT-BR keywords ──
  const timelineClips = useMemo(()=>
    localDrScenes.length
      ? buildTimelineClipsFromDRS(localDrScenes)
      : buildTimelineClips(localScenes),
    [localDrScenes, localScenes]
  );

  // Apply user overrides (drag/trim) on top of computed positions
  const effectiveClips = useMemo(()=>
    timelineClips.map(c=>{
      const ov=clipOverrides[c.id];
      return ov ? {...c,startSec:ov.startSec,durSec:ov.durSec} : c;
    }),
    [timelineClips,clipOverrides]
  );

  // Clip currently under the playhead — null during gaps (no B-roll)
  const currentClip = useMemo(()=>
    effectiveClips.find(c=>currentTime>=c.startSec&&currentTime<c.startSec+c.durSec)??null,
    [effectiveClips,currentTime]
  );

  // Active scene index: which DRS/legacy scene contains the current time
  const activeScene = useMemo(()=>{
    if(currentClip) return currentClip.sceneIdx;
    // During a gap: find the scene whose time window contains currentTime
    const src = localDrScenes.length ? localDrScenes : localScenes;
    let t = 0;
    for(let i=0; i<src.length; i++){
      const dur = localDrScenes.length
        ? (src[i] as DirectResponseScene).duration
        : (src[i] as Scene).estimated_duration_seconds??5;
      if(currentTime >= t && currentTime < t+dur) return i;
      t += dur;
    }
    return Math.max(0, src.length-1);
  },[currentClip, currentTime, localDrScenes, localScenes]);

  const videoUrl    = currentClip?.url??"";

  // Cumulative scene starts — driven by DRS durations when available
  const sceneStarts = useMemo(()=>{
    const s:number[]=[];let a=0;
    const src = localDrScenes.length ? localDrScenes : localScenes;
    for(const sc of src){
      s.push(a);
      a += localDrScenes.length ? (sc as DirectResponseScene).duration : (sc as Scene).estimated_duration_seconds??5;
    }
    return s;
  },[localDrScenes, localScenes]);

  // ── RAF Tick — drives playhead ONLY when no real video (copy-only mode) ──
  // When uploadedVideoUrl exists, handleAvatarTimeUpdate is the sole clock.
  const tickRef = useRef<(ts:number)=>void>(()=>{});
  useEffect(()=>{
    tickRef.current=(ts:number)=>{
      if(!playingRef.current) return;
      // Skip RAF tick when real video drives the clock
      if(uploadedVideoUrl) { rafRef.current=requestAnimationFrame(tickRef.current); return; }
      if(lastTsRef.current===0) lastTsRef.current=ts;
      const delta=Math.min((ts-lastTsRef.current)/1000,0.1);
      lastTsRef.current=ts;
      const newT=Math.min(globalTimeRef.current+delta,totalDur);
      globalTimeRef.current=newT;
      setCurrentTime(newT);
      setPlayheadPct((newT/totalDur)*100);
      if(newT>=totalDur){setPlaying(false);return;}
      rafRef.current=requestAnimationFrame(tickRef.current);
    };
  },[totalDur,uploadedVideoUrl]);

  useEffect(()=>{playingRef.current=playing;},[playing]);

  useEffect(()=>{
    if(playing){lastTsRef.current=0;rafRef.current=requestAnimationFrame(tickRef.current);}
    else{cancelAnimationFrame(rafRef.current);lastTsRef.current=0;}
    return()=>cancelAnimationFrame(rafRef.current);
  },[playing]);

  // ── Auto-play video when clip changes ────────────────────────────────────
  useEffect(()=>{
    if(!currentClip||currentClip.id===prevClipId.current) return;
    prevClipId.current=currentClip.id;
    const local=globalTimeRef.current-currentClip.startSec;
    seekOnLoadRef.current=local>0.3?local:null;
    if(playingRef.current&&videoRef.current&&currentClip.url)
      videoRef.current.play().catch(()=>null);
  },[currentClip]);

  const handleLoadedMetadata=useCallback(()=>{
    if(seekOnLoadRef.current!==null&&videoRef.current){
      videoRef.current.currentTime=seekOnLoadRef.current;
      seekOnLoadRef.current=null;
    }
    if(playingRef.current&&videoRef.current)
      videoRef.current.play().catch(()=>null);
  },[]);

  // ── Avatar video onLoadedMetadata — detects aspect ratio ─────────────────
  const handleAvatarMetadata = useCallback(()=>{
    const v = avatarVideoRef.current;
    if(!v) return;
    setVideoAspect(v.videoHeight > v.videoWidth ? "portrait" : "landscape");
    if(isFinite(v.duration) && v.duration > 0) setRealVideoDur(v.duration);
  },[]);

  // ── Avatar video onTimeUpdate — AUTHORITATIVE clock when real video exists ─
  // This fires ~4x/sec from the <video> element's native time.
  // It is THE source of truth — the RAF tick is disabled when avatar is loaded.
  const handleAvatarTimeUpdate=useCallback(()=>{
    const v=avatarVideoRef.current;
    if(!v) return;
    const t=v.currentTime;
    const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : totalDur;
    if(t>=dur-0.1 && playingRef.current){ setPlaying(false); v.pause(); return; }
    globalTimeRef.current=t;
    setCurrentTime(t);
    setPlayheadPct((t/Math.max(dur,1))*100);
    // Drift correction: re-sync TTS if it drifts more than 500ms from real video
    const ttsEl = ttsAudioRef.current;
    if(ttsEl && ttsAudioUrlRef.current && playingRef.current && isFinite(ttsEl.duration) && ttsEl.duration > 0) {
      const drift = Math.abs(ttsEl.currentTime - t);
      if(drift > 0.5) ttsEl.currentTime = Math.min(t, ttsEl.duration);
    }
  },[totalDur]);

  // ── Background audio volume sync ─────────────────────────────────────────
  useEffect(()=>{
    if(bgAudioRef.current) bgAudioRef.current.volume=bgVolume;
  },[bgVolume]);

  // ── Voz de Apoio — Web Speech API (pt-BR nativo do browser) ─────────────
  // Keeps voiceEnabledRef in sync for use inside RAF/callbacks
  useEffect(()=>{ voiceEnabledRef.current=voiceEnabled; },[voiceEnabled]);

  // Cancels any ongoing speech safely
  const cancelVoice = useCallback(()=>{
    if(typeof window!=="undefined" && window.speechSynthesis)
      window.speechSynthesis.cancel();
  },[]);

  // Speaks a text snippet with pt-BR voice at VSL pacing (rate 0.88)
  const speakText = useCallback((text:string)=>{
    if(typeof window==="undefined"||!window.speechSynthesis) return;
    cancelVoice();
    if(!voiceEnabledRef.current) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang  = "pt-BR";
    utter.rate  = 0.88;   // slightly slower than natural — dramatic VSL feel
    utter.pitch = 1.0;
    // Prefer an explicit pt-BR voice if the browser has one
    const getVoice = ()=>{
      const all = window.speechSynthesis.getVoices();
      return all.find(v=>v.lang==="pt-BR")
          ?? all.find(v=>v.lang.startsWith("pt"))
          ?? null;
    };
    const setVoiceAndSpeak = ()=>{
      const v = getVoice();
      if(v) utter.voice = v;
      window.speechSynthesis.speak(utter);
    };
    // getVoices() may be async on first call (Chrome quirk)
    if(window.speechSynthesis.getVoices().length>0){
      setVoiceAndSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = ()=>{ setVoiceAndSpeak(); };
    }
  },[cancelVoice]);

  // When the active scene changes during playback → speak the new snippet
  useEffect(()=>{
    if(!playing) return;
    if(activeScene===prevVoiceScene.current) return;
    prevVoiceScene.current=activeScene;
    if(voiceEnabled){
      const text = localDrScenes[activeScene]?.textSnippet
        ?? localScenes[activeScene]?.text_chunk
        ?? localScenes[activeScene]?.segment ?? "";
      speakText(text);
    }
  },[activeScene, playing, voiceEnabled, speakText, localDrScenes, localScenes]);

  // Stop speech when component unmounts
  useEffect(()=>cancelVoice,[cancelVoice]);

  // ── Play / Pause ─────────────────────────────────────────────────────────
  const togglePlay=useCallback(()=>{
    if(playing){
      setPlaying(false);
      videoRef.current?.pause();
      avatarVideoRef.current?.pause();
      bgAudioRef.current?.pause();
      cancelVoice();
    } else {
      if(globalTimeRef.current>=totalDur){
        globalTimeRef.current=0;setCurrentTime(0);setPlayheadPct(0);
        if(bgAudioRef.current) bgAudioRef.current.currentTime=0;
        if(avatarVideoRef.current) avatarVideoRef.current.currentTime=0;
        if(ttsAudioRef.current) ttsAudioRef.current.currentTime=0;
        prevVoiceScene.current=-1;
      }
      setPlaying(true);
      videoRef.current?.play().catch(()=>null);
      avatarVideoRef.current?.play().catch(()=>null);
      // Seek bg audio to match playhead position, then play
      if(bgAudioRef.current){
        bgAudioRef.current.currentTime=globalTimeRef.current % (bgAudioRef.current.duration||999);
        bgAudioRef.current.play().catch(()=>null);
      }
      // Start voice on the current scene
      if(voiceEnabledRef.current){
        prevVoiceScene.current=activeScene;
        const text = localDrScenes[activeScene]?.textSnippet
          ?? localScenes[activeScene]?.text_chunk
          ?? localScenes[activeScene]?.segment ?? "";
        speakText(text);
      }
    }
  },[playing,totalDur,cancelVoice,speakText,activeScene,localDrScenes,localScenes]);

  // ── Seek to global time ──────────────────────────────────────────────────
  const seekToTime=useCallback((globalSec:number)=>{
    const clamped=Math.max(0,Math.min(totalDur,globalSec));
    globalTimeRef.current=clamped;
    setCurrentTime(clamped);
    setPlayheadPct((clamped/totalDur)*100);
    // Sync bg audio
    if(bgAudioRef.current&&isFinite(bgAudioRef.current.duration))
      bgAudioRef.current.currentTime=clamped % bgAudioRef.current.duration;
    // Sync TTS voice to seek position
    if(ttsAudioRef.current && ttsAudioUrlRef.current && isFinite(ttsAudioRef.current.duration) && ttsAudioRef.current.duration > 0)
      ttsAudioRef.current.currentTime=Math.min(clamped, ttsAudioRef.current.duration);
    // Sync avatar video to exact global position
    if(avatarVideoRef.current) avatarVideoRef.current.currentTime=clamped;
    // Sync B-roll clip video to local offset
    const clip=effectiveClips.find(c=>clamped>=c.startSec&&clamped<c.startSec+c.durSec);
    if(clip&&videoRef.current){
      const local=clamped-clip.startSec;
      if(clip.id===prevClipId.current){videoRef.current.currentTime=Math.max(0,local);}
      else{seekOnLoadRef.current=local>0.3?local:null;}
    }
  },[totalDur,effectiveClips]);

  // ── Timeline drag — accounts for 80px track header + scroll offset ──────
  const TRACK_HEADER_W = 80; // w-20 = 5rem = 80px
  const timelineBodyPosFromEvent = (clientX: number) => {
    if(!timelineRef.current) return 0;
    const r = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineScrollRef.current?.scrollLeft ?? 0;
    const bodyX = (clientX - r.left + scrollLeft) - TRACK_HEADER_W;
    const bodyW = r.width - TRACK_HEADER_W;
    return Math.max(0, Math.min(1, bodyX / bodyW)) * totalDur;
  };
  const handleTimelineMouseDown=(e:React.MouseEvent<HTMLDivElement>)=>{
    setIsDragging(true);
    seekToTime(timelineBodyPosFromEvent(e.clientX));
  };
  const handleTimelineWheel=useCallback((e:React.WheelEvent)=>{
    if(!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setTimelineZoom(z=>Math.max(0.25, Math.min(8, z * (e.deltaY<0?1.25:0.8))));
  },[]);
  useEffect(()=>{
    if(!isDragging) return;
    const mv=(e:MouseEvent)=>seekToTime(timelineBodyPosFromEvent(e.clientX));
    const up=()=>setIsDragging(false);
    window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);
    return()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isDragging,seekToTime,totalDur]);

  // ── Clip free-drag on timeline (move + trim) ──────────────────────────────
  useEffect(()=>{
    if(!clipDrag) return;
    const pxPerSec=28*timelineZoom;
    const mv=(e:MouseEvent)=>{
      const deltaSec=(e.clientX-clipDrag.startX)/pxPerSec;
      setClipOverrides(prev=>{
        const newStart=clipDrag.mode==="move"
          ? Math.max(0,clipDrag.origStartSec+deltaSec)
          : clipDrag.mode==="trim-left"
          ? Math.max(0,Math.min(clipDrag.origStartSec+clipDrag.origDurSec-0.5,clipDrag.origStartSec+deltaSec))
          : prev[clipDrag.clipId]?.startSec??clipDrag.origStartSec;
        const newDur=clipDrag.mode==="trim-right"
          ? Math.max(0.5,clipDrag.origDurSec+deltaSec)
          : clipDrag.mode==="trim-left"
          ? Math.max(0.5,clipDrag.origDurSec-deltaSec)
          : prev[clipDrag.clipId]?.durSec??clipDrag.origDurSec;
        return{...prev,[clipDrag.clipId]:{startSec:newStart,durSec:newDur}};
      });
    };
    const up=()=>setClipDrag(null);
    window.addEventListener("mousemove",mv);
    window.addEventListener("mouseup",up);
    return()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};
  },[clipDrag,timelineZoom]);

  // ── SFX drag ──────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!sfxDrag) return;
    const pxPerSec=28*timelineZoom;
    const mv=(e:MouseEvent)=>{
      const delta=(e.clientX-sfxDrag.startX)/pxPerSec;
      setSfxOffsets(prev=>({...prev,[sfxDrag.id]:sfxDrag.origOffset+delta}));
    };
    const up=()=>setSfxDrag(null);
    window.addEventListener("mousemove",mv);
    window.addEventListener("mouseup",up);
    return()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};
  },[sfxDrag,timelineZoom]);

  // ── Preview direct drag (CapCut) ────────────────────────────────────────────
  useEffect(()=>{
    if(!previewDrag) return;
    previewDraggedRef.current = false;
    const mv=(e:MouseEvent)=>{
      const el=previewRef.current;
      if(!el)return;
      const {width,height}=el.getBoundingClientRect();
      const dx=(e.clientX-previewDrag.startX)/width*100;
      const dy=(e.clientY-previewDrag.startY)/height*100;
      if(Math.abs(dx)>0.5||Math.abs(dy)>0.5) previewDraggedRef.current=true;
      if(selectedLayer==="avatar"){
        setAvatarTransform(prev=>({...prev,x:previewDrag.origX+dx,y:previewDrag.origY+dy}));
      } else if(selectedLayer && selectedLayer!=="subtitle"){
        setClipTransforms(prev=>({...prev,[selectedLayer]:{
          ...(prev[selectedLayer]??{scale:100,x:0,y:0}),
          x:previewDrag.origX+dx,y:previewDrag.origY+dy,
        }}));
      }
    };
    const up=()=>setPreviewDrag(null);
    window.addEventListener("mousemove",mv);
    window.addEventListener("mouseup",up);
    return()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};
  },[previewDrag,selectedLayer]);

  // ── Keyboard Shortcuts (NLE-standard) ───────────────────────────────────────
  useEffect(()=>{
    const handleKeyDown=(e:KeyboardEvent)=>{
      // Don't capture when typing in textarea/input
      const tag=(e.target as HTMLElement)?.tagName;
      if(tag==="TEXTAREA"||tag==="INPUT"||tag==="SELECT") return;

      switch(e.code){
        case "Space":        // Play / Pause
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":    // Seek backward 5s (Shift = 1s)
          e.preventDefault();
          seekToTime(globalTimeRef.current - (e.shiftKey ? 1 : 5));
          break;
        case "ArrowRight":   // Seek forward 5s (Shift = 1s)
          e.preventDefault();
          seekToTime(globalTimeRef.current + (e.shiftKey ? 1 : 5));
          break;
        case "KeyJ":         // Seek backward 10s
          seekToTime(globalTimeRef.current - 10);
          break;
        case "KeyK":         // Play / Pause (YouTube-style)
          togglePlay();
          break;
        case "KeyL":         // Seek forward 10s
          seekToTime(globalTimeRef.current + 10);
          break;
        case "Home":         // Go to start
          e.preventDefault();
          seekToTime(0);
          break;
        case "End":          // Go to end
          e.preventDefault();
          seekToTime(totalDur);
          break;
        case "KeyM":         // Mute/unmute avatar
          setTrackAVMuted(m=>!m);
          break;
        case "KeyB":         // Toggle B-roll visibility
          if(!e.metaKey&&!e.ctrlKey) setTrackBrollVisible(v=>!v);
          break;
        case "Escape":       // Deselect layer
          setSelectedLayer(null);
          break;
      }
    };
    window.addEventListener("keydown",handleKeyDown);
    return()=>window.removeEventListener("keydown",handleKeyDown);
  },[togglePlay,seekToTime,totalDur]);

  // ── Suggest Another ──────────────────────────────────────────────────────
  const suggestAnother=useCallback(async(clipId:string)=>{
    const clip=effectiveClips.find(c=>c.id===clipId);
    if(!clip) return;
    setLoadingClipIds(prev=>new Set(prev).add(clipId));
    try{
      // ── DRS mode: rotate through videoOptions ─────────────────────────
      if(localDrScenes.length>0){
        const drs=localDrScenes[clip.sceneIdx];
        const opts=drs?.videoOptions??[];
        if(opts.length>1){
          const cur=opts.findIndex(o=>o.url===clip.url);
          const next=opts[(cur+1)%opts.length];
          await new Promise(r=>setTimeout(r,500));
          setLocalDrScenes(prev=>{
            const u=[...prev];
            const d=u[clip.sceneIdx];
            u[clip.sceneIdx]={
              ...d,
              videoUrl:next.url,
              thumbUrl:next.thumb,
              videoOptions:[next,...(d.videoOptions??[]).filter(o=>o.url!==next.url)],
            };
            return u;
          });
        } else {
          // Fetch new Pexels video using the scene's primary searchQuery
          const q=drs?.searchQueries?.[0]??"cinematic broll";
          const page=Math.floor(Math.random()*5)+1;
          const res=await fetch(`/api/suggest-media?q=${encodeURIComponent(q)}&page=${page}`);
          if(res.ok){
            const data=await res.json();
            const newVids:(typeof opts)=(data.videos??[]).map((v:{url:string;thumb?:string})=>({
              url:v.url, thumb:v.thumb??lookupConcept(q), query:q,
            }));
            if(newVids.length>0)
              setLocalDrScenes(prev=>{
                const u=[...prev];
                u[clip.sceneIdx]={...u[clip.sceneIdx],videoUrl:newVids[0].url,thumbUrl:newVids[0].thumb,videoOptions:newVids};
                return u;
              });
          }
        }
        return;
      }
      // ── Legacy Scene mode ─────────────────────────────────────────────
      const sc=localScenes[clip.sceneIdx];
      const opts=sc?.video_options??[];
      if(opts.length>1){
        const cur=opts.findIndex(o=>o.url===clip.url);
        const next=opts[(cur+1)%opts.length];
        await new Promise(r=>setTimeout(r,500));
        setLocalScenes(prev=>{
          const u=[...prev];
          u[clip.sceneIdx]={...u[clip.sceneIdx],video_url:next.url,
            video_options:[next,...opts.filter(o=>o.url!==next.url)]};
          return u;
        });
      } else {
        const q=sc?.broll_search_keywords??sc?.vault_category??sc?.segment??"cinematic";
        const page=Math.floor(Math.random()*5)+1;
        const res=await fetch(`/api/suggest-media?q=${encodeURIComponent(q)}&page=${page}`);
        if(res.ok){
          const data=await res.json();
          const newVids:VideoOption[]=(data.videos??[]).map((v:{url:string})=>({url:v.url}));
          if(newVids.length>0)
            setLocalScenes(prev=>{
              const u=[...prev];
              u[clip.sceneIdx]={...u[clip.sceneIdx],video_url:newVids[0].url,video_options:newVids};
              return u;
            });
        }
      }
    } finally{
      setLoadingClipIds(prev=>{const s=new Set(prev);s.delete(clipId);return s;});
    }
  },[effectiveClips,localDrScenes,localScenes]);

  // ── Drag & Drop from sidebar → V1 block ─────────────────────────────────
  const handleDropOnClip=useCallback((clipId:string,url:string,thumb?:string)=>{
    const clip=effectiveClips.find(c=>c.id===clipId);
    if(!clip) return;
    if(localDrScenes.length>0){
      // DRS mode: update videoUrl + videoOptions
      setLocalDrScenes(prev=>{
        const u=[...prev];
        const d=u[clip.sceneIdx];
        const newOpt={url,thumb:thumb??lookupConcept(d.searchQueries?.[0]??""),query:d.searchQueries?.[0]??""};
        u[clip.sceneIdx]={...d,videoUrl:url,thumbUrl:thumb??d.thumbUrl,
          videoOptions:[newOpt,...(d.videoOptions??[]).filter(o=>o.url!==url)]};
        return u;
      });
    } else {
      setLocalScenes(prev=>{
        const u=[...prev];
        const sc=u[clip.sceneIdx];
        u[clip.sceneIdx]={...sc,video_url:url,
          video_options:[{url},...(sc.video_options??[]).filter(o=>o.url!==url)]};
        return u;
      });
    }
    setDragSrcUrl(null);setDragOverClipId(null);
  },[effectiveClips,localDrScenes]);

  // ── Current subtitle — from DRS when available ───────────────────────────
  const currentSubtitle=useMemo(()=>{
    if(localDrScenes.length) return localDrScenes[activeScene]?.textSnippet??"";
    const sc=localScenes[activeScene];
    return sc?.text_chunk??sc?.segment??"";
  },[localDrScenes,localScenes,activeScene]);

  // ── Sidebar alternatives ─────────────────────────────────────────────────
  const alternatives=useMemo(()=>{
    // DRS mode: alternatives come from Pexels videoOptions (real thumbnails)
    if(localDrScenes.length>0){
      const drs=localDrScenes[activeScene];
      if(!drs) return [];
      // Skip first option (already the main video) — show options 1 & 2 as alternatives
      return (drs.videoOptions??[]).slice(1).map(o=>({
        url:   o.url,
        thumb: o.thumb,
        source:"Pexels",
      }));
    }
    // Legacy mode
    const sc=localScenes[activeScene];
    if(!sc) return [];
    const cur=sc.video_url??sc.video_options?.[0]?.url;
    return (sc.video_options??[]).filter(o=>o.url!==cur);
  },[localDrScenes,localScenes,activeScene]);

  // ── Karaoke Subtitle Words — Whisper real timestamps when available ──────
  const subtitleWords = useMemo(()=>{
    // Priority 1: real Whisper word-level timestamps
    if (rawWhisperWords && rawWhisperWords.length > 0) {
      return rawWhisperWords.map((w): SubtitleWord => {
        const clean = w.word.toLowerCase().replace(/[^a-záéíóúãõçêâîôû]/g, "");
        return {
          word:      w.word,
          startSec:  w.start,
          endSec:    w.end,
          isKeyword: !!BROLL_IMAGES[clean] || POWER_WORDS.has(clean),
          cleanWord: clean,
        };
      });
    }
    // Priority 2: DRS estimated timing
    if (localDrScenes.length) return buildSubtitleWordsFromDRS(localDrScenes);
    // Priority 3: legacy Scene timing
    return buildSubtitleWords(localScenes);
  },[rawWhisperWords,localDrScenes,localScenes]);

  // Active word: the word whose time window contains currentTime
  const activeWordIdx = useMemo(()=>{
    if(!subtitleWords.length) return -1;
    // Binary-search-style: find last word that has started
    let lo=0,hi=subtitleWords.length-1,found=-1;
    while(lo<=hi){
      const mid=Math.floor((lo+hi)/2);
      if(subtitleWords[mid].startSec<=currentTime){found=mid;lo=mid+1;}
      else hi=mid-1;
    }
    // Only highlight if still within the word's window
    return found>=0&&currentTime<subtitleWords[found].endSec ? found : -1;
  },[subtitleWords,currentTime]);

  // ── SFX Scoring Layer ────────────────────────────────────────────────────
  const sfxMarkers = useMemo(()=>buildSFXMarkers(localScenes),[localScenes]);

  // Web-Audio preview — generates a synthetic tone per sfx kind
  const playSFXPreview = useCallback((marker: SFXMarker)=>{
    try {
      type WACtx = typeof AudioContext;
      const ACtx: WACtx = (window.AudioContext
        || (window as Window & { webkitAudioContext?: WACtx }).webkitAudioContext) as WACtx;
      const ctx = new ACtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const t = ctx.currentTime;
      if (marker.kind === "zap") {
        // Downward sweep — whoosh / impact feel
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1400, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.22);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.start(t); osc.stop(t + 0.22);
      } else {
        // Bell / chime — two-note ring
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(1320, t + 0.06);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.start(t); osc.stop(t + 0.45);
      }
    } catch { /* AudioContext not available */ }
  },[]);

  // ── Music ────────────────────────────────────────────────────────────────
  const toggleMusic=(idx:number)=>{
    if(playingMusic===idx){musicRefs[idx]?.current?.pause();setPlayingMusic(null);}
    else{musicRefs.forEach((r,i)=>{if(i!==idx)r.current?.pause();});musicRefs[idx]?.current?.play().catch(()=>null);setPlayingMusic(idx);}
  };
  const downloadSRT=()=>{
    // Convert DRS to Scene-compatible format for SRT generation
    const srtScenes: Scene[] = localDrScenes.length
      ? localDrScenes.map(drs=>({ segment:drs.emotion, text_chunk:drs.textSnippet, estimated_duration_seconds:drs.duration }))
      : localScenes;
    saveAs(new Blob([generateSRT(srtScenes)],{type:"text/plain;charset=utf-8"}),"suarik-legendas.srt");
  };
  const downloadMusic=()=>{const t=tracks[selectedMusic];if(t?.url)window.open(t.url,"_blank");};
  const musicOptions:BackgroundTrack[]=[
    ...tracks.slice(0,3),
    ...Array.from({length:Math.max(0,3-tracks.length)},(_,i)=>({
      title:["Dark Tension Loop","Cinematic Suspense","Epic Orchestral"][i]??"Trilha",
      url:"",is_premium_vault:false,
    })),
  ];

  // ── Toast helper ─────────────────────────────────────────────────────────
  const fireToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleRaioX = useCallback((ad: WinningAd) => {
    fireToast(`🧬 A IA está analisando "${ad.title}"…`);
  }, [fireToast]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
    {/* ── Hidden background audio — emotion-driven music track ── */}
    {/* key forces remount when URL changes so the new track loads immediately */}
    <audio
      key={bgMusicUrl}
      ref={bgAudioRef}
      src={bgMusicUrl}
      loop preload="auto" style={{display:"none"}}
    />
    {/* ── TTS synthetic voice audio ── */}
    <audio ref={ttsAudioRef} preload="auto" style={{display:"none"}} />

    <style>{`
      @keyframes wsIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      @keyframes karaGlow{0%,100%{opacity:1}50%{opacity:0.75}}
      .ws-in{animation:wsIn .35s ease both}
      .v1clip:hover .v1clip-overlay{opacity:1!important}
      .v1clip-overlay{opacity:0;transition:opacity .15s ease}
    `}</style>
    <div className="flex h-screen overflow-hidden ws-in"
      style={{background:"#060606",color:"#F5F3F0",fontFamily:"'DM Sans',sans-serif"}}>

      {/* ══ COL 1: Roteiro (24%) ══════════════════════════════════════════ */}
      {/* ══ COL 1: Roteiro / Inspector ════════════════════════════════════ */}
      <div className="w-[24%] shrink-0 flex flex-col border-r overflow-hidden"
        style={{background:"#0a0a0a",borderColor:"rgba(255,255,255,0.05)"}}>

        {/* Header com botão voltar + tabs */}
        <div className="shrink-0 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <div className="flex items-center gap-2 px-3 pt-3 pb-0">
            <button onClick={onBack} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-white/6 transition-colors shrink-0"><ArrowLeft className="w-4 h-4"/></button>
            {/* Tabs */}
            <div className="flex flex-1 gap-1">
              <button
                onClick={()=>setLeftTab("roteiro")}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${leftTab==="roteiro"?"text-white":"text-gray-500 hover:text-gray-300"}`}
                style={leftTab==="roteiro"?{background:"rgba(232,89,60,0.15)",border:"1px solid rgba(232,89,60,0.3)",color:"#FF7A5C"}:{border:"1px solid transparent"}}>
                Roteiro
              </button>
              <button
                onClick={()=>setLeftTab("inspector")}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all relative ${leftTab==="inspector"?"text-white":"text-gray-500 hover:text-gray-300"}`}
                style={leftTab==="inspector"?{background:"rgba(56,189,248,0.12)",border:"1px solid rgba(56,189,248,0.3)",color:"#38bdf8"}:{border:"1px solid transparent"}}>
                Inspector
                {selectedLayer&&leftTab!=="inspector"&&(
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sky-400"/>
                )}
              </button>
            </div>
          </div>
          <div className="px-4 pb-2 pt-1">
            <p className="text-[9px] text-gray-600">{localDrScenes.length||localScenes.length} cenas · {Math.round(totalDur)}s</p>
          </div>
        </div>

        {/* ── Conteúdo: Roteiro ── */}
        {leftTab==="roteiro"&&(<>
          <textarea value={editCopy} onChange={e=>setEditCopy(e.target.value)}
            className="flex-1 w-full bg-transparent text-[13px] text-gray-400 leading-relaxed px-4 py-4 resize-none focus:outline-none placeholder-gray-700"
            placeholder="Cole ou edite o roteiro aqui…" style={{fontFamily:"inherit"}}/>
          <div className="border-t shrink-0" style={{borderColor:"rgba(255,255,255,0.05)"}}>
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-bold">Cenas</p>
              {localDrScenes.length>0&&(
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{color:"#FF7A5C",background:"rgba(232,89,60,0.1)",border:"1px solid rgba(232,89,60,0.2)"}}>
                  IA · {localDrScenes.length} blocos
                </span>
              )}
            </div>
            <div className="overflow-y-auto max-h-[200px] px-2 pb-3 space-y-0.5">
              {localDrScenes.length>0
                ? localDrScenes.map((drs,i)=>{
                    const col=CLIP_COLS[i%CLIP_COLS.length];
                    return (
                    <button key={i} onClick={()=>seekToTime(sceneStarts[i]+0.01)}
                      className={`w-full flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${activeScene===i?"bg-orange-500/10 border border-orange-500/25":"hover:bg-white/4 border border-transparent"}`}>
                      <span className="text-[9px] font-black mt-0.5 shrink-0" style={{color:activeScene===i?"#FF7A5C":col}}>{String(i+1).padStart(2,"0")}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                            style={{background:`${col}22`,color:col,border:`1px solid ${col}44`}}>
                            {drs.emotion}
                          </span>
                          <span className="text-[8px] text-gray-500">{drs.duration.toFixed(1)}s</span>
                        </div>
                        <p className={`text-[11px] font-medium truncate ${activeScene===i?"text-orange-300":"text-gray-400"}`}>
                          {drs.textSnippet.slice(0,50)}{drs.textSnippet.length>50?"…":""}
                        </p>
                        <p className="text-[8px] text-gray-500 mt-0.5 truncate">🔍 {drs.searchQueries[0]}</p>
                      </div>
                    </button>
                  );})
                : localScenes.map((sc,i)=>(
                  <button key={i} onClick={()=>seekToTime(sceneStarts[i]+0.01)}
                    className={`w-full flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${activeScene===i?"bg-orange-500/10 border border-orange-500/25":"hover:bg-white/4 border border-transparent"}`}>
                    <span className="text-[9px] font-black mt-0.5 shrink-0" style={{color:activeScene===i?"#FF7A5C":CLIP_COLS[i%CLIP_COLS.length]}}>{String(i+1).padStart(2,"0")}</span>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-semibold truncate ${activeScene===i?"text-orange-300":"text-gray-400"}`}>{sc.segment}</p>
                      <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-1">{sc.text_chunk?.slice(0,55)??""}…</p>
                    </div>
                  </button>
                ))
              }
            </div>
          </div>
        </>)}

        {/* ── Conteúdo: Inspector ── */}
        {leftTab==="inspector"&&(()=>{
          // ── Quem está selecionado? ────────────────────────────────────
          const layerType =
            selectedLayer==="avatar"   ? "avatar"   :
            selectedLayer==="subtitle" ? "subtitle" :
            selectedLayer && effectiveClips.find(c=>c.id===selectedLayer) ? "broll" :
            null;
          const selClip = layerType==="broll" ? effectiveClips.find(c=>c.id===selectedLayer)! : null;

          // ── Transforms por layer ──────────────────────────────────────
          const brollT = selClip ? (clipTransforms[selClip.id]??{scale:100,x:0,y:0}) : {scale:100,x:0,y:0};
          const setBrollT = (p:Partial<{scale:number;x:number;y:number}>)=>{ if(!selClip)return; setClipTransforms(prev=>({...prev,[selClip.id]:{...brollT,...p}})); };
          const avT = avatarTransform;
          const setAvT = (p:Partial<typeof avT>)=>setAvatarTransform(prev=>({...prev,...p}));
          const sc = subtitleConfig;
          const setSc = (p:Partial<typeof sc>)=>setSubtitleConfig(prev=>({...prev,...p}));

          // ── Slider helper ─────────────────────────────────────────────
          const SR=({label,value,min,max,step,unit,color,onChange,onReset}:{label:string;value:number;min:number;max:number;step:number;unit:string;color:string;onChange:(v:number)=>void;onReset:()=>void})=>(
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">{label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-bold tabular-nums" style={{color}}>{value}{unit}</span>
                  <button onClick={onReset} className="text-gray-700 hover:text-gray-400 transition-colors text-[10px]">↺</button>
                </div>
              </div>
              <input type="range" min={min} max={max} step={step} value={value}
                className="w-full h-1" style={{accentColor:color}} onChange={e=>onChange(Number(e.target.value))}/>
              <div className="flex justify-between mt-0.5">
                <span className="text-[7px] text-gray-700">{min}{unit}</span>
                <span className="text-[7px] text-gray-700">{max}{unit}</span>
              </div>
            </div>
          );

          // ── Empty state ───────────────────────────────────────────────
          if(!layerType) return(
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5 text-center">
              <div className="grid grid-cols-3 gap-2 w-full">
                {[
                  {label:"AVATAR",layer:"avatar",color:"rgba(148,163,184,0.8)"},
                  {label:"SUB",layer:"subtitle",color:"rgba(234,179,8,0.8)"},
                  {label:"B-ROLL",layer:null,color:"rgba(232,89,60,0.8)"},
                ].map(({label,layer,color})=>(
                  <button key={label}
                    onClick={()=>{if(layer){setSelectedLayer(layer);}}}
                    className="py-3 rounded-xl flex flex-col items-center gap-1.5 transition-all hover:bg-white/4"
                    style={{border:"1px dashed rgba(255,255,255,0.08)",opacity:layer?1:0.4,cursor:layer?"pointer":"default"}}>
                    <span className="text-[8px] font-black tracking-widest" style={{color}}>{label}</span>
                    <span className="text-[7px] text-gray-700">{layer?"clique":"na timeline"}</span>
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-gray-700 leading-relaxed">Clique em uma camada<br/>na timeline para editar</p>
            </div>
          );

          return(
            <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.06) transparent"}}>
              <div className="px-4 pt-4 pb-5">

                {/* ── Header da layer selecionada ── */}
                <div className="flex items-center gap-2 mb-5 pb-3 border-b" style={{borderColor:"rgba(255,255,255,0.06)"}}>
                  <div className="w-1.5 h-6 rounded-full shrink-0" style={{
                    background: layerType==="avatar"?"#94a3b8": layerType==="subtitle"?"#eab308":"#e8593c"
                  }}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-white">
                      {layerType==="avatar"?"Avatar / A-Roll": layerType==="subtitle"?"Legendas": selClip?.label}
                    </p>
                    <p className="text-[8px] text-gray-600">
                      {layerType==="avatar"?"Vídeo base · escala e posição":
                       layerType==="subtitle"?"Estilo, posição e tamanho":
                       `${selClip!.startSec.toFixed(2)}s → ${(selClip!.startSec+selClip!.durSec).toFixed(2)}s`}
                    </p>
                  </div>
                  <button onClick={()=>setSelectedLayer(null)} className="text-gray-700 hover:text-gray-300 transition-colors text-[11px]">✕</button>
                </div>

                {/* ════ AVATAR ════ */}
                {layerType==="avatar"&&(<>
                  <SR label="Escala" value={avT.scale} min={10} max={500} step={5} unit="%" color="#94a3b8"
                    onChange={v=>setAvT({scale:v})} onReset={()=>setAvT({scale:100})}/>
                  <SR label="Posição X" value={avT.x} min={-100} max={100} step={1} unit="%" color="#94a3b8"
                    onChange={v=>setAvT({x:v})} onReset={()=>setAvT({x:0})}/>
                  <SR label="Posição Y" value={avT.y} min={-100} max={100} step={1} unit="%" color="#94a3b8"
                    onChange={v=>setAvT({y:v})} onReset={()=>setAvT({y:0})}/>
                  <button onClick={()=>setAvatarTransform({scale:100,x:0,y:0})}
                    className="w-full py-1.5 rounded-xl text-[9px] font-bold text-gray-600 hover:text-white transition-all mt-1"
                    style={{border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.02)"}}>
                    Resetar
                  </button>

                  {/* ── TTS — Voz Sintética ── */}
                  <div className="mt-4 pt-3" style={{borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                    <p className="text-[8px] font-black uppercase tracking-widest mb-2" style={{color:"#a78bfa"}}>
                      🎙 Voz Sintética (TTS)
                    </p>

                    {/* Voz */}
                    <p className="text-[8px] text-gray-500 uppercase tracking-wider mb-1">Voz</p>
                    <div className="flex gap-2 mb-2">
                      <select value={ttsVoice} onChange={e=>setTtsVoice(e.target.value)}
                        className="flex-1 text-[10px] text-zinc-300 px-2 py-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none"
                        style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}}>
                        <option value="English_expressive_narrator">English — Expressive Narrator</option>
                        <option value="English_Graceful_Lady">English — Graceful Lady</option>
                        <option value="English_Insightful_Speaker">English — Insightful Speaker</option>
                        <option value="English_radiant_girl">English — Radiant Girl</option>
                        <option value="English_Persuasive_Man">English — Persuasive Man</option>
                        <option value="English_Lucky_Robot">English — Lucky Robot</option>
                        <option value="Chinese (Mandarin)_Lyrical_Voice">Chinese (Mandarin) — Lyrical Voice</option>
                        <option value="Chinese (Mandarin)_HK_Flight_Attendant">Chinese (Mandarin) — HK Flight Attendant</option>
                        <option value="Japanese_Whisper_Belle">Japanese — Whisper Belle</option>
                      </select>
                      <button
                        onClick={handlePreviewVoice}
                        disabled={previewLoading}
                        suppressHydrationWarning
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 disabled:opacity-40"
                        style={{background:"rgba(167,139,250,0.15)",border:"1px solid rgba(167,139,250,0.3)",color:"#a78bfa"}}>
                        {previewLoading ? "⏳" : "🔊"}
                      </button>
                    </div>
                    {previewError && <p className="text-[9px] text-red-400 mb-2" suppressHydrationWarning>{previewError}</p>}
                    {previewUrl && <audio ref={previewAudioRef} className="w-full mb-2 h-6" suppressHydrationWarning style={{opacity:0.7}} controls />}

                    {/* Velocidade */}
                    <SR label="Velocidade" value={Math.round(ttsSpeed*100)} min={50} max={200} step={5} unit="%" color="#a78bfa"
                      onChange={v=>setTtsSpeed(v/100)} onReset={()=>setTtsSpeed(1.0)}/>

                    {/* Erro */}
                    {ttsError&&(
                      <p className="text-[9px] text-red-400 mt-1 mb-1">{ttsError}</p>
                    )}

                    {/* Botão gerar */}
                    <button
                      onClick={()=>handleGenerateTTS(editCopy)}
                      disabled={ttsLoading||!editCopy.trim()}
                      className="w-full py-2 rounded-xl text-[10px] font-black transition-all mt-1 flex items-center justify-center gap-1.5 disabled:opacity-40"
                      style={{background:"rgba(167,139,250,0.15)",border:"1px solid rgba(167,139,250,0.3)",color:"#a78bfa"}}>
                      {ttsLoading
                        ? <><span className="w-3 h-3 rounded-full border border-violet-400 border-t-transparent animate-spin inline-block"/>Gerando voz...</>
                        : ttsAudioUrl ? "🔄 Regerar Voz" : "🎙 Gerar Voz"}
                    </button>

                    {/* Player inline */}
                    {ttsAudioUrl&&!ttsLoading&&(
                      <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg"
                        style={{background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.15)"}}>
                        <span className="text-[9px] text-violet-400 font-bold">✓ Voz gerada</span>
                        <a href={ttsAudioUrl} download="voz_tts.mp3"
                          className="ml-auto text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors underline">
                          baixar
                        </a>
                      </div>
                    )}
                  </div>
                </>)}

                {/* ════ LEGENDAS ════ */}
                {layerType==="subtitle"&&(<>
                  <div className="mb-4">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-2">Estilo</p>
                    <div className="grid grid-cols-2 gap-1">
                      {(["bold","minimal","neon","shadow"] as const).map(s=>(
                        <button key={s} onClick={()=>setSc({style:s})}
                          className="py-2 rounded-lg text-[9px] font-bold transition-all"
                          style={sc.style===s
                            ?{background:"rgba(234,179,8,0.15)",border:"1px solid rgba(234,179,8,0.4)",color:"#eab308"}
                            :{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",color:"#6b7280"}}>
                          {s==="bold"?"Bold":s==="minimal"?"Minimal":s==="neon"?"Neon":"Shadow"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-2">Posição na tela</p>
                    <div className="flex gap-1">
                      {([["top","Topo"],["center","Centro"],["bottom","Base"]] as const).map(([pos,lbl])=>(
                        <button key={pos} onClick={()=>setSc({position:pos})}
                          className="flex-1 py-2 rounded-lg text-[9px] font-bold transition-all"
                          style={sc.position===pos
                            ?{background:"rgba(234,179,8,0.15)",border:"1px solid rgba(234,179,8,0.4)",color:"#eab308"}
                            :{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",color:"#6b7280"}}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <SR label="Tamanho" value={sc.fontSize} min={50} max={200} step={5} unit="%" color="#eab308"
                    onChange={v=>setSc({fontSize:v})} onReset={()=>setSc({fontSize:100})}/>
                </>)}

                {/* ════ B-ROLL ════ */}
                {layerType==="broll"&&(<>
                  <SR label="Escala" value={brollT.scale} min={10} max={500} step={5} unit="%" color="#e8593c"
                    onChange={v=>setBrollT({scale:v})} onReset={()=>setBrollT({scale:100})}/>
                  <SR label="Posição X" value={brollT.x} min={-100} max={100} step={1} unit="%" color="#e8593c"
                    onChange={v=>setBrollT({x:v})} onReset={()=>setBrollT({x:0})}/>
                  <SR label="Posição Y" value={brollT.y} min={-100} max={100} step={1} unit="%" color="#e8593c"
                    onChange={v=>setBrollT({y:v})} onReset={()=>setBrollT({y:0})}/>
                  <button
                    onClick={()=>setClipTransforms(prev=>{const n={...prev};if(selClip)delete n[selClip.id];return n;})}
                    className="w-full py-1.5 rounded-xl text-[9px] font-bold text-gray-600 hover:text-white transition-all mt-1"
                    style={{border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.02)"}}>
                    Resetar
                  </button>
                </>)}

              </div>
            </div>
          );
        })()}
      </div>

      {/* ══ COL 2: Player + Timeline (flex-1) ════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar — Pro Status */}
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0" style={{borderColor:"rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.3)"}}>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-all ${playing?"bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]":"bg-gray-600"}`}/>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{color:playing?"#ef4444":"#6b7280"}}>{playing?"REC":"IDLE"}</span>
            </div>
            <div className="w-px h-3.5 bg-white/8"/>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Cena {activeScene+1}/{localDrScenes.length||localScenes.length}</span>
            {currentClip&&<span className="text-[8px] text-gray-500 border border-white/8 px-1.5 py-0.5 rounded truncate max-w-[120px]">{currentClip.label}</span>}
            {selectedLayer&&(
              <>
                <div className="w-px h-3.5 bg-white/8"/>
                <span className="text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{
                    background:selectedLayer==="avatar"?"rgba(148,163,184,0.1)":selectedLayer==="subtitle"?"rgba(234,179,8,0.1)":"rgba(232,89,60,0.1)",
                    color:selectedLayer==="avatar"?"#94a3b8":selectedLayer==="subtitle"?"#eab308":"#e8593c",
                    border:`1px solid ${selectedLayer==="avatar"?"rgba(148,163,184,0.25)":selectedLayer==="subtitle"?"rgba(234,179,8,0.25)":"rgba(232,89,60,0.25)"}`,
                  }}>
                  ✦ {selectedLayer==="avatar"?"Avatar":selectedLayer==="subtitle"?"Legenda":"B-Roll"} selecionado
                </span>
                <button onClick={()=>setSelectedLayer(null)}
                  className="text-[8px] text-gray-700 hover:text-gray-400 transition-colors">
                  ESC
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-orange-400 font-bold tabular-nums tracking-tight">{fmtTime(currentTime)}<span className="text-gray-600 mx-0.5">/</span>{fmtTime(totalDur)}</span>
          </div>
        </div>

        {/* ── Video Player (NLE Monitor) ── */}
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div ref={previewRef}
            className={`relative rounded-xl overflow-hidden group mx-auto ${videoAspect==="portrait" ? "w-auto" : "w-full"}`}
            style={{
              aspectRatio: videoAspect==="portrait" ? "9/16" : "16/7.2",
              maxWidth:    videoAspect==="portrait" ? "260px" : "100%",
              background:"#000",
              border: selectedLayer
                ? `1px solid ${selectedLayer==="avatar"?"rgba(148,163,184,0.5)":selectedLayer==="subtitle"?"rgba(234,179,8,0.5)":"rgba(232,89,60,0.5)"}`
                : "1px solid rgba(255,255,255,0.07)",
              boxShadow: selectedLayer
                ? `0 0 0 2px ${selectedLayer==="avatar"?"rgba(148,163,184,0.12)":selectedLayer==="subtitle"?"rgba(234,179,8,0.1)":"rgba(232,89,60,0.1)"}`
                : "0 0 40px rgba(232,89,60,0.05)",
              cursor: selectedLayer && selectedLayer!=="subtitle" ? (previewDrag?"grabbing":"grab") : "pointer",
            }}
            onMouseDown={e=>{
              // If a moveable layer is selected, start preview drag instead of toggling play
              if(selectedLayer && selectedLayer!=="subtitle"){
                e.preventDefault();
                const origX = selectedLayer==="avatar"
                  ? avatarTransform.x
                  : (clipTransforms[selectedLayer]?.x??0);
                const origY = selectedLayer==="avatar"
                  ? avatarTransform.y
                  : (clipTransforms[selectedLayer]?.y??0);
                setPreviewDrag({startX:e.clientX,startY:e.clientY,origX,origY});
              }
            }}
            onClick={e=>{
              if(previewDraggedRef.current){ previewDraggedRef.current=false; return; }
              togglePlay();
            }}>

            {/* ═══ LAYER 0: Black fallback when AV hidden ═══ */}
            {!trackAVVisible && !uploadedVideoUrl && (
              <div className="absolute inset-0 bg-black"/>
            )}

            {/* ═══ LAYER 1: Avatar / A-Roll — the base (continuous) ═══ */}
            {uploadedVideoUrl ? (
              /* Real UGC video — onTimeUpdate drives the global timeline clock */
              <video
                ref={avatarVideoRef}
                src={uploadedVideoUrl}
                playsInline
                muted={trackAVMuted}
                onLoadedMetadata={handleAvatarMetadata}
                onTimeUpdate={handleAvatarTimeUpdate}
                className="absolute inset-0 w-full h-full transition-opacity duration-200"
                style={{
                  opacity: trackAVVisible ? 1 : 0,
                  objectFit: videoAspect==="portrait" ? "contain" : "cover",
                  background: "#000",
                  transformOrigin:"center center",
                  transform:`scale(${avatarTransform.scale/100}) translate(${avatarTransform.x}%,${avatarTransform.y}%)`,
                }}
              />
            ) : (
              /* No upload: show placeholder or thumb when no B-roll is active */
              !currentClip && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                  style={{background:"linear-gradient(135deg,#0e0e0e,#060606)"}}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{background:"rgba(100,116,139,0.1)",border:"1px solid rgba(100,116,139,0.2)"}}>
                    <Film className="w-5 h-5 text-gray-500"/>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium">Avatar / Locutor</p>
                </div>
              )
            )}

            {/* ═══ LAYER 2: B-Roll overlay — only when clip active + visible ═══ */}
            {trackBrollVisible && (
              videoUrl && !videoErrors[(currentClip?.id??"") + videoUrl] ? (
                // key = clipId + url — remounts element cleanly on swap, no glitch
                <video ref={videoRef} key={(currentClip?.id??"") + videoUrl} src={videoUrl}
                  loop muted playsInline preload="auto" crossOrigin="anonymous"
                  onLoadedMetadata={handleLoadedMetadata}
                  onError={()=>setVideoErrors(prev=>({...prev,[(currentClip?.id??"") + videoUrl]:true}))}
                  className="absolute inset-0 w-full h-full transition-opacity duration-300"
                  style={{
                    opacity: currentClip ? 1 : 0,
                    objectFit: videoAspect==="portrait" ? "contain" : "cover",
                    transformOrigin:"center center",
                    transform:(()=>{
                      const t=currentClip?clipTransforms[currentClip.id]:null;
                      if(!t)return undefined;
                      return `scale(${(t.scale??100)/100}) translate(${t.x??0}%,${t.y??0}%)`;
                    })(),
                  }}/>
              ) : currentClip?.thumb ? (
                /* Thumb-only B-roll — static image overlay during active clip */
                <div className={`absolute inset-0 transition-opacity duration-300 ${currentClip ? "opacity-100" : "opacity-0"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentClip.thumb} alt={currentClip.triggerWord??currentClip.label}
                    className="w-full h-full object-cover"
                    style={{filter:"brightness(0.72) saturate(1.15)"}}/>
                  <div className="absolute inset-0 pointer-events-none"
                    style={{background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.08) 2px,rgba(0,0,0,0.08) 4px)"}}/>
                  {currentClip.triggerWord&&(
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{background:"rgba(0,0,0,0.7)",border:"1px solid rgba(232,89,60,0.4)",backdropFilter:"blur(4px)"}}>
                      <span className="text-[9px] font-black uppercase tracking-wider" style={{color:"#FF7A5C"}}>
                        ⚡ {currentClip.triggerWord}
                      </span>
                    </div>
                  )}
                </div>
              ) : currentClip ? (
                /* Clip exists but no thumb/video — colored gradient placeholder */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 transition-opacity duration-300"
                  style={{background:`linear-gradient(135deg,${currentClip.color}18,#060606)`,opacity: currentClip ? 1 : 0}}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{background:`${currentClip.color}22`,border:`1px solid ${currentClip.color}44`}}>
                    <Film className="w-5 h-5" style={{color:currentClip.color}}/>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium">Sem mídia — passe o mouse no bloco e clique em 🔄</p>
                </div>
              ) : null
            )}

            {/* ═══ LAYER 3: "B-Roll OFF" badge when V2 is hidden ═══ */}
            {!trackBrollVisible && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full pointer-events-none"
                style={{background:"rgba(0,0,0,0.7)",border:"1px solid rgba(239,68,68,0.4)"}}>
                <EyeOff className="w-3 h-3" style={{color:"#f87171"}}/>
                <span className="text-[9px] font-black" style={{color:"#f87171"}}>B-Roll oculto</span>
              </div>
            )}

            {/* ── Subtitle Block — CapCut style: 4-word sliding window ── */}
            {subtitleWords.length>0&&activeWordIdx>=0&&(()=>{
              // ── Build a 4-word window centered on the active word ──
              // This works with BOTH Whisper real timestamps AND estimated DRS timing
              // because activeWordIdx is already found via binary search on currentTime.
              const CHUNK = 4;
              const allWords = subtitleWords.map((sw,i)=>({sw,gIdx:i}));

              // Split ALL words into fixed 4-word chunks
              const chunks: typeof allWords[] = [];
              for(let i=0; i<allWords.length; i+=CHUNK) chunks.push(allWords.slice(i,i+CHUNK));

              // Find chunk containing the active word
              const activeChunkIdx = chunks.findIndex(ch => ch.some(({gIdx})=>gIdx===activeWordIdx));
              const displayChunk = chunks[Math.max(0, activeChunkIdx)] ?? chunks[0];
              if(!displayChunk?.length) return null;

              const emotion = localDrScenes[activeScene]?.emotion ?? "";
              const accentColor =
                emotion==="CTA"||emotion==="Urgência"   ? "#FF3B3B"
                : emotion==="Revelação"||emotion==="Mistério" ? "#00FFCC"
                : emotion==="Oportunidade"||emotion==="Esperança" ? "#00FF88"
                : emotion==="Choque"||emotion==="Dor"   ? "#FF8C00"
                : "#FFFF00";

              // ── Apply subtitleConfig ─────────────────────────────────────
              const fs = subtitleConfig.fontSize / 100;
              const posClass =
                subtitleConfig.position==="top"    ? "top-8"    :
                subtitleConfig.position==="center" ? "top-1/2 -translate-y-1/2" :
                                                     "bottom-10";
              const boldStroke = "2px 2px 0 #000,-2px 2px 0 #000,2px -2px 0 #000,-2px -2px 0 #000,3px 0 0 #000,-3px 0 0 #000,0 3px 0 #000,0 -3px 0 #000";
              const getWordStyle = (isAct:boolean, isKw:boolean):{[k:string]:string|number} => {
                const base = {
                  display:"inline-block" as const,
                  fontFamily:"'DM Sans','Arial Black',sans-serif",
                  fontWeight:900,
                  lineHeight:1.1,
                  letterSpacing:"-0.02em",
                  transition:"transform 0.06s ease,color 0.06s ease,text-shadow 0.06s ease",
                  transformOrigin:"center bottom",
                };
                const sz = isAct ? `clamp(${1.4*fs}rem,${4*fs}vw,${2.2*fs}rem)` : `clamp(${1.2*fs}rem,${3.5*fs}vw,${1.9*fs}rem)`;
                if(subtitleConfig.style==="minimal") return {...base, fontSize:sz, color:"#FFFFFF", textShadow:"1px 1px 3px rgba(0,0,0,0.9)", fontWeight:700, transform:isAct?"scale(1.06)":"scale(1)"};
                if(subtitleConfig.style==="shadow") return {...base, fontSize:sz, color:isKw?accentColor:"#FFFFFF", textShadow:"3px 4px 8px rgba(0,0,0,1),0 0 20px rgba(0,0,0,0.8)", transform:isAct?"scale(1.1) translateY(-2px)":"scale(1)"};
                if(subtitleConfig.style==="neon") return {...base, fontSize:sz, color:isKw?accentColor:isAct?"#fff":"rgba(255,255,255,0.85)", textShadow:isKw?`0 0 12px ${accentColor},0 0 30px ${accentColor},0 0 60px ${accentColor}66`:`0 0 10px rgba(255,255,255,0.5),0 0 20px rgba(255,255,255,0.2)`, transform:isAct?"scale(1.1) translateY(-2px)":"scale(1)", background:isAct&&!isKw?"rgba(255,255,255,0.08)":"transparent", borderRadius:"4px", padding:isAct?"0 3px":"0"};
                // bold (default)
                return {...base, fontSize:sz, color:isKw?accentColor:"#FFFFFF", textShadow:isKw?`${boldStroke},0 0 24px ${accentColor},0 0 48px ${accentColor}55`:boldStroke, transform:isAct?"scale(1.12) translateY(-2px)":"scale(1)", background:isAct&&!isKw?"rgba(255,255,0,0.18)":"transparent", borderRadius:isAct?"4px":"0", padding:isAct?"0 3px":"0"};
              };

              const isSubSel = selectedLayer==="subtitle";
              return (
                <div
                  className={`absolute left-0 right-0 flex justify-center px-6 ${posClass}`}
                  style={{pointerEvents:"auto",cursor:"pointer"}}
                  onClick={e=>{e.stopPropagation();setSelectedLayer(v=>v==="subtitle"?null:"subtitle");setLeftTab("inspector");}}>
                  <div className={`flex flex-wrap justify-center items-end rounded-lg transition-all ${isSubSel?"outline outline-2 outline-yellow-400/60 outline-offset-4":""}`}
                    style={{gap:"0 0.3em",maxWidth:"88%",padding:"2px 6px"}}>
                    {displayChunk.map(({sw,gIdx})=>{
                      const isAct = gIdx===activeWordIdx;
                      const isKw  = sw.isKeyword && isAct;
                      return(
                        <span key={gIdx} style={getWordStyle(isAct,isKw)}>{sw.word}</span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Selected layer indicator (top-left corner) ── */}
            {selectedLayer&&(
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg pointer-events-none z-30 select-none"
                style={{
                  background:"rgba(0,0,0,0.75)",
                  backdropFilter:"blur(6px)",
                  border:`1px solid ${selectedLayer==="avatar"?"rgba(148,163,184,0.4)":selectedLayer==="subtitle"?"rgba(234,179,8,0.4)":"rgba(232,89,60,0.4)"}`,
                }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{
                  background:selectedLayer==="avatar"?"#94a3b8":selectedLayer==="subtitle"?"#eab308":"#e8593c"
                }}/>
                <span className="text-[8px] font-black uppercase tracking-widest"
                  style={{color:selectedLayer==="avatar"?"#94a3b8":selectedLayer==="subtitle"?"#eab308":"#e8593c"}}>
                  {selectedLayer==="avatar"?"Avatar":selectedLayer==="subtitle"?"Legenda":"B-Roll"}
                </span>
                {selectedLayer!=="subtitle"&&(
                  <span className="text-[7px] text-gray-600 ml-0.5">· arraste para mover</span>
                )}
              </div>
            )}

            {/* Play overlay — hidden when a layer is selected (drag mode) */}
            {!selectedLayer&&(
              <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${playing?"opacity-0 group-hover:opacity-100":"opacity-100"}`}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{background:"rgba(232,89,60,0.12)",border:"1px solid rgba(232,89,60,0.35)",backdropFilter:"blur(4px)",boxShadow:"0 0 24px rgba(232,89,60,0.25)"}}>
                  {playing?<Pause className="w-5 h-5 text-orange-300" fill="currentColor"/>:<Play className="w-5 h-5 text-orange-300 ml-0.5" fill="currentColor"/>}
                </div>
              </div>
            )}

            {/* Transport HUD */}
            <div className="absolute bottom-0 left-0 right-0 px-4 py-2 flex items-center gap-3"
              style={{background:"linear-gradient(to top,rgba(0,0,0,0.9),transparent)"}}>
              <button onClick={e=>{e.stopPropagation();seekToTime(sceneStarts[Math.max(0,activeScene-1)]);}} title="Cena anterior (J)"><SkipBack className="w-4 h-4 text-white/50 hover:text-white transition-colors"/></button>
              <button onClick={e=>{e.stopPropagation();togglePlay();}} title="Play / Pause (Space)">
                {playing?<Pause className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor"/>:<Play className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor"/>}
              </button>
              <button onClick={e=>{e.stopPropagation();const sc=localDrScenes.length||localScenes.length;seekToTime(sceneStarts[Math.min(sc-1,activeScene+1)]);}} title="Próxima cena (L)"><SkipForward className="w-4 h-4 text-white/50 hover:text-white transition-colors"/></button>
              <span className="text-[7px] font-mono text-white/20 ml-1 hidden lg:inline" title="Atalhos: Space=Play ←→=Seek J/K/L=Nav M=Mute B=B-Roll">⌨</span>
              <div className="flex items-center gap-3 ml-auto" onClick={e=>e.stopPropagation()}>
                {/* Voz de Apoio toggle */}
                <button
                  onClick={()=>{
                    const next=!voiceEnabled;
                    setVoiceEnabled(next);
                    if(!next) cancelVoice();
                    else if(playing){
                      prevVoiceScene.current=activeScene;
                      speakText(localDrScenes[activeScene]?.textSnippet??currentSubtitle);
                    }
                  }}
                  title={voiceEnabled?"Voz de apoio: ON (clique para desligar)":"Voz de apoio: OFF (clique para ligar)"}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
                  style={{
                    background: voiceEnabled ? "rgba(232,89,60,0.12)" : "rgba(255,255,255,0.04)",
                    border:     `1px solid ${voiceEnabled ? "rgba(232,89,60,0.4)" : "rgba(255,255,255,0.1)"}`,
                    boxShadow:  voiceEnabled ? "0 0 10px rgba(232,89,60,0.2)" : "none",
                  }}>
                  <Mic className="w-3 h-3" style={{color: voiceEnabled ? "#FF7A5C" : "rgba(255,255,255,0.3)"}}/>
                  <span className="text-[8px] font-bold" style={{color: voiceEnabled ? "#FF7A5C" : "rgba(255,255,255,0.3)"}}>
                    {voiceEnabled ? "VOZ ON" : "VOZ"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Premiere CTA Banner ── */}
        <div className="mx-3 mt-2 mb-0 flex items-center gap-3 px-4 py-2.5 rounded-xl shrink-0"
          style={{background:"linear-gradient(135deg,rgba(232,89,60,0.18),rgba(232,89,60,0.12))",border:"1px solid rgba(232,89,60,0.35)",boxShadow:"0 0 24px rgba(232,89,60,0.15)"}}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white leading-tight" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1px"}}>🎬 Timeline pronta para exportar</p>
            <p className="text-[10px] text-orange-300/70 mt-0.5">Exporte para Premiere Pro com 1 clique — sequência XML completa com cortes, B-rolls e legendas</p>
          </div>
          <button onClick={()=>setPaywallOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black shrink-0 transition-all hover:scale-105 active:scale-95"
            style={{background:"linear-gradient(135deg,#E8593C,#E8593C)",color:"#fff",boxShadow:"0 4px 20px rgba(232,89,60,0.5)",border:"1px solid rgba(255,255,255,0.15)"}}>
            <FileCode2 className="w-3.5 h-3.5"/>Exportar para Premiere (XML)
          </button>
        </div>

        {/* ── Audio Mixer ── */}
        <div className="mx-3 mb-0 mt-1 px-4 py-2.5 rounded-xl shrink-0 flex items-center gap-4"
          style={{background:"rgba(0,0,0,0.55)",border:"1px solid rgba(255,255,255,0.06)"}}>
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-500 shrink-0">Mixer</span>
          {/* 🎙️ Avatar fader */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[10px] shrink-0">🎙️</span>
            <span className="text-[9px] font-bold text-gray-500 shrink-0 w-10">Avatar</span>
            <div className="relative flex-1 h-1.5 rounded-full cursor-pointer" style={{background:"rgba(255,255,255,0.08)"}}>
              <div className="absolute left-0 top-0 h-full rounded-full pointer-events-none transition-all"
                style={{width:`${avatarVolume*100}%`,background:"linear-gradient(90deg,#FF7A5C,#E8593C)"}}/>
              <input type="range" min="0" max="1" step="0.01" value={avatarVolume}
                onChange={e=>{
                  const v=+e.target.value; setAvatarVolume(v);
                  if(avatarVideoRef.current) avatarVideoRef.current.volume=v;
                  if(v===0) setTrackAVMuted(true); else if(trackAVMuted) setTrackAVMuted(false);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
            </div>
            <span className="text-[9px] font-mono text-gray-500 w-6 text-right shrink-0">{Math.round(avatarVolume*100)}</span>
          </div>
          <div className="w-px h-4 shrink-0" style={{background:"rgba(255,255,255,0.07)"}}/>
          {/* 🎵 Trilha fader */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[10px] shrink-0">🎵</span>
            <span className="text-[9px] font-bold text-gray-500 shrink-0 w-10">Trilha</span>
            <div className="relative flex-1 h-1.5 rounded-full cursor-pointer" style={{background:"rgba(255,255,255,0.08)"}}>
              <div className="absolute left-0 top-0 h-full rounded-full pointer-events-none transition-all"
                style={{width:`${bgVolume*100}%`,background:"linear-gradient(90deg,#FF7A5C,#E8593C)"}}/>
              <input type="range" min="0" max="1" step="0.01" value={bgVolume}
                onChange={e=>{
                  const v=+e.target.value; setBgVolume(v);
                  if(bgAudioRef.current) bgAudioRef.current.volume=v;
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
            </div>
            <span className="text-[9px] font-mono text-gray-500 w-6 text-right shrink-0">{Math.round(bgVolume*100)}</span>
          </div>
        </div>

        {/* ── Timeline ── */}
        <div className="flex-1 min-h-0 flex flex-col px-3 pb-3 gap-2">
          <div className="flex-1 min-h-0 rounded-xl overflow-hidden flex flex-col"
            style={{background:"#080808",border:"1px solid rgba(255,255,255,0.06)"}}>

            {/* ── Timeline Toolbar ── */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b shrink-0"
              style={{borderColor:"rgba(255,255,255,0.08)",background:"rgba(0,0,0,0.4)"}}>

              {/* Label */}
              <span className="text-[11px] font-black uppercase tracking-widest shrink-0"
                style={{color:"rgba(240,86,58,0.7)"}}>🔍 ZOOM</span>

              {/* Zoom Out */}
              <button onClick={()=>setTimelineZoom(z=>Math.max(0.25,z*0.75))}
                className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-lg transition-all hover:scale-105 active:scale-95"
                style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"#e4e4e7"}}>
                −
              </button>

              {/* Zoom level */}
              <div className="w-16 h-8 rounded-lg flex items-center justify-center text-[13px] font-black"
                style={{background:"rgba(240,86,58,0.15)",border:"1px solid rgba(240,86,58,0.35)",color:"#F0563A"}}>
                {Math.round(timelineZoom*100)}%
              </div>

              {/* Zoom In */}
              <button onClick={()=>setTimelineZoom(z=>Math.min(8,z*1.33))}
                className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-lg transition-all hover:scale-105 active:scale-95"
                style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"#e4e4e7"}}>
                +
              </button>

              {/* FIT */}
              <button onClick={()=>setTimelineZoom(1)}
                className="px-3 h-8 rounded-lg text-[11px] font-black transition-all hover:scale-105 active:scale-95"
                style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#a1a1aa"}}>
                FIT
              </button>

              <div className="flex-1"/>
              <span className="text-[10px] font-medium" style={{color:"rgba(255,255,255,0.2)"}}>
                ✦ Ctrl+scroll para zoom &nbsp;·&nbsp; arraste clips para reordenar
              </span>
            </div>

            {/* Scrollable outer wrapper */}
            <div ref={timelineScrollRef}
              className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden"
              style={{scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.1) transparent"}}
              onWheel={handleTimelineWheel}>

            {/* Fixed-width canvas — grows with video duration + zoom */}
            <div ref={timelineRef}
              className="relative select-none h-full"
              style={{
                width: `${Math.max(640, totalDur * 28 * timelineZoom)}px`,
                cursor:isDragging?"col-resize":"crosshair",
              }}
              onMouseDown={handleTimelineMouseDown}>

              {/* Ruler */}
              <div className="flex h-5 border-b sticky top-0 z-10" style={{background:"#080808",borderColor:"rgba(255,255,255,0.05)"}}>
                <div className="w-20 shrink-0 border-r" style={{borderColor:"rgba(255,255,255,0.05)"}}/>
                <div className="flex-1 relative">
                  {Array.from({length:Math.ceil(totalDur/5)+1}).map((_,i)=>(
                    <div key={i} className="absolute flex flex-col items-center" style={{left:`${(i*5/totalDur)*100}%`}}>
                      <div className="w-px h-2 mt-0.5" style={{background:"rgba(255,255,255,0.1)"}}/>
                      <span className="text-[7px] font-mono text-gray-500">{fmtTime(i*5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ TRILHA AV — Avatar / A-Roll ══ */}
              <div className="flex border-b" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="w-20 shrink-0 flex flex-col items-start justify-center border-r gap-1 px-2 py-1.5"
                  style={{borderColor:"rgba(255,255,255,0.06)",background:selectedLayer==="avatar"?"rgba(148,163,184,0.07)":"rgba(148,163,184,0.02)"}}>
                  <span className="text-[8px] font-black tracking-widest"
                    style={{color:selectedLayer==="avatar"?"rgba(148,163,184,1)":trackAVVisible?"rgba(148,163,184,0.6)":"rgba(148,163,184,0.2)"}}>AVATAR</span>
                  <div className="flex items-center gap-1">
                    <button title={trackAVVisible?"Ocultar":"Mostrar"} onClick={e=>{e.stopPropagation();setTrackAVVisible(v=>!v)}}
                      className="p-0.5 rounded transition-colors hover:bg-white/8">
                      {trackAVVisible?<Eye className="w-2.5 h-2.5 text-slate-500"/>:<EyeOff className="w-2.5 h-2.5 text-red-500/60"/>}
                    </button>
                    <button title={trackAVMuted?"Desmutar":"Mutar"} onClick={e=>{e.stopPropagation();setTrackAVMuted(m=>!m)}}
                      className="p-0.5 rounded transition-colors hover:bg-white/8">
                      {trackAVMuted?<VolumeX className="w-2.5 h-2.5 text-red-500/60"/>:<Volume2 className="w-2.5 h-2.5 text-slate-500"/>}
                    </button>
                  </div>
                </div>
                <div className="flex-1 relative h-11 flex items-center px-1 cursor-pointer"
                  onClick={()=>{setSelectedLayer(v=>v==="avatar"?null:"avatar");setLeftTab("inspector");}}>
                  <div className="absolute left-1 right-1 top-1.5 bottom-1.5 rounded-lg overflow-hidden transition-all duration-150"
                    style={{
                      background: selectedLayer==="avatar" ? "rgba(148,163,184,0.1)" : "rgba(100,116,139,0.08)",
                      border: `1px solid rgba(148,163,184,${selectedLayer==="avatar"?0.4:0.15})`,
                      opacity: trackAVVisible ? 1 : 0.25,
                      boxShadow: selectedLayer==="avatar" ? "0 0 0 1px rgba(148,163,184,0.2)" : "none",
                    }}>
                    <div className="absolute inset-0 flex items-center gap-px px-1">
                      {Array.from({length:90}).map((_,i)=>(
                        <div key={i} className="flex-1 rounded-full"
                          style={{background:"rgba(148,163,184,0.3)",height:`${18+Math.abs(Math.sin(i*1.3)*Math.cos(i*0.4))*64}%`}}/>
                      ))}
                    </div>
                    <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                      <span className="text-[7px] font-black select-none text-slate-500/50">
                        {uploadedVideoUrl?"Avatar UGC":"Avatar / Locutor"} · {Math.round(totalDur)}s
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ TRILHA V2 — B-Roll (clips coloridos sobre o avatar, com gaps) ══ */}
              <div className="flex border-b" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                {/* Track Header — V2 */}
                <div className="w-20 h-20 shrink-0 flex flex-col items-start justify-center border-r gap-1 px-2"
                  style={{borderColor:"rgba(255,255,255,0.06)",background:"rgba(232,89,60,0.03)"}}>
                  <span className="text-[10px] font-black tracking-wide" style={{color:trackBrollVisible?"rgba(232,89,60,1)":"rgba(232,89,60,0.25)"}}>🎬 B-ROLL</span>
                  <button title={trackBrollVisible?"Ocultar B-Rolls":"Mostrar B-Rolls"}
                    onClick={()=>setTrackBrollVisible(v=>!v)}
                    className="p-0.5 rounded transition-colors hover:bg-white/8">
                    {trackBrollVisible
                      ?<Eye className="w-3 h-3" style={{color:"rgba(232,89,60,0.7)"}}/>
                      :<EyeOff className="w-3 h-3" style={{color:"rgba(239,68,68,0.7)"}}/>}
                  </button>
                </div>
                <div className="flex-1 relative h-20">
                  {/* ── Gap indicators — "Avatar respira aqui" ── */}
                  {localDrScenes.length>0 && effectiveClips.map((clip,ci)=>{
                    const gapStart = clip.startSec + clip.durSec;
                    const sceneEnd = gapStart + (localDrScenes[clip.sceneIdx]?.duration??0) - clip.durSec;
                    const nextClipStart = ci+1<effectiveClips.length ? effectiveClips[ci+1].startSec : totalDur;
                    const gapDur = Math.max(0, nextClipStart - gapStart);
                    if(gapDur < 0.5) return null;
                    const gapLeft=(gapStart/totalDur)*100;
                    const gapW=(gapDur/totalDur)*100;
                    return (
                      <div key={`gap${ci}`}
                        className="absolute top-3 bottom-3 rounded-lg flex items-center justify-center pointer-events-none"
                        style={{
                          left:`calc(${gapLeft}% + 1px)`,width:`calc(${gapW}% - 2px)`,
                          background:"rgba(100,116,139,0.05)",
                          border:"1px dashed rgba(100,116,139,0.18)",
                        }}>
                        <span className="text-[6px] font-black uppercase tracking-wider"
                          style={{color:"rgba(100,116,139,0.35)"}}>AV</span>
                      </div>
                    );
                  })}
                  {effectiveClips.map(clip=>{
                    const left=(clip.startSec/totalDur)*100;
                    const width=(clip.durSec/totalDur)*100;
                    const isAct=currentClip?.id===clip.id;
                    const isLoad=loadingClipIds.has(clip.id);
                    const isDT=dragOverClipId===clip.id;
                    const isDraggingThis=dragClipSceneIdx===clip.sceneIdx;
                    const isSel=selectedLayer===clip.id;
                    const isBeingDragged=clipDrag?.clipId===clip.id;
                    return(
                      <div key={clip.id}
                        className={`v1clip group absolute top-1 bottom-1 rounded overflow-hidden
                          ${isAct?"ring-2 ring-orange-400/90 brightness-110":""}
                          ${isSel&&!isAct?"ring-2 ring-sky-400/90":""}
                          ${isDT&&!isDraggingThis?"ring-2 ring-blue-400 brightness-125":""}
                          ${isDraggingThis?"opacity-40 scale-y-95":""}
                          ${isBeingDragged?"opacity-80":""}`}
                        style={{
                          left:`calc(${left}% + 1px)`,width:`calc(${width}% - 2px)`,
                          cursor: clipDrag ? "grabbing" : "grab",
                          background: clip.thumb
                            ? `url(${clip.thumb}) center/cover no-repeat`
                            : clip.url ? `${clip.color}28` : `${clip.color}0d`,
                          border:`1px ${clip.url||clip.thumb?"solid":"dashed"} ${clip.color}${clip.url||clip.thumb?"77":"33"}`,
                          transition: isBeingDragged ? "none" : "left 0.05s,width 0.05s",
                        }}
                        onClick={e=>{e.stopPropagation();setSelectedLayer(isSel?null:clip.id);if(!isSel)setLeftTab("inspector");seekToTime(clip.startSec+0.01);}}
                        onDragOver={e=>{e.preventDefault();setDragOverClipId(clip.id);}}
                        onDragLeave={()=>setDragOverClipId(null)}
                        onDrop={e=>{
                          e.preventDefault();
                          setDragOverClipId(null);
                          if(dragSrcUrl){
                            handleDropOnClip(clip.id,dragSrcUrl);
                          } else if(dragClipSceneIdx!==null && dragClipSceneIdx!==clip.sceneIdx){
                            setLocalDrScenes(prev=>{
                              const next=[...prev];
                              [next[dragClipSceneIdx],next[clip.sceneIdx]]=[next[clip.sceneIdx],next[dragClipSceneIdx]];
                              return next;
                            });
                            setDragClipSceneIdx(null);
                          }
                        }}>
                        {/* ── Trim handle LEFT ── */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2.5 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                          style={{cursor:"ew-resize",background:"rgba(0,0,0,0.4)"}}
                          onMouseDown={e=>{
                            e.stopPropagation();e.preventDefault();
                            setClipDrag({clipId:clip.id,mode:"trim-left",startX:e.clientX,origStartSec:clip.startSec,origDurSec:clip.durSec});
                            setSelectedLayer(clip.id);setLeftTab("inspector");
                          }}>
                          <div className="w-0.5 h-4 rounded-full" style={{background:"rgba(255,255,255,0.7)"}}/>
                        </div>
                        {/* ── Move body ── */}
                        <div className="absolute inset-x-2.5 inset-y-0 z-10"
                          style={{cursor:clipDrag?"grabbing":"grab"}}
                          onMouseDown={e=>{
                            e.stopPropagation();e.preventDefault();
                            setClipDrag({clipId:clip.id,mode:"move",startX:e.clientX,origStartSec:clip.startSec,origDurSec:clip.durSec});
                            setSelectedLayer(clip.id);setLeftTab("inspector");
                          }}/>
                        {/* ── Trim handle RIGHT ── */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2.5 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                          style={{cursor:"ew-resize",background:"rgba(0,0,0,0.4)"}}
                          onMouseDown={e=>{
                            e.stopPropagation();e.preventDefault();
                            setClipDrag({clipId:clip.id,mode:"trim-right",startX:e.clientX,origStartSec:clip.startSec,origDurSec:clip.durSec});
                            setSelectedLayer(clip.id);setLeftTab("inspector");
                          }}>
                          <div className="w-0.5 h-4 rounded-full" style={{background:"rgba(255,255,255,0.7)"}}/>
                        </div>
                        {clip.thumb&&<div className="absolute inset-0 pointer-events-none" style={{background:"linear-gradient(to top,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.18) 60%,transparent 100%)"}}/>}
                        {isLoad?(
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{background:"rgba(0,0,0,0.5)"}}>
                            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                              style={{borderColor:`${clip.color}cc`,borderTopColor:"transparent"}}/>
                          </div>
                        ):(
                          <>
                            <div className="absolute bottom-0 left-0 right-0 flex items-center px-1.5 pb-1 pointer-events-none">
                              {!clip.url&&!clip.thumb&&<div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0 mr-0.5" style={{background:clip.color+"88"}}/>}
                              <span className="text-[7px] font-bold text-white/80 truncate drop-shadow">{clip.label}</span>
                            </div>
                            <div className="v1clip-overlay absolute inset-0 flex items-center justify-center"
                              style={{background:"rgba(0,0,0,0.55)"}}>
                              <button title="Sugerir outra mídia"
                                onClick={e=>{e.stopPropagation();setSelectedLayer(clip.id);setLeftTab("inspector");suggestAnother(clip.id);}}
                                className="flex items-center gap-1.5 hover:scale-110 transition-transform bg-black/60 rounded-full px-2 py-1">
                                <RefreshCw className="w-3 h-3 text-white"/>
                                <span className="text-[8px] text-white font-bold">Trocar</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── T1: Subtitle ── */}
              <div className="flex border-b" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="w-20 h-8 shrink-0 flex items-center justify-center border-r cursor-pointer transition-colors"
                  style={{
                    borderColor:"rgba(255,255,255,0.05)",
                    background: selectedLayer==="subtitle"?"rgba(234,179,8,0.08)":"transparent",
                  }}
                  onClick={()=>{setSelectedLayer(v=>v==="subtitle"?null:"subtitle");setLeftTab("inspector");}}>
                  <span className="text-[8px] font-black tracking-widest"
                    style={{color:selectedLayer==="subtitle"?"rgba(234,179,8,0.9)":"rgba(234,179,8,0.45)"}}>SUB</span>
                </div>
                <div className="flex-1 relative h-8 cursor-pointer"
                  onClick={()=>{setSelectedLayer(v=>v==="subtitle"?null:"subtitle");setLeftTab("inspector");}}>
                  {(localDrScenes.length>0?localDrScenes:localScenes).map((_row,i)=>{
                    const dur=localDrScenes.length?(localDrScenes[i] as DirectResponseScene).duration:(localScenes[i] as Scene).estimated_duration_seconds??5;
                    const text=localDrScenes.length?(localDrScenes[i] as DirectResponseScene).textSnippet:((localScenes[i] as Scene).text_chunk??(localScenes[i] as Scene).segment??"");
                    const left=(sceneStarts[i]/totalDur)*100;
                    const width=(dur/totalDur)*100;
                    const isActive=activeScene===i;
                    const isSel=selectedLayer==="subtitle";
                    return(
                      <div key={i} className="absolute top-0.5 bottom-0.5 rounded overflow-hidden flex items-center px-1.5"
                        style={{
                          left:`calc(${left}% + 1px)`,width:`calc(${width}% - 2px)`,
                          background:isSel?"rgba(234,179,8,0.12)":isActive?"rgba(234,179,8,0.1)":"rgba(234,179,8,0.04)",
                          border:`1px solid rgba(234,179,8,${isSel?0.4:isActive?0.3:0.1})`,
                        }}>
                        <span className="text-[6px] font-medium text-yellow-500/60 truncate">{text.slice(0,40)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── SFX ── */}
              <div className="flex border-b" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="w-20 h-9 shrink-0 flex items-center justify-between border-r px-2"
                  style={{borderColor:"rgba(255,255,255,0.05)"}}>
                  <span className="text-[8px] font-black tracking-widest text-amber-600/60">SFX</span>
                  <button title={trackSfxMuted?"Ativar":"Mutar"} onClick={()=>setTrackSfxMuted(m=>!m)}
                    className="p-0.5 rounded transition-colors hover:bg-white/8">
                    {trackSfxMuted
                      ?<VolumeX className="w-2.5 h-2.5 text-red-500/60"/>
                      :<Volume2 className="w-2.5 h-2.5 text-amber-600/40"/>}
                  </button>
                </div>
                <div className="flex-1 relative h-9 overflow-visible" style={{opacity:trackSfxMuted?0.2:1,transition:"opacity 0.2s"}}>
                  {sfxMarkers.length===0 && (
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className="text-[7px] text-gray-800 italic">Nenhum gatilho detectado</span>
                    </div>
                  )}
                  {sfxMarkers.map(marker=>{
                    const effTime=marker.timeSec+(sfxOffsets[marker.id]??0);
                    const left=Math.max(0,Math.min(100,(effTime/totalDur)*100));
                    const isNear=Math.abs(currentTime-effTime)<0.5;
                    const isDraggingThis=sfxDrag?.id===marker.id;
                    return (
                      <div key={marker.id}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 group/sfxpin"
                        style={{
                          left:`${left}%`,
                          cursor:sfxDrag?"grabbing":"grab",
                          transition:isDraggingThis?"none":"left 0.05s",
                        }}
                        onMouseDown={e=>{
                          e.stopPropagation();e.preventDefault();
                          setSfxDrag({id:marker.id,startX:e.clientX,origOffset:sfxOffsets[marker.id]??0});
                        }}>

                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none
                          opacity-0 group-hover/sfxpin:opacity-100 transition-opacity duration-150 z-50">
                          <div className="whitespace-nowrap text-[8px] font-bold text-white px-2 py-1 rounded-md shadow-2xl"
                            style={{background:"#18181b",border:"1px solid rgba(255,255,255,0.13)",boxShadow:"0 8px 24px rgba(0,0,0,0.7)"}}>
                            {marker.label}
                            {marker.keyword&&<span className="text-gray-500 ml-1">· "{marker.keyword}"</span>}
                          </div>
                          {/* Caret */}
                          <div className="w-2 h-2 mx-auto rotate-45 -mt-px"
                            style={{background:"#18181b",borderRight:"1px solid rgba(255,255,255,0.13)",borderBottom:"1px solid rgba(255,255,255,0.13)"}}/>
                        </div>

                        {/* Icon bubble */}
                        <button
                          onClick={e=>{e.stopPropagation();playSFXPreview(marker);seekToTime(marker.timeSec);}}
                          className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-110"
                          style={{
                            background:"#27272a",
                            border:`1px solid ${isNear?marker.color:"rgba(232,89,60,0.5)"}`,
                            boxShadow:isNear?`0 0 8px ${marker.color},0 0 18px ${marker.color}44`:"none",
                            transform:isNear?"scale(1.45)":"scale(1)",
                          }}>
                          {marker.kind==="zap"
                            ?<Zap      className="w-2.5 h-2.5" style={{color:isNear?marker.color:"#FF7A5C"}} fill={isNear?marker.color:"none"}/>
                            :<Volume2  className="w-2.5 h-2.5" style={{color:isNear?marker.color:"#FF7A5C"}}/>
                          }
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── A1: Voz ── */}
              <div className="flex border-b" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="w-20 h-10 shrink-0 flex items-center justify-between border-r px-2"
                  style={{borderColor:"rgba(255,255,255,0.05)"}}>
                  <span className="text-[8px] font-black tracking-widest text-emerald-600/60">VOZ</span>
                  <button title={trackA1Muted?"Ativar":"Mutar"} onClick={()=>setTrackA1Muted(m=>!m)}
                    className="p-0.5 rounded transition-colors hover:bg-white/8">
                    {trackA1Muted
                      ?<VolumeX className="w-2.5 h-2.5 text-red-500/60"/>
                      :<Volume2 className="w-2.5 h-2.5 text-emerald-600/40"/>}
                  </button>
                </div>
                <div className="flex-1 h-10 flex items-end overflow-hidden gap-px px-1"
                  style={{opacity:trackA1Muted?0.1:1,transition:"opacity 0.2s"}}>
                  {Array.from({length:120}).map((_,i)=>(
                    <div key={i} className="flex-1 rounded-sm" style={{background:"#10b981",opacity:0.5,height:`${12+Math.abs(Math.sin(i*1.7)*Math.cos(i*0.5))*88}%`}}/>
                  ))}
                </div>
              </div>

              {/* ── A2: Trilha ── */}
              <div className="flex">
                <div className="w-20 h-9 shrink-0 flex items-center justify-center border-r"
                  style={{borderColor:"rgba(255,255,255,0.05)"}}>
                  <span className="text-[8px] font-black tracking-widest text-red-600/40">TRILHA</span>
                </div>
                <div className="flex-1 h-9 flex items-end overflow-hidden gap-px px-1">
                  {Array.from({length:120}).map((_,i)=>(
                    <div key={i} className="flex-1 rounded-sm" style={{background:"#ef4444",opacity:0.25,height:`${8+Math.abs(Math.sin(i*2.3+1)*Math.cos(i*0.7))*92}%`}}/>
                  ))}
                </div>
              </div>

              {/* ── Red Playhead Needle ── */}
              <div className="absolute top-0 bottom-0 pointer-events-none z-20"
                style={{left:`calc(80px + (100% - 80px) * ${playheadPct/100})`,transform:"translateX(-50%)"}}>
                <div className="w-px h-full bg-red-500" style={{boxShadow:"0 0 8px rgba(239,68,68,0.7)"}}/>
                <div className="w-3 h-3 bg-red-500 rounded-full absolute -top-1 left-1/2 -translate-x-1/2" style={{boxShadow:"0 0 10px rgba(239,68,68,0.9)"}}/>
              </div>
            </div>
            </div>{/* end scroll wrapper */}
          </div>

          {/* Export bar */}
          <div className="flex items-center justify-between shrink-0 gap-2">
            <span className="text-[10px] text-gray-500">{timelineClips.length} clipes · {localDrScenes.length||localScenes.length} cenas · {result.music_style}</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={()=>setExportOpen(v=>!v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all hover:bg-white/5"
                  style={{background:"rgba(255,255,255,0.03)",borderColor:"rgba(255,255,255,0.08)",color:"#9ca3af"}}>
                  <Download className="w-3.5 h-3.5"/>Exportar<ChevronUp className={`w-3 h-3 transition-transform ${exportOpen?"":"rotate-180"}`}/>
                </button>
                {exportOpen&&(
                  <div className="absolute bottom-full mb-2 right-0 w-52 rounded-xl overflow-hidden z-30"
                    style={{background:"#111",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 -20px 40px rgba(0,0,0,0.6)"}}>
                    {[
                      {label:"Baixar Projeto Completo",icon:"📦",paywall:true},
                      {label:"Baixar Legendas (.srt)", icon:"💬",paywall:false,action:downloadSRT},
                      {label:"Baixar apenas Trilha",   icon:"🎵",paywall:false,action:downloadMusic},
                      {label:"Baixar Pack de Mídias",  icon:"🎬",paywall:true},
                    ].map(opt=>(
                      <button key={opt.label}
                        onClick={()=>{setExportOpen(false);if(opt.paywall)setPaywallOpen(true);else opt.action?.();}}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/6 transition-colors border-b last:border-0"
                        style={{borderColor:"rgba(255,255,255,0.05)"}}>
                        <span>{opt.icon}</span>
                        <span className="flex-1 text-gray-300">{opt.label}</span>
                        {opt.paywall&&<Lock className="w-3 h-3 text-amber-500"/>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={()=>setShowAdLib(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:bg-white/5"
                style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"#9ca3af"}}>
                <TrendingUp className="w-3.5 h-3.5"/>Biblioteca
              </button>
              <button onClick={()=>setPaywallOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                style={{background:"linear-gradient(135deg,rgba(251,191,36,0.1),rgba(245,158,11,0.06))",border:"1px solid rgba(251,191,36,0.3)",color:"#fbbf24"}}>
                <FileCode2 className="w-3.5 h-3.5"/>Premiere<Lock className="w-3 h-3"/>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ COL 3: Mídias Sugeridas + Trilha (26%) ══════════════════════ */}
      <div className="w-[26%] shrink-0 flex flex-col border-l overflow-hidden"
        style={{background:"#0a0a0a",borderColor:"rgba(255,255,255,0.05)"}}>

        <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <p className="text-[13px] font-black text-white uppercase tracking-widest" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2px"}}>Mídias Sugeridas</p>
          <span className="text-[9px] text-orange-400 font-bold flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"/>
            Cena {activeScene+1}/{localDrScenes.length||localScenes.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Alternatives — draggable to V1 */}
          <div className="p-3 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
              Alternativas · arraste para a timeline
            </p>
            {alternatives.length===0?(
              <p className="text-[10px] text-gray-500 py-3 text-center leading-relaxed">
                Passe o mouse em um bloco V1<br/>e clique em 🔄 para gerar alternativas
              </p>
            ):(
              <div className="grid grid-cols-2 gap-1.5">
                {alternatives.slice(0,6).map((opt,i)=>{
                  const altKey   = `${activeScene}-${i}`;
                  const isHovered= hoveredAltKey === altKey;
                  const altThumb = opt.thumb ?? GALLERY_CARDS[(activeScene*3+i) % GALLERY_CARDS.length].src;
                  return (
                  <div key={i}
                    className="relative rounded-lg overflow-hidden cursor-grab active:cursor-grabbing group/drag"
                    style={{aspectRatio:"16/9",border:`1px solid ${isHovered?"rgba(232,89,60,0.4)":"rgba(255,255,255,0.08)"}`}}
                    draggable
                    onDragStart={()=>setDragSrcUrl(opt.url)}
                    onDragEnd={()=>setDragSrcUrl(null)}
                    onMouseEnter={()=>setHoveredAltKey(altKey)}
                    onMouseLeave={()=>setHoveredAltKey(null)}>
                    {/* Thumbnail — hidden while hovering */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={altThumb} alt={`Alt ${i+1}`}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${isHovered?"opacity-0":"opacity-70"}`}
                      loading="lazy"/>
                    {/* Video preview — plays on hover */}
                    {opt.url && (
                      <video
                        src={isHovered ? opt.url : undefined}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${isHovered?"opacity-100":"opacity-0"}`}
                        autoPlay loop muted playsInline crossOrigin="anonymous"
                        onError={e=>{(e.currentTarget as HTMLVideoElement).style.display="none";}}
                      />
                    )}
                    {/* Overlay on hover */}
                    <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity gap-0.5 ${isHovered?"opacity-100":"opacity-0"}`}
                      style={{background:"rgba(0,0,0,0.35)"}}>
                      <GripVertical className="w-4 h-4 text-white/80"/>
                      <span className="text-[8px] text-white font-bold">Arrastar</span>
                    </div>
                    <button onClick={()=>{const cl=effectiveClips.find(c=>c.sceneIdx===activeScene);if(cl)handleDropOnClip(cl.id,opt.url,opt.thumb);}}
                      className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold text-white transition-opacity ${isHovered?"opacity-100":"opacity-0"}`}
                      style={{background:"rgba(232,89,60,0.9)"}}>
                      Usar
                    </button>
                    <div className="absolute top-1 left-1 px-1 py-0.5 rounded text-[7px] font-black text-white/60" style={{background:"rgba(0,0,0,0.6)"}}>Alt {i+1}</div>
                  </div>
                )})}
              </div>
            )}
          </div>

          {/* B-Rolls / Visual Concepts per scene */}
          <div className="p-3 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
              {localDrScenes.length>0?"Conceitos Visuais · IA":"B-Rolls por Cena"}
            </p>
            <div className="space-y-2">
              {(localDrScenes.length>0?localDrScenes:localScenes).map((_row,i)=>{
                const col=CLIP_COLS[i%CLIP_COLS.length];
                const isAct=activeScene===i;
                // DRS mode: show concept thumbnail + searchQuery
                if(localDrScenes.length>0){
                  const drs=localDrScenes[i];
                  const thumb=lookupConcept(drs.searchQueries[0]);
                  return(
                  <div key={i} className={`rounded-xl overflow-hidden border transition-all ${isAct?"border-orange-500/40":"border-transparent"}`}
                    style={{background:"rgba(255,255,255,0.025)"}}>
                    <div className="flex gap-2 p-2.5">
                      <div className="w-16 h-10 rounded-lg shrink-0 overflow-hidden relative"
                        style={{border:`1px solid ${col}44`}}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumb} alt={drs.emotion} className="w-full h-full object-cover opacity-85" loading="lazy"/>
                        <div className="absolute bottom-0.5 right-0.5 text-[7px] font-black px-1 rounded" style={{background:col+"aa",color:"#fff"}}>{i+1}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[7px] font-black uppercase px-1 py-0.5 rounded"
                            style={{background:`${col}22`,color:col}}>{drs.emotion}</span>
                          <span className="text-[7px] text-gray-500">{drs.duration.toFixed(1)}s</span>
                        </div>
                        {drs.searchQueries.map((q,qi)=>(
                          <p key={qi} className="text-[8px] truncate" style={{color:qi===0?"#9ca3af":"#4b5563"}}>
                            {qi===0?"🎯":"  ·"} {q}
                          </p>
                        ))}
                        {drs.suggestedSfx&&(
                          <p className="text-[7px] mt-0.5 text-gray-500">⚡ sfx: {drs.suggestedSfx}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex border-t" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                      <button onClick={()=>{const cl=effectiveClips.find(c=>c.sceneIdx===i);if(cl)suggestAnother(cl.id);}}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] text-gray-400 hover:text-orange-400 transition-colors border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                        <RefreshCw className="w-2.5 h-2.5"/>Sugerir Vídeo
                      </button>
                      <button onClick={()=>setPaywallOpen(true)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] text-gray-400 hover:text-orange-400 transition-colors">
                        <Download className="w-2.5 h-2.5"/>Baixar
                      </button>
                    </div>
                  </div>
                  );
                }
                // Legacy Scene mode
                const sc=localScenes[i];
                const vid=sc.video_url??sc.video_options?.[0]?.url;
                return(
                  <div key={i} className={`rounded-xl overflow-hidden border transition-all ${isAct?"border-orange-500/40":"border-transparent"}`}
                    style={{background:"rgba(255,255,255,0.025)"}}>
                    <div className="flex gap-2 p-2.5">
                      <div className="w-16 h-10 rounded-lg shrink-0 overflow-hidden relative"
                        style={{background:`${col}18`,border:`1px solid ${col}33`}}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getSceneThumb(sc, i)} alt={sc.segment} className="w-full h-full object-cover opacity-85" loading="lazy"/>
                        <div className="absolute bottom-0.5 right-0.5 text-[7px] font-black px-1 rounded" style={{background:col+"aa",color:"#fff"}}>{i+1}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-gray-300 truncate">{sc.segment}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-1">{sc.broll_search_keywords??sc.vault_category??"Pexels HD"}</p>
                        <p className="text-[9px] mt-0.5" style={{color:col+"cc"}}>{sc.estimated_duration_seconds??5}s</p>
                      </div>
                    </div>
                    <div className="flex border-t" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                      <button onClick={()=>{const cl=effectiveClips.find(c=>c.sceneIdx===i);if(cl)suggestAnother(cl.id);}}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] text-gray-400 hover:text-orange-400 transition-colors border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                        <RefreshCw className="w-2.5 h-2.5"/>Sugerir
                      </button>
                      <button onClick={()=>{if(vid)window.open(vid,"_blank");else setPaywallOpen(true);}}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] text-gray-400 hover:text-orange-400 transition-colors">
                        <Download className="w-2.5 h-2.5"/>Baixar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── SFX Sugeridos ── */}
          <div className="p-3 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-bold">SFX · Pontuação</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{color:"#FF7A5C",background:"rgba(232,89,60,0.1)",border:"1px solid rgba(232,89,60,0.25)"}}>
                {sfxMarkers.length} eventos
              </span>
            </div>

            {sfxMarkers.length===0?(
              <p className="text-[10px] text-gray-500 py-3 text-center">Nenhuma keyword detectada na copy</p>
            ):(
              <div className="space-y-1 max-h-[220px] overflow-y-auto pr-0.5">
                {sfxMarkers.map(marker=>{
                  const isActive=Math.abs(currentTime-marker.timeSec)<0.5;
                  return (
                    <div key={marker.id}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all ${isActive?"border-orange-500/30":"border-transparent"}`}
                      style={{
                        border:`1px solid`,
                        borderColor:isActive?"rgba(232,89,60,0.3)":"transparent",
                        background:isActive?"rgba(232,89,60,0.06)":"rgba(255,255,255,0.025)",
                        boxShadow:isActive?`0 0 12px rgba(232,89,60,0.1)`:"none",
                      }}>

                      {/* Play preview via Web Audio */}
                      <button onClick={()=>playSFXPreview(marker)}
                        className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all hover:scale-110"
                        style={{background:"rgba(232,89,60,0.1)",border:"1px solid rgba(232,89,60,0.3)"}}>
                        <Play className="w-2 h-2 text-orange-400 ml-0.5" fill="currentColor"/>
                      </button>

                      {/* Icon bubble */}
                      <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                        style={{background:"#27272a",border:`1px solid ${marker.color}55`}}>
                        {marker.kind==="zap"
                          ?<Zap     className="w-2.5 h-2.5" style={{color:marker.color}}/>
                          :<Volume2 className="w-2.5 h-2.5" style={{color:marker.color}}/>
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold truncate" style={{color:isActive?"#FF7A5C":"#d1d5db"}}>{marker.label}</p>
                        <p className="text-[8px] text-gray-500 mt-0.5">
                          {fmtTime(marker.timeSec)}
                          {marker.keyword?<span className="text-gray-400"> · "{marker.keyword}"</span>:<span className="text-gray-500"> · transição</span>}
                        </p>
                      </div>

                      {/* Seek to */}
                      <button onClick={()=>seekToTime(marker.timeSec)}
                        className="text-[10px] font-black text-gray-500 hover:text-orange-400 transition-colors shrink-0"
                        title="Ir para este momento">→</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trilha Sonora */}
          <div className="p-3">
            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">Trilha Sonora</p>
            <div className="space-y-2">
              {musicOptions.map((track,i)=>{
                const isSel=selectedMusic===i;const isPlay=playingMusic===i;
                return(
                  <div key={i} className={`rounded-xl p-2.5 border transition-all cursor-pointer ${isSel?"border-orange-500/35":"border-transparent"}`}
                    style={{background:isSel?"rgba(232,89,60,0.07)":"rgba(255,255,255,0.025)"}} onClick={()=>setSelectedMusic(i)}>
                    <div className="flex items-center gap-2">
                      <button onClick={e=>{e.stopPropagation();toggleMusic(i);}}
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                        style={{background:isPlay?"rgba(232,89,60,0.3)":"rgba(255,255,255,0.06)",border:"1px solid rgba(232,89,60,0.3)"}}>
                        {isPlay?<Pause className="w-3 h-3 text-orange-400" fill="currentColor"/>:<Play className="w-3 h-3 text-orange-400 ml-0.5" fill="currentColor"/>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-semibold truncate ${isSel?"text-orange-300":"text-gray-400"}`}>{track.title}</p>
                        <p className="text-[8px] text-gray-500">{track.is_premium_vault?"💎 Vault":"🎵 Curada por IA"}</p>
                      </div>
                      {isSel&&<Check className="w-3 h-3 text-orange-400 shrink-0"/>}
                    </div>
                    <div className="mt-1.5 flex items-end gap-px h-3 overflow-hidden rounded">
                      {Array.from({length:40}).map((_,j)=>(
                        <div key={j} className="flex-1 rounded-full"
                          style={{height:`${20+Math.abs(Math.sin((j+i*7)*0.9)*Math.cos((j+i*3)*0.7))*80}%`,background:isSel?"rgba(232,89,60,0.5)":"rgba(255,255,255,0.07)"}}/>
                      ))}
                    </div>
                    {track.url&&<audio ref={musicRefs[i]} src={track.url} loop preload="none"/>}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button onClick={downloadMusic}
                className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-bold border transition-all hover:bg-white/6"
                style={{borderColor:"rgba(255,255,255,0.07)",color:"#6b7280"}}>
                <Download className="w-2.5 h-2.5"/>Download
              </button>
              <button onClick={()=>setPaywallOpen(true)}
                className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-bold border transition-all hover:border-orange-500/40"
                style={{borderColor:"rgba(232,89,60,0.3)",color:"#FF7A5C",background:"rgba(232,89,60,0.06)"}}>
                <RefreshCw className="w-2.5 h-2.5"/>Trocar
              </button>
            </div>
          </div>
        </div>
      </div>

      {paywallOpen&&<PaywallModal onClose={()=>setPaywallOpen(false)}/>}

      {/* ── Winning Ads Library Drawer ── */}
      <WinningAdsDrawer open={showAdLib} onClose={()=>setShowAdLib(false)} onRaioX={handleRaioX}/>

      {/* ── Toast Notification ── */}
      <div className="fixed bottom-6 left-1/2 z-[60] pointer-events-none"
        style={{
          transition:"opacity 0.25s ease, transform 0.25s ease",
          opacity:toast?1:0,
          transform:toast?"translateX(-50%) translateY(0)":"translateX(-50%) translateY(16px)",
        }}>
        {toast&&(
          <div className="flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-semibold text-white"
            style={{
              background:"linear-gradient(135deg,#1a0f0d,#1a0f0d)",
              border:"1px solid rgba(232,89,60,0.5)",
              boxShadow:"0 8px 40px rgba(232,89,60,0.35), 0 0 0 1px rgba(232,89,60,0.2)",
              backdropFilter:"blur(12px)",
            }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 animate-spin"
              style={{border:"2px solid transparent",borderTopColor:"#FF7A5C",borderRightColor:"rgba(255,122,92,0.3)"}}>
            </div>
            {toast}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

// ─── generateMockDrsByDuration ────────────────────────────────────────────────
// Fills the ENTIRE video duration with DRS scenes (4–6s each), cycling phrases
// and Mixkit B-roll videos. No more 30s hard cap.
const MOCK_BROLL_POOL = [
  "https://assets.mixkit.co/videos/18296/18296-360.mp4",
  "https://assets.mixkit.co/videos/24354/24354-360.mp4",
  "https://assets.mixkit.co/videos/47583/47583-360.mp4",
  "https://assets.mixkit.co/videos/33376/33376-360.mp4",
  "https://assets.mixkit.co/videos/25575/25575-360.mp4",
  "https://assets.mixkit.co/videos/5601/5601-360.mp4",
];
function generateMockDrsByDuration(totalSec: number, lang: "auto"|"pt"|"en"|"es"): DirectResponseScene[] {
  const phrases_pt = [
    "Eu estava cansado","de trabalhar 12 horas","não conseguia pagar","as contas atrasadas.",
    "Minha esposa me olhava","com aquele olhar…","Um amigo me mostrou","esse método incrível.",
    "Em apenas 30 dias","tudo mudou de vez.","Hoje acordo sem alarme","trabalho de casa.",
    "Minha família está","orgulhosa de mim.","Se eu consegui,","você também consegue.",
    "Não perca mais tempo.","A janela vai fechar.","Essa é sua chance","de mudar tudo.",
    "Cada dia que passa","você está perdendo","dinheiro e oportunidade.","Aja agora.",
  ];
  const phrases_en = [
    "I was exhausted","working 12 hours","couldn't pay","my bills.",
    "My wife looked at me","with that look…","A friend showed me","this method.",
    "In just 30 days","everything changed.","Now I wake up","without an alarm.",
    "My family is","proud of me.","If I did it,","so can you.",
    "Don't waste more time.","The window is closing.","This is your chance","to change everything.",
    "Every passing day","you are losing","money and opportunity.","Act now.",
  ];
  const phrases_es = [
    "Estaba cansado","de trabajar 12 horas","no podía pagar","las cuentas.",
    "Mi esposa me miraba","con esa mirada…","Un amigo me mostró","este método.",
    "En solo 30 días","todo cambió.","Ahora me despierto","sin alarma.",
    "Mi familia está","orgullosa de mí.","Si yo pude,","tú también puedes.",
    "No pierdas más tiempo.","La ventana se cierra.","Esta es tu oportunidad","de cambiar todo.",
    "Cada día que pasa","estás perdiendo","dinero y oportunidad.","Actúa ahora.",
  ];
  const EMOTIONS = ["Dor","Revelação","Oportunidade","Urgência","Choque","CTA","Esperança","Mistério"];
  const phrases = lang==="en" ? phrases_en : lang==="es" ? phrases_es : phrases_pt;
  const scenes: DirectResponseScene[] = [];
  let cursor = 0; let idx = 0;
  while(cursor < totalSec - 0.5) {
    const remaining = totalSec - cursor;
    const dur = Math.min(remaining, 4 + (idx % 3) * 0.7); // 4s / 4.7s / 5.4s alternating
    if(dur < 1) break;
    const text  = phrases[idx % phrases.length];
    const vUrl  = MOCK_BROLL_POOL[idx % MOCK_BROLL_POOL.length];
    const vUrl2 = MOCK_BROLL_POOL[(idx+1) % MOCK_BROLL_POOL.length];
    scenes.push({
      id:           `mock-${idx}`,
      textSnippet:  text,
      duration:     dur,
      emotion:      EMOTIONS[idx % EMOTIONS.length],
      searchQueries:[text, text, text],
      suggestedSfx: null,
      videoUrl:     vUrl,
      thumbUrl:     null,
      videoOptions: [
        { url: vUrl,  thumb: "", query: text },
        { url: vUrl2, thumb: "", query: text },
      ],
    });
    cursor += dur; idx++;
  }
  return scenes;
}

// ─── buildDrsFromWhisper ──────────────────────────────────────────────────────
// Converte palavras reais do Whisper (com timestamps) em cenas DRS.
// Agrupa palavras em frases de ~5s cada, atribui emoções e B-rolls cíclicos.
function buildDrsFromWhisper(
  words: { word: string; start: number; end: number }[],
  totalDur: number,
): DirectResponseScene[] {
  if (!words.length) return [];
  const EMOTIONS = ["Dor","Revelação","Oportunidade","Urgência","Choque","CTA","Esperança","Mistério"];
  const TARGET_DUR = 5; // ~5 seconds per scene
  const scenes: DirectResponseScene[] = [];
  let sceneWords: typeof words = [];
  let sceneStart = words[0].start;

  for (let i = 0; i < words.length; i++) {
    sceneWords.push(words[i]);
    const elapsed = words[i].end - sceneStart;
    const isLast  = i === words.length - 1;
    // Cut scene every ~5s or at the last word
    if (elapsed >= TARGET_DUR || isLast) {
      const text = sceneWords.map(w => w.word).join(" ");
      const dur  = words[i].end - sceneStart;
      const idx  = scenes.length;
      scenes.push({
        id:           `whisper-${idx}`,
        textSnippet:  text,
        duration:     Math.max(dur, 1),
        emotion:      EMOTIONS[idx % EMOTIONS.length],
        searchQueries:[text.slice(0, 40), text.slice(0, 30), text.slice(0, 20)],
        suggestedSfx: null,
        videoUrl:     MOCK_BROLL_POOL[idx % MOCK_BROLL_POOL.length],
        thumbUrl:     null,
        videoOptions: [
          { url: MOCK_BROLL_POOL[idx % MOCK_BROLL_POOL.length],       thumb: "", query: text.slice(0,30) },
          { url: MOCK_BROLL_POOL[(idx+1) % MOCK_BROLL_POOL.length],   thumb: "", query: text.slice(0,30) },
        ],
      });
      sceneWords = [];
      if (!isLast) sceneStart = words[i + 1].start;
    }
  }

  // Se a última cena termina antes do fim do vídeo, estica a duração
  if (scenes.length > 0) {
    const lastScene = scenes[scenes.length - 1];
    const scenesEnd = scenes.reduce((sum, s) => sum + s.duration, 0);
    if (scenesEnd < totalDur - 1) {
      lastScene.duration += (totalDur - scenesEnd);
    }
  }

  return scenes;
}

// ─── WAV encoder helper ───────────────────────────────────────────────────────
function writeWavString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function audioBufferToWav(audioBuffer: AudioBuffer, targetRate = 16000): Blob {
  const origRate = audioBuffer.sampleRate;
  // Mix to mono
  let samples: Float32Array;
  if (audioBuffer.numberOfChannels === 1) {
    samples = audioBuffer.getChannelData(0);
  } else {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;
    samples = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) samples[i] = (left[i] + right[i]) * 0.5;
  }
  // Downsample
  if (origRate !== targetRate) {
    const ratio = origRate / targetRate;
    const newLen = Math.ceil(samples.length / ratio);
    const ds = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) ds[i] = samples[Math.floor(i * ratio)];
    samples = ds;
  }
  // Encode as 16-bit PCM WAV
  const pcmLen = samples.length * 2;
  const wavLen = 44 + pcmLen;
  const buf = new ArrayBuffer(wavLen);
  const v = new DataView(buf);
  writeWavString(v, 0, "RIFF");
  v.setUint32(4, wavLen - 8, true);
  writeWavString(v, 8, "WAVE");
  writeWavString(v, 12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, targetRate, true);
  v.setUint32(28, targetRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  writeWavString(v, 36, "data");
  v.setUint32(40, pcmLen, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    off += 2;
  }
  return new Blob([buf], { type: "audio/wav" });
}

// ─── extractAudioAsWav ────────────────────────────────────────────────────────
// Uses Web Audio API to decode video → extract audio → encode as WAV.
// This is INSTANT (no playback needed). Output: ~2MB per minute at 16kHz mono.
// Works with any video size — browser decodes the audio track directly.
async function extractAudioAsWav(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return audioBufferToWav(audioBuffer, 16000); // 16kHz mono WAV
  } finally {
    ctx.close();
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SuarikHome() {
  const router = useRouter();
  const { toasts, remove: removeToast, toast } = useToast();

  // ── User profile (loaded async from Supabase) ─────────────────────────────
  const [userInitials,  setUserInitials]  = useState("·");
  const [userDisplay,   setUserDisplay]   = useState("...");
  const [userPlan,      setUserPlan]      = useState("Free");
  const [userCredits,   setUserCredits]   = useState<number|null>(null);

  // ── Pending cross-tool payloads (read once at mount, before auth resolves) ──
  const [pendingTtsUrl,    setPendingTtsUrl]    = useState<string|null>(null);
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string|null>(null);

  const [copy,             setCopy]          = useState("");
  const [niche,            setNiche]         = useState("dr_nutra_pain");
  const [aspect,           setAspect]        = useState(0);
  const [isCopyOpen,       setCopyOpen]      = useState(false);
  const [error,            setError]         = useState<string|null>(null);
  const [result,           setResult]        = useState<GenerateResponse|null>(null);
  const [drScenes,         setDrScenes]      = useState<DirectResponseScene[]>([]);
  const [bgMusicUrl,       setBgMusicUrl]    = useState<string|undefined>(undefined);
  const [isUploadModalOpen,setUploadOpen]    = useState(false);
  const [isGenerating,     setIsGenerating]  = useState(false);
  const [isGenerated,      setIsGenerated]   = useState(false);
  const [paywallOpen,      setPaywallOpen]   = useState(false);
  const [activeTag,        setActiveTag]     = useState("All");
  const [homeToast,        setHomeToast]     = useState<string|null>(null);
  const [inputTab,         setInputTab]      = useState<"roteiro"|"video"|"tts">("roteiro");
  const [videoFile,        setVideoFile]     = useState<File|null>(null);
  // TTS home state
  const [homeTtsVoice,     setHomeTtsVoice]  = useState("English_expressive_narrator");
  const [homeTtsLoading,   setHomeTtsLoading]= useState(false);
  const [homeTtsUrl,       setHomeTtsUrl]    = useState<string|null>(null);
  const [homeTtsError,     setHomeTtsError]  = useState<string|null>(null);
  const [isDragOver,       setIsDragOver]    = useState(false);
  const [isEnriching,      setIsEnriching]   = useState(false);
  const [enrichStep,       setEnrichStep]    = useState(0); // 0-3
  const [videoLang,        setVideoLang]     = useState<"auto"|"pt"|"en"|"es">("auto");

  // ── Load user data from Supabase on mount ─────────────────────────────────
  useEffect(() => {
    const supabase = (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      return createClient();
    })();
    supabase.then(async (client) => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const name = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Usuário";
      const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
      setUserInitials(initials);
      setUserDisplay(name.split(" ")[0]);
      const { data: prof } = await client.from("profiles").select("plan,credits").eq("id", user.id).single();
      if (prof) {
        const planLabels: Record<string,string> = { free:"Free", starter:"Starter", pro:"PRO", agency:"Agency", premium:"Premium" };
        setUserPlan(planLabels[prof.plan] ?? "Free");
        setUserCredits(prof.credits ?? 0);
      }

      // ── Open upload modal flag (from /enricher redirect) ─────────────────
      const openUploadFlag = sessionStorage.getItem("vb_open_upload_modal");
      if (openUploadFlag) {
        sessionStorage.removeItem("vb_open_upload_modal");
        setUploadOpen(true);
        setInputTab("video");
      }

      // ── Restore last workstation session ONLY when explicitly requested ──────
      // (from /projects "Abrir no Editor", /timeline redirect, or other tools)
      // Do NOT auto-restore just because savedResult exists — user may want fresh start.
      const restoreRequested = sessionStorage.getItem("vb_restore_requested");
      sessionStorage.removeItem("vb_restore_requested");
      const savedResult   = sessionStorage.getItem("vb_project_result");
      const savedCopy     = sessionStorage.getItem("vb_project_copy");
      const savedDrScenes = sessionStorage.getItem("vb_project_drScenes");
      if (restoreRequested && savedResult && savedCopy) {
        try {
          const parsedResult   = JSON.parse(savedResult);
          const parsedDrScenes = savedDrScenes ? JSON.parse(savedDrScenes) : [];
          setCopy(savedCopy);
          setResult(parsedResult);
          setDrScenes(parsedDrScenes);
          if (parsedResult.background_tracks?.[0]?.url) setBgMusicUrl(parsedResult.background_tracks[0].url);
          setIsGenerated(true);
        } catch { /* ignore corrupt session data */ }
      }

      // ── Pending audio from Audio Studio / Voice Clone ──────────────────────
      const pendingAudioRaw = sessionStorage.getItem("vb_pending_audio");
      if (pendingAudioRaw) {
        sessionStorage.removeItem("vb_pending_audio");
        try {
          const pa = JSON.parse(pendingAudioRaw) as { url: string; label?: string };
          if (pa?.url) {
            setHomeTtsUrl(pa.url);
            setPendingTtsUrl(pa.url); // also pass to WorkstationView if session is restored
          }
        } catch { /* ignore */ }
      }

      // ── Pending video from DreamAct / LipSync / DreamFace ─────────────────
      const pendingVideoUrl = sessionStorage.getItem("vb_pending_video");
      const legacyAvatarUrl = sessionStorage.getItem("vb_pending_avatar_url");
      const avatarUrl = pendingVideoUrl ?? legacyAvatarUrl;
      if (pendingVideoUrl) sessionStorage.removeItem("vb_pending_video");
      if (legacyAvatarUrl) sessionStorage.removeItem("vb_pending_avatar_url");
      if (avatarUrl) {
        setPendingAvatarUrl(avatarUrl);
        setInputTab("video");
        // If no saved session, create a minimal one so WorkstationView opens
        const hasSavedSession = !!sessionStorage.getItem("vb_project_result");
        if (!hasSavedSession) {
          const emptyResult = { project_vibe: "ugc", music_style: "Suspense", scenes: [], background_tracks: [] };
          sessionStorage.setItem("vb_project_result", JSON.stringify(emptyResult));
          sessionStorage.setItem("vb_project_copy", "Avatar");
          sessionStorage.setItem("vb_project_drScenes", "[]");
          sessionStorage.setItem("vb_restore_requested", "1");
          setResult(emptyResult as GenerateResponse);
          setDrScenes([]);
          setCopy("Avatar");
          setIsGenerated(true);
        }
      }
    });
  }, []);

  const fireHomeToast = useCallback((msg: string) => {
    setHomeToast(msg);
    setTimeout(() => setHomeToast(null), 3500);
  }, []);

  const handleHomeRaioX = useCallback((ad: WinningAd) => {
    fireHomeToast(`🧬 A IA está analisando "${ad.title}"…`);
  }, [fireHomeToast]);

  const aspectFormats = ["landscape","portrait","landscape"] as const;
  const themeMap: Record<number,string> = { 0:"vsl_long", 1:"social_organic", 2:"cinematic" };

  const handleHomeTts = async () => {
    if (!copy.trim() || homeTtsLoading) return;
    setHomeTtsLoading(true);
    setHomeTtsError(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: copy.trim(), voiceId: homeTtsVoice }),
      });
      if (!res.ok) {
        const d = await res.json().catch(()=>({error:"Erro desconhecido"}));
        throw new Error(d.error ?? "Erro ao gerar voz");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setHomeTtsUrl(prev => { if(prev) URL.revokeObjectURL(prev); return url; });
    } catch(e: unknown) {
      setHomeTtsError(e instanceof Error ? e.message : "Erro ao gerar voz");
    } finally {
      setHomeTtsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!copy.trim() || isGenerating) return;
    setIsGenerating(true); setIsGenerated(false); setError(null); setResult(null);
    try {
      // ── Fire both API calls in parallel ─────────────────────────────────
      // /api/generate        → media enrichment (Pexels, Freesound, vault)
      // /api/generate-timeline → real OpenAI DRS analysis (source of truth)
      // Promise.all guarantees minimum 3s loading animation even on fast connections.
      const [[data, drs]] = await Promise.all([
        Promise.all([
          // 1. Media + legacy scene structure
          fetch("/api/generate", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body:JSON.stringify({copy, videoFormat:themeMap[aspect], videoTheme:niche, format:aspectFormats[aspect]}),
          }).then(async res=>{
            const d = await res.json() as GenerateResponse;
            if(!res.ok) throw new Error((d as {error?:string}).error??"Erro ao gerar.");
            return d;
          }),
          // 2. OpenAI DRS analysis + Pexels dual-source + music (generate-timeline)
          fetch("/api/generate-timeline", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body:JSON.stringify({copy}),
          }).then(async res=>{
            if(!res.ok){
              console.warn("[generate-timeline] API falhou, usando análise local.");
              return { scenes: analyzeCopyForDirectResponse(copy), backgroundMusicUrl: undefined, backgroundTracks: undefined };
            }
            const d = await res.json();
            if(d?.scenes && Array.isArray(d.scenes) && d.scenes.length>0)
              return {
                scenes: d.scenes as DirectResponseScene[],
                backgroundMusicUrl: d.backgroundMusicUrl as string|undefined,
                backgroundTracks:   d.backgroundTracks as BackgroundTrack[]|undefined,
              };
            if(Array.isArray(d) && d.length>0)
              return { scenes: d as DirectResponseScene[], backgroundMusicUrl: undefined, backgroundTracks: undefined };
            return { scenes: analyzeCopyForDirectResponse(copy), backgroundMusicUrl: undefined, backgroundTracks: undefined };
          }),
        ]),
        new Promise<void>(r=>setTimeout(r,3000)), // minimum 3s loading screen
      ]);

      // Merge DRS background tracks into result (DRS tracks are better quality)
      const mergedResult = drs.backgroundTracks?.length
        ? {...data, background_tracks: drs.backgroundTracks}
        : data;
      sessionStorage.setItem("vb_project_result", JSON.stringify(mergedResult));
      sessionStorage.setItem("vb_project_copy", copy);
      sessionStorage.setItem("vb_project_drScenes", JSON.stringify(drs.scenes));
      setResult(mergedResult);
      setDrScenes(drs.scenes);
      if(drs.backgroundMusicUrl) setBgMusicUrl(drs.backgroundMusicUrl);
      // Carry home TTS audio into WorkstationView as the narration track
      if(homeTtsUrl) setPendingTtsUrl(homeTtsUrl);
      setIsGenerated(true);
      // ── Save to Projects ──────────────────────────────────────────────────
      toast.success(`Storyboard com ${data.scenes?.length ?? 0} cenas gerado! 🎬`);
      fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "storyboard",
          title: copy.trim().slice(0, 80) || "Storyboard sem título",
          meta: { scenes: data.scenes?.length ?? 0, niche, aspect },
        }),
      }).catch(() => {});
    } catch(e:unknown){
      setError(e instanceof Error?e.message:"Erro ao gerar.");
      toast.error(e instanceof Error?e.message:"Erro ao gerar storyboard.");
    } finally{
      setIsGenerating(false);
    }
  };

  const handleBack = () => { setIsGenerated(false); setResult(null); setIsEnriching(false); setEnrichStep(0); };

  // ── Enrichment flow — upload REAL + Whisper REAL + mock B-rolls ───────────
  const ENRICH_STEPS = [
    "🔗 Solicitando passe de segurança...",
    "☁️ Enviando vídeo para a nuvem...",
    "🎧 Extraindo áudio + transcrevendo com Whisper IA...",
    "🎬 GPT-4o analisando cenas + buscando B-rolls HD...",
  ];
  const [r2PublicUrl, setR2PublicUrl] = useState<string|null>(null);
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [whisperWords, setWhisperWords] = useState<WhisperWord[]>([]);

  const handleEnrich = async () => {
    if (!videoFile || isEnriching) return;
    setIsEnriching(true);
    setEnrichStep(0); // "🔗 Solicitando passe de segurança..."
    setError("");

    try {
      // ── 1. Probe video duration ──────────────────────────────────────────
      const videoDuration = await new Promise<number>((resolve) => {
        const probe = document.createElement("video");
        const probeUrl = URL.createObjectURL(videoFile);
        probe.preload = "metadata";
        probe.src = probeUrl;
        probe.onloadedmetadata = () => {
          const dur = isFinite(probe.duration) && probe.duration > 0
            ? probe.duration : 60;
          URL.revokeObjectURL(probeUrl);
          resolve(dur);
        };
        probe.onerror = () => {
          URL.revokeObjectURL(probeUrl);
          resolve(60); // fallback
        };
      });

      // ── 2 & 3. Upload DIRETO ao R2 (presigned URL, sem proxy) ────────────
      setEnrichStep(1); // "☁️ Enviando vídeo para a nuvem..."
      setUploadProgress(0);

      // Get presigned URL from our backend
      const presignRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: videoFile.name,
          contentType: videoFile.type || "video/mp4",
        }),
      });
      if (!presignRes.ok) {
        const errBody = await presignRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Falha ao solicitar URL de upload (${presignRes.status})`);
      }
      const { uploadUrl, publicUrl } = await presignRes.json();

      // Upload via proxy (evita CORS do R2)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `/api/upload/proxy?target=${encodeURIComponent(uploadUrl)}`);
        xhr.setRequestHeader("Content-Type", videoFile.type || "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) { setUploadProgress(100); resolve(); }
          else reject(new Error(`Upload falhou (HTTP ${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Erro de rede no upload. Tente novamente."));
        xhr.send(videoFile);
      });

      // ── Upload concluído! Salva a URL pública do R2 ──────────────────────
      setR2PublicUrl(publicUrl);

      // ── 4. Extract audio + Whisper Transcription ──────────────────────
      setEnrichStep(2); // "🎧 Transcrevendo áudio com Whisper IA..."
      setUploadProgress(0);

      let whisperText = "";
      let whisperWords: { word: string; start: number; end: number }[] = [];

      try {
        // Strategy: extract audio as WAV in browser (instant via Web Audio API)
        // then upload the small WAV to R2, and send R2 URL to Whisper.
        // WAV at 16kHz mono = ~2MB/min — tiny compared to 70MB+ video files.
        console.log(`[Whisper] Extraindo áudio do vídeo (${(videoFile.size/1024/1024).toFixed(1)}MB)...`);

        const wavBlob = await extractAudioAsWav(videoFile);
        console.log(`[Whisper] WAV extraído: ${(wavBlob.size/1024).toFixed(0)}KB`);

        // Upload WAV to R2 (small file, fast)
        const wavPresignRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: videoFile.name.replace(/\.[^.]+$/, ".wav"),
            contentType: "audio/wav",
          }),
        });

        let audioPublicUrl: string | null = null;

        if (wavPresignRes.ok) {
          const { uploadUrl: wavUploadUrl, publicUrl: wavPublicUrl } = await wavPresignRes.json();
          // Upload WAV via proxy (evita CORS do R2)
          const wavUpRes = await fetch(`/api/upload/proxy?target=${encodeURIComponent(wavUploadUrl)}`, {
            method: "PUT",
            headers: { "Content-Type": "audio/wav" },
            body: wavBlob,
          });
          if (wavUpRes.ok || wavUpRes.status === 200) {
            audioPublicUrl = wavPublicUrl;
            console.log(`[Whisper] WAV uploaded to R2: ${wavPublicUrl}`);
          } else {
            console.warn("[Whisper] WAV upload failed:", wavUpRes.status);
          }
        }

        // Send to Whisper via R2 URL (server downloads small WAV)
        if (audioPublicUrl) {
          const txRes = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicUrl: audioPublicUrl }),
          });
          if (txRes.ok) {
            const txData = await txRes.json();
            whisperText  = txData.text  || "";
            whisperWords = txData.words || [];
            setWhisperWords(whisperWords);
            console.log(`[Whisper] OK — ${whisperWords.length} words, ${whisperText.length} chars`);
          } else {
            const errData = await txRes.json().catch(() => ({}));
            console.warn("[Whisper] Transcription failed:", txRes.status, errData);
          }
        }
      } catch (audioErr) {
        console.warn("[Whisper] Audio extraction failed, trying R2 video URL as fallback:", audioErr);
        // Fallback: try sending original video R2 URL (works for small videos)
        try {
          const txRes = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicUrl }),
          });
          if (txRes.ok) {
            const txData = await txRes.json();
            whisperText  = txData.text  || "";
            whisperWords = txData.words || [];
            setWhisperWords(whisperWords);
            console.log(`[Whisper] Fallback OK — ${whisperWords.length} words`);
          }
        } catch { /* silent */ }
      }

      // ── 5. GPT-4o + Pexels + Freesound — B-rolls REAIS ──────────────────
      setEnrichStep(3); // "🎬 GPT-4o analisando cenas + buscando B-rolls HD..."

      let finalDrs: DirectResponseScene[];
      let backgroundMusicUrl: string | undefined;
      let enrichBgTracks: BackgroundTrack[] = [];

      if (whisperText) {
        // ── Transcrição disponível → GPT-4o analisa + Pexels busca B-rolls ──
        try {
          const enrichRes = await fetch("/api/enrich-scenes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: whisperText,
              words: whisperWords,
              videoDuration,
            }),
          });
          if (enrichRes.ok) {
            const enrichData = await enrichRes.json();
            finalDrs = enrichData.scenes || [];
            backgroundMusicUrl = enrichData.backgroundMusicUrl;
            if (enrichData.backgroundTracks?.length) enrichBgTracks = enrichData.backgroundTracks;
          } else {
            console.warn("[enrich-scenes] Falhou, usando fallback local. Status:", enrichRes.status);
            finalDrs = whisperWords.length > 0
              ? buildDrsFromWhisper(whisperWords, videoDuration)
              : analyzeCopyForDirectResponse(whisperText);
          }
        } catch (enrichErr) {
          console.warn("[enrich-scenes] Erro de rede, usando fallback:", enrichErr);
          finalDrs = whisperWords.length > 0
            ? buildDrsFromWhisper(whisperWords, videoDuration)
            : analyzeCopyForDirectResponse(whisperText);
        }
      } else {
        // ── Sem transcrição — use whisper-based fallback or show warning ──
        console.error("[handleEnrich] Whisper não retornou transcrição. Usando fallback.");
        finalDrs = buildDrsFromWhisper([], videoDuration); // empty = no real subtitles
        // Show the user a warning that transcription failed
        setError("⚠️ Não foi possível transcrever o áudio do vídeo. As legendas podem não corresponder ao conteúdo real. Tente novamente ou use um vídeo menor.");
      }

      const finalResult: GenerateResponse = {
        project_vibe: "ugc_alto_impacto",
        music_style:  "Suspense Emocional",
        scenes: [],
        background_tracks: enrichBgTracks.length ? enrichBgTracks : [
          ...(backgroundMusicUrl ? [{ url: backgroundMusicUrl, title: "Trilha Principal (IA)", is_premium_vault: true }] : []),
          { url: "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3", title: "Epic Orchestral Cinematic", is_premium_vault: true },
          { url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", title: "Dark Tension Loop", is_premium_vault: false },
        ].slice(0, 3),
      };
      sessionStorage.setItem("vb_project_result", JSON.stringify(finalResult));
      sessionStorage.setItem("vb_project_copy", videoFile?.name ?? "Vídeo enriquecido");
      sessionStorage.setItem("vb_project_drScenes", JSON.stringify(finalDrs));
      setResult(finalResult);
      setDrScenes(finalDrs);
      if(homeTtsUrl) setPendingTtsUrl(homeTtsUrl);
      if (backgroundMusicUrl) setBgMusicUrl(backgroundMusicUrl);
      setIsEnriching(false);
      setEnrichStep(0);
      setIsGenerated(true);
      toast.success("Vídeo enriquecido com IA! 🎬");
      fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "storyboard",
          title: videoFile?.name ?? "Vídeo enriquecido",
          meta: { enriched: true },
        }),
      }).catch(() => {});

    } catch (err: unknown) {
      setIsEnriching(false);
      setEnrichStep(0);
      const msg = err instanceof Error ? err.message : "Erro inesperado no upload.";
      setError(msg);
      toast.error(msg);
    }
  };

  // Full-screen workstation mode
  if (isGenerated && result) {
    return <WorkstationView result={result} copy={copy} drScenes={drScenes} initialBgMusicUrl={bgMusicUrl} videoFile={videoFile} whisperWords={whisperWords} initialTtsUrl={pendingTtsUrl} initialAvatarUrl={pendingAvatarUrl} onBack={handleBack}/>;
  }

  // Has content ready to process?
  const hasContent = !!(videoFile || copy.trim());

  // ─── Script Analysis (computed from copy) ──────────────────────────────
  const scriptScenes = useMemo(() =>
    copy.trim().split(/\n\n+/).filter(p => p.trim().length > 10),
    [copy]
  );

  const wordCount = useMemo(() =>
    copy.trim() ? copy.trim().split(/\s+/).length : 0,
    [copy]
  );

  const estimatedDurationSec = useMemo(() =>
    Math.round(wordCount / 2.8),
    [wordCount]
  );

  const estimatedDurationFmt = useMemo(() => {
    const m = Math.floor(estimatedDurationSec / 60);
    const s = estimatedDurationSec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }, [estimatedDurationSec]);

  const detectedPowerWords = useMemo(() => {
    if (!copy) return [];
    const words = copy.toLowerCase().split(/\s+/);
    const found = new Set<string>();
    words.forEach(w => {
      const clean = w.replace(/[^a-záéíóúãõçêâîôû]/g, "");
      if (POWER_WORDS.has(clean)) found.add(clean);
    });
    return Array.from(found);
  }, [copy]);

  const brollSuggestions = useMemo(() => {
    if (!copy) return [];
    const words = copy.toLowerCase().split(/\s+/);
    const found: Array<{word: string; img: string}> = [];
    const seen = new Set<string>();
    words.forEach(w => {
      const clean = w.replace(/[^a-záéíóúãõçêâîôû]/g, "");
      if (BROLL_IMAGES[clean] && !seen.has(clean)) {
        seen.add(clean);
        found.push({word: clean, img: BROLL_IMAGES[clean]});
      }
    });
    return found;
  }, [copy]);

  const engagementScore = useMemo(() => {
    if (!copy || wordCount === 0) return 0;
    const powerCount = detectedPowerWords.length;
    const brollCount = brollSuggestions.length;
    const sceneCount = scriptScenes.length;
    const score = Math.min(100, Math.round(
      (powerCount / Math.max(1, wordCount / 30)) * 40 +
      (brollCount / Math.max(1, sceneCount)) * 35 +
      Math.min(25, sceneCount * 8)
    ));
    return score;
  }, [copy, wordCount, detectedPowerWords, brollSuggestions, scriptScenes]);

  return (
    <>
    <style>{`
      @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @keyframes grainShift{0%{transform:translate(0,0)}10%{transform:translate(-2%,-2%)}20%{transform:translate(1%,1%)}30%{transform:translate(-1%,2%)}40%{transform:translate(2%,-1%)}50%{transform:translate(-2%,1%)}60%{transform:translate(1%,-2%)}70%{transform:translate(-1%,-1%)}80%{transform:translate(2%,2%)}90%{transform:translate(-2%,0%)}100%{transform:translate(0,0)}}
      @keyframes glowPulse{0%,100%{box-shadow:0 0 20px rgba(240,86,58,0.25),0 4px 15px rgba(240,86,58,0.3)}50%{box-shadow:0 0 35px rgba(240,86,58,0.45),0 4px 25px rgba(240,86,58,0.4),0 0 80px rgba(240,86,58,0.12)}}
      @keyframes heroIn{from{opacity:0;transform:translateY(20px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes videoScroll{0%{transform:translateY(0)}100%{transform:translateY(-33.333%)}}
      .hook-card{transition:all 0.25s cubic-bezier(0.4,0,0.2,1)}
      .hook-card:hover{border-color:rgba(240,86,58,0.4)!important;transform:translateY(-2px)}
    `}</style>

    {/* ═══ SIDEBAR FIXA ═══ */}
    <aside className="fixed top-0 left-0 h-screen w-64 flex flex-col z-50" style={{background:"#09090b",borderRight:"1px solid rgba(255,255,255,0.06)"}}>
      {/* ── Logo ── */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm" style={{background:"#F0563A",boxShadow:"0 0 20px rgba(240,86,58,0.35)"}}>S</div>
        <span className="text-xl text-white" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2.5px"}}>SUARIK</span>
      </div>

      {/* ── Workspace Selector ── */}
      <button className="mx-4 mb-5 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/[0.04]"
        style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">Workstation</p>
          <p className="text-[13px] text-zinc-300 font-medium truncate">Meu Estúdio</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-600 shrink-0"/>
      </button>

      {/* ── Navigation ── */}
      <nav className="flex flex-col gap-1 px-3">
        <button onClick={()=>handleBack()} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all"
          style={{background:"rgba(240,86,58,0.1)",border:"1px solid rgba(240,86,58,0.15)"}}>
          <Plus className="w-4 h-4" style={{color:"#F0563A"}}/>
          Novo Criativo
        </button>
        <button onClick={()=>handleBack()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all">
          <BookOpen className="w-4 h-4"/>
          Biblioteca de Hooks
        </button>
        <button onClick={()=>router.push("/settings")}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all">
          <Settings className="w-4 h-4"/>
          Configurações
        </button>
      </nav>

      {/* ── Spacer ── */}
      <div className="flex-1"/>

      {/* ── User & Credits Footer ── */}
      <div className="mx-3 mb-4 px-3 py-3 rounded-xl" style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.05)"}}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{background:"linear-gradient(135deg,#F0563A,#FF7A5C)"}}>
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-zinc-300 truncate">{userDisplay}</p>
            <p className="text-[10px] text-zinc-600 font-medium">Plano {userPlan}</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{background:"rgba(255,255,255,0.03)"}}>
          <span className="text-[10px]">{userCredits === null ? "⏳" : userCredits > 0 ? "🟢" : "🔴"}</span>
          <span className="text-[11px] font-semibold text-zinc-400">
            {userCredits === null ? "Carregando..." : `${userCredits.toLocaleString("pt-BR")} Créditos`}
          </span>
        </div>
      </div>
    </aside>

    {/* ═══ MAIN CANVAS (offset by sidebar) ═══ */}
    <div className="min-h-screen relative overflow-y-auto ml-64" style={{background:"#09090b",color:"#F5F3F0",fontFamily:"'DM Sans',sans-serif"}}>
      {/* Grain overlay */}
      <div className="fixed inset-0 pointer-events-none z-[9990] opacity-30" style={{backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,animation:"grainShift 0.5s steps(4) infinite"}}/>

      {/* ═══ MAIN CONTENT ═══ */}
      {isEnriching ? (
        /* ── Enriching Full-Screen ── */
        <div className="flex flex-col items-center justify-center gap-8 px-8 min-h-[80vh]" style={{animation:"heroIn 0.5s ease both"}}>
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full animate-spin" style={{border:"3px solid transparent",borderTopColor:"#F0563A",borderRightColor:"rgba(240,86,58,0.3)"}}/>
            <div className="absolute inset-2 rounded-full animate-spin" style={{border:"2px solid transparent",borderTopColor:"#FF7A5C",animationDirection:"reverse",animationDuration:"1.4s"}}/>
            <div className="absolute inset-0 flex items-center justify-center">
              <Film className="w-8 h-8" style={{color:"#F0563A"}}/>
            </div>
          </div>
          <div className="w-full max-w-sm space-y-2.5">
            {ENRICH_STEPS.map((msg, i) => {
              const done = i < enrichStep, active = i === enrichStep, pending = i > enrichStep;
              return (
                <div key={i} className="flex flex-col gap-0 px-4 py-3 rounded-xl transition-all duration-500"
                  style={{
                    background: active?"rgba(240,86,58,0.08)":done?"rgba(52,211,153,0.05)":"rgba(255,255,255,0.02)",
                    border:`1px solid ${active?"rgba(240,86,58,0.35)":done?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.04)"}`,
                    opacity: pending?0.3:1,
                  }}>
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                      {done ? <Check className="w-4 h-4 text-emerald-400"/>
                        : active ? <div className="w-4 h-4 rounded-full border-2 border-orange-400/20 border-t-orange-400 animate-spin"/>
                        : <div className="w-2 h-2 rounded-full bg-white/8"/>}
                    </div>
                    <span className={`text-[13px] font-medium ${active?"text-orange-300":done?"text-emerald-400":"text-zinc-600"}`}>{msg}</span>
                  </div>
                  {i===1 && active && uploadProgress>0 && (
                    <>
                      <div className="w-full mt-2.5 h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
                        <div className="h-full rounded-full transition-all duration-300" style={{width:`${uploadProgress}%`,background:uploadProgress>=100?"linear-gradient(90deg,#22c55e,#10b981)":"linear-gradient(90deg,#FF7A5C,#F0563A)"}}/>
                      </div>
                      <span className="text-[10px] font-mono mt-1" style={{color:uploadProgress>=100?"#22c55e":"#FF7A5C"}}>{uploadProgress>=100?"✓ Upload concluído":`${uploadProgress}%`}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {videoFile && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
              <Film className="w-3.5 h-3.5 text-zinc-500 shrink-0"/>
              <span className="text-[11px] text-zinc-400 truncate max-w-[240px]">{videoFile.name}</span>
              <span className="text-[10px] text-zinc-500 shrink-0">{(videoFile.size/1024/1024).toFixed(1)} MB</span>
            </div>
          )}
          <p className="text-[12px] text-zinc-600">A IA está enriquecendo seu vídeo com B-rolls, legendas e SFX sincronizados…</p>
        </div>
      ) : isGenerating ? (
        <div className="min-h-[80vh] flex items-center justify-center"><GeneratingView/></div>
      ) : (
        /* ═══ OBSIDIAN SCRIPT EDITOR ═══ */
        <div className="flex flex-col h-screen overflow-hidden" style={{background:"#0d0d0f"}}>
          {/* ── Top header ── */}
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b" style={{borderColor:"rgba(255,255,255,0.05)",background:"rgba(9,9,11,0.95)"}}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                <FileCode2 className="w-3.5 h-3.5"/>
                Estúdio de Script
              </div>
              <div className="w-px h-4 bg-white/5"/>
              {/* Tab nav */}
              <div className="flex gap-0.5">
                {[
                  {tab:"roteiro", label:"Roteiro"},
                  {tab:"video", label:"Enviar Vídeo"},
                  {tab:"tts", label:"🎙 Voz"},
                ].map(({tab, label}) => (
                  <button key={tab} onClick={()=>setInputTab(tab as "roteiro"|"video"|"tts")}
                    className="px-3 py-1 text-[11px] font-semibold rounded-md transition-all"
                    style={{background:inputTab===tab?"rgba(240,86,58,0.15)":"transparent",color:inputTab===tab?"#FF7A5C":"rgba(255,255,255,0.5)",borderBottom:inputTab===tab?"2px solid #F0563A":"none"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Right: word count + options */}
            <div className="flex items-center gap-4">
              {copy && <span className="text-[10px] text-zinc-600">{wordCount} palavras · ~{estimatedDurationFmt}</span>}
              <select value={aspect} onChange={e=>setAspect(+e.target.value)} disabled={isGenerating}
                className="text-[10px] text-zinc-400 px-2 py-1 rounded appearance-none cursor-pointer focus:outline-none"
                style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
                {ASPECTS.map((a,i)=><option key={i} value={i}>{a}</option>)}
              </select>
              <select value={niche} onChange={e=>setNiche(e.target.value)} disabled={isGenerating}
                className="text-[10px] text-zinc-400 px-2 py-1 rounded appearance-none cursor-pointer focus:outline-none"
                style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
                {NICHES.map(g=>(<optgroup key={g.group} label={`── ${g.group}`}>{g.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>))}
              </select>
            </div>
          </div>

          {/* ── Body: 3 columns ── */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Scene outline + templates */}
            <div className="w-48 shrink-0 flex flex-col border-r" style={{borderColor:"rgba(255,255,255,0.05)",background:"rgba(9,9,11,0.6)"}}>
              <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">Estrutura</div>
              <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                {scriptScenes.map((s, i) => (
                  <button key={i}
                    className="w-full text-left px-2 py-2 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all truncate border border-transparent hover:border-zinc-700">
                    <span className="text-[9px] font-mono text-zinc-700 mr-1.5">{String(i+1).padStart(2,"0")}</span>
                    {s.slice(0,40)}{s.length>40?"…":""}
                  </button>
                ))}
                {scriptScenes.length === 0 && <div className="text-[10px] text-zinc-700 p-2">Cole um roteiro para ver cenas</div>}
              </div>
              {/* Templates */}
              <div className="px-3 py-2 border-t" style={{borderColor:"rgba(255,255,255,0.05)"}}>
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Modelos</div>
                <div className="space-y-1">
                  {TEMPLATES.map(t => (
                    <button key={t.label} onClick={()=>setCopy(t.copy)}
                      className="w-full text-left px-2 py-1.5 rounded-md text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all flex items-center gap-1.5 truncate">
                      <span className="shrink-0">{t.icon}</span><span className="truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Center: Script editor (tabs) */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {inputTab === "roteiro" && (
                <div className="flex-1 relative overflow-hidden flex flex-col">
                  <textarea
                    value={copy}
                    onChange={e=>setCopy(e.target.value)}
                    disabled={isGenerating}
                    placeholder="Cole sua VSL, roteiro ou copy aqui…&#10;&#10;Dica: escreva em parágrafos para criar cenas automaticamente."
                    className="flex-1 resize-none focus:outline-none text-sm text-zinc-300 placeholder-zinc-700 px-10 py-8 leading-relaxed disabled:opacity-40"
                    style={{
                      background:"transparent",
                      fontFamily:"'JetBrains Mono','Fira Code','Courier New',monospace",
                      fontSize:"13px",
                      lineHeight:"1.8",
                      caretColor:"#F0563A",
                    }}
                  />
                  {/* Detected keywords strip */}
                  {copy && detectedPowerWords.length > 0 && (
                    <div className="shrink-0 px-6 py-2 border-t flex flex-wrap gap-1.5 overflow-x-auto" style={{borderColor:"rgba(255,255,255,0.05)"}}>
                      {detectedPowerWords.slice(0,8).map(kw => (
                        <span key={kw} className="px-2 py-0.5 rounded-full text-[9px] font-bold text-orange-400 border border-orange-400/20 bg-orange-400/5 shrink-0">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {inputTab === "video" && (
                <div className="flex-1 flex items-center justify-center">
                  <div
                    onDragOver={e=>{e.preventDefault();setIsDragOver(true);}}
                    onDragLeave={()=>setIsDragOver(false)}
                    onDrop={e=>{e.preventDefault();setIsDragOver(false);const f=e.dataTransfer.files[0];if(f&&f.type.startsWith("video/"))setVideoFile(f);}}
                    onClick={()=>{const i=document.createElement("input");i.type="file";i.accept="video/mp4,video/quicktime";i.onchange=(ev)=>{const f=(ev.target as HTMLInputElement).files?.[0];if(f)setVideoFile(f);};i.click();}}
                    className="flex flex-col items-center justify-center gap-4 rounded-2xl cursor-pointer transition-all"
                    style={{
                      width:"min(500px, 100% - 40px)",
                      padding: videoFile ? "2rem 2rem" : "3.5rem 2rem",
                      border:`2px dashed ${isDragOver?"#F0563A":videoFile?"rgba(52,211,153,0.5)":"rgba(255,255,255,0.12)"}`,
                      background:isDragOver?"rgba(240,86,58,0.08)":videoFile?"rgba(52,211,153,0.05)":"rgba(9,9,11,0.4)",
                      backdropFilter:"blur(12px)",
                      boxShadow:isDragOver?"0 0 60px rgba(240,86,58,0.15)":"0 4px 16px rgba(0,0,0,0.2)",
                    }}>
                    {videoFile ? (
                      <>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.25)"}}>
                          <Check className="w-7 h-7 text-emerald-400"/>
                        </div>
                        <div className="text-center">
                          <p className="text-base font-black text-emerald-400 truncate max-w-[300px]">{videoFile.name}</p>
                          <p className="text-[11px] text-zinc-400 mt-1">{(videoFile.size/1024/1024).toFixed(1)} MB · pronto para enriquecer</p>
                        </div>
                        <button onClick={e=>{e.stopPropagation();setVideoFile(null);}} className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 mt-1">
                          <X className="w-3.5 h-3.5"/>Remover arquivo
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all" style={{background:isDragOver?"rgba(240,86,58,0.15)":"rgba(255,255,255,0.04)",border:isDragOver?"1px solid rgba(240,86,58,0.4)":"1px solid rgba(255,255,255,0.08)"}}>
                          <CloudUpload className={`w-8 h-8 transition-colors ${isDragOver?"text-orange-400":"text-zinc-500"}`}/>
                        </div>
                        <div className="text-center">
                          <p className="text-base font-bold text-zinc-200">Sobe um MP4 do seu A-roll</p>
                          <p className="text-[12px] text-zinc-600 mt-1.5">.mp4 · .mov · até 500MB</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {inputTab === "tts" && (
                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="max-w-sm rounded-2xl p-4" style={{background:"rgba(167,139,250,0.05)",border:"1px solid rgba(167,139,250,0.15)"}}>
                    <p className="text-[11px] font-black uppercase tracking-widest mb-3" style={{color:"#a78bfa"}}>🎙 Gerar Voz Sintética</p>
                    {!copy.trim() && (
                      <p className="text-[11px] text-zinc-500 mb-3">Cole seu roteiro acima para gerar a voz.</p>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-[10px] text-zinc-500 shrink-0">Voz:</label>
                      <select value={homeTtsVoice} onChange={e=>setHomeTtsVoice(e.target.value)}
                        className="flex-1 text-[11px] text-zinc-300 px-2.5 py-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none"
                        style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
                        <option value="English_expressive_narrator">English — Expressive Narrator</option>
                      <option value="English_Graceful_Lady">English — Graceful Lady</option>
                      <option value="English_Insightful_Speaker">English — Insightful Speaker</option>
                      <option value="English_radiant_girl">English — Radiant Girl</option>
                      <option value="English_Persuasive_Man">English — Persuasive Man</option>
                      <option value="English_Lucky_Robot">English — Lucky Robot</option>
                      <option value="Chinese (Mandarin)_Lyrical_Voice">Chinese (Mandarin) — Lyrical Voice</option>
                      <option value="Chinese (Mandarin)_HK_Flight_Attendant">Chinese (Mandarin) — HK Flight Attendant</option>
                      <option value="Japanese_Whisper_Belle">Japanese — Whisper Belle</option>
                      </select>
                    </div>
                    {homeTtsError && <p className="text-[10px] text-red-400 mb-2">{homeTtsError}</p>}
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={handleHomeTts}
                        disabled={homeTtsLoading||!copy.trim()}
                        className="flex-1 py-2.5 rounded-xl text-[12px] font-black transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                        style={{background:"rgba(167,139,250,0.15)",border:"1px solid rgba(167,139,250,0.3)",color:"#a78bfa"}}>
                        {homeTtsLoading
                          ? <><span className="w-3.5 h-3.5 rounded-full border border-violet-400 border-t-transparent animate-spin"/>Gerando...</>
                          : homeTtsUrl ? "🔄 Regerar Voz" : "🎙 Gerar Voz Agora"}
                      </button>
                      {homeTtsUrl && !homeTtsLoading && (
                        <a href={homeTtsUrl} download="voz_sintetica.mp3"
                          className="px-3 py-2.5 rounded-xl text-[11px] font-bold text-zinc-400 hover:text-white transition-all flex items-center gap-1.5"
                          style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
                          <Download className="w-3.5 h-3.5"/>MP3
                        </a>
                      )}
                    </div>
                    {homeTtsUrl && !homeTtsLoading && (
                      <div className="px-3 py-2 rounded-lg flex items-center gap-2"
                        style={{background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.12)"}}>
                        <span className="text-[10px] text-violet-400 font-bold">✓ Voz gerada</span>
                        <audio controls src={homeTtsUrl} className="flex-1 h-6" style={{opacity:0.7}}/>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: AI Analysis Panel */}
            <div className="w-56 shrink-0 flex flex-col border-l" style={{borderColor:"rgba(255,255,255,0.05)",background:"rgba(9,9,11,0.6)"}}>
              <div className="px-4 py-3 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                  <Brain className="w-3 h-3"/>Análise IA
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
                {copy ? (
                  <>
                    {/* Engagement score */}
                    <div>
                      <div className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Retenção</div>
                      <div className="flex items-end gap-2 mb-1.5">
                        <span className="text-2xl font-black" style={{color:"#F0563A"}}>{engagementScore}</span>
                        <span className="text-[10px] text-zinc-600 mb-0.5">/ 100</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
                        <div className="h-full rounded-full transition-all duration-500" style={{width:`${engagementScore}%`,background:"linear-gradient(90deg,#F0563A,#FF7A5C)"}}/>
                      </div>
                    </div>

                    {/* Power words detected */}
                    {detectedPowerWords.length > 0 && (
                      <div>
                        <div className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Palavras de Poder</div>
                        <div className="flex flex-wrap gap-1">
                          {detectedPowerWords.slice(0,6).map(w=>(
                            <span key={w} className="px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-400 bg-amber-400/8 border border-amber-400/15">{w}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested B-rolls */}
                    {brollSuggestions.length > 0 && (
                      <div>
                        <div className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">B-Rolls</div>
                        <div className="space-y-1.5">
                          {brollSuggestions.slice(0,3).map(({word, img})=>(
                            <div key={word} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)"}}>
                              <img src={img} className="w-8 h-8 rounded object-cover shrink-0" alt={word}/>
                              <span className="text-[10px] text-zinc-400 truncate">{word}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Estimated duration */}
                    <div>
                      <div className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Duração</div>
                      <div className="text-lg font-black text-zinc-300">{estimatedDurationFmt}</div>
                      <div className="text-[9px] text-zinc-600">{wordCount} palavras</div>
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] text-zinc-700 text-center py-8">Cole seu roteiro para ver análises</div>
                )}
              </div>
            </div>
          </div>

          {/* ── Bottom generate bar ── */}
          <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t" style={{borderColor:"rgba(255,255,255,0.05)"}}>
            <div className="flex items-center gap-3">
              {error && <span className="text-[11px] text-red-400 flex items-center gap-1 max-w-xs truncate"><X className="w-3.5 h-3.5 shrink-0"/>{error}</span>}
              {!error && <span className="text-[10px] text-zinc-600">{hasContent ? "Pronto para gerar" : "Cole um roteiro ou envie um vídeo"}</span>}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={videoFile ? handleEnrich : handleGenerate}
                disabled={videoFile ? isEnriching : (!copy.trim() || isGenerating)}
                className="px-8 py-2.5 rounded-xl text-[13px] font-black text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 flex items-center gap-2"
                style={{
                  background: hasContent ? "#F0563A" : "rgba(255,255,255,0.06)",
                  animation: hasContent ? "glowPulse 3s ease-in-out infinite" : "none",
                }}>
                <Sparkles className="w-4 h-4"/>
                {videoFile
                  ? (isEnriching
                      ? <span className="flex items-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"/>Processando…</span>
                      : "Enriquecer com IA"
                    )
                  : (isGenerating
                      ? <span className="flex items-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"/>Gerando…</span>
                      : "Gerar Sequência"
                    )
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {isUploadModalOpen && <UploadModal onClose={()=>setUploadOpen(false)}/>}
    {paywallOpen       && <PaywallModal onClose={()=>setPaywallOpen(false)}/>}
    <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
