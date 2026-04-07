import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SUARIK — AI Cinematic Engine",
  description: "Motor de IA que transforma sua copy em B-rolls, legendas e timeline em segundos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        {/* Primary design fonts */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,300&display=swap" rel="stylesheet"/>
      </head>
      <body className="antialiased" style={{fontFamily:"'DM Sans',sans-serif"}}>{children}</body>
    </html>
  );
}
