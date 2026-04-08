export const TTS_VOICES = [
  { id: "English_expressive_narrator",          label: "English — Expressive Narrator" },
  { id: "English_Graceful_Lady",                label: "English — Graceful Lady" },
  { id: "English_Insightful_Speaker",           label: "English — Insightful Speaker" },
  { id: "English_radiant_girl",                 label: "English — Radiant Girl" },
  { id: "English_Persuasive_Man",               label: "English — Persuasive Man" },
  { id: "English_Lucky_Robot",                  label: "English — Lucky Robot" },
  { id: "Chinese (Mandarin)_Lyrical_Voice",     label: "Chinese (Mandarin) — Lyrical Voice" },
  { id: "Chinese (Mandarin)_HK_Flight_Attendant", label: "Chinese (Mandarin) — HK Flight Attendant" },
  { id: "Japanese_Whisper_Belle",               label: "Japanese — Whisper Belle" },
] as const;

export type TTSVoiceId = (typeof TTS_VOICES)[number]["id"];
