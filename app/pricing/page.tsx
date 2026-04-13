"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Zap, Building2, Rocket, ChevronDown, ArrowLeft, Star, Loader2 } from "lucide-react";
import { trackEvent } from "@/components/PostHogProvider";

// ─── Data ──────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "R$ 97",
    period: "/mês",
    description: "Para criadores Faceless que querem montar sua linha de produção de VSLs.",
    icon: Rocket,
    iconColor: "text-blue-400",
    iconBg: "rgba(37,99,235,0.12)",
    iconBorder: "rgba(59,130,246,0.2)",
    accentBorder: "rgba(59,130,246,0.15)",
    accentGlow: "rgba(37,99,235,0.08)",
    badgeText: null,
    queue: "1 render · Fila Padrão",
    ctaLabel: "Começar agora",
    ctaStyle: { background: "rgba(37,99,235,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd" },
    features: [
      "5.000 Moedas / mês",
      "Geração de storyboard",
      "Enriquecimento de vídeo",
      "Voz neural (TTS)",
      "Exportar SRT + XML (DaVinci)",
      "B-rolls via Pexels + Pixabay",
    ],
    locked: [
      "Avatares e LipSync",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 197",
    period: "/mês",
    description: "Para editores de VSL diários. Volume, qualidade e Avatar integrado.",
    icon: Zap,
    iconColor: "text-amber-400",
    iconBg: "rgba(234,179,8,0.1)",
    iconBorder: "rgba(234,179,8,0.25)",
    accentBorder: "rgba(79,70,229,0.4)",
    accentGlow: "rgba(79,70,229,0.12)",
    badgeText: "Mais Escolhido",
    queue: "3 renders simultâneos · Fila Padrão",
    ctaLabel: "Assinar Pro",
    ctaStyle: { background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", boxShadow: "0 8px 32px rgba(79,70,229,0.4)" },
    features: [
      "15.000 Moedas / mês",
      "Avatares + LipSync desbloqueados",
      "Acervo vault completo",
      "Biblioteca de anúncios vencedores",
      "Exportar SRT + XML (DaVinci)",
      "Suporte prioritário",
    ],
    locked: [] as string[],
  },
  {
    id: "growth",
    name: "Growth",
    price: "R$ 497",
    period: "/mês",
    description: "Para operações de escala com múltiplas campanhas rodando em paralelo.",
    icon: Building2,
    iconColor: "text-emerald-400",
    iconBg: "rgba(16,185,129,0.1)",
    iconBorder: "rgba(16,185,129,0.2)",
    accentBorder: "rgba(16,185,129,0.15)",
    accentGlow: "rgba(16,185,129,0.06)",
    badgeText: null,
    queue: "5 renders simultâneos · Fila Padrão",
    ctaLabel: "Assinar Growth",
    ctaStyle: { background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#6ee7b7" },
    features: [
      "45.000 Moedas / mês",
      "Tudo do Pro",
      "Multi-contas",
      "Acervo vault exclusivo por nicho",
      "Suporte VIP dedicado",
    ],
    locked: [
      "Fila VIP exclusiva",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "R$ 1.997",
    period: "/mês",
    description: "Para grandes agências com escala agressiva e zero tolerância a espera.",
    icon: Star,
    iconColor: "text-yellow-400",
    iconBg: "rgba(234,179,8,0.1)",
    iconBorder: "rgba(234,179,8,0.2)",
    accentBorder: "rgba(255,215,0,0.25)",
    accentGlow: "rgba(255,215,0,0.08)",
    badgeText: "Grandes Agências",
    queue: "10 renders simultâneos · Fila VIP Exclusiva",
    ctaLabel: "Falar com vendas",
    ctaStyle: { background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.25)", color: "#fde047" },
    features: [
      "250.000 Moedas / mês",
      "Fila VIP — zero tempo de espera",
      "Tudo do Growth",
      "Multi-contas ilimitadas",
      "Gerente de conta dedicado",
      "SLA garantido",
      "Onboarding personalizado",
    ],
    locked: [] as string[],
  },
];

const FAQ = [
  {
    q: "O que são Moedas?",
    a: "Moedas são a unidade de consumo do Copiloto. Cada ação — gerar uma timeline, sintetizar uma voz, renderizar um avatar — consome uma quantidade proporcional ao custo de API. Ações de alta margem (B-rolls, voz neural) consomem poucas moedas. Ações premium (avatar, lip-sync) consomem mais.",
  },
  {
    q: "As moedas acumulam de um mês para o outro?",
    a: "Não. As moedas seguem a regra 'Use it or Lose it': o saldo reseta no início de cada ciclo de faturamento. Isso nos permite manter os preços baixos e garantir capacidade de servidor para todos os usuários.",
  },
  {
    q: "Qual é a garantia?",
    a: "Oferecemos garantia de 7 dias ou até o consumo de 1.500 moedas (o que ocorrer primeiro). Isso permite que você teste o produto de verdade sem risco.",
  },
  {
    q: "O XML gerado é compatível com o Premiere Pro?",
    a: "Sim. Exportamos no formato FCP 7 XML (xmeml v4), que o Premiere Pro importa nativamente. Os clips abrem como 'Offline Media' para você fazer o Link Media.",
  },
  {
    q: "Posso fazer upgrade ou downgrade do plano?",
    a: "Sim, a qualquer momento. O novo valor é calculado proporcionalmente (pro-rata) no próximo ciclo.",
  },
  {
    q: "O que são os Top-Ups?",
    a: "Quando sua operação zera o saldo antes do próximo ciclo, você pode comprar moedas avulsas com um clique — sem precisar esperar o reset mensal. Os créditos são somados ao saldo atual imediatamente.",
  },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

const TOPUP_PACKAGES: { key: string; name: string; label: string; price: string; perCr: string; highlight?: boolean }[] = [
  { key: "small",  name: "Salva-Vidas",    label: "5.000 moedas",  price: "R$ 47",  perCr: "R$ 0,0094/moeda" },
  { key: "medium", name: "Escala",         label: "15.000 moedas", price: "R$ 117", perCr: "R$ 0,0078/moeda", highlight: true },
  { key: "large",  name: "Agência",        label: "50.000 moedas", price: "R$ 347", perCr: "R$ 0,0069/moeda" },
];

export default function PricingPage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);

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
    } finally {
      setLoadingPack(null);
    }
  }

  async function handleCheckout(planId: string) {
    trackEvent("plan_checkout_initiated", { plan: planId });
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.push("/login?next=/pricing");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: "#050505", color: "#e5e5e5" }}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-10 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <button onClick={() => router.push("/dashboard")}
          className="text-xl font-black tracking-tighter text-white hover:opacity-80 transition-opacity" style={{ letterSpacing: "-0.04em", background: "transparent", border: "none", cursor: "pointer" }}>
          Suarik
          <span className="ml-2 text-[10px] text-blue-500 font-semibold uppercase tracking-widest align-middle">PRO</span>
        </button>

        <button onClick={() => router.push("/login")}
          className="text-sm text-gray-500 hover:text-gray-200 transition-colors">
          Entrar
        </button>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <div className="text-center px-6 pt-16 pb-12 relative">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(79,70,229,0.12) 0%, transparent 70%)" }} />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold mb-6 border"
            style={{ background: "rgba(79,70,229,0.1)", borderColor: "rgba(79,70,229,0.25)", color: "#a5b4fc" }}>
            <Star className="w-3 h-3 fill-current" />
            Mais de 1.200 editores já escalaram com a Suarik
          </div>

          <h1 className="text-4xl font-black text-white mb-4" style={{ letterSpacing: "-0.04em" }}>
            Escale sua edição.<br />
            <span style={{ background: "linear-gradient(90deg,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Corte seus custos.
            </span>
          </h1>

          <p className="text-base text-gray-500 max-w-lg mx-auto leading-relaxed">
            Escolha o plano ideal para o seu volume de projetos. Sem contratos. Sem surpresas.
          </p>
        </div>
      </div>

      {/* ── PLANS ───────────────────────────────────────────────────────────── */}
      <div className="px-6 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(plan => {
            const Icon = plan.icon;
            const isPro = plan.id === "pro";
            return (
              <div key={plan.id} className="relative flex flex-col rounded-2xl p-6 transition-all duration-300"
                style={{
                  background: isPro ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${plan.accentBorder}`,
                  boxShadow: isPro ? `0 0 40px ${plan.accentGlow}` : `0 0 20px ${plan.accentGlow}`,
                }}>

                {/* Badge */}
                {plan.badgeText && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                    style={{ background: isPro ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "rgba(255,215,0,0.15)", color: isPro ? "#fff" : "#fde047", border: isPro ? "none" : "1px solid rgba(255,215,0,0.3)", boxShadow: isPro ? "0 4px 16px rgba(79,70,229,0.4)" : "none" }}>
                    <Star className="w-2.5 h-2.5 fill-current" />
                    {plan.badgeText}
                  </div>
                )}

                {/* Icon */}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: plan.iconBg, border: `1px solid ${plan.iconBorder}` }}>
                  <Icon className={`w-5 h-5 ${plan.iconColor}`} />
                </div>

                {/* Name & Price */}
                <h2 className="text-lg font-black text-white mb-1" style={{ letterSpacing: "-0.02em" }}>{plan.name}</h2>
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-3xl font-black text-white" style={{ letterSpacing: "-0.03em" }}>{plan.price}</span>
                  <span className="text-sm text-gray-600 mb-1">{plan.period}</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">{plan.description}</p>

                {/* Queue pill */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg mb-5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Zap className={`w-3 h-3 shrink-0 ${plan.iconColor}`} />
                  <span className="text-[10px] text-gray-500">{plan.queue}</span>
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1 mb-4">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-gray-400">
                      <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${plan.iconColor}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Locked features */}
                {plan.locked.length > 0 && (
                  <ul className="space-y-1.5 mb-5 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    {plan.locked.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="mt-0.5 shrink-0">✕</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}

                {/* CTA */}
                <button className="w-full py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 disabled:opacity-60 mt-auto"
                  style={plan.ctaStyle}
                  onMouseEnter={e => { if (isPro) e.currentTarget.style.boxShadow = "0 12px 40px rgba(79,70,229,0.6)"; }}
                  onMouseLeave={e => { if (isPro) e.currentTarget.style.boxShadow = "0 8px 32px rgba(79,70,229,0.4)"; }}
                  disabled={loadingPlan !== null}
                  onClick={() => handleCheckout(plan.id)}
                >
                  {loadingPlan === plan.id
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Aguarde...</>
                    : plan.ctaLabel}
                </button>
              </div>
            );
          })}
        </div>

        {/* Guarantee strip */}
        <p className="text-center text-xs text-gray-700 mt-8">
          ✓ Garantia de 7 dias ou 1.500 moedas &nbsp;·&nbsp; ✓ Moedas não acumulam entre ciclos &nbsp;·&nbsp; ✓ Pagamento seguro via Stripe
        </p>
      </div>

      {/* ── CREDIT TOP-UP ───────────────────────────────────────────────────── */}
      <div className="border-t px-6 py-16" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl font-black text-white mb-2" style={{ letterSpacing: "-0.03em" }}>
            ⚡ Recarregar créditos
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Compra única, sem assinatura. Os créditos são somados ao seu saldo atual.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {TOPUP_PACKAGES.map(pkg => (
              <button
                key={pkg.key}
                onClick={() => handleTopup(pkg.key)}
                disabled={loadingPack !== null}
                style={{
                  padding: "20px 12px", borderRadius: 12, cursor: "pointer",
                  border: pkg.highlight ? "1px solid #F0563A66" : "1px solid rgba(255,255,255,0.08)",
                  background: pkg.highlight ? "#F0563A12" : "rgba(255,255,255,0.03)",
                  opacity: loadingPack && loadingPack !== pkg.key ? 0.5 : 1,
                  transition: "all 0.2s",
                }}
              >
                {loadingPack === pkg.key ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                ) : (
                  <>
                    <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: pkg.highlight ? "#F0563A" : "#555" }}>
                      {pkg.name}
                    </div>
                    <div className="text-lg font-black" style={{ color: pkg.highlight ? "#F0563A" : "#e5e7eb" }}>
                      {pkg.label}
                    </div>
                    <div className="text-2xl font-black text-white mt-1">{pkg.price}</div>
                    <div className="text-xs mt-1" style={{ color: "#555" }}>{pkg.perCr}</div>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <div className="border-t px-6 py-16" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-black text-white text-center mb-10" style={{ letterSpacing: "-0.03em" }}>
            Perguntas Frequentes
          </h2>

          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="rounded-xl overflow-hidden transition-all"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-gray-300 hover:text-white transition-colors"
                >
                  {item.q}
                  <ChevronDown className={`w-4 h-4 text-gray-600 shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <p className="pt-3">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="border-t px-10 py-8 flex items-center justify-between text-xs text-gray-700"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <span className="font-black text-gray-600" style={{ letterSpacing: "-0.03em" }}>Suarik</span>
        <span>© 2025 Kraft Mídia · Todos os direitos reservados</span>
        <div className="flex gap-4">
          <button className="hover:text-gray-400 transition-colors">Termos</button>
          <button className="hover:text-gray-400 transition-colors">Privacidade</button>
        </div>
      </footer>

    </div>
  );
}
