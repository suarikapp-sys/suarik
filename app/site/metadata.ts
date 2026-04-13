import { APP_URL } from "@/app/lib/config";
import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "SUARIK — Transforme sua copy em storyboard profissional com IA",
  description:
    "Cole sua copy ou faça upload do seu vídeo A-roll. A IA gera cenas, B-rolls sincronizados, legendas karaokê, SFX e trilha sonora em segundos. Export para Premiere, DaVinci e CapCut.",
  alternates: {
    canonical: APP_URL,
  },
  openGraph: {
    url:   APP_URL,
    title: "SUARIK — Storyboard com IA em segundos",
    description:
      "Do roteiro ao storyboard profissional: B-rolls, legendas e música gerados automaticamente pela IA.",
  },
};
