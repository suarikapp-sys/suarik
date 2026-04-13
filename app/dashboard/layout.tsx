import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — SUARIK",
  description: "Seus projetos, créditos e ferramentas de IA em um só lugar.",
  robots: { index: false, follow: false }, // área privada — não indexar
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
