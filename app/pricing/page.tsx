"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Zap, Building2, Rocket, ChevronDown, ArrowLeft, Star } from "lucide-react";

// ─── Data ──────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "R$ 97",
    period: "/mês",
    description: "Perfeito para editores independentes que querem começar a escalar.",
    icon: Rocket,
    iconColor: "text-blue-400",
    iconBg: "rgba(37,99,235,0.12)",
    iconBorder: "rgba(59,130,246,0.2)",
    accentBorder: "rgba(59,130,246,0.15)",
    accentGlow: "rgba(37,99,235,0.08)",
    badgeText: null,
    ctaLabel: "Começar agora",
    ctaStyle: { background: "rgba(37,99,235,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd" },
    features: [
      "500 Créditos / mês",
      "Exportação XML para Premiere",
      "Marca d'água removida",
      "Pexels + Freesound integrado",
      "Suporte por e-mail",
    ],
  },
  {
    id: "pro",
    name: "PRO",
    price: "R$ 197",
    period: "/mês",
    description: "Para profissionais e agências que precisam de volume e qualidade máxima.",
    icon: Zap,
    iconColor: "text-amber-400",
    iconBg: "rgba(234,179,8,0.1)",
    iconBorder: "rgba(234,179,8,0.25)",
    accentBorder: "rgba(79,70,229,0.4)",
    accentGlow: "rgba(79,70,229,0.12)",
    badgeText: "Mais Escolhido",
    ctaLabel: "Assinar PRO",
    ctaStyle: { background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", boxShadow: "0 8px 32px rgba(79,70,229,0.4)" },
    features: [
      "2.000 Créditos / mês",
      "Acesso ao Cofre Kraft Premium",
      "Uploads de vídeo ilimitados",
      "Todos os nichos do Acervo",
      "Exportação em batch",
      "Suporte prioritário",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    price: "R$ 497",
    period: "/mês",
    description: "Para agências e produtoras com múltiplas equipes e clientes.",
    icon: Building2,
    iconColor: "text-emerald-400",
    iconBg: "rgba(16,185,129,0.1)",
    iconBorder: "rgba(16,185,129,0.2)",
    accentBorder: "rgba(16,185,129,0.15)",
    accentGlow: "rgba(16,185,129,0.06)",
    badgeText: null,
    ctaLabel: "Falar com vendas",
    ctaStyle: { background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#6ee7b7" },
    features: [
      "10.000 Créditos / mês",
      "Múltiplos usuários (até 10 seats)",
      "Workspace de equipe compartilhado",
      "Cofre B-Roll exclusivo Agency",
      "Relatórios de uso avançados",
      "Suporte VIP dedicado",
      "Onboarding personalizado",
    ],
  },
];

const FAQ = [
  {
    q: "O que são Créditos?",
    a: "Cada geração de timeline consome 1 crédito. Créditos não utilizados expiram no final do ciclo mensal.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. Não há fidelidade nem multa. Cancele quando quiser diretamente no painel da sua conta.",
  },
  {
    q: "O XML gerado é compatível com o Premiere Pro?",
    a: "Sim. Exportamos no formato FCP 7 XML (xmeml v4), que o Premiere Pro importa nativamente. Os clips abrem como 'Offline Media' para você fazer o Link Media.",
  },
  {
    q: "O que é o Cofre Kraft Premium?",
    a: "É nossa biblioteca exclusiva de B-rolls, trilhas sonoras e SFX curados para Direct Response, imobiliário, nutra e outros nichos. Disponível a partir do plano PRO.",
  },
  {
    q: "Posso fazer upgrade ou downgrade do plano?",
    a: "Sim, você pode alterar seu plano a qualquer momento. O novo valor é cobrado no próximo ciclo.",
  },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen font-sans" style={{ background: "#050505", color: "#e5e5e5" }}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-10 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <button onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <span className="text-xl font-black tracking-tighter text-white select-none" style={{ letterSpacing: "-0.04em" }}>
          Suarik
          <span className="ml-2 text-[10px] text-blue-500 font-semibold uppercase tracking-widest align-middle">PRO</span>
        </span>

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
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
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

                {/* "Mais Escolhido" badge */}
                {plan.badgeText && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                    style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", boxShadow: "0 4px 16px rgba(79,70,229,0.4)" }}>
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
                <p className="text-xs text-gray-600 leading-relaxed mb-6">{plan.description}</p>

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.iconColor}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button className="w-full py-3 rounded-xl text-sm font-black transition-all"
                  style={plan.ctaStyle}
                  onMouseEnter={e => { if (isPro) e.currentTarget.style.boxShadow = "0 12px 40px rgba(79,70,229,0.6)"; }}
                  onMouseLeave={e => { if (isPro) e.currentTarget.style.boxShadow = "0 8px 32px rgba(79,70,229,0.4)"; }}
                  onClick={() => router.push("/login")}
                >
                  {plan.ctaLabel}
                </button>
              </div>
            );
          })}
        </div>

        {/* Guarantee strip */}
        <p className="text-center text-xs text-gray-700 mt-8">
          ✓ Sem fidelidade &nbsp;·&nbsp; ✓ Cancele quando quiser &nbsp;·&nbsp; ✓ Pagamento seguro via Stripe
        </p>
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
