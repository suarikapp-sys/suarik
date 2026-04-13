import type {
  Scene,
  DirectResponseScene,
  TimelineClip,
  SubtitleWord,
  SFXMarker,
  IntentResult,
} from "./types";

// ─── SFX Keywords ────────────────────────────────────────────────────────────
// Keywords → SFX label + visual style
export const SFX_KEYWORDS: Record<string, { label: string; kind: "zap"|"bell"; color: string }> = {
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

// ─── VSL Brain: keyword → premium curated image ───────────────────────────────
export const BROLL_IMAGES: Record<string, string> = {
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

// ─── PEXELS_CONCEPTS: English concept → curated HD image ─────────────────────
export const PEXELS_CONCEPTS: Record<string, string> = {
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

// ─── Static data ──────────────────────────────────────────────────────────────
export const CLIP_COLS = ["#E8593C","#D4513A","#FF7A5C","#C44B35","#B8422F","#FF9478"];

export const POWER_WORDS = new Set([
  "segredo","proibido","nunca","grátis","agora","urgente","exclusivo","revelado",
  "bug","verdade","descoberto","destroi","dissolve","esquecido","padrão","esconder",
  "detecta","estratégia","bloqueado","bilhões","médicos","composto","amazônia",
]);

// Gallery fallback cards (used by getSceneThumb)
export const GALLERY_CARDS = [
  {id:1,  tag:"Renda Extra", title:"Hook 'Olha quanto eu recebi hoje'",   src:"https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=400", tall:true,  videoUrl:"https://assets.mixkit.co/videos/18296/18296-360.mp4"},
  {id:2,  tag:"Renda Extra", title:"Prova Social — Dinheiro na Mão",      src:"https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&w=400", tall:false, videoUrl:"https://assets.mixkit.co/videos/24354/24354-360.mp4"},
  {id:3,  tag:"Saúde",       title:"Dor de cabeça — gancho Nutra",        src:"https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&w=400", tall:false, videoUrl:"https://assets.mixkit.co/videos/47583/47583-360.mp4"},
  {id:4,  tag:"Saúde",       title:"Dor abdominal — abertura VSL Saúde",  src:"https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&w=400", tall:true,  videoUrl:"https://assets.mixkit.co/videos/33376/33376-360.mp4"},
  {id:5,  tag:"Finanças",    title:"Frustração com contas atrasadas",      src:"https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&w=400", tall:false, videoUrl:"https://assets.mixkit.co/videos/25575/25575-360.mp4"},
  {id:6,  tag:"Finanças",    title:"Estresse financeiro no trabalho",      src:"https://images.pexels.com/photos/259200/pexels-photo-259200.jpeg?auto=compress&w=400",   tall:true,  videoUrl:"https://assets.mixkit.co/videos/5601/5601-360.mp4"},
  {id:7,  tag:"Dor",         title:"Dor que vende — gancho emocional",     src:"https://images.pexels.com/photos/3762800/pexels-photo-3762800.jpeg?auto=compress&w=400", tall:false, videoUrl:"https://assets.mixkit.co/videos/47583/47583-360.mp4"},
  {id:8,  tag:"Dor",         title:"'Não aguento mais' — abertura forte",  src:"https://images.pexels.com/photos/3771807/pexels-photo-3771807.jpeg?auto=compress&w=400", tall:false, videoUrl:"https://assets.mixkit.co/videos/33376/33376-360.mp4"},
  {id:9,  tag:"Ansiedade",   title:"Colapso financeiro — cena de abertura",src:"https://images.pexels.com/photos/3684307/pexels-photo-3684307.jpeg?auto=compress&w=400", tall:true,  videoUrl:"https://assets.mixkit.co/videos/25575/25575-360.mp4"},
  {id:10, tag:"Ansiedade",   title:"Burnout — esgotamento total",          src:"https://images.pexels.com/photos/1166209/pexels-photo-1166209.jpeg?auto=compress&w=400", tall:false, videoUrl:"https://assets.mixkit.co/videos/5601/5601-360.mp4"},
  {id:11, tag:"UGC",         title:"Prova de renda — notificação ao vivo", src:"https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=400", tall:false, videoUrl:"https://assets.mixkit.co/videos/18296/18296-360.mp4"},
  {id:12, tag:"UGC",         title:"Depoimento UGC — antes e depois",      src:"https://images.pexels.com/photos/2263436/pexels-photo-2263436.jpeg?auto=compress&w=400", tall:true,  videoUrl:"https://assets.mixkit.co/videos/24354/24354-360.mp4"},
];

// ─── AI Art Director: semantic intent classification ──────────────────────────
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

export function classifyIntent(lower: string): IntentResult {
  for (const rule of SEMANTIC_RULES) if (rule.test(lower)) return rule.result;
  return SEMANTIC_RULES[SEMANTIC_RULES.length - 1].result;
}

// Fuzzy lookup: returns best matching image for any English concept query
export function lookupConcept(query: string): string {
  if (PEXELS_CONCEPTS[query]) return PEXELS_CONCEPTS[query];
  const qwords = new Set(query.toLowerCase().split(/\s+/));
  let best = "", bestScore = 0;
  for (const [key, url] of Object.entries(PEXELS_CONCEPTS)) {
    const score = key.toLowerCase().split(/\s+/).filter(w => qwords.has(w)).length;
    if (score > bestScore) { bestScore = score; best = url; }
  }
  return best || GALLERY_CARDS[0].src;
}

// Returns a guaranteed-visible thumbnail for a scene
export function getSceneThumb(sc: Scene, idx: number): string {
  const txt = (sc.text_chunk ?? sc.segment ?? "").toLowerCase();
  for (const w of txt.split(/\s+/)) {
    const clean = w.replace(/[^a-záéíóúãõçêâîôû]/g, "");
    if (BROLL_IMAGES[clean]) return BROLL_IMAGES[clean];
  }
  return GALLERY_CARDS[idx % GALLERY_CARDS.length].src;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function fmtTime(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

// Scans all scenes, emits SFXMarker for each keyword hit + scene-boundary transitions.
// Debounced: max 1 marker per 1.5s to avoid visual noise.
export function buildSFXMarkers(scenes: Scene[]): SFXMarker[] {
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

// ─── Zero Black Screen + Rapid-Cut algorithm ─────────────────────────────────
export function buildTimelineClips(scenes: Scene[]): TimelineClip[] {
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
          triggerWord: hit.word,
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
export function buildSubtitleWords(scenes: Scene[]): SubtitleWord[] {
  const out: SubtitleWord[] = [];
  let cursor = 0;
  for (const sc of scenes) {
    const dur  = sc.estimated_duration_seconds ?? 5;
    const text = (sc.text_chunk ?? sc.segment ?? "").trim();
    const raw  = text.split(/\s+/).filter(Boolean);
    if (raw.length === 0) { cursor += dur; continue; }
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

// ─── analyzeCopyForDirectResponse ────────────────────────────────────────────
export function analyzeCopyForDirectResponse(copyText: string): DirectResponseScene[] {
  const WPS = 2.2, MIN_DUR = 3.5, MAX_DUR = 9.0;

  const raw = copyText.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

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

  const merged: string[] = [];
  let buf = "";
  for (const chunk of chunks) {
    if (!buf) { buf = chunk; continue; }
    if (buf.split(/\s+/).length < 6) { buf += " " + chunk; }
    else { merged.push(buf); buf = chunk; }
  }
  if (buf) merged.push(buf);

  return merged.map((text, i) => {
    const wc = text.split(/\s+/).length;
    const pause = /[.!?]$/.test(text.trim()) ? 0.6 : /[…,]$/.test(text.trim()) ? 0.3 : 0;
    const duration = Math.max(MIN_DUR, Math.min(MAX_DUR, wc / WPS + pause));
    const { emotion, searchQueries, suggestedSfx } = classifyIntent(text.toLowerCase());
    return { id:`drs-${i}`, textSnippet:text, duration, emotion, searchQueries, suggestedSfx };
  });
}

// ─── buildTimelineClipsFromDRS ────────────────────────────────────────────────
export function buildTimelineClipsFromDRS(drScenes: DirectResponseScene[]): TimelineClip[] {
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

    const brollRatio = i % 2 === 0 ? 0.65 : 0.60;
    const brollDur   = Math.max(1.5, drs.duration * brollRatio);

    clips.push({
      id:          `drs${i}`,
      sceneIdx:    i,
      url,
      thumb:       thumb || lookupConcept(query),
      triggerWord: query,
      startSec:    cursor,
      durSec:      brollDur,
      label:       `${drs.emotion} · ${shortLabel}`,
      color:       col,
    });
    cursor += drs.duration;
  }
  return clips;
}

// ─── buildSubtitleWordsFromDRS ────────────────────────────────────────────────
export function buildSubtitleWordsFromDRS(drScenes: DirectResponseScene[]): SubtitleWord[] {
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

export function generateSRT(scenes: Scene[]): string {
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

// ─── WAV encoder helpers ──────────────────────────────────────────────────────
export function writeWavString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

export function audioBufferToWav(audioBuffer: AudioBuffer, targetRate = 16000): Blob {
  const origRate = audioBuffer.sampleRate;
  let samples: Float32Array;
  if (audioBuffer.numberOfChannels === 1) {
    samples = audioBuffer.getChannelData(0);
  } else {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;
    samples = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) samples[i] = (left[i] + right[i]) * 0.5;
  }
  if (origRate !== targetRate) {
    const ratio = origRate / targetRate;
    const newLen = Math.ceil(samples.length / ratio);
    const ds = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) ds[i] = samples[Math.floor(i * ratio)];
    samples = ds;
  }
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
export async function extractAudioAsWav(file: File): Promise<Blob> {
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
