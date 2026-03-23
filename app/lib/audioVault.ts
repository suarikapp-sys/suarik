// ─────────────────────────────────────────────────────────────────────────────
// 🔐 COFRE PRIVADO DE ÁUDIO — Audio Vault
//
// Prioridade máxima: estas trilhas são usadas ANTES do Pixabay.
// Para adicionar suas próprias músicas, substitua as URLs de placeholder
// por caminhos reais (ex: /audio/minha_trilha.mp3) ou URLs hospedadas.
//
// Categorias disponíveis para o music_style da IA:
//   vsl_tension          → VSLs e anúncios de alto impacto
//   extra_income_hype    → Renda extra, oportunidades, energia
//   real_estate_cinematic → Imóveis, lifestyle, luxo
//   sfx_impact           → Impactos e pancadas de corte
//   sfx_whoosh           → Transições rápidas e whooshes
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultTrack {
  title: string;
  url: string;
}

export const AUDIO_VAULT: Record<string, VaultTrack[]> = {
  // ── Tensão para VSL / Direct Response ──────────────────────────────────────
  vsl_tension: [
    { title: "Tensão Máxima", url: "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3" },
  ],

  // ── Hype para Renda Extra / Infoprodutos ───────────────────────────────────
  extra_income_hype: [
    { title: "Money Flow — Motivational Trap", url: "/audio/extra_income_01.mp3" },
    { title: "Rise Up — Success Energy",       url: "/audio/extra_income_02.mp3" },
    { title: "Cash Vibes — Lo-fi Hype",        url: "/audio/extra_income_03.mp3" },
  ],

  // ── Cinemático para Imóveis / Lifestyle ────────────────────────────────────
  real_estate_cinematic: [
    { title: "Golden Hour — Luxury Cinematic", url: "/audio/real_estate_01.mp3" },
    { title: "Skyline Dreams — Epic Ambient",  url: "/audio/real_estate_02.mp3" },
    { title: "Premium Life — Soft Orchestral", url: "/audio/real_estate_03.mp3" },
  ],

  // ── SFX: Impactos de Corte ─────────────────────────────────────────────────
  sfx_impact: [
    { title: "Heavy Impact Hit 1",  url: "/audio/sfx_impact_01.mp3" },
    { title: "Cinematic Boom",      url: "/audio/sfx_impact_02.mp3" },
    { title: "Bass Drop Punch",     url: "/audio/sfx_impact_03.mp3" },
  ],

  // ── SFX: Transições Whoosh ─────────────────────────────────────────────────
  sfx_whoosh: [
    { title: "Fast Whoosh Transition 1", url: "/audio/sfx_whoosh_01.mp3" },
    { title: "Air Swoosh Cut",           url: "/audio/sfx_whoosh_02.mp3" },
    { title: "Zip Transition",           url: "/audio/sfx_whoosh_03.mp3" },
  ],
};
