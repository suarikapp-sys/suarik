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
      // Capture real name from OAuth metadata (Google/GitHub supply this even when profiles.full_name is null)
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
  const planInfo    = PLAN_LABELS[plan] ?? PLAN_LABELS.free;
  const initials    = getInitials(profile?.full_name ?? authName ?? null, profile?.email ?? "?");
  // Priority: profiles.full_name → OAuth metadata name → email local-part
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

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "'Geist', system-ui, sans-serif", background: "#060606", color: "#EBEBEB" }}>

      {/* ═══ TOPBAR ═══════════════════════════════════════════════════════════ */}
      <div style={{ height: 52, flexShrink: 0, display: "flex", alignItems: "center", background: "#060606", borderBottom: "1px solid #141414", zIndex: 100, padding: "0 16px 0 0" }}>

        {/* Brand */}
        <div style={{ width: 224, flexShrink: 0, borderRight: "1px solid #141414", padding: "0 16px", height: "100%", display: "flex", alignItems: "center", gap: 9 }}>
          <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="8" fill="#111"/>
            <rect x="12" y="10" width="40" height="11" rx="4" fill="#E8E8E8"/>
            <rect x="41" y="10" width="11" height="24" rx="4" fill="#E8E8E8"/>
            <rect x="12" y="43" width="40" height="11" rx="4" fill="#E8512A"/>
            <rect x="12" y="30" width="11" height="24" rx="4" fill="#E8512A"/>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#EBEBEB", letterSpacing: "-0.02em" }}>Suarik</span>
        </div>

        {/* Middle: search */}
        <div style={{ flex: 1, padding: "0 16px" }}>
          <div style={{ background: "#0F0F0F", border: "1px solid #141414", borderRadius: 7, padding: "7px 11px", width: 260, display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>
            </svg>
            <span style={{ fontSize: 12, color: "#555", flex: 1 }}>Buscar projetos e ferramentas...</span>
            <kbd style={{ fontSize: 10, fontFamily: "monospace", background: "#141414", border: "1px solid #1C1C1C", padding: "2px 5px", borderRadius: 4, color: "#555" }}>⌘K</kbd>
          </div>
        </div>

        {/* Right */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Credits widget */}
          <div style={{ background: "#0F0F0F", border: "1px solid #141414", borderRadius: 7, padding: "6px 12px", display: "flex", alignItems: "center", gap: 9 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#E8512A" stroke="none">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#EBEBEB" }}>{credits.toLocaleString()}</span>
                <span style={{ fontSize: 11, color: "#555" }}>/ {maxCredits.toLocaleString()}</span>
              </div>
              <div style={{ width: 48, height: 2, background: "#1C1C1C", borderRadius: 1, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${creditsPct}%`, background: "linear-gradient(90deg, #E8512A, #FF6534)", borderRadius: 1 }} />
              </div>
            </div>
          </div>

          {/* Criar button */}
          <button
            onClick={() => router.push("/storyboard")}
            style={{ background: "#E8512A", color: "#fff", borderRadius: 7, height: 32, padding: "0 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Criar
          </button>

          {/* Avatar */}
          <button
            onClick={handleSignOut}
            title={`${displayName} · Sair`}
            style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#E8512A,#FF6534)", fontSize: 11, fontWeight: 700, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {initials}
          </button>
        </div>
      </div>

      {/* ═══ APP BODY ══════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <div style={{ width: 224, flexShrink: 0, height: "100%", borderRight: "1px solid #141414", display: "flex", flexDirection: "column", overflowY: "auto", background: "#060606" }}>

          {/* Section 1: Navigation */}
          <div style={{ padding: "12px 10px 6px" }}>
            {/* Início (active) */}
            <button
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, background: "#0F0F0F", border: "1px solid #141414", cursor: "pointer", marginBottom: 2 }}
              onClick={() => router.push("/dashboard")}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: "#1C1C1C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EBEBEB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#EBEBEB" }}>Início</span>
            </button>

            {/* Projetos (inactive) */}
            <button
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, background: "transparent", border: "1px solid transparent", cursor: "pointer" }}
              onClick={() => router.push("/projects")}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: "#141414", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 400, color: "#555", flex: 1, textAlign: "left" }}>Projetos</span>
              <span style={{ fontSize: 9, background: "#141414", color: "#555", padding: "2px 6px", borderRadius: 10 }}>{allProjects.length}</span>
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "#141414", margin: "6px 10px" }} />

          {/* Section 2: Motor Principal */}
          <div style={{ padding: "0 10px 6px" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 10px 6px", margin: 0 }}>Motor Principal</p>
            <button
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, background: "transparent", border: "1px solid transparent", cursor: "pointer" }}
              onClick={() => router.push("/storyboard")}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(232,81,42,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8512A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v6M7 13h2M7 17h2M13 13h4M13 17h4"/>
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 400, color: "#888", flex: 1, textAlign: "left" }}>Storyboard IA</span>
              <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(232,81,42,.08)", color: "#E8512A", padding: "2px 6px", borderRadius: 10 }}>DR</span>
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "#141414", margin: "6px 10px" }} />

          {/* Section 3: Apresentador */}
          <div style={{ padding: "0 10px 6px" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 10px 6px", margin: 0 }}>Apresentador</p>

            {/* LipSync */}
            <button
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, background: "transparent", border: "1px solid transparent", cursor: "pointer", marginBottom: 2 }}
              onClick={() => router.push("/dreamface")}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(232,81,42,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8512A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2"/>
                  <circle cx="9" cy="9.5" r="1" fill="#E8512A" stroke="none"/><circle cx="15" cy="9.5" r="1" fill="#E8512A" stroke="none"/>
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 400, color: "#888" }}>LipSync</span>
            </button>

            {/* Animador */}
            <button
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, background: "transparent", border: "1px solid transparent", cursor: "pointer", marginBottom: 2 }}
              onClick={() => router.push("/dreamact")}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(139,127,232,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B7FE8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="2.5"/><path d="M12 8v5M9 20l3-7 3 7M7 12l-2 3M17 12l2 3"/>
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 400, color: "#888" }}>Animador de Avatar</span>
            </button>

            {/* Estúdio de Áudio */}
            <button
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, background: "transparent", border: "1px solid transparent", cursor: "pointer" }}
              onClick={() => router.push("/audio")}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(62,207,142,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3ECF8E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4"/>
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 400, color: "#888" }}>Estúdio de Áudio</span>
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "#141414", margin: "6px 10px" }} />

          {/* Section 4: Ferramentas */}
          <div style={{ padding: "0 10px 6px" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 10px 6px", margin: 0 }}>Ferramentas</p>

            {/* Enriquecedor */}
            <button
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, background: "transparent", border: "1px solid transparent", cursor: "pointer", marginBottom: 2 }}
              onClick={() => router.push("/enricher")}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(74,158,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4A9EFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 400, color: "#888" }}>Enriquecedor</span>
            </button>

            {/* Clone de Voz */}
            <button
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, background: "transparent", border: "1px solid transparent", cursor: "pointer" }}
              onClick={() => router.push("/voiceclone")}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(245,166,35,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3v18M15 3v18M9 7h6M9 12h6M9 17h6"/>
                  <circle cx="9" cy="3" r="1.5" fill="#F5A623" stroke="none"/>
                  <circle cx="15" cy="3" r="1.5" fill="#F5A623" stroke="none"/>
                  <circle cx="9" cy="21" r="1.5" fill="#F5A623" stroke="none"/>
                  <circle cx="15" cy="21" r="1.5" fill="#F5A623" stroke="none"/>
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 400, color: "#888", flex: 1, textAlign: "left" }}>Clone de Voz</span>
              <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(62,207,142,.08)", color: "#3ECF8E", padding: "2px 6px", borderRadius: 10 }}>Novo</span>
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "#141414", margin: "6px 10px" }} />

          {/* Section 5: Recentes */}
          {recentProjects.length > 0 && (
            <div style={{ padding: "0 10px 6px" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 10px 6px", margin: 0 }}>Recentes</p>
              {recentProjects.slice(0, 4).map((p, i) => {
                const dotColors = ["#3ECF8E", "#E8512A", "#333", "#333"];
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColors[i] ?? "#333", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#555", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.title.replace(/^[^—]+—\s*/, "")}
                    </span>
                    <span style={{ fontSize: 10, color: "#333", flexShrink: 0 }}>{timeAgo(p.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Plan card */}
          <div style={{ margin: "auto 10px 10px", padding: 14, background: "#0F0F0F", border: "1px solid #141414", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(232,81,42,.08)", padding: "3px 8px", borderRadius: 6 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#E8512A" stroke="none">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                </svg>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#E8512A", textTransform: "uppercase", letterSpacing: "0.1em" }}>PRO</span>
              </div>
              <span style={{ fontSize: 10, color: "#333" }}>{allProjects.length}/7 ativas</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#EBEBEB", lineHeight: 1.1, marginBottom: 2 }}>{credits.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>de {maxCredits.toLocaleString()} créditos</div>
            <div style={{ height: 3, background: "#1C1C1C", borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ height: "100%", width: `${creditsPct}%`, background: "linear-gradient(90deg,#E8512A,#FF6534)", borderRadius: 2 }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => router.push("/pricing")}
                style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "1px solid rgba(232,81,42,.3)", background: "rgba(232,81,42,.06)", color: "#E8512A", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Upgrade
              </button>
              <button
                onClick={handleSignOut}
                style={{ width: 32, height: 32, borderRadius: 7, border: "1px solid #1C1C1C", background: "#141414", color: "#555", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── MAIN ────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", background: "#060606" }}>
          <div style={{ padding: "36px 36px 60px", maxWidth: 1080, margin: "0 auto" }}>

            {/* Greeting */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, color: "#333", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>{dateDisplay}</p>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", color: "#EBEBEB", lineHeight: 1.1, margin: 0 }}>
                {greeting}, <em style={{ color: "#E8512A", fontStyle: "normal" }}>{firstName}.</em>
              </h1>
              {streak > 0 && (
                <p style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
                  {streak} {streak === 1 ? "dia" : "dias"} em sequência
                </p>
              )}
            </div>

            {/* Hero input */}
            <div style={{ marginBottom: 10, background: "#0A0A0A", border: "1px solid #141414", borderRadius: 16, overflow: "hidden" }}
              onFocus={() => {}}
            >
              <textarea
                ref={textareaRef}
                value={heroText}
                onChange={e => setHeroText(e.target.value)}
                placeholder="Cole seu roteiro, ou descreva o vídeo que quer criar..."
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  color: "#EBEBEB", fontFamily: "'Geist', system-ui, sans-serif", fontSize: 14,
                  fontWeight: 300, padding: "18px 18px 0", resize: "none", minHeight: 76,
                  lineHeight: 1.65, boxSizing: "border-box",
                }}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
              />
              <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 7, borderTop: "1px solid #141414" }}>
                {/* Chips */}
                <button style={{ display: "flex", alignItems: "center", gap: 5, background: "#0F0F0F", border: "1px solid #141414", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#555", cursor: "pointer" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Roteiro
                </button>
                <button
                  onClick={() => router.push("/enricher")}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "#0F0F0F", border: "1px solid #141414", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#555", cursor: "pointer" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
                  Importar MP4
                </button>
                <div style={{ width: 1, height: 14, background: "#141414" }} />
                <button style={{ display: "flex", alignItems: "center", gap: 5, background: "#0F0F0F", border: "1px solid #141414", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#555", cursor: "pointer" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  15–30s
                </button>
                <button style={{ display: "flex", alignItems: "center", gap: 5, background: "#0F0F0F", border: "1px solid #141414", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#555", cursor: "pointer" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  Direct Response
                </button>

                {/* Send button */}
                <button
                  onClick={handleGenerate}
                  disabled={!heroText.trim()}
                  style={{
                    marginLeft: "auto", background: heroText.trim() ? "#E8512A" : "#141414",
                    color: heroText.trim() ? "#fff" : "#333", borderRadius: 7, padding: "7px 14px",
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
                  style={{ fontSize: 12, color: "#555", padding: "5px 12px", background: "#0A0A0A", border: "1px solid #141414", borderRadius: 20, cursor: "pointer" }}>
                  {qp.label}
                </button>
              ))}
            </div>

            {/* ── Tools Level 1: Featured Storyboard ─────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#888" }}>Ferramentas</span>
              <button onClick={() => router.push("/storyboard")} style={{ fontSize: 12, color: "#555", background: "none", border: "none", cursor: "pointer" }}>Ver todas →</button>
            </div>

            {/* Big storyboard card */}
            <div
              onClick={() => router.push("/storyboard")}
              style={{ background: "#0A0A0A", border: "1px solid #141414", borderRadius: 12, padding: 20, display: "flex", gap: 20, marginBottom: 6, overflow: "hidden", position: "relative", cursor: "pointer" }}>

              {/* Left */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(232,81,42,.08)", color: "#E8512A", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 10 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#E8512A" stroke="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                    Motor Principal
                  </span>
                  <span style={{ fontSize: 10, color: "#333" }}>Direct Response</span>
                </div>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(232,81,42,.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8512A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v6M7 13h2M7 17h2M13 13h4M13 17h4"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "#EBEBEB", margin: "0 0 6px" }}>Storyboard IA</h3>
                <p style={{ fontSize: 13, color: "#555", lineHeight: 1.55, margin: "0 0 auto", flex: 1 }}>
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
              <div style={{ width: 260, background: "#0F0F0F", border: "1px solid #141414", borderRadius: 10, flexShrink: 0, overflow: "hidden" }}>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #141414" }}>
                  <p style={{ fontSize: 9, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Timeline gerada por IA</p>

                  {/* Track 1 */}
                  <div style={{ height: 13, background: "#141414", borderRadius: 3, position: "relative", marginBottom: 4, overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: "5%", width: "28%", height: "100%", background: "#0E1828", borderRadius: 2, display: "flex", alignItems: "center", paddingLeft: 4 }}>
                      <span style={{ fontSize: 7, color: "#4A9EFF" }}>Abertura</span>
                    </div>
                    <div style={{ position: "absolute", left: "35%", width: "30%", height: "100%", background: "#121820", borderRadius: 2 }} />
                    <div style={{ position: "absolute", left: "68%", width: "25%", height: "100%", background: "#0E1828", borderRadius: 2 }} />
                    <div style={{ position: "absolute", left: "35%", width: "1.5px", height: "100%", background: "#E8512A" }} />
                  </div>

                  {/* Track 2 */}
                  <div style={{ height: 13, background: "#141414", borderRadius: 3, position: "relative", marginBottom: 4, overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: "8%", width: "22%", height: "100%", background: "#1A1428", borderRadius: 2 }} />
                    <div style={{ position: "absolute", left: "33%", width: "35%", height: "100%", background: "#1A1428", borderRadius: 2 }} />
                    <div style={{ position: "absolute", left: "71%", width: "20%", height: "100%", background: "#1A1428", borderRadius: 2 }} />
                    <div style={{ position: "absolute", left: "35%", width: "1.5px", height: "100%", background: "#E8512A" }} />
                  </div>

                  {/* Track 3 */}
                  <div style={{ height: 13, background: "#141414", borderRadius: 3, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: "5%", right: "5%", height: "100%", background: "#0A1A12", borderRadius: 2, display: "flex", alignItems: "center", paddingLeft: 4 }}>
                      <span style={{ fontSize: 7, color: "#3ECF8E" }}>voz principal</span>
                    </div>
                    <div style={{ position: "absolute", left: "35%", width: "1.5px", height: "100%", background: "#E8512A" }} />
                  </div>
                </div>

                {/* Footer */}
                <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#3ECF8E", boxShadow: "0 0 5px #3ECF8E" }} />
                  <span style={{ fontSize: 10, color: "#333" }}>4 cenas · B-roll mapeado</span>
                  <span style={{ fontSize: 10, color: "#E8512A", fontWeight: 600, marginLeft: "auto" }}>94%</span>
                </div>
              </div>
            </div>

            {/* ── Tools Level 2: Motor do Apresentador ───────────────────── */}
            <div style={{ background: "#0F0F0F", border: "1px solid #141414", borderRadius: 12, overflow: "hidden", marginBottom: 6 }}>
              {/* Header */}
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #141414", display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#555" }}>Motor do Apresentador</span>
                <span style={{ fontSize: 10, color: "#333", marginLeft: "auto" }}>3 ferramentas integradas</span>
              </div>

              {/* 3-col grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>

                {/* LipSync */}
                <div
                  onClick={() => router.push("/dreamface")}
                  style={{ borderRight: "1px solid #141414", padding: 18, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(232,81,42,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8512A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2"/>
                        <circle cx="9" cy="9.5" r="1" fill="#E8512A" stroke="none"/><circle cx="15" cy="9.5" r="1" fill="#E8512A" stroke="none"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#EBEBEB", margin: "0 0 2px" }}>LipSync</p>
                      <p style={{ fontSize: 10, color: "#333", margin: 0 }}>Motor de Avatar</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "#555", marginBottom: 10, lineHeight: 1.5 }}>Sincronize lábios com qualquer áudio. LipSync ultra-preciso.</p>
                  {/* Waveform preview */}
                  <div style={{ background: "#141414", borderRadius: 7, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid #E8512A", background: "#1A0A08", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E8512A" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
                      {[10, 16, 8, 20, 12, 18, 7, 14].map((h, i) => (
                        <div key={i} style={{ width: 2, height: h, background: "#E8512A", borderRadius: 1, opacity: 0.7 }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 9, color: "#555" }}>sincronizando...</span>
                  </div>
                  <button style={{ width: "100%", padding: "7px 0", border: "1px solid rgba(232,81,42,.16)", background: "rgba(232,81,42,.08)", color: "#E8512A", fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: "pointer" }}>
                    Abrir LipSync →
                  </button>
                </div>

                {/* Animador */}
                <div
                  onClick={() => router.push("/dreamact")}
                  style={{ borderRight: "1px solid #141414", padding: 18, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(139,127,232,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B7FE8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="5" r="2.5"/><path d="M12 8v5M9 20l3-7 3 7M7 12l-2 3M17 12l2 3"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#EBEBEB", margin: "0 0 2px" }}>Animador de Avatar</p>
                      <p style={{ fontSize: 10, color: "#333", margin: 0 }}>Laboratório de Movimento</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "#555", marginBottom: 10, lineHeight: 1.5 }}>Anime qualquer foto com movimentos naturais e expressivos.</p>
                  {/* Photo → avatar preview */}
                  <div style={{ background: "#141414", borderRadius: 7, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "#1A1428", border: "1px solid rgba(139,127,232,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B7FE8" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-6-6L5 21"/></svg>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#8B7FE8,#6B5FD8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="5" r="2.5"/><path d="M12 8v5M9 20l3-7 3 7"/></svg>
                    </div>
                    <span style={{ fontSize: 9, color: "#555" }}>foto → avatar</span>
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
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#EBEBEB", margin: "0 0 2px" }}>Estúdio de Áudio</p>
                      <p style={{ fontSize: 10, color: "#333", margin: 0 }}>Motor de Voz · Clone</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "#555", marginBottom: 10, lineHeight: 1.5 }}>TTS de alta fidelidade com emoções, velocidade e tom ajustáveis.</p>
                  {/* Waveform bars */}
                  <div style={{ background: "#141414", borderRadius: 7, padding: "8px 10px", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      {[6, 14, 10, 18, 8, 16, 12, 20, 9, 15].map((h, i) => (
                        <div key={i} style={{ width: 2, height: h, background: "#3ECF8E", borderRadius: 1, opacity: 0.7 }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 9, color: "#555" }}>voz gerada</span>
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
                style={{ background: "#0A0A0A", border: "1px solid #141414", borderRadius: 12, display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", cursor: "pointer" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(74,158,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A9EFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#EBEBEB" }}>Enriquecedor</span>
                    <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(74,158,255,.08)", color: "#4A9EFF", padding: "2px 7px", borderRadius: 10 }}>Upload MP4</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#555", margin: 0 }}>Injete B-Rolls em filmagens existentes</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>

              {/* Clone de Voz */}
              <div
                onClick={() => router.push("/voiceclone")}
                style={{ background: "#0A0A0A", border: "1px solid #141414", borderRadius: 12, display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", cursor: "pointer" }}>
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
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#EBEBEB" }}>Clone de Voz</span>
                    <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(245,166,35,.08)", color: "#F5A623", padding: "2px 7px", borderRadius: 10 }}>10s</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#555", margin: 0 }}>Clone qualquer voz com apenas 10 segundos</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            </div>

            {/* ── Credits low warning ─────────────────────────────────────── */}
            {creditsPct < 20 && plan === "free" && (
              <div style={{ borderRadius: 12, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0A0A0A", border: "1px solid rgba(232,81,42,.15)", marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(232,81,42,.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8512A" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#EBEBEB", margin: "0 0 2px" }}>Créditos acabando</p>
                    <p style={{ fontSize: 12, color: "#555", margin: 0 }}>Faça upgrade para continuar criando sem limites.</p>
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
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#888" }}>Projetos recentes</span>
                  <button onClick={() => router.push("/projects")} style={{ fontSize: 12, color: "#555", background: "none", border: "none", cursor: "pointer" }}>Ver todos →</button>
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
                        style={{ background: "#0A0A0A", border: "1px solid #141414", borderRadius: 12, overflow: "hidden", cursor: "pointer" }}>
                        {/* Thumbnail */}
                        <div style={{ aspectRatio: "16/9", background: gradients, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                          {p.thumb_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.thumb_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <ToolIcon name={meta.icon} style={{ width: 24, height: 24, color: "rgba(255,255,255,0.1)" }} />
                          )}
                          {/* Play icon */}
                          <div style={{ position: "absolute", width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          </div>
                          {/* Progress bar */}
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(0,0,0,0.3)" }}>
                            <div style={{ height: "100%", width: hasResult ? "100%" : "60%", background: hasResult ? "#3ECF8E" : "#E8512A" }} />
                          </div>
                        </div>
                        {/* Body */}
                        <div style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#EBEBEB", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>
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
                          <p style={{ fontSize: 11, color: "#333", margin: 0 }}>{timeAgo(p.created_at)}</p>
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
                <p style={{ fontSize: 13, fontWeight: 600, color: "#888", margin: "0 0 6px" }}>Por onde você quer começar?</p>
                <p style={{ fontSize: 12, color: "#555", margin: "0 0 24px" }}>Cole um roteiro no campo acima ou escolha um ponto de partida abaixo.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, width: "100%", marginBottom: 24 }}>
                  {[
                    { step: "01 · Mais rápido", title: "Cole um roteiro", desc: "Transforme qualquer texto em B-Rolls cinematográficos.", color: "#E8512A", bg: "rgba(232,81,42,.08)", action: () => textareaRef.current?.focus() },
                    { step: "02 · Mais visual",  title: "Suba um vídeo",   desc: "Injete B-Rolls premium em filmagens existentes.",     color: "#4A9EFF", bg: "rgba(74,158,255,.08)",  action: () => router.push("/enricher") },
                    { step: "03 · Mais guiado", title: "Use um template", desc: "Escolha um nicho e comece com roteiro pronto.",        color: "#3ECF8E", bg: "rgba(62,207,142,.08)",  action: () => router.push("/storyboard") },
                  ].map(card => (
                    <div
                      key={card.step}
                      onClick={card.action}
                      style={{ background: "#0A0A0A", border: "1px solid #141414", borderRadius: 12, padding: "16px 14px", position: "relative", cursor: "pointer", textAlign: "left" }}>
                      <p style={{ fontSize: 9, color: "#333", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>{card.step}</p>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={card.color} strokeWidth="1.5" strokeLinecap="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#EBEBEB", margin: "0 0 4px" }}>{card.title}</p>
                      <p style={{ fontSize: 11, color: "#555", margin: 0 }}>{card.desc}</p>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
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
                <p style={{ fontSize: 11, color: "#333", margin: 0 }}>500 moedas grátis · sem cartão de crédito</p>
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
            {/* Header */}
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

            {/* Steps */}
            <div style={{ padding: "24px 32px" }}>
              <p style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 16px", fontWeight: 700 }}>Como funciona</p>
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
                      <p style={{ fontSize: 12, color: "#555", margin: 0 }}>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
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
                  border: "1px solid rgba(255,255,255,0.08)", color: "#555",
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
