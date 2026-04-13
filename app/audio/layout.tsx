import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audio Studio — SUARIK",
  description: "TTS com 44 vozes em 9 idiomas, Music AI e SFX gerados em segundos.",
  robots: { index: false, follow: false },
};

export default function AudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
