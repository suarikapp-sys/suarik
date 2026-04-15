"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast, ToastContainer } from "@/components/Toast";
import { trackEvent } from "@/components/PostHogProvider";
import { useTheme } from "@/components/ThemeProvider";

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
  audio:        { icon: "audio",      route: "/audio",      color: "#3ECF8E", label: "Áudio" },
  dreamface:    { icon: "lipsync",    route: "/dreamface",  color: "#E8512A", label: "LipSync" },
  voiceclone:   { icon: "clone",      route: "/voiceclone", color: "#F5A623", label: "Clone" },
  dreamact:     { icon: "dreamact",   route: "/dreamact",   color: "#8B7FE8", label: "DreamAct" },
  enricher:     { icon: "enricher",   route: "/enricher",   color: "#4A9EFF", label: "Enricher" },
};

// ─── Quick Picks ──────────────────────────────────────────────────────────────
const QUICK_PICKS = [
  { label: "VSL Suplemento",  prompt: "Crie um VSL de 3 minutos para um suplemento natural de energia e foco. Tom persuasivo, ganchos emocionais, CTA forte no final." },
  { label: "Financeiro DR",   prompt: "Crie um vídeo estilo Direct Response para um curso de finanças pessoais. Abordagem problema-solução, prova social, urgência." },
  { label: "Emagrecimento",   prompt: "Crie um VSL de emagrecimento saudável. Comece com dor, mostre a jornada, apresente a solução e depoimentos." },
  { label: "Relacionamento",  prompt: "Crie um vídeo emocional sobre como melhorar relacionamentos. Tom empático, storytelling pessoal, oferta de curso." },
  { label: "Curso Online",    prompt: "Crie um vídeo promocional para lançamento de curso online. Autoridade, transformação, bônus e escassez." },
];

