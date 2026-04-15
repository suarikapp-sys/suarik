"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { trackEvent } from "@/components/PostHogProvider";
import { useTheme } from "@/components/ThemeProvider";
import { useCredits } from "@/hooks/useCredits";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string; name: string; role: string;
  price: string; priceAnnual: string | null; priceAnnualLabel: string | null;
  coins: string; renders: number;
  features: string[]; locked: string[];
  badge: string | null; variant: "current" | "hot" | "ent" | "default";
  ctaLabel: string; ctaVariant: "current-btn" | "upgrade" | "ghost" | "purple-btn";
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    id: "starter", name: "Starter", role: "Criadores Faceless",
    price: "R$97", priceAnnual: null, priceAnnualLabel: null,
    coins: "5.000", renders: 1,
    features: ["Storyboard DR", "B-Roll Studio", "Audio Studio · TTS", "Export SRT + XML"],
    locked: ["Avatares e LipSync"],
    badge: "Plano atual", variant: "current", ctaLabel: "Plano atual", ctaVariant: "current-btn",
  },
  {
    id: "pro", name: "Pro", role: "Editor DR",
    price: "R$197", priceAnnual: "R$157", priceAnnualLabel: "R$157/mês · cobrado anual",
    coins: "15.000", renders: 3,
    features: ["Tudo do Starter", "LipSync Studio", "DreamAct · Avatares", "Vault completo", "Biblioteca de anúncios"],
    locked: [],
    badge: "⭐ Popular", variant: "hot", ctaLabel: "Fazer upgrade → Pro", ctaVariant: "upgrade",
  },
  {
    id: "growth", name: "Growth", role: "Agências",
    price: "R$497", priceAnnual: "R$397", priceAnnualLabel: "R$397/mês · cobrado anual",
    coins: "45.000", renders: 5,
    features: ["Tudo do Pro", "Multi-contas", "Vault por nicho", "Suporte VIP"],
    locked: ["Fila VIP exclusiva"],
    badge: null, variant: "default", ctaLabel: "Upgrade → Growth", ctaVariant: "ghost",
  },
  {
    id: "enterprise", name: "Enterprise", role: "Fábricas de vídeo",
    price: "R$1.997", priceAnnual: "R$1.597", priceAnnualLabel: "R$1.597/mês · cobrado anual",
    coins: "250.000", renders: 10,
    features: ["Tudo do Growth", "Multi-contas ilimitadas", "Gerente dedicado", "SLA garantido", "Zero espera · Fila VIP"],
    locked: [],
    badge: "⚡ Fila VIP", variant: "ent", ctaLabel: "Falar com time →", ctaVariant: "purple-btn",
  },
];

const TOPUP_PACKAGES = [
  { key: "small",  name: "Salva-Vidas", coins: "5.000",  price: "R$47",  desc: "Para quando o saldo acaba no meio de uma campanha.",              highlight: false },
  { key: "medium", name: "Escala",      coins: "15.000", price: "R$117", desc: "O sweet spot para agências em escala ativa de anúncios.",         highlight: true  },
  { key: "large",  name: "Agência",     coins: "50.000", price: "R$347", desc: "Para grandes operações com múltiplos clientes ativos.",           highlight: false },
];

