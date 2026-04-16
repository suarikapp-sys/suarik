"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import SuarikLogo from "@/components/SuarikLogo";

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = "perfil" | "plano" | "preferencias" | "seguranca" | "conta";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: "Free", starter: "Starter", pro: "Pro", growth: "Growth", enterprise: "Enterprise",
};
const PLAN_TOTAL: Record<string, number> = {
  free: 0, starter: 5000, pro: 15000, growth: 45000, enterprise: 250000,
};
const SELECT_ARROW = `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%23444' stroke-width='1.2' stroke-linecap='round' fill='none'/%3E%3C/svg%3E")`;

// ─── Sub-components ───────────────────────────────────────────────────────────


function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 30, height: 17, borderRadius: 9, position: "relative", cursor: "pointer",
        transition: "background .2s", flexShrink: 0,
        background: on ? "var(--o)" : "var(--bg4)",
        border: on ? "none" : "1px solid var(--border2)",
      }}
    >
      <div style={{
        position: "absolute", width: 13, height: 13, borderRadius: "50%",
        background: "#fff", top: 2, left: on ? 15 : 2, transition: "left .2s",
        boxShadow: "0 1px 3px rgba(0,0,0,.3)",
      }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [activeSection, setActiveSection] = useState<Section>("perfil");
  const [userEmail,     setUserEmail]     = useState("");
  const [userName,      setUserName]      = useState("");
  const [userLastName,  setUserLastName]  = useState("");
  const [userPlan,      setUserPlan]      = useState("starter");
  const [credits,       setCredits]       = useState(0);
  const [saved,         setSaved]         = useState(false);

  // Notification toggles
  const [notifRender, setNotifRender] = useState(true);
  const [notifCoins,  setNotifCoins]  = useState(true);
  const [notifNews,   setNotifNews]   = useState(false);
  const [notifTips,   setNotifTips]   = useState(true);

  useEffect(() => {
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email ?? "");
      const fullName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "";
      const parts = fullName.split(" ");
      setUserName(parts[0] ?? "");
      setUserLastName(parts.slice(1).join(" "));
      const { data: prof } = await supabase.from("profiles").select("plan,credits").eq("id", user.id).single();
      if (prof) {
        setUserPlan(prof.plan ?? "starter");
        setCredits(prof.credits ?? 0);
      }
    })();
  }, [router]);

  const handleSave = async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const fullName = [userName, userLastName].filter(Boolean).join(" ");
      await supabase.auth.updateUser({ data: { full_name: fullName } });
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    } catch { /* silent */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handlePortal = async () => {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch { /* ignore */ }
  };

  const handleExportData = async () => {
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        alert("Não foi possível exportar seus dados. Tente novamente.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `suarik-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erro de rede ao exportar. Tente novamente.");
    }
  };

  const handleDeleteAccount = async () => {
    const warn = "Esta ação é IRREVERSÍVEL.\n\nSerá apagado:\n• seu perfil e créditos\n• todos os projetos\n• vozes clonadas\n• sua assinatura Stripe será cancelada\n\nPara confirmar, digite EXCLUIR:";
    const input = window.prompt(warn);
    if (input !== "EXCLUIR") return;

    try {
      const res = await fetch("/api/account/delete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ confirm: "EXCLUIR" }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        alert(data.error ?? "Erro ao excluir conta. Contate suporte@suarik.com.");
        return;
      }
      // Sign out locally and redirect
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut().catch(() => {});
      window.location.href = "/?account=deleted";
    } catch {
      alert("Erro de rede. Tente novamente ou contate suporte@suarik.com.");
    }
  };

  const planLabel  = PLAN_LABELS[userPlan] ?? "Starter";
  const planTotal  = PLAN_TOTAL[userPlan] ?? 5000;
  const creditsPct = planTotal > 0 ? Math.min(100, Math.round((credits / planTotal) * 100)) : 0;
  const userInitial = userName ? userName[0].toUpperCase() : "U";

  // ── CSS variable maps ──
  const themeVars: Record<string, string> = isDark ? {
    "--bg": "#060606", "--bg2": "#09090B", "--bg3": "#0F0F0F", "--bg4": "#141414",
    "--border": "#131313", "--border2": "#1A1A1A",
    "--text": "#EAEAEA", "--text2": "#7A7A7A", "--text3": "#444", "--text4": "#252525",
    "--card": "#09090B",
  } : {
    "--bg": "#F4F4F6", "--bg2": "#FAFAFA", "--bg3": "#EFEFEF", "--bg4": "#E6E6E8",
    "--border": "#E2E2E4", "--border2": "#D6D6D8",
    "--text": "#0C0C0C", "--text2": "#606060", "--text3": "#999", "--text4": "#C8C8C8",
    "--card": "#FFFFFF",
  };
  const colorVars: Record<string, string> = {
    "--o": "#E8512A", "--o2": "#FF6B3D",
    "--green": "#3ECF8E", "--gs": "rgba(62,207,142,.07)", "--gm": "rgba(62,207,142,.18)",
    "--amber": "#F5A623", "--as": "rgba(245,166,35,.1)",
    "--red": "#E24B4A", "--rs": "rgba(226,75,74,.07)",
    "--r": "7px", "--r2": "11px",
  };

  // ── Shared style helpers ──
  const fi: React.CSSProperties = {
    width: "100%", background: "var(--bg3)", border: "1px solid var(--border)",
    borderRadius: "var(--r)", padding: "9px 12px", color: "var(--text)",
    fontFamily: "'Geist',system-ui,sans-serif", fontSize: 13, outline: "none",
    caretColor: "var(--o)", transition: "border-color .2s",
  };
  const si: React.CSSProperties = {
    ...fi, WebkitAppearance: "none", appearance: "none" as const,
    backgroundImage: SELECT_ARROW, backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center", paddingRight: 30, cursor: "pointer",
  };
  const card: React.CSSProperties = {
    background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: "var(--r2)", overflow: "hidden", marginBottom: 10,
  };
  const cardHd: React.CSSProperties = {
    padding: "14px 16px", borderBottom: "1px solid var(--border)",
    display: "flex", alignItems: "center", gap: 8,
  };
  const saveBtn = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700,
    padding: "9px 18px", borderRadius: "var(--r)", background: active ? "#3ECF8E" : "var(--o)",
    color: "#fff", border: "none", cursor: active ? "default" : "pointer",
    fontFamily: "inherit", transition: "all .2s",
  });

  // ── Sidebar nav ──
  const navItems: { id: Section; label: string; danger?: boolean; icon: React.ReactNode }[] = [
    { id: "perfil", label: "Perfil", icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="3" stroke="currentColor" strokeWidth="1.1"/><path d="M2 13c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg> },
    { id: "plano", label: "Plano & Cobrança", icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1L5.5 4H2l2.5 2-1 3.5L7 7.5l3.5 2-1-3.5 2.5-2H8.5L7 1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg> },
    { id: "preferencias", label: "Preferências", icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.1"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.9 2.9l1.4 1.4M9.7 9.7l1.4 1.4M2.9 11.1l1.4-1.4M9.7 4.3l1.4-1.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg> },
    { id: "seguranca", label: "Segurança", icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="3" y="6" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.1"/><path d="M5 6V4a2 2 0 014 0v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg> },
    { id: "conta", label: "Conta", danger: true, icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 12h12L7 1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/><path d="M7 5.5v3M7 10v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
  ];

  const secHd = (title: string, sub: string) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em", color: "var(--text)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 300 }}>{sub}</div>
    </div>
  );

  return (
    <div style={{
      ...themeVars, ...colorVars,
      fontFamily: "'Geist',system-ui,sans-serif", WebkitFontSmoothing: "antialiased",
      background: "var(--bg)", color: "var(--text)",
      height: "100vh", display: "flex", flexDirection: "column",
      fontSize: 14, overflow: "hidden",
    } as React.CSSProperties}>
      {/* ── Custom scrollbar ── */}
      <style>{`
        .settings-main::-webkit-scrollbar { width: 4px; }
        .settings-main::-webkit-scrollbar-thumb { background: var(--border2, #1A1A1A); border-radius: 2px; }
        .settings-main::-webkit-scrollbar-track { background: transparent; }
        .sbi-danger:hover { background: var(--rs, rgba(226,75,74,.07)) !important; }
      `}</style>

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 46, background: "var(--bg)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 20px", gap: 10, flexShrink: 0 }}>
        <button
          onClick={() => router.push("/dashboard")}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text3)", cursor: "pointer", padding: "5px 8px", borderRadius: 6, border: "none", background: "none", fontFamily: "inherit", transition: "all .15s" }}
        >
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M8 2L3 6.5l5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Voltar
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 10px", borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
          <SuarikLogo size={18} showName />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>Perfil & Configurações</span>
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={toggleTheme}
            style={{ width: 28, height: 28, borderRadius: 6, background: "var(--bg3)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text3)", transition: "all .15s" }}
          >
            {isDark ? (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1 1M11.8 11.8l1 1M3.2 12.8l1-1M11.8 4.2l1-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M12 12.5A6.5 6.5 0 016.5 3a6.5 6.5 0 000 10A6.5 6.5 0 0012 12.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── APP GRID ───────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <div style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>
          {/* User block */}
          <div style={{ padding: "16px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,var(--o),var(--o2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {userInitial}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", letterSpacing: "-.01em" }}>{userName || "..."}</div>
              <div style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 8, background: "var(--as)", color: "var(--amber)", border: "1px solid rgba(245,166,35,.2)", marginTop: 2, display: "inline-block" }}>
                {planLabel}
              </div>
            </div>
          </div>

          {/* Nav items */}
          <div style={{ flex: 1, padding: 8 }}>
            {navItems.map(item => {
              const isActive = activeSection === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={item.danger ? "sbi-danger" : undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "7px 9px",
                    borderRadius: "var(--r)", cursor: "pointer", transition: "all .15s", marginBottom: 1,
                    color: item.danger ? "var(--red)" : isActive ? "var(--text)" : "var(--text3)",
                    background: isActive ? "var(--bg3)" : "transparent",
                    border: isActive ? "1px solid var(--border2)" : "1px solid transparent",
                  }}
                >
                  <div style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.icon}</div>
                  <span style={{ fontSize: 12, fontWeight: isActive ? 500 : "normal" }}>{item.label}</span>
                </div>
              );
            })}
          </div>

          {/* Sign out */}
          <div style={{ padding: "8px 8px 12px" }}>
            <div
              onClick={handleSignOut}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: "var(--r)", cursor: "pointer", color: "var(--text3)", border: "1px solid transparent", transition: "all .15s" }}
            >
              <div style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 7H3M6 4.5L3 7l3 2.5M11 2h1a1 1 0 011 1v8a1 1 0 01-1 1h-1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontSize: 12 }}>Sair da conta</span>
            </div>
          </div>
        </div>

        {/* ── MAIN ── */}
        <div className="settings-main" style={{ overflowY: "auto", background: "var(--bg2)" }}>
          <div style={{ padding: "28px 32px", maxWidth: 680 }}>

            {/* ── PERFIL ── */}
            {activeSection === "perfil" && (
              <>
                {secHd("Perfil", "Suas informações públicas e de conta")}

                <div style={card}>
                  <div style={cardHd}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Foto e nome</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>Aparece nos seus projetos e exportações</div>
                    </div>
                  </div>
                  <div style={{ padding: 16 }}>
                    {/* Avatar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,var(--o),var(--o2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff", flexShrink: 0, cursor: "pointer" }}>
                        {userInitial}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>
                          {[userName, userLastName].filter(Boolean).join(" ") || "..."}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>JPG, PNG ou WebP · máx 2MB</div>
                        <div style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", cursor: "pointer", marginTop: 6, display: "inline-block" }}>
                          Trocar foto
                        </div>
                      </div>
                    </div>

                    {/* Nome / Sobrenome */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 5 }}>Nome</label>
                        <input value={userName} onChange={e => setUserName(e.target.value)} style={fi} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 5 }}>Sobrenome</label>
                        <input value={userLastName} onChange={e => setUserLastName(e.target.value)} placeholder="Opcional" style={fi} />
                      </div>
                    </div>

                    {/* Email */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 5 }}>Email</label>
                      <input value={userEmail} disabled style={{ ...fi, opacity: .5, cursor: "not-allowed" }} />
                    </div>

                    {/* Nicho */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 5 }}>Nicho principal</label>
                      <select style={si} defaultValue="Direct Response">
                        {["Direct Response","Nutra / Saúde","Finanças","Emagrecimento","iGaming","Relacionamento","Cursos / Infoprodutos"].map(n => <option key={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <button onClick={handleSave} style={saveBtn(saved)}>
                    <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    {saved ? "Salvo!" : "Salvar alterações"}
                  </button>
                </div>
              </>
            )}

            {/* ── PLANO & COBRANÇA ── */}
            {activeSection === "plano" && (
              <>
                {secHd("Plano & Cobrança", "Seu plano atual, moedas e histórico de pagamentos")}

                {/* Plan mini */}
                <div style={{ background: "var(--as)", border: "1px solid rgba(245,166,35,.2)", borderRadius: "var(--r2)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245,166,35,.12)", border: "1px solid rgba(245,166,35,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M9 1L6.5 7H1l4.5 3.5L4 16l5-3.5L14 16l-1.5-5.5L17 7H11.5L9 1z" stroke="#F5A623" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Plano {planLabel}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>Renova mensalmente</div>
                  </div>
                  <button onClick={() => router.push("/pricing")} style={{ fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: "var(--r)", background: "var(--o)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all .2s", whiteSpace: "nowrap" }}>
                    Fazer upgrade →
                  </button>
                </div>

                {/* Coins meter */}
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r2)", padding: 16, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text2)" }}>Moedas disponíveis</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{credits.toLocaleString("pt-BR")} / {planTotal.toLocaleString("pt-BR")}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--bg4)", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ height: "100%", background: "linear-gradient(90deg,#F5A623,#FFAA00)", borderRadius: 3, width: `${creditsPct}%`, transition: "width .5s" }} />
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text4)" }}>Moedas não utilizadas expiram no próximo ciclo</div>
                </div>

                {/* Billing history */}
                <div style={card}>
                  <div style={cardHd}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Histórico de cobranças</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>Últimas transações</div>
                    </div>
                  </div>
                  <div style={{ padding: "8px 16px" }}>
                    {[
                      { date: "18 abr 2026", desc: `${planLabel} · mensal`,           val: "R$97"  },
                      { date: "18 mar 2026", desc: `${planLabel} · mensal`,           val: "R$97"  },
                      { date: "5 mar 2026",  desc: "Top-Up Escala · 15.000 moedas",  val: "R$117" },
                      { date: "18 fev 2026", desc: `${planLabel} · mensal`,           val: "R$97"  },
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                        <span style={{ fontSize: 11, color: "var(--text3)", width: 80, flexShrink: 0 }}>{item.date}</span>
                        <span style={{ fontSize: 12, color: "var(--text)", flex: 1 }}>{item.desc}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "var(--gs)", color: "var(--green)", border: "1px solid var(--gm)", flexShrink: 0 }}>Pago</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", width: 60, textAlign: "right", flexShrink: 0 }}>{item.val}</span>
                        <div style={{ width: 20, height: 20, borderRadius: 4, background: "var(--bg3)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text4)", flexShrink: 0 }}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 8V2M3.5 5.5L6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment method */}
                <div style={card}>
                  <div style={cardHd}><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Método de pagamento</div></div>
                  <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 40, height: 26, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--text3)" }}>VISA</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>•••• •••• •••• 4242</div>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>Expira 12/2027</div>
                    </div>
                    <button onClick={handlePortal} style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: "var(--r)", border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}>
                      Trocar cartão
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── PREFERÊNCIAS ── */}
            {activeSection === "preferencias" && (
              <>
                {secHd("Preferências", "Personalize sua experiência no app")}

                {/* Appearance */}
                <div style={card}>
                  <div style={cardHd}><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Aparência</div></div>
                  <div style={{ padding: "8px 16px" }}>
                    {[
                      { label: "Tema escuro",          sub: "Interface escura em todo o app",                       on: isDark,      onChange: toggleTheme },
                      { label: "Animações reduzidas",  sub: "Para melhor performance em máquinas mais lentas",      on: false,       onChange: () => {} },
                    ].map((row, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i === 0 ? "1px solid var(--border)" : "none" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{row.label}</div>
                          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{row.sub}</div>
                        </div>
                        <Toggle on={row.on} onChange={row.onChange} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notifications */}
                <div style={card}>
                  <div style={cardHd}><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Notificações</div></div>
                  <div style={{ padding: "8px 16px" }}>
                    {[
                      { label: "Render concluído",  sub: "Notificação por email quando um projeto termina",      on: notifRender, set: () => setNotifRender(v => !v) },
                      { label: "Moedas baixas",     sub: "Aviso quando restar menos de 20% do saldo",           on: notifCoins,  set: () => setNotifCoins(v => !v)  },
                      { label: "Novidades e updates", sub: "Emails sobre novas funcionalidades da Suarik",       on: notifNews,   set: () => setNotifNews(v => !v)   },
                      { label: "Dicas de uso",      sub: "Sugestões de como usar melhor o produto",             on: notifTips,   set: () => setNotifTips(v => !v)   },
                    ].map((row, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{row.label}</div>
                          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{row.sub}</div>
                        </div>
                        <Toggle on={row.on} onChange={row.set} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Generation defaults */}
                <div style={card}>
                  <div style={cardHd}><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Padrões de geração</div></div>
                  <div style={{ padding: 16, display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 5 }}>Idioma padrão · TTS</label>
                      <select style={si}>
                        <option>🇧🇷 Português · BR</option>
                        <option>🇺🇸 English · US</option>
                        <option>🇪🇸 Español</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 5 }}>Formato de export padrão</label>
                      <select style={si}>
                        <option>XML + SRT</option>
                        <option>SRT apenas</option>
                        <option>JSON</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <button
                    onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
                    style={saveBtn(saved)}
                  >
                    <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    {saved ? "Salvo!" : "Salvar preferências"}
                  </button>
                </div>
              </>
            )}

            {/* ── SEGURANÇA ── */}
            {activeSection === "seguranca" && (
              <>
                {secHd("Segurança", "Senha, autenticação e sessões ativas")}

                {/* Password */}
                <div style={{ ...card, marginBottom: 10 }}>
                  <div style={cardHd}><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Trocar senha</div></div>
                  <div style={{ padding: 16 }}>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 5 }}>Senha atual</label>
                      <input type="password" placeholder="••••••••" style={fi} />
                    </div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 5 }}>Nova senha</label>
                        <input type="password" placeholder="Mínimo 8 caracteres" style={fi} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 5 }}>Confirmar nova senha</label>
                        <input type="password" placeholder="Repita a nova senha" style={fi} />
                      </div>
                    </div>
                    <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "9px 18px", borderRadius: "var(--r)", background: "var(--o)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>
                      Atualizar senha
                    </button>
                  </div>
                </div>

                {/* 2FA */}
                <div style={{ ...card, marginBottom: 10, overflow: "visible" }}>
                  <div style={{ ...cardHd, borderBottom: "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Autenticação em dois fatores</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>Adiciona uma camada extra de segurança</div>
                    </div>
                    <Toggle on={false} onChange={() => {}} />
                  </div>
                </div>

                {/* Sessions */}
                <div style={card}>
                  <div style={cardHd}><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Sessões ativas</div></div>
                  <div style={{ padding: "8px 16px" }}>
                    {[
                      { device: "Chrome · macOS",    meta: "São Paulo · há 2 minutos",        current: true  },
                      { device: "Safari · iPhone",    meta: "São Paulo · há 3 dias",           current: false },
                      { device: "Firefox · Windows",  meta: "Rio de Janeiro · há 1 semana",   current: false },
                    ].map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--bg3)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--text3)" }}>
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="2" y="3" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.1"/><path d="M5 10v1M9 10v1M4 11h6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
                            {s.device}
                            {s.current && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: "var(--gs)", color: "var(--green)", marginLeft: 6 }}>Sessão atual</span>}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{s.meta}</div>
                        </div>
                        {!s.current && (
                          <button style={{ fontSize: 10, color: "var(--red)", cursor: "pointer", padding: "4px 8px", borderRadius: 5, border: "1px solid rgba(226,75,74,.2)", background: "none", fontFamily: "inherit", transition: "all .15s" }}>
                            Encerrar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── CONTA ── */}
            {activeSection === "conta" && (
              <>
                {secHd("Conta", "Gerencie ou encerre sua conta Suarik.")}
                {[
                  { title: "Cancelar assinatura",           desc: "Você mantém o acesso até o fim do período pago. As moedas não utilizadas expiram.",                   btn: "Cancelar assinatura",  severe: false, onClick: handlePortal },
                  { title: "Exportar meus dados",           desc: "Baixe todos os seus projetos, configurações e histórico em formato JSON.",                             btn: "Exportar dados",       severe: false, onClick: handleExportData },
                  { title: "Excluir conta permanentemente", desc: "Remove todos os seus dados, projetos e histórico. Esta ação não pode ser desfeita.",                   btn: "Excluir conta",        severe: true,  onClick: handleDeleteAccount },
                ].map((item, i) => (
                  <div key={i} style={{ background: "rgba(226,75,74,.07)", border: `1px solid rgba(226,75,74,${item.severe ? ".35" : ".2"})`, borderRadius: "var(--r2)", padding: 16, display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: item.severe ? "var(--red)" : "var(--text)" }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 3, lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                    <button onClick={item.onClick} style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: "var(--r)", border: `1px solid rgba(226,75,74,${item.severe ? ".4" : ".3"})`, background: item.severe ? "rgba(226,75,74,.08)" : "none", color: "var(--red)", cursor: "pointer", fontFamily: "inherit", transition: "all .2s", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {item.btn}
                    </button>
                  </div>
                ))}
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
