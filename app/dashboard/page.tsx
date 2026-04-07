"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast, ToastContainer } from "@/components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: string;
  credits: number;
  subscription_status: string;
}

const PLAN_CREDITS: Record<string, number> = {
  free: 100, starter: 500, pro: 2000, agency: 10000, premium: 50000,
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:    { label: "Gratuito",   color: "#94a3b8" },
  starter: { label: "Iniciante",  color: "#60a5fa" },
  pro:     { label: "PRO",        color: "#a78bfa" },
  agency:  { label: "Agência",    color: "#34d399" },
  premium: { label: "Premium",    color: "#F0563A" },
};

function getInitials(name: string | null, email: string) {
  if (name) return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return email[0].toUpperCase();
}

// ─── Tool card data ───────────────────────────────────────────────────────────
const TOOLS = [
  {
    id:      "storyboarder",
    route:   "/storyboard",
    label:   "Gerador de Storyboard",
    desc:    "Converta roteiros em B-Rolls sequenciados com pacing dinâmico e transições cinematográficas.",
    tag:     "Motor Narrativo",
    tagColor:"#F0563A",
    icon:    "✨",
    size:    "large",   // md:col-span-8
    gradient:"radial-gradient(ellipse at 30% 50%, rgba(240,86,58,0.25), transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(99,5,239,0.15), transparent 50%)",
    cta:     "Lançar Text-to-B-Roll →",
    ctaBg:   "linear-gradient(135deg,#F0563A,#c44527)",
    ctaColor:"#fff",
  },
  {
    id:      "audio",
    route:   "/audio",
    label:   "Estúdio de Áudio",
    desc:    "TTS de alta fidelidade com MiniMax. Vozes PT-BR e EN, emoções, velocidade e tom ajustáveis.",
    tag:     "Motor de Voz",
    tagColor:"#a78bfa",
    icon:    "🎙️",
    size:    "medium",  // md:col-span-4
    gradient:"radial-gradient(ellipse at 80% 20%, rgba(99,5,239,0.18), transparent 60%)",
    cta:     "Abrir Estúdio de Áudio",
    ctaBg:   "rgba(99,5,239,0.12)",
    ctaColor:"#a78bfa",
    ctaBorder:"rgba(99,5,239,0.3)",
  },
  {
    id:      "dreamface",
    route:   "/dreamface",
    label:   "Estúdio de LipSync",
    desc:    "Sincronize lábios de avatares com qualquer áudio. Porta-vozes virtuais com LipSync ultra-preciso.",
    tag:     "Motor de Avatar",
    tagColor:"#F0563A",
    icon:    "🎭",
    size:    "medium",  // md:col-span-4
    gradient:"radial-gradient(ellipse at 30% 60%, rgba(240,86,58,0.12), transparent 50%)",
    cta:     "Abrir LipSync",
    ctaBg:   "rgba(240,86,58,0.1)",
    ctaColor:"#F0563A",
    ctaBorder:"rgba(240,86,58,0.25)",
  },
  {
    id:      "voiceclone",
    route:   "/voiceclone",
    label:   "Clone de Voz",
    desc:    "Clone qualquer voz com apenas 10 segundos de áudio. Crie narrações com sua voz ou de qualquer pessoa.",
    tag:     "Laboratório de Clone",
    tagColor:"#34d399",
    icon:    "🧬",
    size:    "medium",  // md:col-span-4
    gradient:"radial-gradient(ellipse at 60% 30%, rgba(52,211,153,0.12), transparent 60%)",
    cta:     "Clonar Voz",
    ctaBg:   "rgba(52,211,153,0.08)",
    ctaColor:"#34d399",
    ctaBorder:"rgba(52,211,153,0.2)",
  },
  {
    id:      "dreamact",
    route:   "/dreamact",
    label:   "Animador de Avatar",
    desc:    "Anime qualquer foto com movimentos naturais. Crie avatares que acenam, falam, dançam.",
    tag:     "Laboratório de Movimento",
    tagColor:"#a78bfa",
    icon:    "🎭",
    size:    "medium",
    gradient:"radial-gradient(ellipse at 50% 20%, rgba(167,139,250,0.15), transparent 60%)",
    cta:     "Animar Avatar",
    ctaBg:   "rgba(167,139,250,0.1)",
    ctaColor:"#a78bfa",
    ctaBorder:"rgba(167,139,250,0.25)",
  },
  {
    id:      "enricher",
    route:   "/enricher",
    label:   "Enriquecedor",
    desc:    "Injete B-Rolls premium em filmagens existentes via análise semântica automática.",
    tag:     "Suíte de Sobreposição",
    tagColor:"#22d3ee",
    icon:    "🎬",
    size:    "medium",  // md:col-span-4
    gradient:"radial-gradient(ellipse at 70% 30%, rgba(0,218,243,0.1), transparent 60%)",
    cta:     "Upload MP4",
    ctaBg:   "rgba(255,255,255,0.04)",
    ctaColor:"rgba(255,255,255,0.7)",
    ctaBorder:"rgba(255,255,255,0.08)",
  },
  {
    id:      "projects",
    route:   "/projects",
    label:   "Meus Projetos",
    desc:    "Acesse e reabra todos os projetos gerados. Storyboards, áudios, lipsync e avatares em um só lugar.",
    tag:     "Biblioteca",
    tagColor:"#a78bfa",
    icon:    "📁",
    size:    "medium",  // md:col-span-4
    gradient:"radial-gradient(ellipse at 20% 70%, rgba(99,5,239,0.12), transparent 60%)",
    cta:     "Ver Projetos",
    ctaBg:   "rgba(99,5,239,0.1)",
    ctaColor:"#a78bfa",
    ctaBorder:"rgba(99,5,239,0.25)",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();
  const { toasts, remove: removeToast, toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Show success toast after Stripe checkout
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast.success("Plano ativado! Seus créditos foram adicionados. 🎉", 6000);
      // Clean URL without reload
      window.history.replaceState({}, "", "/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(prof as Profile ?? {
        id: user.id, email: user.email ?? "", full_name: null,
        avatar_url: null, plan: "free", credits: 100, subscription_status: "inactive",
      });
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#131313]">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-[#353534] border-t-[#F0563A] rounded-full animate-spin mx-auto" />
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/30">Iniciando Motor Neural...</p>
        </div>
      </div>
    );
  }

  const plan        = profile?.plan ?? "free";
  const credits     = profile?.credits ?? 0;
  const maxCredits  = PLAN_CREDITS[plan] ?? 10;
  const creditsPct  = Math.min((credits / maxCredits) * 100, 100);
  const planInfo    = PLAN_LABELS[plan] ?? PLAN_LABELS.free;
  const initials    = getInitials(profile?.full_name ?? null, profile?.email ?? "?");
  const displayName = profile?.full_name ?? profile?.email?.split("@")[0] ?? "Usuário";

  const large  = TOOLS.filter(t => t.size === "large");
  const medium = TOOLS.filter(t => t.size === "medium");

  return (
    <div className="min-h-screen bg-[#131313] text-[#E5E2E1] font-sans">

      {/* ═══ TOP NAV ══════════════════════════════════════════════════════════ */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16
                      bg-[#131313] border-b border-white/[0.04]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-sm"
              style={{ background: "#F0563A", boxShadow: "0 0 16px rgba(240,86,58,0.4)" }}>S</div>
            <span className="text-lg font-black text-white tracking-tighter">SUARIK</span>
          </div>
          <div className="hidden md:flex items-center gap-5">
            <button onClick={() => router.push("/projects")}
              className="text-sm text-white/50 hover:text-[#F0563A] transition-colors font-medium tracking-tight">
              Projetos
            </button>
            <button onClick={() => router.push("/audio")}
              className="text-sm text-white/50 hover:text-[#F0563A] transition-colors font-medium tracking-tight">
              Estúdio
            </button>
            <button onClick={() => router.push("/pricing")}
              className="text-sm text-white/50 hover:text-[#F0563A] transition-colors font-medium tracking-tight">
              Planos
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Credits bar */}
          <div className="hidden md:flex flex-col items-end mr-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[#F0563A] text-sm">🔥</span>
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Créditos</span>
            </div>
            <div className="w-28 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${creditsPct}%`, background: "linear-gradient(90deg,#F0563A,#ff7a4d)" }} />
            </div>
            <span className="text-[10px] font-mono mt-0.5" style={{ color: "#F0563A" }}>
              {credits.toLocaleString("pt-BR")} / {maxCredits.toLocaleString("pt-BR")}
            </span>
          </div>

          <button onClick={() => router.push("/storyboard")}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 text-white"
            style={{ background: "linear-gradient(135deg,#F0563A,#c44527)" }}>
            ⚡ Criar
          </button>

          <button onClick={handleSignOut}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white border border-white/10 hover:border-[#F0563A]/40 transition-all"
            style={{ background: "linear-gradient(135deg,#F0563A,#FF7A5C)" }}
            title={`${displayName} · Sair`}>
            {initials}
          </button>
        </div>
      </nav>

      {/* ═══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside className="fixed left-0 top-16 bottom-0 w-20 flex flex-col items-center py-5 z-40
                        bg-[#1C1B1B] border-r border-white/[0.04]">

        <div className="flex flex-col items-center gap-1 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg mb-1"
            style={{ background: "rgba(240,86,58,0.12)", border: "1px solid rgba(240,86,58,0.2)" }}>
            🧠
          </div>
          <span className="text-[9px] uppercase tracking-widest text-white/30 font-mono">Tools</span>
        </div>

        <div className="flex flex-col gap-1 w-full">
          {[
            { icon: "✨", label: "Script",    route: "/storyboard" },
            { icon: "🎙️", label: "Audio",    route: "/audio"      },
            { icon: "🎤", label: "LipSync",  route: "/dreamface"  },
            { icon: "🎭", label: "DreamAct", route: "/dreamact"   },
            { icon: "🧬", label: "Clone",    route: "/voiceclone" },
            { icon: "🎬", label: "Enricher",  route: "/enricher"   },
            { icon: "📁", label: "Projetos", route: "/projects"   },
          ].map(t => (
            <button key={t.route}
              onClick={() => router.push(t.route)}
              className="w-full flex flex-col items-center py-3 transition-all text-white/40
                         hover:text-[#F0563A] hover:bg-[rgba(240,86,58,0.06)]">
              <span className="text-xl mb-1">{t.icon}</span>
              <span className="text-[9px] uppercase tracking-widest font-mono">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto">
          <button onClick={() => router.push("/storyboard")}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"
            style={{ background: "linear-gradient(135deg,#F0563A,#ff7a4d)", boxShadow: "0 4px 20px rgba(240,86,58,0.35)" }}>
            +
          </button>
        </div>

        <div className="mt-4 px-2">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold text-white mx-auto mb-1"
              style={{ background: "linear-gradient(135deg,#F0563A,#FF7A5C)" }}>
              {initials}
            </div>
            <p className="text-[8px] font-mono uppercase tracking-widest" style={{ color: planInfo.color }}>
              {planInfo.label}
            </p>
          </div>
        </div>
      </aside>

      {/* ═══ MAIN ═════════════════════════════════════════════════════════════ */}
      <main className="ml-20 mt-16 p-8 min-h-screen">
        <div className="max-w-6xl mx-auto">

          <header className="mb-10">
            <h1 className="text-5xl font-black tracking-tighter text-white mb-2">
              Orquestrador de Narrativas
            </h1>
            <p className="text-lg text-white/40 max-w-xl">
              Selecione um motor editorial para acelerar sua produção.
            </p>
          </header>

          {/* ── Bento Grid ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pb-24">

            {/* LARGE card — Storyboarder */}
            {large.map(tool => (
              <section
                key={tool.id}
                onClick={() => router.push(tool.route)}
                className="md:col-span-8 group relative overflow-hidden rounded-xl cursor-pointer"
                style={{ background: "#1C1B1B", border: "1px solid rgba(92,64,55,0.15)", aspectRatio: "16/7" }}>
                <div className="absolute inset-0 z-0">
                  <div className="absolute inset-0 opacity-25 group-hover:opacity-40 transition-opacity duration-700"
                    style={{ background: tool.gradient }} />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #131313 0%, transparent 60%)" }} />
                  <div className="absolute inset-0 opacity-[0.04]"
                    style={{ backgroundImage: "linear-gradient(#F0563A 1px, transparent 1px), linear-gradient(90deg, #F0563A 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
                </div>
                <div className="relative z-10 p-8 h-full flex flex-col justify-end">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest font-mono"
                      style={{ background: `${tool.tagColor}22`, color: tool.tagColor }}>
                      {tool.tag}
                    </span>
                  </div>
                  <h2 className="text-4xl font-black tracking-tighter text-white mb-3">{tool.label}</h2>
                  <p className="text-white/50 text-sm max-w-md mb-6 leading-relaxed">{tool.desc}</p>
                  <button className="w-fit flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold text-white"
                    style={{ background: tool.ctaBg }}>
                    {tool.cta}
                  </button>
                </div>
              </section>
            ))}

            {/* MEDIUM cards row */}
            {medium.map(tool => (
              <section
                key={tool.id}
                onClick={() => router.push(tool.route)}
                className="md:col-span-4 group relative overflow-hidden rounded-xl h-64 cursor-pointer"
                style={{ background: "#1C1B1B", border: "1px solid rgba(92,64,55,0.15)" }}>
                <div className="absolute inset-0 z-0">
                  <div className="absolute inset-0 opacity-100 group-hover:opacity-150 transition-opacity duration-500"
                    style={{ background: tool.gradient }} />
                </div>
                <div className="relative z-10 p-7 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl"
                      style={{ background: `${tool.tagColor}18`, border: `1px solid ${tool.tagColor}30` }}>
                      {tool.icon}
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                      style={{ background: `${tool.tagColor}15`, color: tool.tagColor }}>
                      {tool.tag}
                    </span>
                  </div>
                  <div className="mt-auto">
                    <h3 className="text-xl font-black tracking-tighter mb-2"
                      style={{ color: tool.tagColor }}>{tool.label}</h3>
                    <p className="text-white/40 text-xs mb-4 leading-relaxed line-clamp-2">{tool.desc}</p>
                    <button
                      className="w-full py-2.5 rounded-lg text-xs font-bold transition-all"
                      style={{ background: tool.ctaBg, border: `1px solid ${tool.ctaBorder ?? tool.tagColor + "30"}`, color: tool.ctaColor }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                      {tool.cta}
                    </button>
                  </div>
                </div>
              </section>
            ))}

          </div>
        </div>
      </main>

      {/* ── Floating status panel ───────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl max-w-[220px] shadow-2xl"
        style={{ background: "rgba(42,42,42,0.85)", backdropFilter: "blur(20px)", border: "1px solid rgba(92,64,55,0.15)" }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg text-purple-300" style={{ background: "rgba(99,5,239,0.12)" }}>✨</div>
          <div>
            <h4 className="text-sm font-black text-white tracking-tight">Status do Sistema</h4>
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-mono">GPU Cluster: Ativo</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-white/40">Velocidade Média</span>
            <span className="text-cyan-400 font-mono">42 FPS</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-white/40">Agentes Ativos</span>
            <span className="text-white font-mono">8 / 12</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-white/40">Plano</span>
            <span className="font-mono font-bold" style={{ color: planInfo.color }}>{planInfo.label}</span>
          </div>
        </div>
        <button onClick={() => router.push("/pricing")}
          className="w-full mt-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all"
          style={{ background: "rgba(240,86,58,0.1)", border: "1px solid rgba(240,86,58,0.2)", color: "#F0563A" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,86,58,0.18)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(240,86,58,0.1)")}>
          ⚡ Upgrade
        </button>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
