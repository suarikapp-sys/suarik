// Re-uses the same OG image for Twitter cards
// runtime must be declared directly (Next.js 16 doesn't allow re-exporting it)
export const runtime = "edge";
export const alt = "SUARIK — AI Cinematic Engine";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export { default } from "./opengraph-image";
