import { APP_URL } from "@/app/lib/config";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PostHogProvider } from "@/components/PostHogProvider";

// ─── Global SEO Metadata ──────────────────────────────────────────────────────
const OG_IMAGE = `${APP_URL}/og-image.jpg`;

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default:  "SUARIK — Transforme sua copy em storyboard profissional com IA",
    template: "%s | SUARIK",
  },
  description:
    "Motor de IA que converte sua copy ou vídeo A-roll em B-rolls sincronizados, legendas karaokê, SFX e trilha — pronto para Premiere, DaVinci e CapCut em segundos.",

  keywords: [
    "storyboard com IA", "edição de vídeo IA", "B-rolls automáticos",
    "legendas automáticas", "VSL", "direct response", "IA para criadores de conteúdo",
    "TTS em português", "trilha sonora IA", "SUARIK",
  ],

  authors: [{ name: "SUARIK", url: APP_URL }],
  creator: "SUARIK",
  publisher: "SUARIK",

  // ── Open Graph ───────────────────────────────────────────────────────────────
  openGraph: {
    type:        "website",
    locale:      "pt_BR",
    url:         APP_URL,
    siteName:    "SUARIK",
    title:       "SUARIK — Transforme sua copy em storyboard profissional com IA",
    description: "Cole sua copy, a IA gera cenas, B-rolls, legendas e música em segundos. Export direto para Premiere, DaVinci ou CapCut.",
    images: [
      {
        url:    OG_IMAGE,
        width:  1200,
        height: 630,
        alt:    "SUARIK — AI Cinematic Engine",
      },
    ],
  },

  // ── Twitter / X ──────────────────────────────────────────────────────────────
  twitter: {
    card:        "summary_large_image",
    title:       "SUARIK — Storyboard com IA em segundos",
    description: "Cole sua copy, a IA gera cenas, B-rolls e música automaticamente.",
    images:      [OG_IMAGE],
    creator:     "@suarik",
  },

  // ── Robots ───────────────────────────────────────────────────────────────────
  robots: {
    index:            true,
    follow:           true,
    googleBot: {
      index:          true,
      follow:         true,
      "max-image-preview": "large",
      "max-snippet":  -1,
    },
  },

  // ── Alternate ────────────────────────────────────────────────────────────────
  alternates: {
    canonical: APP_URL,
    languages: { "pt-BR": APP_URL },
  },

  // ── Icons ────────────────────────────────────────────────────────────────────
  icons: {
    icon:        "/favicon.ico",
    shortcut:    "/favicon.ico",
    apple:       "/apple-touch-icon.png",
  },

  // ── App manifest ─────────────────────────────────────────────────────────────
  manifest: "/manifest.json",

  // ── Category ─────────────────────────────────────────────────────────────────
  category: "technology",
};

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  themeColor:   "#F0563A",
};

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Primary design fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,300&family=Geist:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* JSON-LD — SoftwareApplication structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type":    "SoftwareApplication",
              name:       "SUARIK",
              url:        APP_URL,
              description:
                "Motor de IA que converte copy em storyboards profissionais com B-rolls, legendas e música para Premiere, DaVinci e CapCut.",
              applicationCategory: "MultimediaApplication",
              operatingSystem:     "Web",
              offers: {
                "@type":    "AggregateOffer",
                priceCurrency: "BRL",
                lowPrice:   "0",
                offerCount: "4",
              },
              inLanguage: "pt-BR",
            }),
          }}
        />
      </head>
      <body className="antialiased" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <PostHogProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </PostHogProvider>
      </body>
    </html>
  );
}
