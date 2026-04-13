import { APP_URL } from "@/app/lib/config";
import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "Planos e Preços — SUARIK",
  description:
    "Escolha o plano ideal: do Starter gratuito ao Agency. Créditos mensais, storyboards ilimitados e acesso a todas as ferramentas de IA — cancele quando quiser.",
  alternates: { canonical: `${APP_URL}/pricing` },
  openGraph: {
    url:   `${APP_URL}/pricing`,
    title: "Planos SUARIK — Do Starter ao Agency",
    description:
      "Créditos para TTS, Music AI, SFX e Storyboard. Assine e comece a criar agora.",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
