"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast, ToastContainer } from "@/components/Toast";
import { trackEvent } from "@/components/PostHogProvider";

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
  free: 100, starter: 5000, pro: 15000, growth: 45000, enterprise: 250000,
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:       { label: "Gratuito",    color: "#94a3b8" },
  starter:    { label: "Starter",     color: "#60a5fa" },
  pro:        { label: "Pro",         color: "#a78bfa" },
  growth:     { label: "Growth",      color: "#34d399" },
  enterprise: { label: "Enterprise",  color: "#E8512A" },
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
    tagColor:"#E8512A",
    icon:    "storyboard",
    size:    "large",
    cta:     "Lançar Text-to-B-Roll",
  },
  {
    id:      "audio",
    route:   "/audio",
    label:   "Estúdio de Áudio",
    desc:    "TTS de alta fidelidade com MiniMax. Vozes EN, ZH e JA. Emoções, velocidade e tom ajustáveis.",
    tag:     "Motor de Voz",
    tagColor:"#a78bfa",
    icon:    "audio",
    size:    "medium",
    cta:     "Abrir Estúdio",
  },
  {
    id:      "dreamface",
    route:   "/dreamface",
    label:   "Estúdio de LipSync",
    desc:    "Sincronize lábios de avatares com qualquer áudio. LipSync ultra-preciso.",
    tag:     "Motor de Avatar",
    tagColor:"#E8512A",
    icon:    "lipsync",
    size:    "medium",
    cta:     "Abrir LipSync",
  },
  {
    id:      "voiceclone",
    route:   "/voiceclone",
    label:   "Clone de Voz",
    desc:    "Clone qualquer voz com apenas 10 segundos de áudio.",
    tag:     "Laboratório de Clone",
    tagColor:"#34d399",
    icon:    "clone",
    size:    "medium",
    cta:     "Clonar Voz",
  },
  {
    id:      "dreamact",
    route:   "/dreamact",
    label:   "Animador de Avatar",
    desc:    "Anime qualquer foto com movimentos naturais.",
    tag:     "Laboratório de Movimento",
    tagColor:"#a78bfa",
    icon:    "dreamact",
    size:    "medium",
    cta:     "Animar Avatar",
  },
  {
    id:      "enricher",
    route:   "/enricher",
    label:   "Enriquecedor",
    desc:    "Injete B-Rolls premium em filmagens existentes via análise semântica.",
    tag:     "Suíte de Sobreposição",
    tagColor:"#22d3ee",
    icon:    "enricher",
    size:    "medium",
    cta:     "Upload MP4",
  },
  {
    id:      "projects",
    route:   "/projects",
    label:   "Meus Projetos",
    desc:    "Acesse e reabra todos os projetos gerados.",
    tag:     "Biblioteca",
    tagColor:"#a78bfa",
    icon:    "projects",
    size:    "medium",
    cta:     "Ver Projetos",
  },
];

// ─── SVG icons for tools ──────────────────────────────────────────────────────
function ToolIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const props = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className, style };
  switch (name) {
    case "storyboard":
      return (<svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v6M7 13h2M7 17h2M13 13h4M13 17h4" /></svg>);
    case "audio":
      return (<svg {...props}><path d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4" /></svg>);
    case "lipsync":
      return (<svg {...props}><circle cx="12" cy="12" r="9" /><path d="M8 14.5s1.5 2 4 2 4-2 4-2" /><circle cx="9" cy="9.5" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="9.5" r="1" fill="currentColor" stroke="none" /></svg>);
    case "clone":
      return (<svg {...props}><path d="M9 3v18M15 3v18M9 7h6M9 12h6M9 17h6" /><circle cx="9" cy="3" r="1.5" fill="currentColor" stroke="none" /><circle cx="15" cy="3" r="1.5" fill="currentColor" stroke="none" /><circle cx="9" cy="21" r="1.5" fill="currentColor" stroke="none" /><circle cx="15" cy="21" r="1.5" fill="currentColor" stroke="none" /></svg>);
    case "dreamact":
      return (<svg {...props}><circle cx="12" cy="5" r="2.5" /><path d="M12 8v5M9 20l3-7 3 7M7 12l-2 3M17 12l2 3" /></svg>);
    case "enricher":
      return (<svg {...props}><path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>);
    case "projects":
      return (<svg {...props}><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>);
    default:
      return (<svg {...props}><circle cx="12" cy="12" r="9" /></svg>);
  }
}

// ─── Streak computation ───────────────────────────────────────────────────────
function computeStreak(projects: RecentProject[]): number {
  if (projects.length === 0) return 0;
  const dates = [...new Set(
    projects.map(p => new Date(p.created_at).toLocaleDateString("pt-BR"))
  )].sort((a, b) => {
    const [da, ma, ya] = a.split("/").map(Number);
    const [db, mb, yb] = b.split("/").map(Number);
    return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
  });
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR");
  const today     = fmt(new Date());
  const yesterday = fmt(new Date(Date.now() - 86400000));
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const [dp, mp, yp] = dates[i - 1].split("/").map(Number);
    const [dc, mc, yc] = dates[i].split("/").map(Number);
    const prev = new Date(yp, mp - 1, dp).getTime();
    const curr = new Date(yc, mc - 1, dc).getTime();
    if (Math.round((prev - curr) / 86400000) === 1) streak++;
    else break;
  }
  return streak;
}

