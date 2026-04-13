// ─── App-wide config ──────────────────────────────────────────────────────────
// Fonte única de verdade para URLs e constantes globais.

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://suarik.com.br";

export const IS_DEV  = process.env.NODE_ENV === "development";
export const IS_PROD = process.env.NODE_ENV === "production";
