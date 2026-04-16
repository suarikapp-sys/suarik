// ─── 404 Not Found ────────────────────────────────────────────────────────────
import Link from "next/link";
import SuarikLogo from "@/components/SuarikLogo";

export default function NotFound() {
  return (
    <html lang="pt-BR" data-theme="dark">
      <body style={{ margin: 0, padding: 0, background: "#060606", fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "0 24px" }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 40 }}>
            <SuarikLogo size={32} showName />
          </div>

          {/* 404 */}
          <div style={{ fontSize: 96, fontWeight: 900, color: "#E8512A", lineHeight: 1, letterSpacing: "-.05em", marginBottom: 16, opacity: .9 }}>
            404
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#eaeaea", margin: "0 0 10px", letterSpacing: "-.03em" }}>
            Página não encontrada
          </h1>
          <p style={{ fontSize: 14, color: "#555", margin: "0 0 36px", lineHeight: 1.6 }}>
            O endereço que você acessou não existe ou foi movido.
          </p>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/dashboard" style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "10px 20px", borderRadius: 8,
              background: "#E8512A", color: "#fff",
              fontSize: 13, fontWeight: 700, textDecoration: "none",
              letterSpacing: "-.01em",
            }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L2 6h3v7h4V6h3L7 1z" fill="currentColor"/>
              </svg>
              Ir para o Dashboard
            </Link>
            <Link href="/" style={{
              display: "inline-flex", alignItems: "center",
              padding: "10px 20px", borderRadius: 8,
              border: "1px solid #1a1a1a", color: "#666",
              fontSize: 13, fontWeight: 500, textDecoration: "none",
            }}>
              Página inicial
            </Link>
          </div>

        </div>
      </body>
    </html>
  );
}