// ─── Recent project type ──────────────────────────────────────────────────────
interface RecentProject {
  id: string;
  tool: string;
  title: string;
  result_url: string | null;
  thumb_url:  string | null;
  created_at: string;
}

const TOOL_META: Record<string, { icon: string; route: string; color: string; label: string }> = {
  storyboarder: { icon: "storyboard", route: "/storyboard", color: "#E8512A", label: "Script" },
  storyboard:   { icon: "storyboard", route: "/storyboard", color: "#E8512A", label: "Script" },
  audio:        { icon: "audio",      route: "/audio",      color: "#a78bfa", label: "Áudio" },
  dreamface:    { icon: "lipsync",    route: "/dreamface",  color: "#E8512A", label: "LipSync" },
  voiceclone:   { icon: "clone",      route: "/voiceclone", color: "#34d399", label: "Clone" },
  dreamact:     { icon: "dreamact",   route: "/dreamact",   color: "#a78bfa", label: "DreamAct" },
  enricher:     { icon: "enricher",   route: "/enricher",   color: "#22d3ee", label: "Enricher" },
};

// ─── Quick Picks ──────────────────────────────────────────────────────────────
const QUICK_PICKS = [
  { label: "VSL Suplemento",  prompt: "Crie um VSL de 3 minutos para um suplemento natural de energia e foco. Tom persuasivo, ganchos emocionais, CTA forte no final." },
  { label: "Financeiro DR",   prompt: "Crie um vídeo estilo Direct Response para um curso de finanças pessoais. Abordagem problema-solução, prova social, urgência." },
  { label: "Emagrecimento",   prompt: "Crie um VSL de emagrecimento saudável. Comece com dor, mostre a jornada, apresente a solução e depoimentos." },
  { label: "Relacionamento",  prompt: "Crie um vídeo emocional sobre como melhorar relacionamentos. Tom empático, storytelling pessoal, oferta de curso." },
  { label: "Curso Online",    prompt: "Crie um vídeo promocional para lançamento de curso online. Autoridade, transformação, bônus e escassez." },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
function DashboardContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();
  const { toasts, remove: removeToast, toast } = useToast();

  const [profile,        setProfile]        = useState<Profile | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [allProjects,    setAllProjects]    = useState<RecentProject[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [heroText,       setHeroText]       = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast.success("Plano ativado! Seus créditos foram adicionados. 🎉", 6000);
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
      fetch("/api/projects")
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.projects) {
            setRecentProjects(d.projects.slice(0, 6));
            setAllProjects(d.projects);
            // Show onboarding for new users (0 projects + never seen)
            if (d.projects.length === 0) {
              const seen = typeof window !== "undefined" && localStorage.getItem("suarik_onboarding_seen");
              if (!seen) setShowOnboarding(true);
            }
          }
          setProjectsLoaded(true);
        })
        .catch(() => { setProjectsLoaded(true); });
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function handleGenerate() {
    if (!heroText.trim()) return;
    trackEvent("hero_generate", { textLength: heroText.length });
    sessionStorage.setItem("suarik_draft_script", heroText);
    router.push("/storyboard");
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#060606" }}>
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-[#131313] border-t-[#E8512A] rounded-full animate-spin mx-auto" />
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
  const firstName   = displayName.split(" ")[0];

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const large        = TOOLS.filter(t => t.size === "large");
  const medium       = TOOLS.filter(t => t.size === "medium");
  const streak       = computeStreak(allProjects);
  const totalCreated = allProjects.length;

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "Agora mesmo";
    if (h < 24) return `Há ${h}h`;
    const d = Math.floor(h / 24);
    return d === 1 ? "Ontem" : `Há ${d} dias`;
  }

  return (
    <div className="min-h-screen text-[#EAEAEA]" style={{ background: "#060606", fontFamily: "'Geist', system-ui, sans-serif" }}>

      {/* ═══ TOP NAV ══════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 flex justify-between items-center px-6 h-14" style={{ background: "rgba(6,6,6,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid #131313" }}>
        <div className="flex items-center gap-8">
          {/* Logo */}
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2.5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="1" y="1" width="9" height="9" rx="2" fill="#E8512A" />
              <rect x="14" y="14" width="9" height="9" rx="2" fill="#E8512A" />
              <rect x="14" y="1" width="9" height="9" rx="2" fill="#E8512A" opacity="0.3" />
              <rect x="1" y="14" width="9" height="9" rx="2" fill="#E8512A" opacity="0.3" />
            </svg>
            <span className="text-[15px] font-extrabold text-white tracking-tight">SUARIK</span>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {[
              { label: "Projetos", route: "/projects" },
              { label: "Estúdio", route: "/audio" },
              { label: "Planos",  route: "/pricing" },
            ].map(l => (
              <button key={l.route} onClick={() => router.push(l.route)}
                className="px-3 py-1.5 rounded-md text-[13px] text-white/40 hover:text-white hover:bg-white/[0.04] transition-all">
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Credits */}
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg" style={{ background: "#09090B", border: "1px solid #131313" }}>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: creditsPct < 20 ? "#E8512A" : "#34d399" }} />
              <span className="text-[11px] font-medium text-white/50">Créditos</span>
            </div>
            <div className="w-20 h-1 rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${creditsPct}%`, background: creditsPct < 20 ? "#E8512A" : "#34d399" }} />
            </div>
            <span className="text-[11px] font-mono font-medium" style={{ color: creditsPct < 20 ? "#E8512A" : "#EAEAEA" }}>
              {credits.toLocaleString("pt-BR")}
            </span>
          </div>

          {/* Plan badge */}
          <div className="hidden md:flex px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: `${planInfo.color}15`, color: planInfo.color, border: `1px solid ${planInfo.color}25` }}>
            {planInfo.label}
          </div>

          {/* Avatar */}
          <button onClick={handleSignOut}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white transition-all hover:ring-2 hover:ring-[#E8512A]/40"
            style={{ background: "linear-gradient(135deg,#E8512A,#c44020)" }}
            title={`${displayName} · Sair`}>
            {initials}
          </button>
        </div>
      </nav>

      {/* ═══ MAIN ═════════════════════════════════════════════════════════════ */}
      <main className="max-w-[960px] mx-auto px-6 pt-12 pb-24">

        {/* ── Greeting ────────────────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-[40px] font-extrabold tracking-tight text-white leading-[1.1]">
            {greeting}, {firstName}.
          </h1>
          {streak > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm">{streak >= 7 ? "🔥" : "✦"}</span>
              <span className="text-[13px] text-white/40">
                {streak} {streak === 1 ? "dia" : "dias"} em sequência
                {streak >= 7 && <span className="ml-1.5 text-[#E8512A] font-semibold text-[11px] uppercase">{streak >= 30 ? "Lendário" : streak >= 14 ? "Imparável" : "Em chamas"}</span>}
              </span>
            </div>
          )}
        </div>

        {/* ── Hero Input ──────────────────────────────────────────────── */}
        <section className="mb-6 rounded-xl p-[1px]" style={{ background: "linear-gradient(135deg, #131313, #1a1a1a)" }}>
          <div className="rounded-xl p-5" style={{ background: "#09090B" }}>
            <textarea
              ref={textareaRef}
              value={heroText}
              onChange={e => setHeroText(e.target.value)}
              placeholder="Cole seu roteiro, ou descreva o vídeo que quer criar..."
              rows={3}
              className="w-full bg-transparent text-[15px] text-white placeholder:text-white/20 resize-none focus:outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid #131313" }}>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: "Roteiro", icon: "📝" },
                  { label: "Importar MP4", icon: "📁", action: () => router.push("/enricher") },
                  { label: "3 min", icon: "⏱" },
                  { label: "Cinematic", icon: "🎬" },
                ].map(chip => (
                  <button key={chip.label} onClick={chip.action}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
                    style={{ border: "1px solid #1a1a1a" }}>
                    <span className="text-[11px]">{chip.icon}</span>
                    {chip.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleGenerate}
                disabled={!heroText.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
                style={{ background: heroText.trim() ? "#E8512A" : "#1a1a1a" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                Gerar Mapa
              </button>
            </div>
          </div>
        </section>

        {/* ── Quick Picks ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-12 flex-wrap">
          <span className="text-[11px] text-white/20 font-medium mr-1">Nichos:</span>
          {QUICK_PICKS.map(qp => (
            <button key={qp.label}
              onClick={() => { setHeroText(qp.prompt); textareaRef.current?.focus(); trackEvent("quick_pick", { niche: qp.label }); }}
              className="px-3 py-1.5 rounded-full text-[12px] text-white/35 hover:text-white/70 hover:bg-white/[0.04] transition-all"
              style={{ border: "1px solid #171717" }}>
              {qp.label}
            </button>
          ))}
        </div>

        {/* ── Stats row ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { label: "Projetos", value: totalCreated.toString(), color: "#EAEAEA" },
            { label: "Créditos", value: credits.toLocaleString("pt-BR"), color: creditsPct < 20 ? "#E8512A" : "#EAEAEA" },
            { label: "Ferramentas", value: "7", color: "#22d3ee" },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-5 py-4" style={{ background: "#09090B", border: "1px solid #131313" }}>
              <p className="text-[11px] uppercase tracking-wider text-white/25 font-medium mb-1">{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Tools: Featured ─────────────────────────────────────────── */}
        <section className="mb-5">
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-white/20 font-semibold mb-4">Ferramentas</h2>

          {large.map(tool => (
            <button key={tool.id} onClick={() => { trackEvent("tool_opened", { tool: tool.label, route: tool.route }); router.push(tool.route); }}
              className="group w-full text-left rounded-xl overflow-hidden relative transition-all hover:ring-1 hover:ring-[#E8512A]/30"
              style={{ background: "#09090B", border: "1px solid #131313" }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(232,81,42,0.08), transparent 70%)" }} />
              <div className="relative p-7 flex items-center gap-6">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(232,81,42,0.08)", border: "1px solid rgba(232,81,42,0.15)" }}>
                  <ToolIcon name={tool.icon} className="w-7 h-7 text-[#E8512A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-bold text-white tracking-tight">{tool.label}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                      style={{ background: `${tool.tagColor}12`, color: tool.tagColor }}>
                      {tool.tag}
                    </span>
                  </div>
                  <p className="text-[13px] text-white/35 leading-relaxed">{tool.desc}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all group-hover:opacity-90"
                  style={{ background: "#E8512A" }}>
                  {tool.cta}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </div>
              </div>
            </button>
          ))}
        </section>

        {/* ── Tools: Grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-14">
          {medium.map(tool => (
            <button key={tool.id}
              onClick={() => { trackEvent("tool_opened", { tool: tool.label, route: tool.route }); router.push(tool.route); }}
              className="group text-left rounded-xl p-5 transition-all hover:ring-1"
              style={{ background: "#09090B", border: "1px solid #131313" }}
              onMouseEnter={e => e.currentTarget.style.setProperty("--tw-ring-color", `${tool.tagColor}40`)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${tool.tagColor}10`, border: `1px solid ${tool.tagColor}20` }}>
                  <ToolIcon name={tool.icon} className="w-5 h-5" style={{ color: tool.tagColor } as React.CSSProperties} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ color: `${tool.tagColor}`, background: `${tool.tagColor}10` }}>
                  {tool.tag}
                </span>
              </div>
              <h3 className="text-[15px] font-bold text-white tracking-tight mb-1">{tool.label}</h3>
              <p className="text-[12px] text-white/30 leading-relaxed mb-4 line-clamp-2">{tool.desc}</p>
              <div className="flex items-center gap-1.5 text-[12px] font-medium transition-colors group-hover:text-white/70"
                style={{ color: `${tool.tagColor}` }}>
                {tool.cta}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
        </div>

        {/* ── Empty State (0 projects) ────────────────────────────────── */}
        {allProjects.length === 0 && projectsLoaded && (
          <section className="mb-14">
            <h2 className="text-[11px] uppercase tracking-[0.15em] text-white/20 font-semibold mb-4">Comece aqui</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: "📝", title: "Cole um roteiro", desc: "Transforme qualquer texto em um vídeo com B-Rolls cinematográficos.", route: "/storyboard", color: "#E8512A" },
                { icon: "📁", title: "Suba um vídeo", desc: "Injete B-Rolls premium em filmagens existentes automaticamente.", route: "/enricher", color: "#22d3ee" },
                { icon: "✨", title: "Use um template", desc: "Escolha um nicho acima e comece com um roteiro pronto.", route: null, color: "#a78bfa" },
              ].map(card => (
                <button key={card.title}
                  onClick={() => {
                    if (card.route) router.push(card.route);
                    else textareaRef.current?.focus();
                  }}
                  className="group text-left rounded-xl p-6 transition-all hover:ring-1"
                  style={{ background: "#09090B", border: "1px solid #131313" }}
                  onMouseEnter={e => e.currentTarget.style.setProperty("--tw-ring-color", `${card.color}40`)}
                >
                  <span className="text-2xl mb-3 block">{card.icon}</span>
                  <h3 className="text-[15px] font-bold text-white mb-1">{card.title}</h3>
                  <p className="text-[12px] text-white/30 leading-relaxed">{card.desc}</p>
                </button>
              ))}
            </div>
            <div className="text-center mt-6">
              <button onClick={() => router.push("/storyboard")}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "#E8512A" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Criar meu primeiro projeto
              </button>
            </div>
          </section>
        )}

        {/* ── Recent Projects ─────────────────────────────────────────── */}
        {recentProjects.length > 0 && (
          <section className="mb-14">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[11px] uppercase tracking-[0.15em] text-white/20 font-semibold">Projetos recentes</h2>
              <button onClick={() => router.push("/projects")}
                className="text-[12px] font-medium text-white/30 hover:text-[#E8512A] transition-colors">
                Ver todos →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentProjects.map(p => {
                const meta = TOOL_META[p.tool] ?? { icon: "projects", route: "/projects", color: "#a78bfa", label: "Projeto" };
                const hasResult = !!p.result_url;
                return (
                  <button key={p.id} onClick={() => router.push(meta.route)}
                    className="group text-left rounded-xl overflow-hidden transition-all hover:ring-1"
                    style={{ background: "#09090B", border: "1px solid #131313" }}
                    onMouseEnter={e => e.currentTarget.style.setProperty("--tw-ring-color", `${meta.color}40`)}
                  >
                    {/* Thumbnail area */}
                    <div className="h-28 flex items-center justify-center relative"
                      style={{ background: "#0c0c0e", borderBottom: "1px solid #131313" }}>
                      {p.thumb_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumb_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ToolIcon name={meta.icon} className="w-8 h-8 text-white/10" />
                      )}
                      {/* Status badge */}
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium"
                        style={{ background: "rgba(6,6,6,0.8)", backdropFilter: "blur(8px)" }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: hasResult ? "#34d399" : "#eab308" }} />
                        <span style={{ color: hasResult ? "#34d399" : "#eab308" }}>
                          {hasResult ? "Concluído" : "Em progresso"}
                        </span>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ToolIcon name={meta.icon} className="w-3.5 h-3.5" style={{ color: meta.color } as React.CSSProperties} />
                        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
                      </div>
                      <p className="text-[13px] font-medium text-white leading-snug line-clamp-2 mb-2">
                        {p.title.replace(/^[^—]+—\s*/, "")}
                      </p>
                      <p className="text-[11px] text-white/20 font-mono">{timeAgo(p.created_at)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Credits low warning ─────────────────────────────────────── */}
        {creditsPct < 20 && plan === "free" && (
          <section className="rounded-xl p-5 flex items-center justify-between" style={{ background: "#09090B", border: "1px solid rgba(232,81,42,0.15)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(232,81,42,0.08)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8512A" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">Créditos acabando</p>
                <p className="text-[12px] text-white/30">Faça upgrade para continuar criando sem limites.</p>
              </div>
            </div>
            <button onClick={() => router.push("/pricing")}
              className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white hover:opacity-90 transition-all shrink-0"
              style={{ background: "#E8512A" }}>
              Ver planos
            </button>
          </section>
        )}

      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── ONBOARDING MODAL ── */}
      {showOnboarding && (
        <div style={{
          position:"fixed",inset:0,zIndex:9999,
          background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:24,
        }}>
          <div style={{
            maxWidth:520,width:"100%",borderRadius:24,overflow:"hidden",
            background:"#111",border:"1px solid rgba(255,255,255,0.08)",
            boxShadow:"0 32px 80px rgba(0,0,0,0.8)",
          }}>
            {/* Header */}
            <div style={{
              padding:"32px 32px 24px",
              background:"linear-gradient(135deg,rgba(240,86,58,0.12),rgba(99,5,239,0.08))",
              borderBottom:"1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <div style={{width:40,height:40,borderRadius:10,background:"#F0563A",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"#fff",fontSize:18}}>S</div>
                <div>
                  <p style={{fontSize:11,color:"#F0563A",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,margin:0}}>Bem-vindo ao</p>
                  <p style={{fontSize:22,fontWeight:900,color:"#fff",margin:0,letterSpacing:-0.5}}>SUARIK</p>
                </div>
              </div>
              <p style={{fontSize:14,color:"rgba(255,255,255,0.6)",margin:0,lineHeight:1.6}}>
                Motor de IA que transforma sua copy em B-rolls, legendas e timeline em segundos.
              </p>
            </div>

            {/* Steps */}
            <div style={{padding:"24px 32px"}}>
              <p style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:1.5,margin:"0 0 16px",fontWeight:700}}>Como funciona</p>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {[
                  { icon:"✍️", step:"1", title:"Cole sua copy ou VSL", desc:"Cole o script, narração ou vídeo de vendas" },
                  { icon:"🤖", step:"2", title:"IA gera o storyboard", desc:"GPT-4o cria cenas, B-rolls e músicas automaticamente" },
                  { icon:"🎬", step:"3", title:"Exporte para seu editor", desc:"Premiere Pro, DaVinci Resolve, CapCut — pronto" },
                ].map(s => (
                  <div key={s.step} style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    <div style={{width:32,height:32,borderRadius:8,background:"rgba(240,86,58,0.12)",border:"1px solid rgba(240,86,58,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                      {s.icon}
                    </div>
                    <div>
                      <p style={{fontSize:13,fontWeight:700,color:"#fff",margin:"0 0 2px"}}>{s.title}</p>
                      <p style={{fontSize:12,color:"#555",margin:0}}>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div style={{padding:"0 32px 28px",display:"flex",gap:10}}>
              <button
                onClick={() => {
                  localStorage.setItem("suarik_onboarding_seen", "1");
                  setShowOnboarding(false);
                  router.push("/storyboard");
                }}
                style={{
                  flex:1,padding:"13px 0",borderRadius:12,border:"none",cursor:"pointer",
                  background:"linear-gradient(135deg,#F0563A,#c44527)",
                  color:"#fff",fontSize:14,fontWeight:800,letterSpacing:-0.3,
                  boxShadow:"0 8px 24px rgba(240,86,58,0.35)",
                }}
              >
                🚀 Criar primeiro storyboard
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("suarik_onboarding_seen", "1");
                  setShowOnboarding(false);
                }}
                style={{
                  padding:"13px 20px",borderRadius:12,background:"transparent",
                  border:"1px solid rgba(255,255,255,0.08)",color:"#555",
                  fontSize:13,fontWeight:600,cursor:"pointer",
                }}
              >
                Explorar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#060606" }}>
        <div className="w-8 h-8 border-2 border-[#131313] border-t-[#E8512A] rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
