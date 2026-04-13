// ─── Storyboard constants — shared by WorkstationView and SuarikHome ─────────
import type { Scene } from "./types";

export const NICHES = [
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

export const TEMPLATES = [
  { icon:"💊", label:"Copy Nutra",    copy:`Médicos estão proibindo esta informação porque destrói o mercado de remédios para dores articulares. Um composto natural descoberto na Amazônia dissolve o cristal de urato em apenas 21 dias. Sem cirurgia. Sem efeitos colaterais. Assista até o final — este vídeo pode sair do ar.` },
  { icon:"💰", label:"Copy Finanças", copy:`Existe um bug no sistema financeiro brasileiro que faz dinheiro desaparecer da sua conta sem você perceber. 47 bilhões em acordos judiciais esquecidos pelo governo. Seu nome pode estar na lista. Vou te mostrar como verificar em 3 minutos, de graça, pelo celular.` },
  { icon:"🎰", label:"Copy iGaming",  copy:`A maioria dos jogadores perde porque usa a estratégia errada. Depois de analisar 847 rodadas ao vivo, identificamos o único padrão que os cassinos tentam esconder. Nossa IA detecta o momento exato de entrar e sair. Retorno médio dos últimos 30 dias: +247%.` },
];

export const ASPECTS   = ["📺 16:9 · VSL","📱 9:16 · Reels","🎬 Cinemático"];
export const CLIP_COLS = ["#E8593C","#D4513A","#FF7A5C","#C44B35","#B8422F","#FF9478"];

// ─── VSL Brain: keyword → premium curated image (exact match, high quality) ──
// Each entry maps a PT-BR trigger word to a Pexels HD photo that visually
// represents that concept. This drives both the timeline rapid-cut thumbnails
// and the karaoke subtitle glow effect.
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

// Returns a guaranteed-visible thumbnail for a scene
function getSceneThumb(sc: Scene, idx: number): string {
  const txt = (sc.text_chunk ?? sc.segment ?? "").toLowerCase();
  for (const w of txt.split(/\s+/)) {
    const clean = w.replace(/[^a-záéíóúãõçêâîôû]/g, "");
    if (BROLL_IMAGES[clean]) return BROLL_IMAGES[clean];
  }
  return GALLERY_CARDS[idx % GALLERY_CARDS.length].src;
}

export const GALLERY_TAGS  = ["All","Renda Extra","Saúde","Finanças","Dor","Ansiedade","UGC"];
// ── Mixkit CDN · IDs verificados · formato 360p ──────────────────────────────
// 💰 Renda Extra — pessoas com dinheiro real
export const VA = "https://assets.mixkit.co/videos/18296/18296-360.mp4"; // homem contando maço de notas
export const VB = "https://assets.mixkit.co/videos/24354/24354-360.mp4"; // mulher contando dólares
// 😣 Saúde / Dor física — pessoas sofrendo de verdade
export const VC = "https://assets.mixkit.co/videos/47583/47583-360.mp4"; // mulher massageando têmpora com dor
export const VD = "https://assets.mixkit.co/videos/33376/33376-360.mp4"; // garota na cama com dor forte no estômago
// 💻 Finanças / Ansiedade — frustração real no dia a dia
export const VE = "https://assets.mixkit.co/videos/25575/25575-360.mp4"; // mulher jovem frustrada na frente do PC
export const VF = "https://assets.mixkit.co/videos/5601/5601-360.mp4";   // empresário estressado esfregando os olhos
export const GALLERY_CARDS = [
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

export const LOADING_MSGS = [
  "Analisando psicologia da copy…","Detectando gatilhos de retenção…",
  "Cortando silêncios automaticamente…","Adicionando SFX de impacto…",
  "Mapeando Palavras de Poder…","Sincronizando B-rolls com a fala…",
  "Calibrando trilha para tensão máxima…","Finalizando mapa de edição premium…",
];

export const POWER_WORDS = new Set([
  "segredo","proibido","nunca","grátis","agora","urgente","exclusivo","revelado",
  "bug","verdade","descoberto","destroi","dissolve","esquecido","padrão","esconder",
  "detecta","estratégia","bloqueado","bilhões","médicos","composto","amazônia",
]);