// ─── Navigation screens (page dots) ──────────────────────────────────────────
const NAV_SCREENS = [
  { id: "dashboard",  route: "/dashboard",  label: "Dashboard" },
  { id: "projects",   route: "/projects",   label: "Projetos" },
  { id: "storyboard", route: "/storyboard", label: "Storyboard" },
  { id: "audio",      route: "/audio",      label: "Audio Studio" },
  { id: "enricher",   route: "/enricher",   label: "B-Roll Studio" },
  { id: "dreamface",  route: "/dreamface",  label: "LipSync Studio" },
  { id: "dreamact",   route: "/dreamact",   label: "DreamAct" },
  { id: "voiceclone", route: "/voiceclone", label: "Voice Clone" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
function DashboardContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();
  const { toasts, remove: removeToast, toast } = useToast();

  const [profile,        setProfile]        = useState<Profile | null>(null);
  const [authName,       setAuthName]       = useState<string | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [allProjects,    setAllProjects]    = useState<RecentProject[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [heroText,       setHeroText]       = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sideExpanded,   setSideExpanded]   = useState(false);

  const { theme, toggleTheme } = useTheme();

  const dark = {
    bg:    '#060606', bg2: '#0A0A0A', bg3: '#0F0F0F', bg4: '#141414', bg5: '#1C1C1C',
    bd:    '1px solid #141414', bd2: '1px solid #1C1C1C', bd3: '1px solid #242424',
    bdRaw: '#141414', bd2Raw: '#1C1C1C',
    text:  '#EBEBEB', text2: '#888', text3: '#555', text4: '#333',
    card:  '#0A0A0A', card2: '#0F0F0F',
    shadow: 'rgba(0,0,0,.5)',
  };
  const light = {
    bg:    '#F5F5F7', bg2: '#FFFFFF', bg3: '#F0F0F2', bg4: '#E8E8EA', bg5: '#DCDCE0',
    bd:    '1px solid #E0E0E4', bd2: '1px solid #D4D4D8', bd3: '1px solid #C8C8CC',
    bdRaw: '#E0E0E4', bd2Raw: '#D4D4D8',
    text:  '#0A0A0A', text2: '#555', text3: '#888', text4: '#AAAAAA',
    card:  '#FFFFFF', card2: '#F8F8FA',
    shadow: 'rgba(0,0,0,.08)',
  };
  const T = theme === 'dark' ? dark : light;

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
      const metaName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name     as string | undefined) ??
        null;
      if (metaName) setAuthName(metaName);
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

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => textareaRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [loading]);

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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#060606" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: "2px solid #131313", borderTopColor: "#E8512A", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)" }}>Iniciando Motor Neural...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const plan        = profile?.plan ?? "free";
  const credits     = profile?.credits ?? 0;
  const maxCredits  = PLAN_CREDITS[plan] ?? 10;
  const creditsPct  = Math.min((credits / maxCredits) * 100, 100);
  const initials    = getInitials(profile?.full_name ?? authName ?? null, profile?.email ?? "?");
  const displayName = profile?.full_name ?? authName ?? profile?.email?.split("@")[0] ?? "Usuário";
  const firstName   = displayName.split(" ")[0];

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const streak = computeStreak(allProjects);

  const dateStr     = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const dateDisplay = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "Agora mesmo";
    if (h < 24) return `Há ${h}h`;
    const d = Math.floor(h / 24);
    return d === 1 ? "Ontem" : `Há ${d} dias`;
  }

  const thumbGradients = [
    "linear-gradient(135deg, #0A1420, #060810)",
    "linear-gradient(135deg, #0A1808, #060A04)",
    "linear-gradient(135deg, #140A20, #080410)",
  ];

  // ── Sidebar nav items ──────────────────────────────────────────────────────
  const sideItems = [
    { route: "/storyboard", label: "Storyboard",    color: "#E8512A", icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="#E8512A" strokeWidth="1.1"/><path d="M4 6h8M4 9h5M4 12h6" stroke="#E8512A" strokeWidth="1" strokeLinecap="round"/></svg> },
    { route: "/audio",      label: "Audio Studio",  color: "#3ECF8E", icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="2" width="6" height="8" rx="3" stroke="#3ECF8E" strokeWidth="1.2"/><path d="M3 9.5c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke="#3ECF8E" strokeWidth="1.2" strokeLinecap="round"/></svg> },
    { route: "/enricher",   label: "B-Roll Studio", color: "#4A9EFF", icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="10" height="10" rx="2" stroke="#4A9EFF" strokeWidth="1.1"/><path d="M11 6l4-2v8l-4-2V6z" stroke="#4A9EFF" strokeWidth="1.1" strokeLinejoin="round"/></svg> },
    { route: "/dreamface",  label: "LipSync",       color: "#E8512A", icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#E8512A" strokeWidth="1.2"/><path d="M5.5 8.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5" stroke="#E8512A" strokeWidth="1.1" strokeLinecap="round"/><circle cx="6" cy="6.5" r=".7" fill="#E8512A"/><circle cx="10" cy="6.5" r=".7" fill="#E8512A"/></svg> },
    { route: "/dreamact",   label: "DreamAct",      color: "#9B8FF8", icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="4" y="1" width="8" height="14" rx="4" stroke="#9B8FF8" strokeWidth="1.2"/><circle cx="6.5" cy="6" r=".7" fill="#9B8FF8"/><circle cx="9.5" cy="6" r=".7" fill="#9B8FF8"/><path d="M6.5 9.5c0 .8.6 1.5 1.5 1.5s1.5-.7 1.5-1.5" stroke="#9B8FF8" strokeWidth="1" strokeLinecap="round"/></svg> },
    { route: "/voiceclone", label: "Voice Clone",   color: "#4A9EFF", icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="1" width="6" height="9" rx="3" stroke="#4A9EFF" strokeWidth="1.2"/><path d="M3 10c0 3 2.2 5.5 5 5.5s5-2.5 5-5.5" stroke="#4A9EFF" strokeWidth="1.2" strokeLinecap="round"/></svg> },
  ];

  const snItemStyle = (active = false): React.CSSProperties => ({
    width: "calc(100% - 8px)",
    height: 36,
    borderRadius: 7,
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    background: active ? T.bg3 : "transparent",
    border: `1px solid ${active ? T.bd2Raw : "transparent"}`,
    padding: "0 9px",
    gap: 9,
    flexShrink: 0,
    position: "relative",
    transition: "background 0.15s",
  });

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "'Geist', system-ui, sans-serif", background: T.bg, color: T.text, transition: "background 0.2s, color 0.2s" }}>

      {/* ═══ TOPBAR ═══════════════════════════════════════════════════════════ */}
      <div style={{ height: 38, flexShrink: 0, display: "flex", alignItems: "center", background: T.bg, borderBottom: T.bd, zIndex: 100, padding: "0 12px", gap: 8 }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <span
            style={{ color: T.text4, cursor: "pointer", transition: "color 0.15s" }}
            onClick={() => router.push("/dashboard")}
          >Suarik</span>
          <span style={{ color: T.text4, fontSize: 10 }}>›</span>
          <span style={{ fontWeight: 600, color: T.text2 }}>Dashboard</span>
        </div>

        {/* Back / forward */}
        <div style={{ display: "flex", gap: 3, marginLeft: 8 }}>
          <button
            onClick={() => router.back()}
            title="Voltar"
            style={{ width: 24, height: 24, borderRadius: 5, background: T.bg3, border: T.bd, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text4 }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M7 2L3 6l4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          </button>
          <button
            onClick={() => router.forward()}
            title="Avançar"
            style={{ width: 24, height: 24, borderRadius: 5, background: T.bg3, border: T.bd, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text4 }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Center: page dots */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          {NAV_SCREENS.map((s, i) => (
            <div
              key={s.id}
              onClick={() => router.push(s.route)}
              title={s.label}
              style={{
                width: i === 0 ? 16 : 5,
                height: 5,
                borderRadius: i === 0 ? 3 : "50%",
                background: i === 0 ? "#E8512A" : T.bg5,
                cursor: "pointer",
                transition: "all 0.2s",
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        {/* Right: credits + theme + criar + avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>

          {/* Credits */}
          <div style={{ background: T.bg3, border: T.bd, borderRadius: 6, padding: "4px 10px", display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#E8512A" stroke="none">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{credits.toLocaleString()}</span>
            <div style={{ width: 36, height: 2, background: T.bg5, borderRadius: 1 }}>
              <div style={{ height: "100%", width: `${creditsPct}%`, background: "linear-gradient(90deg,#E8512A,#FF6534)", borderRadius: 1 }} />
            </div>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            style={{ width: 24, height: 24, borderRadius: 5, background: T.bg3, border: T.bd, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text4 }}
          >
            {theme === 'dark' ? (
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1 1M11.8 11.8l1 1M3.2 12.8l1-1M11.8 4.2l1-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M13.5 10A6 6 0 016 2.5a6 6 0 100 11 6 6 0 007.5-3.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            )}
          </button>

          {/* Criar */}
          <button
            onClick={() => router.push("/storyboard")}
            style={{ background: "#E8512A", color: "#fff", borderRadius: 6, height: 26, padding: "0 12px", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Criar
          </button>

          {/* Avatar */}
          <button
            onClick={handleSignOut}
            title={`${displayName} · Sair`}
            style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#E8512A,#FF6534)", fontSize: 10, fontWeight: 700, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            {initials}
          </button>
        </div>
      </div>

      {/* ═══ APP BODY ══════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <div style={{
          width: sideExpanded ? 192 : 52,
          flexShrink: 0,
          height: "100%",
          borderRight: T.bd,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "10px 0",
          gap: 2,
          background: T.bg,
          transition: "width 0.25s cubic-bezier(.16,1,.3,1)",
          overflow: "hidden",
          zIndex: 200,
        }}>

          {/* Logo — click to toggle */}
          <div
            onClick={() => setSideExpanded(p => !p)}
            title={sideExpanded ? undefined : "Expandir menu"}
            style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", marginBottom: 6, transition: "background 0.2s" }}
          >
            <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
              <rect width="64" height="64" rx="10" fill="#111"/>
              <rect x="12" y="10" width="40" height="11" rx="4" fill="#E8E8E8"/>
              <rect x="41" y="10" width="11" height="24" rx="4" fill="#E8E8E8"/>
              <rect x="12" y="43" width="40" height="11" rx="4" fill="#E8512A"/>
              <rect x="12" y="30" width="11" height="24" rx="4" fill="#E8512A"/>
            </svg>
          </div>

          {/* Dashboard (active) */}
          <div
            onClick={() => router.push("/dashboard")}
            title={sideExpanded ? undefined : "Dashboard"}
            style={snItemStyle(true)}
          >
            <div style={{ width: 18, height: 18, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" rx="1" stroke={T.text} strokeWidth="1.1"/>
                <rect x="9" y="2" width="5" height="5" rx="1" stroke={T.text} strokeWidth="1.1"/>
                <rect x="2" y="9" width="5" height="5" rx="1" stroke={T.text} strokeWidth="1.1"/>
                <rect x="9" y="9" width="5" height="5" rx="1" stroke={T.text} strokeWidth="1.1"/>
              </svg>
            </div>
            {sideExpanded && <span style={{ fontSize: 12, fontWeight: 500, color: T.text, whiteSpace: "nowrap", flex: 1 }}>Dashboard</span>}
            {sideExpanded && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8512A", flexShrink: 0 }} />}
          </div>

          {/* Projetos */}
          <div
            onClick={() => router.push("/projects")}
            title={sideExpanded ? undefined : "Projetos"}
            style={snItemStyle(false)}
          >
            <div style={{ width: 18, height: 18, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke={T.text3} strokeWidth="1.1"/>
                <path d="M5 6h6M5 9h4" stroke={T.text3} strokeWidth="1" strokeLinecap="round"/>
              </svg>
            </div>
            {sideExpanded && <span style={{ fontSize: 12, fontWeight: 500, color: T.text3, whiteSpace: "nowrap", flex: 1 }}>Projetos</span>}
            {sideExpanded && allProjects.length > 0 && (
              <span style={{ fontSize: 9, background: T.bg4, color: T.text3, padding: "1px 5px", borderRadius: 8, flexShrink: 0 }}>{allProjects.length}</span>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: "calc(100% - 16px)", height: 1, background: T.bdRaw, margin: "4px 0", flexShrink: 0 }} />

          {/* Section label */}
          {sideExpanded && (
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.text4, padding: "0 10px", height: 16, display: "flex", alignItems: "center", width: "100%", flexShrink: 0 }}>
              Ferramentas
            </div>
          )}

          {/* Tool items */}
          {sideItems.map(item => (
            <div
              key={item.route}
              onClick={() => router.push(item.route)}
              title={sideExpanded ? undefined : item.label}
              style={snItemStyle(false)}
            >
              <div style={{ width: 18, height: 18, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {item.icon}
              </div>
              {sideExpanded && <span style={{ fontSize: 12, fontWeight: 500, color: T.text2, whiteSpace: "nowrap", flex: 1 }}>{item.label}</span>}
              {sideExpanded && <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, opacity: 0.6, flexShrink: 0 }} />}
            </div>
          ))}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Bottom toggle */}
          <div
            onClick={() => setSideExpanded(p => !p)}
            title={sideExpanded ? undefined : "Expandir"}
            style={{ width: "calc(100% - 8px)", height: 28, borderRadius: 7, display: "flex", alignItems: "center", cursor: "pointer", padding: "0 9px", gap: 9, flexShrink: 0, color: T.text4, transition: "color 0.15s" }}
          >
            <div style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                {sideExpanded
                  ? <path d="M9 2L4.5 6.5 9 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  : <path d="M4 2l4.5 4.5L4 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                }
              </svg>
            </div>
            {sideExpanded && <span style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden" }}>Recolher</span>}
          </div>
        </div>

        {/* ── MAIN ────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", background: T.bg }}>
          <div style={{ padding: "36px 36px 60px", maxWidth: 1080, margin: "0 auto" }}>

            {/* Greeting */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, color: T.text4, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>{dateDisplay}</p>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", color: T.text, lineHeight: 1.1, margin: 0 }}>
                {greeting}, <em style={{ color: "#E8512A", fontStyle: "normal" }}>{firstName}.</em>
              </h1>
              {streak > 0 && (
                <p style={{ fontSize: 12, color: T.text3, marginTop: 6 }}>
                  {streak} {streak === 1 ? "dia" : "dias"} em sequência
                </p>
              )}
            </div>

            {/* Hero input */}
            <div style={{ marginBottom: 10, background: T.card, border: T.bd, borderRadius: 16, overflow: "hidden" }}
              onFocus={() => {}}
            >
              <textarea
                ref={textareaRef}
                value={heroText}
                onChange={e => setHeroText(e.target.value)}
                placeholder="Cole seu roteiro, ou descreva o vídeo que quer criar..."
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  color: T.text, fontFamily: "'Geist', system-ui, sans-serif", fontSize: 14,
                  fontWeight: 300, padding: "18px 18px 0", resize: "none", minHeight: 76,
                  lineHeight: 1.65, boxSizing: "border-box",
                }}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
              />
              <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 7, borderTop: T.bd }}>
                {/* Chips */}
                <button style={{ display: "flex", alignItems: "center", gap: 5, background: T.bg3, border: T.bd, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: T.text3, cursor: "pointer" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Roteiro
                </button>
                <button
                  onClick={() => router.push("/enricher")}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: T.bg3, border: T.bd, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: T.text3, cursor: "pointer" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
                  Importar MP4
                </button>
                <div style={{ width: 1, height: 14, background: T.bg4 }} />
                <button style={{ display: "flex", alignItems: "center", gap: 5, background: T.bg3, border: T.bd, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: T.text3, cursor: "pointer" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  15–30s
                </button>
                <button style={{ display: "flex", alignItems: "center", gap: 5, background: T.bg3, border: T.bd, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: T.text3, cursor: "pointer" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  Direct Response
                </button>

                {/* Send button */}
                <button
                  onClick={handleGenerate}
                  disabled={!heroText.trim()}
                  style={{
                    marginLeft: "auto", background: heroText.trim() ? "#E8512A" : T.bg4,
                    color: heroText.trim() ? "#fff" : T.text4, borderRadius: 7, padding: "7px 14px",
                    fontSize: 12, fontWeight: 600, border: "none", cursor: heroText.trim() ? "pointer" : "default",
                    display: "flex", alignItems: "center", gap: 5, transition: "background 0.15s",
                  }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  Gerar Mapa
                </button>
              </div>
            </div>

            {/* Quick picks */}
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 36 }}>
              {QUICK_PICKS.map(qp => (
                <button
                  key={qp.label}
                  onClick={() => { setHeroText(qp.prompt); textareaRef.current?.focus(); trackEvent("quick_pick", { niche: qp.label }); }}
                  style={{ fontSize: 12, color: T.text3, padding: "5px 12px", background: T.card, border: T.bd, borderRadius: 20, cursor: "pointer" }}>
                  {qp.label}
                </button>
              ))}
            </div>

            {/* ── Tools Level 1: Featured Storyboard ─────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: T.text2 }}>Ferramentas</span>
              <button onClick={() => router.push("/storyboard")} style={{ fontSize: 12, color: T.text3, background: "none", border: "none", cursor: "pointer" }}>Ver todas →</button>
            </div>

            {/* Big storyboard card */}
            <div
              onClick={() => router.push("/storyboard")}
              style={{ background: T.card, border: T.bd, borderRadius: 12, padding: 20, display: "flex", gap: 20, marginBottom: 6, overflow: "hidden", position: "relative", cursor: "pointer" }}>

              {/* Left */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(232,81,42,.08)", color: "#E8512A", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 10 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#E8512A" stroke="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                    Motor Principal
                  </span>
                  <span style={{ fontSize: 10, color: T.text4 }}>Direct Response</span>
                </div>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(232,81,42,.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8512A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v6M7 13h2M7 17h2M13 13h4M13 17h4"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: T.text, margin: "0 0 6px" }}>Storyboard IA</h3>
                <p style={{ fontSize: 13, color: T.text3, lineHeight: 1.55, margin: "0 0 auto", flex: 1 }}>
                  Converta roteiros em B-Rolls sequenciados com pacing dinâmico e transições cinematográficas. Motor direto para response.
                </p>
                <button
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#E8512A", color: "#fff", padding: "8px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", marginTop: 16, width: "fit-content" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  Criar novo projeto
                </button>
              </div>

              {/* Right: mini timeline */}
              <div style={{ width: 260, background: T.card2, border: T.bd, borderRadius: 10, flexShrink: 0, overflow: "hidden" }}>
                <div style={{ padding: "10px 12px", borderBottom: T.bd }}>
                  <p style={{ fontSize: 9, color: T.text4, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Timeline gerada por IA</p>
                  <div style={{ height: 13, background: T.bg4, borderRadius: 3, position: "relative", marginBottom: 4, overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: "5%", width: "28%", height: "100%", background: "#0E1828", borderRadius: 2, display: "flex", alignItems: "center", paddingLeft: 4 }}>
                      <span style={{ fontSize: 7, color: "#4A9EFF" }}>Abertura</span>
                    </div>
                    <div style={{ position: "absolute", left: "35%", width: "30%", height: "100%", background: "#121820", borderRadius: 2 }} />
                    <div style={{ position: "absolute", left: "68%", width: "25%", height: "100%", background: "#0E1828", borderRadius: 2 }} />
                    <div style={{ position: "absolute", left: "35%", width: "1.5px", height: "100%", background: "#E8512A" }} />
                  </div>
                  <div style={{ height: 13, background: T.bg4, borderRadius: 3, position: "relative", marginBottom: 4, overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: "8%", width: "22%", height: "100%", background: "#1A1428", borderRadius: 2 }} />
                    <div style={{ position: "absolute", left: "33%", width: "35%", height: "100%", background: "#1A1428", borderRadius: 2 }} />
                    <div style={{ position: "absolute", left: "71%", width: "20%", height: "100%", background: "#1A1428", borderRadius: 2 }} />
                    <div style={{ position: "absolute", left: "35%", width: "1.5px", height: "100%", background: "#E8512A" }} />
                  </div>
                  <div style={{ height: 13, background: T.bg4, borderRadius: 3, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: "5%", right: "5%", height: "100%", background: "#0A1A12", borderRadius: 2, display: "flex", alignItems: "center", paddingLeft: 4 }}>
                      <span style={{ fontSize: 7, color: "#3ECF8E" }}>voz principal</span>
                    </div>
                    <div style={{ position: "absolute", left: "35%", width: "1.5px", height: "100%", background: "#E8512A" }} />
                  </div>
                </div>
                <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#3ECF8E", boxShadow: "0 0 5px #3ECF8E" }} />
                  <span style={{ fontSize: 10, color: T.text4 }}>4 cenas · B-roll mapeado</span>
                  <span style={{ fontSize: 10, color: "#E8512A", fontWeight: 600, marginLeft: "auto" }}>94%</span>
                </div>
              </div>
            </div>

            {/* ── Tools Level 2: Motor do Apresentador ───────────────────── */}
            <div style={{ background: T.card2, border: T.bd, borderRadius: 12, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ padding: "10px 14px", borderBottom: T.bd, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.text3 }}>Motor do Apresentador</span>
                <span style={{ fontSize: 10, color: T.text4, marginLeft: "auto" }}>3 ferramentas integradas</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>

                {/* LipSync */}
                <div
                  onClick={() => router.push("/dreamface")}
                  style={{ borderRight: T.bd, padding: 18, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(232,81,42,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8512A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2"/>
                        <circle cx="9" cy="9.5" r="1" fill="#E8512A" stroke="none"/><circle cx="15" cy="9.5" r="1" fill="#E8512A" stroke="none"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: "0 0 2px" }}>LipSync</p>
                      <p style={{ fontSize: 10, color: T.text4, margin: 0 }}>Motor de Avatar</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: T.text3, marginBottom: 10, lineHeight: 1.5 }}>Sincronize lábios com qualquer áudio. LipSync ultra-preciso.</p>
                  <div style={{ background: T.bg4, borderRadius: 7, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid #E8512A", background: "#1A0A08", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E8512A" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
                      {[10, 16, 8, 20, 12, 18, 7, 14].map((h, i) => (
                        <div key={i} style={{ width: 2, height: h, background: "#E8512A", borderRadius: 1, opacity: 0.7 }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 9, color: T.text3 }}>sincronizando...</span>
                  </div>
                  <button style={{ width: "100%", padding: "7px 0", border: "1px solid rgba(232,81,42,.16)", background: "rgba(232,81,42,.08)", color: "#E8512A", fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: "pointer" }}>
                    Abrir LipSync →
                  </button>
                </div>

                {/* Animador */}
                <div
                  onClick={() => router.push("/dreamact")}
                  style={{ borderRight: T.bd, padding: 18, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(139,127,232,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B7FE8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="5" r="2.5"/><path d="M12 8v5M9 20l3-7 3 7M7 12l-2 3M17 12l2 3"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: "0 0 2px" }}>Animador de Avatar</p>
                      <p style={{ fontSize: 10, color: T.text4, margin: 0 }}>Laboratório de Movimento</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: T.text3, marginBottom: 10, lineHeight: 1.5 }}>Anime qualquer foto com movimentos naturais e expressivos.</p>
                  <div style={{ background: T.bg4, borderRadius: 7, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "#1A1428", border: "1px solid rgba(139,127,232,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B7FE8" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-6-6L5 21"/></svg>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.text4} strokeWidth="1.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#8B7FE8,#6B5FD8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="5" r="2.5"/><path d="M12 8v5M9 20l3-7 3 7"/></svg>
                    </div>
                    <span style={{ fontSize: 9, color: T.text3 }}>foto → avatar</span>
                  </div>
                  <button style={{ width: "100%", padding: "7px 0", border: "1px solid rgba(139,127,232,.2)", background: "rgba(139,127,232,.08)", color: "#8B7FE8", fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: "pointer" }}>
                    Animar Avatar →
                  </button>
                </div>

                {/* Estúdio de Áudio */}
                <div
                  onClick={() => router.push("/audio")}
                  style={{ padding: 18, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(62,207,142,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3ECF8E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: "0 0 2px" }}>Estúdio de Áudio</p>
                      <p style={{ fontSize: 10, color: T.text4, margin: 0 }}>Motor de Voz · Clone</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: T.text3, marginBottom: 10, lineHeight: 1.5 }}>TTS de alta fidelidade com emoções, velocidade e tom ajustáveis.</p>
                  <div style={{ background: T.bg4, borderRadius: 7, padding: "8px 10px", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      {[6, 14, 10, 18, 8, 16, 12, 20, 9, 15].map((h, i) => (
                        <div key={i} style={{ width: 2, height: h, background: "#3ECF8E", borderRadius: 1, opacity: 0.7 }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 9, color: T.text3 }}>voz gerada</span>
                  </div>
                  <button style={{ width: "100%", padding: "7px 0", border: "1px solid rgba(62,207,142,.2)", background: "rgba(62,207,142,.08)", color: "#3ECF8E", fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: "pointer" }}>
                    Abrir Estúdio →
                  </button>
                </div>
              </div>
            </div>

            {/* ── Tools Level 3: Compact 2-col ───────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 28 }}>

              {/* Enriquecedor */}
              <div
                onClick={() => router.push("/enricher")}
                style={{ background: T.card, border: T.bd, borderRadius: 12, display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", cursor: "pointer" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(74,158,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A9EFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Enriquecedor</span>
                    <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(74,158,255,.08)", color: "#4A9EFF", padding: "2px 7px", borderRadius: 10 }}>Upload MP4</span>
                  </div>
                  <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>Injete B-Rolls em filmagens existentes</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.text4} strokeWidth="1.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>

              {/* Clone de Voz */}
              <div
                onClick={() => router.push("/voiceclone")}
                style={{ background: T.card, border: T.bd, borderRadius: 12, display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", cursor: "pointer" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245,166,35,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 3v18M15 3v18M9 7h6M9 12h6M9 17h6"/>
                    <circle cx="9" cy="3" r="1.5" fill="#F5A623" stroke="none"/>
                    <circle cx="15" cy="3" r="1.5" fill="#F5A623" stroke="none"/>
                    <circle cx="9" cy="21" r="1.5" fill="#F5A623" stroke="none"/>
                    <circle cx="15" cy="21" r="1.5" fill="#F5A623" stroke="none"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Clone de Voz</span>
                    <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(245,166,35,.08)", color: "#F5A623", padding: "2px 7px", borderRadius: 10 }}>10s</span>
                  </div>
                  <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>Clone qualquer voz com apenas 10 segundos</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.text4} strokeWidth="1.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            </div>

            {/* ── Credits low warning ─────────────────────────────────────── */}
            {creditsPct < 20 && plan === "free" && (
              <div style={{ borderRadius: 12, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.card, border: "1px solid rgba(232,81,42,.15)", marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(232,81,42,.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8512A" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: "0 0 2px" }}>Créditos acabando</p>
                    <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>Faça upgrade para continuar criando sem limites.</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push("/pricing")}
                  style={{ padding: "8px 18px", borderRadius: 8, background: "#E8512A", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", flexShrink: 0 }}>
                  Ver planos
                </button>
              </div>
            )}

            {/* ── Recent Projects ─────────────────────────────────────────── */}
            {recentProjects.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.text2 }}>Projetos recentes</span>
                  <button onClick={() => router.push("/projects")} style={{ fontSize: 12, color: T.text3, background: "none", border: "none", cursor: "pointer" }}>Ver todos →</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {recentProjects.slice(0, 3).map((p, idx) => {
                    const meta     = TOOL_META[p.tool] ?? { icon: "projects", route: "/projects", color: "#888", label: "Projeto" };
                    const hasResult = !!p.result_url;
                    const gradients = thumbGradients[idx] ?? "linear-gradient(135deg, #141414, #0A0A0A)";
                    return (
                      <div
                        key={p.id}
                        onClick={() => router.push(meta.route)}
                        style={{ background: T.card, border: T.bd, borderRadius: 12, overflow: "hidden", cursor: "pointer" }}>
                        <div style={{ aspectRatio: "16/9", background: gradients, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                          {p.thumb_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.thumb_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <ToolIcon name={meta.icon} style={{ width: 24, height: 24, color: "rgba(255,255,255,0.1)" }} />
                          )}
                          <div style={{ position: "absolute", width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          </div>
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(0,0,0,0.3)" }}>
                            <div style={{ height: "100%", width: hasResult ? "100%" : "60%", background: hasResult ? "#3ECF8E" : "#E8512A" }} />
                          </div>
                        </div>
                        <div style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>
                              {p.title.replace(/^[^—]+—\s*/, "")}
                            </p>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
                              background: hasResult ? "rgba(62,207,142,.08)" : "rgba(232,81,42,.08)",
                              color: hasResult ? "#3ECF8E" : "#E8512A",
                            }}>
                              {hasResult ? "Concluído" : "Em curadoria"}
                            </span>
                          </div>
                          <p style={{ fontSize: 11, color: T.text4, margin: 0 }}>{timeAgo(p.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── First access state ──────────────────────────────────────── */}
            {recentProjects.length === 0 && projectsLoaded && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0 32px", textAlign: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.text2, margin: "0 0 6px" }}>Por onde você quer começar?</p>
                <p style={{ fontSize: 12, color: T.text3, margin: "0 0 24px" }}>Cole um roteiro no campo acima ou escolha um ponto de partida abaixo.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, width: "100%", marginBottom: 24 }}>
                  {[
                    { step: "01 · Mais rápido", title: "Cole um roteiro", desc: "Transforme qualquer texto em B-Rolls cinematográficos.", color: "#E8512A", bg: "rgba(232,81,42,.08)", action: () => textareaRef.current?.focus() },
                    { step: "02 · Mais visual",  title: "Suba um vídeo",   desc: "Injete B-Rolls premium em filmagens existentes.",     color: "#4A9EFF", bg: "rgba(74,158,255,.08)",  action: () => router.push("/enricher") },
                    { step: "03 · Mais guiado", title: "Use um template", desc: "Escolha um nicho e comece com roteiro pronto.",        color: "#3ECF8E", bg: "rgba(62,207,142,.08)",  action: () => router.push("/storyboard") },
                  ].map(card => (
                    <div
                      key={card.step}
                      onClick={card.action}
                      style={{ background: T.card, border: T.bd, borderRadius: 12, padding: "16px 14px", position: "relative", cursor: "pointer", textAlign: "left" }}>
                      <p style={{ fontSize: 9, color: T.text4, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>{card.step}</p>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={card.color} strokeWidth="1.5" strokeLinecap="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: "0 0 4px" }}>{card.title}</p>
                      <p style={{ fontSize: 11, color: T.text3, margin: 0 }}>{card.desc}</p>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text4} strokeWidth="1.5" strokeLinecap="round" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => router.push("/storyboard")}
                  style={{ background: "#E8512A", color: "#fff", fontSize: 13, fontWeight: 700, padding: "12px 24px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 10 }}>
                  Criar meu primeiro projeto
                </button>
                <p style={{ fontSize: 11, color: T.text4, margin: 0 }}>500 moedas grátis · sem cartão de crédito</p>
              </div>
            )}

          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── ONBOARDING MODAL ── */}
      {showOnboarding && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{
            maxWidth: 520, width: "100%", borderRadius: 24, overflow: "hidden",
            background: "#111", border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
          }}>
            <div style={{
              padding: "32px 32px 24px",
              background: "linear-gradient(135deg,rgba(240,86,58,0.12),rgba(99,5,239,0.08))",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#F0563A", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#fff", fontSize: 18 }}>S</div>
                <div>
                  <p style={{ fontSize: 11, color: "#F0563A", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>Bem-vindo ao</p>
                  <p style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: -0.5 }}>SUARIK</p>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.6 }}>
                Motor de IA que transforma sua copy em B-rolls, legendas e timeline em segundos.
              </p>
            </div>
            <div style={{ padding: "24px 32px" }}>
              <p style={{ fontSize: 11, color: T.text3, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 16px", fontWeight: 700 }}>Como funciona</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { icon: "✍️", step: "1", title: "Cole sua copy ou VSL", desc: "Cole o script, narração ou vídeo de vendas" },
                  { icon: "🤖", step: "2", title: "IA gera o storyboard",  desc: "GPT-4o cria cenas, B-rolls e músicas automaticamente" },
                  { icon: "🎬", step: "3", title: "Exporte para seu editor", desc: "Premiere Pro, DaVinci Resolve, CapCut — pronto" },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(240,86,58,0.12)", border: "1px solid rgba(240,86,58,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                      {s.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>{s.title}</p>
                      <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: "0 32px 28px", display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  localStorage.setItem("suarik_onboarding_seen", "1");
                  setShowOnboarding(false);
                  router.push("/storyboard");
                }}
                style={{
                  flex: 1, padding: "13px 0", borderRadius: 12, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg,#F0563A,#c44527)",
                  color: "#fff", fontSize: 14, fontWeight: 800, letterSpacing: -0.3,
                  boxShadow: "0 8px 24px rgba(240,86,58,0.35)",
                }}>
                🚀 Criar primeiro storyboard
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("suarik_onboarding_seen", "1");
                  setShowOnboarding(false);
                }}
                style={{
                  padding: "13px 20px", borderRadius: 12, background: "transparent",
                  border: "1px solid rgba(255,255,255,0.08)", color: T.text3,
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>
                Explorar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        html, body { overflow: hidden; }
      `}</style>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#060606" }}>
        <div style={{ width: 32, height: 32, border: "2px solid #131313", borderTopColor: "#E8512A", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
