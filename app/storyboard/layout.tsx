import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Storyboard Studio — SUARIK",
  description: "Crie storyboards profissionais com B-rolls, legendas e música gerados por IA.",
  robots: { index: false, follow: false },
};

export default function StoryboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