const FAQ = [
  { q: "As moedas expiram?",            a: "Sim. O saldo reseta todo mês no ciclo de faturamento. Moedas não utilizadas não acumulam para o próximo ciclo." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim. Sem multa, sem burocracia. Você mantém o acesso até o fim do período pago." },
  { q: "O que são renders simultâneos?", a: "Quantos projetos podem ser processados ao mesmo tempo. No Starter, um de cada vez." },
  { q: "O que é a Fila VIP?",           a: "No Enterprise, seus renders entram numa fila prioritária — processamento imediato, zero espera." },
];

const COMPARE_ROWS: Array<{ label: string; vals: string[]; type: "val" | "check" | "text" | "section" }> = [
  { label: "Moedas/mês",              vals: ["5.000", "15.000", "45.000", "250.000"],            type: "val"  },
  { label: "Renders simultâneos",     vals: ["1", "3", "5", "10"],                              type: "val"  },
  { label: "Fila de processamento",   vals: ["Padrão", "Padrão", "Padrão", "⚡ VIP"],           type: "text" },
  { label: "FERRAMENTAS",             vals: ["", "", "", ""],                                   type: "section" },
  { label: "Storyboard DR",           vals: ["✓", "✓", "✓", "✓"],                              type: "check" },
  { label: "Audio Studio · TTS",      vals: ["✓", "✓", "✓", "✓"],                              type: "check" },
  { label: "B-Roll Studio",           vals: ["✓", "✓", "✓", "✓"],                              type: "check" },
  { label: "Export SRT + XML",        vals: ["✓", "✓", "✓", "✓"],                              type: "check" },
  { label: "LipSync Studio",          vals: ["✗", "✓", "✓", "✓"],                              type: "check" },
  { label: "DreamAct · Avatares",     vals: ["✗", "✓", "✓", "✓"],                              type: "check" },
  { label: "Voice Clone",             vals: ["✗", "✓", "✓", "✓"],                              type: "check" },
  { label: "Vault completo",          vals: ["✗", "✓", "✓", "✓"],                              type: "check" },
  { label: "CONTA",                   vals: ["", "", "", ""],                                   type: "section" },
  { label: "Multi-contas",            vals: ["✗", "✗", "✓", "Ilimitadas"],                     type: "check" },
  { label: "Suporte",                 vals: ["Email", "Email", "VIP", "Gerente dedicado"],      type: "text"  },
  { label: "SLA garantido",           vals: ["✗", "✗", "✗", "✓"],                              type: "check" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SuarikLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}>
      <rect width="64" height="64" rx="8" style={{ fill: "#111111" }} />
      <rect x="12" y="10" width="40" height="11" rx="4" style={{ fill: "#E8E8E8" }} />
      <rect x="41" y="10" width="11" height="24" rx="4" style={{ fill: "#E8E8E8" }} />
      <rect x="12" y="43" width="40" height="11" rx="4" style={{ fill: "#E8512A" }} />
      <rect x="12" y="30" width="11" height="24" rx="4" style={{ fill: "#E8512A" }} />
    </svg>
  );
}

function RenderDots({ count, isEnt }: { count: number; isEnt: boolean }) {
  const dots = Math.min(count, 5);
  const color = isEnt ? "var(--purple)" : "var(--o)";
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: i < dots ? color : "var(--bg4)",
        }} />
      ))}
    </div>
  );
}

interface PlanCardProps {
  plan: Plan;
  annual: boolean;
  loadingPlan: string | null;
  onCheckout: (id: string) => void;
  isCurrentPlan: boolean;
}

