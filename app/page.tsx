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
  Eye, EyeOff, TrendingUp,
} from "lucide-react";
import { saveAs } from "file-saver";

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
  "Mapeando Power Words…","Sincronizando B-rolls com a fala…",
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

function WorkstationView({ result, copy: initialCopy, drScenes: initialDrScenes, initialBgMusicUrl, videoFile, whisperWords: rawWhisperWords, onBack }: {
  result: GenerateResponse;
  copy: string;
  drScenes: DirectResponseScene[];
  initialBgMusicUrl?: string;
  videoFile?: File | null;
  whisperWords?: WhisperWord[];
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
  const [avatarVolume,      setAvatarVolume]      = useState(1.0);
  const [videoAspect,       setVideoAspect]       = useState<"landscape"|"portrait">("landscape");
  // ── Uploaded UGC Avatar video object URL ─────────────────────────────────
  const [uploadedVideoUrl,  setUploadedVideoUrl]  = useState<string|null>(null);

  const tracks   = result.background_tracks ?? [];

  // ── Create object URL from uploaded videoFile ─────────────────────────────
  useEffect(()=>{
    if(!videoFile) return;
    const url = URL.createObjectURL(videoFile);
    setUploadedVideoUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[videoFile]);

  // ── Sync avatarVideoRef muted + volume state ─────────────────────────────
  useEffect(()=>{
    if(!avatarVideoRef.current) return;
    avatarVideoRef.current.muted  = trackAVMuted;
    avatarVideoRef.current.volume = avatarVolume;
  },[trackAVMuted, avatarVolume]);

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

  // Clip currently under the playhead — null during gaps (no B-roll)
  const currentClip = useMemo(()=>
    timelineClips.find(c=>currentTime>=c.startSec&&currentTime<c.startSec+c.durSec)??null,
    [timelineClips,currentTime]
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
    // Sync avatar video to exact global position
    if(avatarVideoRef.current) avatarVideoRef.current.currentTime=clamped;
    // Sync B-roll clip video to local offset
    const clip=timelineClips.find(c=>clamped>=c.startSec&&clamped<c.startSec+c.durSec);
    if(clip&&videoRef.current){
      const local=clamped-clip.startSec;
      if(clip.id===prevClipId.current){videoRef.current.currentTime=Math.max(0,local);}
      else{seekOnLoadRef.current=local>0.3?local:null;}
    }
  },[totalDur,timelineClips]);

  // ── Timeline drag — accounts for 56px track header + scroll offset ──────
  const TRACK_HEADER_W = 56; // w-14 = 3.5rem = 56px
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
  useEffect(()=>{
    if(!isDragging) return;
    const mv=(e:MouseEvent)=>seekToTime(timelineBodyPosFromEvent(e.clientX));
    const up=()=>setIsDragging(false);
    window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);
    return()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isDragging,seekToTime,totalDur]);

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
      }
    };
    window.addEventListener("keydown",handleKeyDown);
    return()=>window.removeEventListener("keydown",handleKeyDown);
  },[togglePlay,seekToTime,totalDur]);

  // ── Suggest Another ──────────────────────────────────────────────────────
  const suggestAnother=useCallback(async(clipId:string)=>{
    const clip=timelineClips.find(c=>c.id===clipId);
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
  },[timelineClips,localDrScenes,localScenes]);

  // ── Drag & Drop from sidebar → V1 block ─────────────────────────────────
  const handleDropOnClip=useCallback((clipId:string,url:string,thumb?:string)=>{
    const clip=timelineClips.find(c=>c.id===clipId);
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
  },[timelineClips,localDrScenes]);

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
      <div className="w-[24%] shrink-0 flex flex-col border-r overflow-hidden"
        style={{background:"#0a0a0a",borderColor:"rgba(255,255,255,0.05)"}}>
        <div className="flex items-center gap-3 px-4 py-3.5 border-b shrink-0" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <button onClick={onBack} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-white/6 transition-colors"><ArrowLeft className="w-4 h-4"/></button>
          <div>
            <p className="text-[13px] font-black text-white uppercase tracking-widest" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2px"}}>Roteiro</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{localDrScenes.length||localScenes.length} cenas · {Math.round(totalDur)}s</p>
          </div>
        </div>
        <textarea value={editCopy} onChange={e=>setEditCopy(e.target.value)}
          className="flex-1 w-full bg-transparent text-[13px] text-gray-400 leading-relaxed px-4 py-4 resize-none focus:outline-none placeholder-gray-700"
          placeholder="Cole ou edite o roteiro aqui…" style={{fontFamily:"inherit"}}/>
        <div className="border-t" style={{borderColor:"rgba(255,255,255,0.05)"}}>
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
                      {/* Emotion tag — the key DRS field */}
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
                      <p className="text-[8px] text-gray-500 mt-0.5 truncate">
                        🔍 {drs.searchQueries[0]}
                      </p>
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
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-orange-400 font-bold tabular-nums tracking-tight">{fmtTime(currentTime)}<span className="text-gray-600 mx-0.5">/</span>{fmtTime(totalDur)}</span>
          </div>
        </div>

        {/* ── Video Player (NLE Monitor) ── */}
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div className={`relative rounded-xl overflow-hidden cursor-pointer group mx-auto ${videoAspect==="portrait" ? "w-auto" : "w-full"}`}
            style={{
              aspectRatio: videoAspect==="portrait" ? "9/16" : "16/7.2",
              maxWidth:    videoAspect==="portrait" ? "260px" : "100%",
              background:"#000",
              border:"1px solid rgba(255,255,255,0.07)",
              boxShadow:"0 0 40px rgba(232,89,60,0.05)",
            }}
            onClick={togglePlay}>

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
              videoUrl ? (
                // key = clipId + url — remounts element cleanly on swap, no glitch
                <video ref={videoRef} key={(currentClip?.id??"") + videoUrl} src={videoUrl}
                  loop muted playsInline onLoadedMetadata={handleLoadedMetadata}
                  className="absolute inset-0 w-full h-full transition-opacity duration-300"
                  style={{
                    opacity: currentClip ? 1 : 0,
                    objectFit: videoAspect==="portrait" ? "contain" : "cover",
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

              const stroke = "2px 2px 0 #000,-2px 2px 0 #000,2px -2px 0 #000,-2px -2px 0 #000,3px 0 0 #000,-3px 0 0 #000,0 3px 0 #000,0 -3px 0 #000";

              return (
                <div className="absolute bottom-10 left-0 right-0 flex justify-center px-6 pointer-events-none">
                  <div className="flex flex-wrap justify-center items-end" style={{gap:"0 0.3em",maxWidth:"88%"}}>
                    {displayChunk.map(({sw,gIdx})=>{
                      const isAct = gIdx===activeWordIdx;
                      const isKw  = sw.isKeyword && isAct;
                      return(
                        <span key={gIdx}
                          style={{
                            display:"inline-block",
                            fontFamily:"'DM Sans','Arial Black',sans-serif",
                            fontWeight:900,
                            fontSize: isAct ? "clamp(1.6rem,4vw,2.2rem)" : "clamp(1.4rem,3.5vw,1.9rem)",
                            lineHeight:1.1,
                            color: isKw ? accentColor : "#FFFFFF",
                            textShadow: isKw
                              ? `${stroke},0 0 24px ${accentColor},0 0 48px ${accentColor}55`
                              : stroke,
                            transform: isAct ? "scale(1.12) translateY(-2px)" : "scale(1)",
                            transition:"transform 0.06s ease,color 0.06s ease,text-shadow 0.06s ease",
                            transformOrigin:"center bottom",
                            letterSpacing:"-0.02em",
                            background: isAct && !isKw ? "rgba(255,255,0,0.18)" : "transparent",
                            borderRadius: isAct ? "4px" : "0",
                            padding: isAct ? "0 3px" : "0",
                          }}>
                          {sw.word}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Play overlay */}
            <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${playing?"opacity-0 group-hover:opacity-100":"opacity-100"}`}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                style={{background:"rgba(232,89,60,0.12)",border:"1px solid rgba(232,89,60,0.35)",backdropFilter:"blur(4px)",boxShadow:"0 0 24px rgba(232,89,60,0.25)"}}>
                {playing?<Pause className="w-5 h-5 text-orange-300" fill="currentColor"/>:<Play className="w-5 h-5 text-orange-300 ml-0.5" fill="currentColor"/>}
              </div>
            </div>

            {/* Transport HUD */}
            <div className="absolute bottom-0 left-0 right-0 px-4 py-2 flex items-center gap-3"
              style={{background:"linear-gradient(to top,rgba(0,0,0,0.9),transparent)"}}>
              <button onClick={e=>{e.stopPropagation();seekToTime(sceneStarts[Math.max(0,activeScene-1)]);}} title="Cena anterior (J)"><SkipBack className="w-4 h-4 text-white/50 hover:text-white transition-colors"/></button>
              <button onClick={e=>{e.stopPropagation();togglePlay();}} title="Play / Pause (Space)">
                {playing?<Pause className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor"/>:<Play className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor"/>}
              </button>
              <button onClick={e=>{e.stopPropagation();seekToTime(sceneStarts[Math.min(localScenes.length-1,activeScene+1)]);}} title="Próxima cena (L)"><SkipForward className="w-4 h-4 text-white/50 hover:text-white transition-colors"/></button>
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

            {/* Scrollable outer wrapper */}
            <div ref={timelineScrollRef}
              className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden"
              style={{scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.1) transparent"}}>

            {/* Fixed-width canvas — grows with video duration */}
            <div ref={timelineRef}
              className="relative select-none h-full"
              style={{
                minWidth: `${Math.max(640, totalDur * 28)}px`,
                cursor:isDragging?"col-resize":"crosshair",
              }}
              onMouseDown={handleTimelineMouseDown}>

              {/* Ruler */}
              <div className="flex h-5 border-b sticky top-0 z-10" style={{background:"#080808",borderColor:"rgba(255,255,255,0.05)"}}>
                <div className="w-14 shrink-0 border-r" style={{borderColor:"rgba(255,255,255,0.05)"}}/>
                <div className="flex-1 relative">
                  {Array.from({length:Math.ceil(totalDur/5)+1}).map((_,i)=>(
                    <div key={i} className="absolute flex flex-col items-center" style={{left:`${(i*5/totalDur)*100}%`}}>
                      <div className="w-px h-2 mt-0.5" style={{background:"rgba(255,255,255,0.1)"}}/>
                      <span className="text-[7px] font-mono text-gray-500">{fmtTime(i*5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ TRILHA AV — Avatar / A-Roll base (linha separada, 100% contínuo) ══ */}
              <div className="flex border-b" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                {/* Track Header — AV */}
                <div className="w-14 shrink-0 flex flex-col items-center justify-center border-r gap-0.5 px-1 py-1"
                  style={{borderColor:"rgba(255,255,255,0.04)"}}>
                  <span className="text-[7px] font-black" style={{color:trackAVVisible?"rgba(156,163,175,0.7)":"rgba(156,163,175,0.2)"}}>AV</span>
                  <div className="flex items-center gap-1">
                    {/* Eye toggle */}
                    <button title={trackAVVisible?"Ocultar Avatar":"Mostrar Avatar"}
                      onClick={()=>setTrackAVVisible(v=>!v)}
                      className="p-0.5 rounded transition-colors hover:bg-white/5">
                      {trackAVVisible
                        ? <Eye className="w-2.5 h-2.5" style={{color:"rgba(148,163,184,0.6)"}}/>
                        : <EyeOff className="w-2.5 h-2.5" style={{color:"rgba(239,68,68,0.7)"}}/>
                      }
                    </button>
                    {/* Mute toggle */}
                    <button title={trackAVMuted?"Desmutar":"Mutar"}
                      onClick={()=>setTrackAVMuted(m=>!m)}
                      className="p-0.5 rounded transition-colors hover:bg-white/5">
                      {trackAVMuted
                        ? <VolumeX className="w-2.5 h-2.5" style={{color:"rgba(239,68,68,0.7)"}}/>
                        : <Volume2 className="w-2.5 h-2.5" style={{color:"rgba(148,163,184,0.5)"}}/>
                      }
                    </button>
                  </div>
                </div>
                <div className="flex-1 relative h-11 flex items-center px-1">
                  {/* Barra contínua — 100% do vídeo base */}
                  <div className="absolute left-1 right-1 top-1.5 bottom-1.5 rounded-lg overflow-hidden transition-opacity duration-200"
                    style={{
                      background:"rgba(100,116,139,0.13)",
                      border:"1px solid rgba(100,116,139,0.22)",
                      opacity: trackAVVisible ? 1 : 0.25,
                    }}>
                    {/* Waveform simulado do locutor */}
                    <div className="absolute inset-0 flex items-center gap-px px-1">
                      {Array.from({length:90}).map((_,i)=>(
                        <div key={i} className="flex-1 rounded-full"
                          style={{background:"rgba(148,163,184,0.35)",height:`${18+Math.abs(Math.sin(i*1.3)*Math.cos(i*0.4))*64}%`}}/>
                      ))}
                    </div>
                    {/* Label flutuante */}
                    <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                      <span className="text-[7px] font-black select-none" style={{color:"rgba(148,163,184,0.4)"}}>
                        {uploadedVideoUrl ? "🎥 Avatar UGC carregado" : "Avatar / Locutor"} — A-Roll base · {Math.round(totalDur)}s
                        {trackAVMuted && <span style={{color:"rgba(239,68,68,0.6)"}}> · 🔇 MUDO</span>}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ TRILHA V2 — B-Roll (clips coloridos sobre o avatar, com gaps) ══ */}
              <div className="flex border-b" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                {/* Track Header — V2 */}
                <div className="w-14 h-20 shrink-0 flex flex-col items-center justify-center border-r gap-0.5 px-0.5"
                  style={{borderColor:"rgba(255,255,255,0.04)"}}>
                  <span className="text-[7px] font-black" style={{color:trackBrollVisible?"rgba(232,89,60,0.9)":"rgba(232,89,60,0.25)"}}>V2</span>
                  <span className="text-[5px] font-bold text-gray-500 uppercase tracking-tight">B-Roll</span>
                  {/* Eye toggle */}
                  <button title={trackBrollVisible?"Ocultar B-Rolls":"Mostrar B-Rolls"}
                    onClick={()=>setTrackBrollVisible(v=>!v)}
                    className="p-0.5 rounded transition-colors hover:bg-white/5 mt-0.5">
                    {trackBrollVisible
                      ? <Eye className="w-2.5 h-2.5" style={{color:"rgba(232,89,60,0.7)"}}/>
                      : <EyeOff className="w-2.5 h-2.5" style={{color:"rgba(239,68,68,0.7)"}}/>
                    }
                  </button>
                </div>
                <div className="flex-1 relative h-20">
                  {/* ── Gap indicators — "Avatar respira aqui" ── */}
                  {localDrScenes.length>0 && timelineClips.map((clip,ci)=>{
                    const gapStart = clip.startSec + clip.durSec;
                    const sceneEnd = gapStart + (localDrScenes[clip.sceneIdx]?.duration??0) - clip.durSec;
                    const nextClipStart = ci+1<timelineClips.length ? timelineClips[ci+1].startSec : totalDur;
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
                  {timelineClips.map(clip=>{
                    const left=(clip.startSec/totalDur)*100;
                    const width=(clip.durSec/totalDur)*100;
                    const isAct=currentClip?.id===clip.id;
                    const isLoad=loadingClipIds.has(clip.id);
                    const isDT=dragOverClipId===clip.id;
                    return(
                      <div key={clip.id}
                        className={`v1clip absolute top-1 bottom-1 rounded cursor-pointer overflow-hidden transition-all
                          ${isAct?"ring-2 ring-orange-400/90 brightness-110":""}
                          ${isDT?"ring-2 ring-orange-500 brightness-125":""}`}
                        style={{
                          left:`calc(${left}% + 1px)`,width:`calc(${width}% - 2px)`,
                          background: clip.thumb
                            ? `url(${clip.thumb}) center/cover no-repeat`
                            : clip.url ? `${clip.color}28` : `${clip.color}0d`,
                          border:`1px ${clip.url||clip.thumb?"solid":"dashed"} ${clip.color}${clip.url||clip.thumb?"77":"33"}`,
                        }}
                        onClick={e=>{e.stopPropagation();seekToTime(clip.startSec+0.01);}}
                        onDragOver={e=>{e.preventDefault();setDragOverClipId(clip.id);}}
                        onDragLeave={()=>setDragOverClipId(null)}
                        onDrop={e=>{e.preventDefault();if(dragSrcUrl)handleDropOnClip(clip.id,dragSrcUrl);}}>
                        {clip.thumb&&<div className="absolute inset-0" style={{background:"linear-gradient(to top,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.18) 60%,transparent 100%)"}}/>}
                        {isLoad?(
                          <div className="absolute inset-0 flex items-center justify-center" style={{background:"rgba(0,0,0,0.5)"}}>
                            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                              style={{borderColor:`${clip.color}cc`,borderTopColor:"transparent"}}/>
                          </div>
                        ):(
                          <>
                            <div className="absolute bottom-0 left-0 right-0 flex items-center px-1.5 pb-1">
                              {!clip.url&&!clip.thumb&&<div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0 mr-0.5" style={{background:clip.color+"88"}}/>}
                              <span className="text-[7px] font-bold text-white/80 truncate drop-shadow">{clip.label}</span>
                            </div>
                            <div className="v1clip-overlay absolute inset-0 flex items-center justify-center"
                              style={{background:"rgba(0,0,0,0.55)"}}>
                              <button title="Sugerir outra mídia"
                                onClick={e=>{e.stopPropagation();suggestAnother(clip.id);}}
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
                <div className="w-14 h-12 shrink-0 flex items-center justify-center border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                  <span className="text-[8px] font-black text-gray-500">T1</span>
                </div>
                <div className="flex-1 relative h-12">
                  {/* Use DRS when available (correct durations) — fall back to legacy scenes */}
                  {(localDrScenes.length>0?localDrScenes:localScenes).map((_row,i)=>{
                    const dur = localDrScenes.length
                      ? (localDrScenes[i] as DirectResponseScene).duration
                      : (localScenes[i] as Scene).estimated_duration_seconds??5;
                    const text = localDrScenes.length
                      ? (localDrScenes[i] as DirectResponseScene).textSnippet
                      : ((localScenes[i] as Scene).text_chunk??(localScenes[i] as Scene).segment??"");
                    const left=(sceneStarts[i]/totalDur)*100;
                    const width=(dur/totalDur)*100;
                    const words=text.split(" ").slice(0,6);
                    return(
                      <div key={i} className="absolute top-0.5 bottom-0.5 rounded overflow-hidden flex items-center gap-0.5 px-1.5"
                        style={{left:`calc(${left}%+1px)`,width:`calc(${width}%-2px)`,background:"rgba(234,179,8,0.07)",border:"1px solid rgba(234,179,8,0.2)"}}>
                        {words.map((ww,wi)=>{
                          const isPW=POWER_WORDS.has(ww.toLowerCase().replace(/[^a-záéíóúãõç]/g,""));
                          return <span key={wi} className={`text-[6px] font-bold shrink-0 ${isPW?"text-yellow-400":"text-gray-400"}`}>{ww}</span>;
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── SFX: Scoring / Pontuação Layer ── */}
              <div className="flex border-b" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="w-14 h-10 shrink-0 flex items-center justify-center border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                  <span className="text-[7px] font-black uppercase tracking-tight" style={{color:"rgba(232,89,60,0.55)"}}>SFX</span>
                </div>
                {/* overflow-visible so tooltip pokes above the track */}
                <div className="flex-1 relative h-10 overflow-visible">
                  {sfxMarkers.length===0 && (
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className="text-[7px] text-gray-800 italic">Nenhum gatilho detectado</span>
                    </div>
                  )}
                  {sfxMarkers.map(marker=>{
                    const left=(marker.timeSec/totalDur)*100;
                    const isNear=Math.abs(currentTime-marker.timeSec)<0.5;
                    return (
                      <div key={marker.id}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 group/sfxpin"
                        style={{left:`calc(56px + (100% - 56px) * ${left/100})`}}>

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

              {/* ── A1: Waveform ── */}
              <div className="flex border-b" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="w-14 h-14 shrink-0 flex items-center justify-center border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                  <span className="text-[8px] font-black text-gray-500">A1</span>
                </div>
                <div className="flex-1 h-14 flex items-end overflow-hidden gap-px px-1" style={{background:"rgba(16,185,129,0.04)"}}>
                  {Array.from({length:110}).map((_,i)=>(
                    <div key={i} className="flex-1 rounded-full opacity-60" style={{background:"#10b981",height:`${14+Math.abs(Math.sin(i*1.7)*Math.cos(i*0.5))*86}%`}}/>
                  ))}
                </div>
              </div>

              {/* ── A2: SFX ── */}
              <div className="flex" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="w-14 h-10 shrink-0 flex items-center justify-center border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                  <span className="text-[8px] font-black text-gray-500">A2</span>
                </div>
                <div className="flex-1 relative h-10">
                  {localScenes.map((sc,i)=>sc.sfx_url&&(
                    <div key={i} className="absolute top-0.5 bottom-0.5 rounded flex items-center gap-0.5 px-1.5 overflow-hidden"
                      style={{left:`calc(${(sceneStarts[i]/totalDur)*100}%+1px)`,width:`calc(${((sc.estimated_duration_seconds??5)/totalDur)*100}%-2px)`,background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)"}}>
                      {[40,80,55,30].map((h,j)=><div key={j} className="w-1 bg-red-500/60 rounded-full" style={{height:`${h}%`}}/>)}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Red Playhead Needle ── */}
              <div className="absolute top-0 bottom-0 pointer-events-none z-20"
                style={{left:`calc(56px + (100% - 56px) * ${playheadPct/100})`,transform:"translateX(-50%)"}}>
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
                  const altThumb = opt.thumb ?? GALLERY_CARDS[(activeScene*3+i) % GALLERY_CARDS.length].src;
                  return (
                  <div key={i}
                    className="relative rounded-lg overflow-hidden cursor-grab active:cursor-grabbing group/drag"
                    style={{aspectRatio:"16/9",border:"1px solid rgba(255,255,255,0.08)"}}
                    draggable onDragStart={()=>setDragSrcUrl(opt.url)} onDragEnd={()=>setDragSrcUrl(null)}>
                    {/* Static img — always visible, no grey loading state */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={altThumb} alt={`Alt ${i+1}`}
                      className="w-full h-full object-cover opacity-70 group-hover/drag:opacity-90 transition-opacity"
                      loading="lazy"/>
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover/drag:opacity-100 transition-opacity gap-0.5"
                      style={{background:"rgba(0,0,0,0.5)"}}>
                      <GripVertical className="w-4 h-4 text-white/80"/>
                      <span className="text-[8px] text-white font-bold">Arrastar</span>
                    </div>
                    <button onClick={()=>{const cl=timelineClips.find(c=>c.sceneIdx===activeScene);if(cl)handleDropOnClip(cl.id,opt.url,opt.thumb);}}
                      className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold text-white opacity-0 group-hover/drag:opacity-100 transition-opacity"
                      style={{background:"rgba(232,89,60,0.85)"}}>
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
                      <button onClick={()=>{const cl=timelineClips.find(c=>c.sceneIdx===i);if(cl)suggestAnother(cl.id);}}
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
                      <button onClick={()=>{const cl=timelineClips.find(c=>c.sceneIdx===i);if(cl)suggestAnother(cl.id);}}
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
                        <p className="text-[8px] text-gray-500">{track.is_premium_vault?"💎 Cofre Kraft":"🎵 Pixabay"}</p>
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
  const [inputTab,         setInputTab]      = useState<"roteiro"|"video">("roteiro");
  const [videoFile,        setVideoFile]     = useState<File|null>(null);
  const [isDragOver,       setIsDragOver]    = useState(false);
  const [isEnriching,      setIsEnriching]   = useState(false);
  const [enrichStep,       setEnrichStep]    = useState(0); // 0-3
  const [videoLang,        setVideoLang]     = useState<"auto"|"pt"|"en"|"es">("auto");

  const fireHomeToast = useCallback((msg: string) => {
    setHomeToast(msg);
    setTimeout(() => setHomeToast(null), 3500);
  }, []);

  const handleHomeRaioX = useCallback((ad: WinningAd) => {
    fireHomeToast(`🧬 A IA está analisando "${ad.title}"…`);
  }, [fireHomeToast]);

  const aspectFormats = ["landscape","portrait","landscape"] as const;
  const themeMap: Record<number,string> = { 0:"vsl_long", 1:"social_organic", 2:"cinematic" };

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
          // 2. OpenAI DRS analysis + Pexels + Freesound + music (generate-timeline)
          fetch("/api/generate-timeline", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body:JSON.stringify({copy}),
          }).then(async res=>{
            if(!res.ok){
              console.warn("[generate-timeline] API falhou, usando análise local.");
              return { scenes: analyzeCopyForDirectResponse(copy), backgroundMusicUrl: undefined };
            }
            const d = await res.json();
            // New format: { scenes: [...], backgroundMusicUrl: "..." }
            if(d?.scenes && Array.isArray(d.scenes) && d.scenes.length>0)
              return { scenes: d.scenes as DirectResponseScene[], backgroundMusicUrl: d.backgroundMusicUrl as string|undefined };
            // Legacy format: bare array (fallback)
            if(Array.isArray(d) && d.length>0)
              return { scenes: d as DirectResponseScene[], backgroundMusicUrl: undefined };
            return { scenes: analyzeCopyForDirectResponse(copy), backgroundMusicUrl: undefined };
          }),
        ]),
        new Promise<void>(r=>setTimeout(r,3000)), // minimum 3s loading screen
      ]);

      sessionStorage.setItem("vb_project_result", JSON.stringify(data));
      sessionStorage.setItem("vb_project_copy", copy);
      setResult(data);
      setDrScenes(drs.scenes);
      if(drs.backgroundMusicUrl) setBgMusicUrl(drs.backgroundMusicUrl);
      setIsGenerated(true);
    } catch(e:unknown){
      setError(e instanceof Error?e.message:"Erro ao gerar.");
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

      // Upload directly from browser → R2 (CORS enabled on bucket)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl); // Direct to R2 presigned URL
        xhr.setRequestHeader("Content-Type", videoFile.type || "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) { setUploadProgress(100); resolve(); }
          else reject(new Error(`Upload falhou (HTTP ${xhr.status}). Verifique se o CORS está configurado no R2.`));
        };
        xhr.onerror = () => reject(new Error("Erro de rede no upload direto ao R2. Verifique CORS."));
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
          // Direct upload to R2 (CORS enabled)
          const wavUpRes = await fetch(wavUploadUrl, {
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
        background_tracks: [],
      };
      setResult(finalResult);
      setDrScenes(finalDrs);
      if (backgroundMusicUrl) setBgMusicUrl(backgroundMusicUrl);
      setIsEnriching(false);
      setEnrichStep(0);
      setIsGenerated(true);

    } catch (err: unknown) {
      setIsEnriching(false);
      setEnrichStep(0);
      const msg = err instanceof Error ? err.message : "Erro inesperado no upload.";
      setError(msg);
    }
  };

  // Full-screen workstation mode
  if (isGenerated && result) {
    return <WorkstationView result={result} copy={copy} drScenes={drScenes} initialBgMusicUrl={bgMusicUrl} videoFile={videoFile} whisperWords={whisperWords} onBack={handleBack}/>;
  }

  // Has content ready to process?
  const hasContent = !!(videoFile || copy.trim());

  return (
    <>
    <style>{`
      @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @keyframes grainShift{0%{transform:translate(0,0)}10%{transform:translate(-2%,-2%)}20%{transform:translate(1%,1%)}30%{transform:translate(-1%,2%)}40%{transform:translate(2%,-1%)}50%{transform:translate(-2%,1%)}60%{transform:translate(1%,-2%)}70%{transform:translate(-1%,-1%)}80%{transform:translate(2%,2%)}90%{transform:translate(-2%,0%)}100%{transform:translate(0,0)}}
      @keyframes glowPulse{0%,100%{box-shadow:0 0 20px rgba(240,86,58,0.25),0 4px 15px rgba(240,86,58,0.3)}50%{box-shadow:0 0 35px rgba(240,86,58,0.45),0 4px 25px rgba(240,86,58,0.4),0 0 80px rgba(240,86,58,0.12)}}
      @keyframes heroIn{from{opacity:0;transform:translateY(20px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
      .hook-card{transition:all 0.25s cubic-bezier(0.4,0,0.2,1)}
      .hook-card:hover{border-color:rgba(240,86,58,0.4)!important;transform:translateY(-2px)}
    `}</style>

    <div className="min-h-screen relative overflow-y-auto" style={{background:"#09090b",color:"#F5F3F0",fontFamily:"'DM Sans',sans-serif"}}>
      {/* Grain overlay */}
      <div className="fixed inset-0 pointer-events-none z-[9990] opacity-30" style={{backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,animation:"grainShift 0.5s steps(4) infinite"}}/>

      {/* ═══ TOP NAV BAR ═══ */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-8 py-4" style={{background:"rgba(9,9,11,0.85)",backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-white text-sm" style={{background:"#F0563A",boxShadow:"0 0 18px rgba(240,86,58,0.35)"}}>S</div>
          <span className="text-xl text-white" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2px"}}>SUARIK</span>
        </div>
        <nav className="flex items-center gap-5">
          <button onClick={()=>router.push("/editor")} className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors">Biblioteca</button>
          <button onClick={()=>router.push("/pricing")} className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-500"/>
            <span>Créditos <span className="text-amber-500 font-bold">500</span></span>
          </button>
          <button onClick={()=>router.push("/login")} className="text-[13px] font-semibold text-zinc-300 hover:text-white px-4 py-2 rounded-xl border transition-all hover:bg-white/5" style={{borderColor:"rgba(255,255,255,0.1)"}}>
            <span className="flex items-center gap-1.5"><LogIn className="w-3.5 h-3.5"/>Entrar</span>
          </button>
        </nav>
      </header>

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
        <>
          {/* ═══ HERO SECTION ═══ */}
          <main className="max-w-3xl mx-auto text-center px-6 pt-20 pb-14" style={{animation:"heroIn 0.6s ease both"}}>
            <h1 className="text-white leading-[0.95] tracking-tight" style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(3rem,6.5vw,4.5rem)",letterSpacing:"1px"}}>
              O CÉREBRO VISUAL<br/>DO SEU EDITOR.
            </h1>
            <p className="text-[17px] text-zinc-500 mt-5 max-w-lg mx-auto leading-relaxed">
              Tudo que um editor DR precisa. Zero marcação manual — cole e clique.
            </p>

            {/* ── HERO DROPZONE ── */}
            <div
              onDragOver={e=>{e.preventDefault();setIsDragOver(true);}}
              onDragLeave={()=>setIsDragOver(false)}
              onDrop={e=>{e.preventDefault();setIsDragOver(false);const f=e.dataTransfer.files[0];if(f&&f.type.startsWith("video/"))setVideoFile(f);}}
              onClick={()=>{const i=document.createElement("input");i.type="file";i.accept="video/mp4,video/quicktime";i.onchange=(ev)=>{const f=(ev.target as HTMLInputElement).files?.[0];if(f)setVideoFile(f);};i.click();}}
              className="mt-10 relative flex flex-col items-center justify-center gap-4 rounded-2xl cursor-pointer transition-all mx-auto max-w-2xl"
              style={{
                padding: videoFile ? "2rem 2rem" : "3.5rem 2rem",
                border:`2px dashed ${isDragOver?"#F0563A":videoFile?"rgba(52,211,153,0.5)":"rgba(63,63,70,0.4)"}`,
                background:isDragOver?"rgba(240,86,58,0.04)":videoFile?"rgba(52,211,153,0.03)":"rgba(255,255,255,0.015)",
                boxShadow:isDragOver?"0 0 60px rgba(240,86,58,0.12),inset 0 0 60px rgba(240,86,58,0.03)":"0 0 0 transparent",
                transition:"all 0.3s ease",
              }}>
              {videoFile ? (
                <>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.25)"}}>
                    <Check className="w-7 h-7 text-emerald-400"/>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-black text-emerald-400 truncate max-w-[300px]">{videoFile.name}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">{(videoFile.size/1024/1024).toFixed(1)} MB · pronto para enriquecer</p>
                  </div>
                  <button onClick={e=>{e.stopPropagation();setVideoFile(null);}} className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors flex items-center gap-1 mt-1">
                    <X className="w-3.5 h-3.5"/>Remover arquivo
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all" style={{background:isDragOver?"rgba(240,86,58,0.15)":"rgba(255,255,255,0.03)",border:isDragOver?"1px solid rgba(240,86,58,0.4)":"1px solid rgba(255,255,255,0.06)"}}>
                    <CloudUpload className={`w-8 h-8 transition-colors ${isDragOver?"text-orange-400":"text-zinc-600"}`}/>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-zinc-300">Sobe um MP4 do seu A-roll</p>
                    <p className="text-[12px] text-zinc-600 mt-1.5">.mp4 · .mov · até 500MB</p>
                  </div>
                </>
              )}
            </div>

            {/* ── "ou cole um roteiro" toggle ── */}
            <div className="mt-7">
              <button onClick={()=>setCopyOpen(v=>!v)}
                className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1.5 mx-auto group">
                <FileText className="w-4 h-4 group-hover:text-zinc-400"/>
                {isCopyOpen ? "Fechar roteiro" : "ou cole um roteiro de texto"}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isCopyOpen?"rotate-180":""}`}/>
              </button>
              {isCopyOpen && (
                <div className="mt-4 max-w-2xl mx-auto text-left" style={{animation:"fadeIn 0.3s ease both"}}>
                  <textarea
                    value={copy} onChange={e=>setCopy(e.target.value)} disabled={isGenerating} rows={6}
                    placeholder="Cole sua VSL, roteiro ou copy aqui…"
                    className="w-full rounded-xl text-sm text-zinc-300 placeholder-zinc-700 px-4 py-3.5 resize-none focus:outline-none focus:ring-1 transition-all disabled:opacity-40"
                    style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",fontFamily:"inherit"}}/>
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATES.map(t=>(
                        <button key={t.label} onClick={()=>setCopy(t.copy)}
                          className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all hover:bg-white/5 hover:border-zinc-700"
                          style={{borderColor:"rgba(255,255,255,0.07)",color:"#71717a"}}>
                          {t.icon} {t.label}
                        </button>
                      ))}
                    </div>
                    {copy.length>0 && (
                      <span className="text-[10px] font-medium text-zinc-600 shrink-0 ml-2">
                        {copy.length} chars · ~{Math.max(1,Math.round(copy.length/900))} min
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Progressive Disclosure: Options + Glow Button ── */}
            {hasContent && (
              <div className="mt-8 flex flex-col items-center gap-5" style={{animation:"fadeIn 0.4s ease both"}}>
                {/* Options row — only appears after content */}
                <div className="flex items-center gap-3 flex-wrap justify-center px-4 py-2.5 rounded-xl" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)"}}>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-600 font-semibold shrink-0">
                    <Brain className="w-3 h-3"/>Neural
                  </div>
                  <div className="w-px h-3.5" style={{background:"rgba(255,255,255,0.06)"}}/>
                  <select value={aspect} onChange={e=>setAspect(+e.target.value)} disabled={isGenerating}
                    className="text-[10px] text-zinc-500 pr-4 py-0.5 appearance-none cursor-pointer focus:outline-none bg-transparent disabled:opacity-40">
                    {ASPECTS.map((a,i)=><option key={i} value={i}>{a}</option>)}
                  </select>
                  <div className="w-px h-3.5" style={{background:"rgba(255,255,255,0.06)"}}/>
                  <select value={niche} onChange={e=>setNiche(e.target.value)} disabled={isGenerating}
                    className="text-[10px] text-zinc-500 pr-4 py-0.5 appearance-none cursor-pointer focus:outline-none bg-transparent disabled:opacity-40">
                    {NICHES.map(g=>(<optgroup key={g.group} label={`── ${g.group}`}>{g.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>))}
                  </select>
                  {videoFile && (
                    <>
                      <div className="w-px h-3.5" style={{background:"rgba(255,255,255,0.06)"}}/>
                      <select value={videoLang} onChange={e=>setVideoLang(e.target.value as "auto"|"pt"|"en"|"es")}
                        className="text-[10px] text-zinc-500 pr-4 py-0.5 appearance-none cursor-pointer focus:outline-none bg-transparent">
                        <option value="auto">🤖 Auto</option>
                        <option value="pt">🇧🇷 PT</option>
                        <option value="en">🇺🇸 EN</option>
                        <option value="es">🇪🇸 ES</option>
                      </select>
                    </>
                  )}
                </div>

                {/* ── GLOW BUTTON ── */}
                <button
                  onClick={videoFile ? handleEnrich : handleGenerate}
                  disabled={videoFile ? isEnriching : (!copy.trim() || isGenerating)}
                  className="px-10 py-3.5 rounded-xl text-[15px] font-black text-white transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background: hasContent ? "#F0563A" : "rgba(255,255,255,0.06)",
                    color: hasContent ? "#fff" : "rgba(255,255,255,0.2)",
                    animation: hasContent ? "glowPulse 3s ease-in-out infinite" : "none",
                    letterSpacing: "-0.01em",
                  }}>
                  {videoFile
                    ? (isEnriching
                        ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"/>Processando…</span>
                        : <span className="flex items-center gap-2"><Zap className="w-4 h-4"/>Enriquecer com IA</span>
                      )
                    : (isGenerating
                        ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"/>Gerando…</span>
                        : <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/>Gerar Mapa de Edição</span>
                      )
                  }
                </button>
              </div>
            )}

            {error && (
              <div className="mt-6 flex items-center gap-2 text-[13px] text-red-400 rounded-xl px-4 py-3 max-w-2xl mx-auto" style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)"}}>
                <X className="w-4 h-4 shrink-0"/>{error}
              </div>
            )}
          </main>

          {/* ═══ DIVIDER ═══ */}
          <div className="max-w-5xl mx-auto" style={{borderTop:"1px solid rgba(63,63,70,0.25)"}}/>

          {/* ═══ HOOKS VIRAIS — "ATALHOS" ═══ */}
          <section className="max-w-6xl mx-auto px-6 pt-10 pb-16">
            <p className="text-[14px] text-zinc-600 text-center mb-8 font-medium">
              Ou comece com um Hook validado
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {GALLERY_CARDS.map(card=>(
                <div key={card.id}
                  className="hook-card group relative rounded-2xl overflow-hidden cursor-pointer"
                  style={{border:"1px solid rgba(255,255,255,0.05)",background:"#111"}}>
                  <video
                    src={card.videoUrl}
                    autoPlay loop muted playsInline
                    className="w-full object-cover"
                    style={{aspectRatio:card.tall?"9/14":"9/11",display:"block",filter:"brightness(0.78) saturate(1.1)"}}
                    onError={e=>{
                      const v=e.currentTarget;
                      const img=document.createElement("img");
                      img.src=card.src; img.className=v.className; img.style.cssText=v.style.cssText;
                      v.parentNode?.replaceChild(img,v);
                    }}
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{background:"linear-gradient(to bottom,transparent 30%,rgba(0,0,0,0.85) 100%)"}}/>
                  {/* Tag */}
                  <div className="absolute top-2 left-2">
                    <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full"
                      style={{background:"rgba(240,86,58,0.2)",color:"#FF7A5C",border:"1px solid rgba(240,86,58,0.35)",backdropFilter:"blur(6px)"}}>
                      {card.tag}
                    </span>
                  </div>
                  {/* Title */}
                  <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-6">
                    <p className="text-[10px] font-bold text-white/80 leading-snug"
                      style={{textShadow:"0 1px 4px rgba(0,0,0,0.8)"}}>
                      {card.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>

    {isUploadModalOpen && <UploadModal onClose={()=>setUploadOpen(false)}/>}
    {paywallOpen       && <PaywallModal onClose={()=>setPaywallOpen(false)}/>}
    </>
  );
}
