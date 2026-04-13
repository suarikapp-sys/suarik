// ─── MiniMax TTS Voice Library (speech-2.8-hd) ────────────────────────────────
// ✅ TODOS OS IDs TESTADOS E CONFIRMADOS via /api/admin/test-voices
// Vozes multilíngues: o idioma do texto determina o idioma falado.
// Última verificação: 2026-04-12

export const TTS_VOICES = [
  // ── Multilíngue — falam PT, EN, ES e mais ────────────────────────────────────
  // Melhor opção para conteúdo em Português Brasileiro
  { id: "Portuguese_Narrator",  label: "Narrador PT",         lang: "PT", gender: "M" },
  { id: "Sofia",                label: "Sofia",               lang: "PT", gender: "F" },
  { id: "Leonardo",             label: "Leonardo",            lang: "PT", gender: "M" },
  { id: "Daniel",               label: "Daniel",              lang: "PT", gender: "M" },
  { id: "Luna",                 label: "Luna",                lang: "PT", gender: "F" },
  { id: "Mia",                  label: "Mia",                 lang: "PT", gender: "F" },
  { id: "Lisa",                 label: "Lisa",                lang: "PT", gender: "F" },
  { id: "Rose",                 label: "Rose",                lang: "PT", gender: "F" },
  { id: "Leon",                 label: "Leon",                lang: "PT", gender: "M" },
  { id: "Owen",                 label: "Owen",                lang: "PT", gender: "M" },
  { id: "Narrator",             label: "Narrator (Universal)",lang: "PT", gender: "M" },
  { id: "Friendly_Person",      label: "Pessoa Amigável",     lang: "PT", gender: "F" },
  { id: "Calm_Woman",           label: "Mulher Calma",        lang: "PT", gender: "F" },
  { id: "Ethan",                label: "Ethan",               lang: "PT", gender: "M" },

  // ── English — vozes nativas confirmadas ──────────────────────────────────────
  { id: "English_expressive_narrator", label: "Expressive Narrator", lang: "EN", gender: "M" },
  { id: "English_Insightful_Speaker",  label: "Insightful Speaker",  lang: "EN", gender: "M" },
  { id: "English_Persuasive_Man",      label: "Persuasive Man",      lang: "EN", gender: "M" },
  { id: "English_Lucky_Robot",         label: "Lucky Robot",         lang: "EN", gender: "M" },
  { id: "English_Graceful_Lady",       label: "Graceful Lady",       lang: "EN", gender: "F" },
  { id: "English_radiant_girl",        label: "Radiant Girl",        lang: "EN", gender: "F" },

  // ── 日本語 ────────────────────────────────────────────────────────────────────
  { id: "Japanese_Whisper_Belle",      label: "Whisper Belle",       lang: "JA", gender: "F" },

  // ── 普通话 ────────────────────────────────────────────────────────────────────
  { id: "Chinese (Mandarin)_Lyrical_Voice",       label: "Lyrical Voice",       lang: "ZH", gender: "F" },
  { id: "Chinese (Mandarin)_HK_Flight_Attendant", label: "HK Flight Attendant", lang: "ZH", gender: "F" },
  { id: "male-qn-qingse",             label: "Qingse (Male)",       lang: "ZH", gender: "M" },
  { id: "female-shaonv",              label: "Shaonv (Female)",     lang: "ZH", gender: "F" },
] as const;

export type TTSVoiceId = (typeof TTS_VOICES)[number]["id"];
export type TTSVoice   = (typeof TTS_VOICES)[number];