function PlanCard({ plan, annual, loadingPlan, onCheckout, isCurrentPlan }: PlanCardProps) {
  const isCurrent = isCurrentPlan;
  const isHot     = plan.variant === "hot";
  const isEnt     = plan.variant === "ent";
  const isLoading = loadingPlan === plan.id;

  const cardBorder = isCurrent ? "rgba(245,166,35,.3)" : isHot ? "rgba(232,81,42,.25)" : isEnt ? "rgba(155,143,248,.2)" : "var(--border)";
  const cardGrad   = isCurrent ? "linear-gradient(170deg,rgba(245,166,35,.05) 0%,var(--card) 40%)"
                   : isHot     ? "linear-gradient(170deg,rgba(232,81,42,.07) 0%,var(--card) 40%)"
                   : isEnt     ? "linear-gradient(170deg,rgba(155,143,248,.05) 0%,var(--card) 40%)"
                   : "var(--card)";
  const shimmer    = isCurrent ? "linear-gradient(90deg,transparent,rgba(245,166,35,.4),transparent)"
                   : isHot     ? "linear-gradient(90deg,transparent,rgba(232,81,42,.5),transparent)"
                   : isEnt     ? "linear-gradient(90deg,transparent,rgba(155,143,248,.35),transparent)"
                   : "rgba(255,255,255,.05)";

  const coinBg     = isHot ? "rgba(232,81,42,.07)" : isEnt ? "rgba(155,143,248,.07)" : "rgba(255,255,255,.03)";
  const coinBorder = isHot ? "rgba(232,81,42,.15)" : isEnt ? "rgba(155,143,248,.12)" : "rgba(255,255,255,.05)";
  const coinColor  = isHot ? "var(--o)" : isEnt ? "var(--purple)" : "var(--text2)";

  const fIcoBg    = isEnt ? "rgba(155,143,248,.07)" : "rgba(232,81,42,.07)";
  const fIcoColor = isEnt ? "var(--purple)" : "var(--o)";

  const badgeBg     = isCurrent ? "rgba(245,166,35,.15)" : isHot ? "var(--o)" : "rgba(155,143,248,.07)";
  const badgeColor  = isCurrent ? "#F5A623" : isHot ? "#fff" : "var(--purple)";
  const badgeBorder = isCurrent ? "1px solid rgba(245,166,35,.25)" : isEnt ? "1px solid rgba(155,143,248,.2)" : "none";

  const displayPrice = annual && plan.priceAnnual ? plan.priceAnnual : plan.price;

  const ctaBase: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    width: "100%", padding: 10, borderRadius: "var(--r)", fontSize: 12, fontWeight: 700,
    fontFamily: "inherit", transition: "all .22s", letterSpacing: "-.01em",
    cursor: isCurrent ? "default" : "pointer",
  };
  const ctaStyle: React.CSSProperties =
    plan.ctaVariant === "upgrade"    ? { ...ctaBase, background: "var(--o)", color: "#fff", boxShadow: "0 4px 14px rgba(232,81,42,.2)", border: "none" }
    : plan.ctaVariant === "ghost"    ? { ...ctaBase, background: "transparent", color: "var(--text2)", border: "1px solid var(--border)" }
    : plan.ctaVariant === "purple-btn" ? { ...ctaBase, background: "rgba(155,143,248,.12)", color: "var(--purple)", border: "1px solid rgba(155,143,248,.2)" }
    : { ...ctaBase, background: "var(--bg3)", color: "var(--text3)", border: "1px solid var(--border)" };

  return (
    <div style={{ background: cardGrad, border: `1px solid ${cardBorder}`, borderRadius: "var(--r2)", padding: 20, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", transition: "all .22s" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: shimmer }} />

      {(isCurrent ? "Plano atual" : plan.badge) && (
        <div style={{ position: "absolute", top: 14, right: 14, fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 8, letterSpacing: ".07em", textTransform: "uppercase", background: badgeBg, color: badgeColor, border: badgeBorder }}>
          {isCurrent ? "Plano atual" : plan.badge}
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text2)", marginBottom: 6 }}>{plan.name}</div>
      <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 14 }}>{plan.role}</div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-.04em", color: "var(--text)", lineHeight: 1 }}>
          {displayPrice}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text3)", letterSpacing: 0 }}>/mês</span>
        </div>
        {annual && plan.priceAnnualLabel && (
          <div style={{ fontSize: 10, color: "var(--green)", fontWeight: 600, marginTop: 2 }}>{plan.priceAnnualLabel}</div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 11px", background: coinBg, border: `1px solid ${coinBorder}`, borderRadius: "var(--r)", marginBottom: 12 }}>
        <span style={{ fontSize: 14 }}>🪙</span>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.03em", color: coinColor }}>{plan.coins}</span>
        <span style={{ fontSize: 10, color: "var(--text3)", flex: 1, lineHeight: 1.3 }}>moedas<br/>por mês</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
        <RenderDots count={plan.renders} isEnt={isEnt} />
        <span style={{ fontSize: 10, color: "var(--text3)" }}>
          {plan.renders === 1 ? "1 render por vez" : `${plan.renders} renders simultâneos`}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6, marginLeft: "auto", letterSpacing: ".04em", background: isEnt ? "rgba(155,143,248,.07)" : "rgba(255,255,255,.05)", color: isEnt ? "var(--purple)" : "var(--text4)", border: isEnt ? "1px solid rgba(155,143,248,.2)" : "none" }}>
          {isEnt ? "⚡ VIP" : "Padrão"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16, flex: 1 }}>
        {plan.features.map(f => (
          <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: "var(--text2)", lineHeight: 1.45 }}>
            <div style={{ width: 13, height: 13, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, fontSize: 8, background: fIcoBg, color: fIcoColor }}>✓</div>
            {f}
          </div>
        ))}
        {plan.locked.map(f => (
          <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: "var(--text4)", lineHeight: 1.45 }}>
            <div style={{ width: 13, height: 13, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, fontSize: 8, background: "rgba(255,255,255,.04)", color: "var(--text4)" }}>✗</div>
            {f}
          </div>
        ))}
      </div>

      <button
        style={ctaStyle}
        disabled={loadingPlan !== null || isCurrent}
        onClick={() => !isCurrent && onCheckout(plan.id)}
      >
        {isLoading
          ? <><Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> Aguarde...</>
          : isCurrent ? "Plano atual" : plan.ctaLabel}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { credits: userCredits, plan: userPlan, loading: creditsLoading } = useCredits();
  const [annual, setAnnual]           = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);

  const isDark = theme === "dark";

  // ── Real plan/credits data ─────────────────────────────────────────────────
  const normalizedPlan = (userPlan ?? "free").toLowerCase();
  const currentPlan    = PLANS.find(p => p.id === normalizedPlan) ?? PLANS[0];
  const planCoinsLimit = Number(currentPlan.coins.replace(/\./g, "")) || 0;
  const coinsUsed      = Math.max(0, planCoinsLimit - (userCredits ?? 0));
  const coinsPct       = planCoinsLimit > 0
    ? Math.min(100, Math.round((coinsUsed / planCoinsLimit) * 1000) / 10)
    : 0;
  const fmtCoins = (n: number) => n.toLocaleString("pt-BR");

  const themeVars: Record<string, string> = isDark ? {
    "--bg": "#060606", "--bg2": "#09090B", "--bg3": "#0F0F0F", "--bg4": "#141414", "--bg5": "#1C1C1C",
    "--border": "#131313", "--border2": "#1A1A1A", "--border3": "#222",
    "--text": "#EAEAEA", "--text2": "#7A7A7A", "--text3": "#444", "--text4": "#252525",
    "--card": "#09090B", "--shadow": "rgba(0,0,0,.7)",
  } : {
    "--bg": "#F4F4F6", "--bg2": "#FAFAFA", "--bg3": "#EFEFEF", "--bg4": "#E6E6E8", "--bg5": "#DADADC",
    "--border": "#E2E2E4", "--border2": "#D6D6D8", "--border3": "#CACACE",
    "--text": "#0C0C0C", "--text2": "#606060", "--text3": "#999", "--text4": "#C8C8C8",
    "--card": "#FFFFFF", "--shadow": "rgba(0,0,0,.07)",
  };

  const colorVars: Record<string, string> = {
    "--o": "#E8512A", "--o2": "#FF6B3D", "--os": "rgba(232,81,42,.07)", "--om": "rgba(232,81,42,.16)",
    "--green": "#3ECF8E", "--gs": "rgba(62,207,142,.07)", "--gm": "rgba(62,207,142,.18)",
    "--blue": "#4A9EFF", "--bs": "rgba(74,158,255,.07)", "--bm": "rgba(74,158,255,.16)",
    "--purple": "#9B8FF8", "--ps": "rgba(155,143,248,.07)", "--pm": "rgba(155,143,248,.2)",
    "--amber": "#F5A623", "--as": "rgba(245,166,35,.1)",
    "--r": "8px", "--r2": "12px",
  };

  async function handleCheckout(planId: string) {
    trackEvent("plan_checkout_initiated", { plan: planId });
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json() as { url?: string };
      if (res.status === 401) { router.push("/login?next=/pricing"); return; }
      if (data.url) window.location.href = data.url;
    } finally { setLoadingPlan(null); }
  }

  async function handleTopup(pack: string) {
    trackEvent("topup_initiated", { pack });
    setLoadingPack(pack);
    try {
      const res = await fetch("/api/stripe/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally { setLoadingPack(null); }
  }

  async function handlePortal() {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch { /* ignore */ }
  }

  return (
    <div style={{
      ...themeVars, ...colorVars,
      fontFamily: "'Geist',system-ui,sans-serif",
      WebkitFontSmoothing: "antialiased",
      background: "var(--bg)",
      color: "var(--text)",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      fontSize: 14,
      overflow: "hidden",
    } as React.CSSProperties}>

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 46, background: "var(--bg)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 20px", gap: 10, flexShrink: 0, zIndex: 100 }}>
        <button
          onClick={() => router.push("/dashboard")}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text3)", cursor: "pointer", padding: "5px 8px", borderRadius: 6, transition: "all .15s", border: "none", background: "none", fontFamily: "inherit" }}
        >
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
            <path d="M8 2L3 6.5l5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Voltar
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 10px", borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
          <SuarikLogo size={18} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: "-.03em" }}>Suarik</span>
        </div>

        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>Planos</span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, color: "var(--text2)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F5A623", boxShadow: "0 0 6px #F5A623", flexShrink: 0 }} />
            <span>{currentPlan.name} · {creditsLoading ? "…" : fmtCoins(userCredits)} moedas</span>
          </div>
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

      {/* ── SCROLLABLE CONTENT ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px 48px" }}>

        {/* ── HEADER ── */}
        <div style={{ maxWidth: 960, margin: "0 auto 28px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--o)", marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 16, height: 1, background: "var(--o)", opacity: .5, display: "inline-block" }} />
              Planos
            </div>
            <h1 style={{ fontFamily: "'Instrument Serif',serif", fontSize: "clamp(28px,3vw,40px)", lineHeight: .95, letterSpacing: "-.02em", color: "var(--text)", fontWeight: 400 }}>
              Escolha sua<br/><em style={{ fontStyle: "italic", color: "var(--o)" }}>velocidade.</em>
            </h1>
            <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 8, fontWeight: 300, lineHeight: 1.6 }}>
              Moedas que não expiram. Use em qualquer ferramenta, sem desperdício.
            </p>
          </div>

          {/* Billing toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: annual ? "var(--text3)" : "var(--text)", cursor: "pointer", transition: "color .2s" }} onClick={() => setAnnual(false)}>
              Mensal
            </span>
            <div
              onClick={() => setAnnual(a => !a)}
              style={{ width: 38, height: 21, borderRadius: 11, background: annual ? "var(--o)" : "var(--bg4)", border: `1px solid ${annual ? "var(--o)" : "var(--border2)"}`, position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}
            >
              <div style={{ position: "absolute", width: 15, height: 15, borderRadius: "50%", background: "#fff", top: 2, left: annual ? 20 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: annual ? "var(--text)" : "var(--text3)", cursor: "pointer", transition: "color .2s" }} onClick={() => setAnnual(true)}>
              Anual
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "var(--gs)", color: "var(--green)", border: "1px solid var(--gm)", letterSpacing: ".04em", whiteSpace: "nowrap" }}>
              Economize 20%
            </span>
          </div>
        </div>

        {/* ── CURRENT PLAN BANNER ── */}
        <div style={{ maxWidth: 960, margin: "0 auto 20px", background: "var(--as)", border: "1px solid rgba(245,166,35,.2)", borderRadius: "var(--r2)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245,166,35,.12)", border: "1px solid rgba(245,166,35,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M9 1L6.5 7H1l4.5 3.5L4 16l5-3.5L14 16l-1.5-5.5L17 7H11.5L9 1z" stroke="#F5A623" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Plano atual: <strong>{currentPlan.name}</strong></div>
            <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>Renova mensalmente · {currentPlan.price}/mês</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: "#F5A623" }}>{creditsLoading ? "…" : fmtCoins(coinsUsed)}</span>
            <span style={{ color: "var(--text3)" }}>/ {fmtCoins(planCoinsLimit)} moedas usadas</span>
            <div style={{ width: 80, height: 4, background: "var(--bg4)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#F5A623", borderRadius: 2, width: `${coinsPct}%`, transition: "width .4s" }} />
            </div>
            <span style={{ fontSize: 10, color: "var(--text3)" }}>{Math.round(coinsPct)}%</span>
          </div>
          <button
            onClick={handlePortal}
            style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", cursor: "pointer", padding: "5px 10px", borderRadius: 5, border: "1px solid var(--border)", background: "none", fontFamily: "inherit", transition: "all .15s", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            Gerenciar cobrança →
          </button>
        </div>

        {/* ── PLANS GRID ── */}
        <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, alignItems: "start" }}>
          {PLANS.map(plan => (
            <PlanCard key={plan.id} plan={plan} annual={annual} loadingPlan={loadingPlan} onCheckout={handleCheckout} isCurrentPlan={plan.id === normalizedPlan} />
          ))}
        </div>

        {/* ── COMPARISON TABLE ── */}
        <div style={{ maxWidth: 960, margin: "28px auto 0" }}>
          <button
            onClick={() => setCompareOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 12, color: "var(--text3)", transition: "color .15s", border: "none", background: "none", fontFamily: "inherit", padding: 0, marginBottom: 16 }}
          >
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none" style={{ transition: "transform .2s", transform: compareOpen ? "rotate(180deg)" : "none" }}>
              <path d="M3 5.5l3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Ver comparação completa de funcionalidades
          </button>

          {compareOpen && (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r2)", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(4,1fr)", background: "var(--bg3)", borderBottom: "1px solid var(--border)" }}>
                {(["Funcionalidade", "Starter", "Pro", "Growth", "Enterprise"] as const).map((h, i) => (
                  <div key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, textAlign: i === 0 ? "left" : "center", color: i === 0 ? "var(--text3)" : i === 1 ? "#F5A623" : i === 2 ? "var(--o)" : i === 4 ? "var(--purple)" : "var(--text2)" }}>
                    {h}
                  </div>
                ))}
              </div>

              {COMPARE_ROWS.map((row, ri) => {
                if (row.type === "section") {
                  return (
                    <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr repeat(4,1fr)", background: "var(--bg3)", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ padding: "9px 12px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text4)" }}>{row.label}</div>
                      {[0,1,2,3].map(i => <div key={i} style={{ padding: "9px 12px" }} />)}
                    </div>
                  );
                }
                return (
                  <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr repeat(4,1fr)", borderBottom: ri < COMPARE_ROWS.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ padding: "9px 12px", fontSize: 11, color: "var(--text2)", display: "flex", alignItems: "center" }}>{row.label}</div>
                    {row.vals.map((v, vi) => {
                      const isVal  = row.type === "val";
                      const isYes  = v === "✓";
                      const isNo   = v === "✗";
                      const isEntC = vi === 3;
                      const color  = isVal
                        ? (isEntC ? "var(--purple)" : vi === 1 ? "var(--o)" : "var(--text)")
                        : isYes ? "var(--green)"
                        : isNo  ? "var(--text4)"
                        : isEntC && (v.includes("VIP") || v === "Ilimitadas" || v === "Gerente dedicado") ? "var(--purple)"
                        : v === "VIP" ? "var(--green)"
                        : "var(--text3)";
                      return (
                        <div key={vi} style={{ padding: "9px 12px", fontSize: 11, color, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: isVal || (isEntC && !isNo && !isYes) ? 600 : "normal" }}>
                          {v}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── GUARANTEE ── */}
        <div style={{ maxWidth: 960, margin: "20px auto 0", background: "rgba(62,207,142,.07)", border: "1px solid rgba(62,207,142,.18)", borderRadius: "var(--r2)", padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
            <path d="M10 2L3 6v5c0 4 3 7.5 7 8.5C14 18.5 17 15 17 11V6L10 2z" stroke="#3ECF8E" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M7 10l2 2 4-4" stroke="#3ECF8E" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>Garantia de 7 dias</div>
            <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
              Reembolso total nos primeiros 7 dias <strong>ou</strong> até o consumo de 1.500 moedas — o que ocorrer primeiro.
            </div>
          </div>
        </div>

        {/* ── TOP-UPS ── */}
        <div style={{ maxWidth: 960, margin: "20px auto 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--o)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 1, background: "var(--o)", display: "inline-block", opacity: .5 }} />
                Top-Ups
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Zerou as moedas? A operação não para.</div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>Compra avulsa · sem mensalidade adicional</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {TOPUP_PACKAGES.map(pkg => (
              <div key={pkg.key} style={{ background: pkg.highlight ? "linear-gradient(170deg,rgba(232,81,42,.05),var(--card) 40%)" : "var(--card)", border: `1px solid ${pkg.highlight ? "rgba(232,81,42,.2)" : "var(--border)"}`, borderRadius: "var(--r2)", padding: 18, transition: "all .2s", position: "relative" }}>
                {pkg.highlight && (
                  <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: "var(--o)", color: "#fff", letterSpacing: ".07em", whiteSpace: "nowrap" }}>
                    Sweet Spot
                  </div>
                )}
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: pkg.highlight ? "var(--o)" : "var(--text4)", marginBottom: 10 }}>
                  {pkg.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>🪙</span>
                  <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.03em", color: "var(--text)" }}>{pkg.coins}</span>
                  <span style={{ fontSize: 11, color: "var(--text3)" }}>moedas</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-.04em", color: "var(--text)", marginBottom: 12 }}>{pkg.price}</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 14 }}>{pkg.desc}</div>
                <button
                  onClick={() => handleTopup(pkg.key)}
                  disabled={loadingPack !== null}
                  style={{ width: "100%", padding: 9, background: pkg.highlight ? "var(--o)" : "var(--bg3)", border: pkg.highlight ? "none" : "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 12, fontWeight: 600, color: pkg.highlight ? "#fff" : "var(--text2)", cursor: loadingPack !== null ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all .2s", opacity: loadingPack && loadingPack !== pkg.key ? .5 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {loadingPack === pkg.key
                    ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
                    : "Comprar agora →"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <div style={{ maxWidth: 960, margin: "24px auto 0" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 10 }}>Dúvidas frequentes</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {FAQ.map((item, i) => (
              <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "12px 14px", cursor: "default", transition: "border-color .15s" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{item.q}</div>
                <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.55 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>

      </div>{/* end scrollable */}
    </div>
  );
}
