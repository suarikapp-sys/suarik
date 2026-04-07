"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast, ToastContainer } from "@/components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type Project = {
  id:         string;
  tool:       string;
  title:      string;
  result_url: string | null;
  thumb_url:  string | null;
  meta:       Record<string, unknown>;
  created_at: string;
};

// ─── Tool config ──────────────────────────────────────────────────────────────
const TOOL_CONFIG: Record<string, { icon: string; label: string; color: string; route: string }> = {
  audio:      { icon: "🎙️", label: "Audio Studio",   color: "#a78bfa", route: "/audio"      },
  lipsync:    { icon: "🎭", label: "LipSync Studio", color: "#F0563A", route: "/dreamface"  },
  voiceclone: { icon: "🧬", label: "Voice Clone",    color: "#34d399", route: "/voiceclone" },
  storyboard: { icon: "✨", label: "Storyboarder",   color: "#F0563A", route: "/storyboard" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDur(sec: unknown) {
  if (!sec || typeof sec !== "number") return null;
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const router   = useRouter();
  const supabase = createClient();

  const { toasts, remove: removeToast, toast } = useToast();
  const [initials,  setInitials]  = useState("US");
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<string>("all");
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [preview,   setPreview]   = useState<Project | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setInitials((user.email ?? "U")[0].toUpperCase());
    });
    loadProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      const j   = await res.json() as { projects?: Project[] };
      setProjects(j.projects ?? []);
    } catch {}
    setLoading(false);
  }

  async function deleteProject(id: string) {
    setDeleting(id);
    try {
      await fetch("/api/projects", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id }),
      });
      setProjects(p => p.filter(x => x.id !== id));
      if (preview?.id === id) setPreview(null);
      toast.success("Projeto removido.");
    } catch {
      toast.error("Não foi possível remover o projeto.");
    }
    setDeleting(null);
  }

  function openInTool(p: Project) {
    const cfg = TOOL_CONFIG[p.tool];
    if (!cfg) return;
    if (p.result_url && (p.tool === "audio" || p.tool === "voiceclone")) {
      sessionStorage.setItem("vb_pending_audio", JSON.stringify({
        url:      p.result_url,
        label:    p.title,
        duration: p.meta.duration ?? 0,
      }));
      sessionStorage.setItem("vb_restore_requested", "1");
      router.push("/storyboard");
    } else if (p.tool === "lipsync" && p.result_url) {
      sessionStorage.setItem("vb_pending_video", p.result_url);
      sessionStorage.setItem("vb_restore_requested", "1");
      router.push("/storyboard");
    } else if (p.tool === "storyboard") {
      // Signal the storyboard page to restore last session
      sessionStorage.setItem("vb_restore_requested", "1");
      router.push(cfg.route);
    } else {
      router.push(cfg.route);
    }
  }

  const filtered = filter === "all" ? projects : projects.filter(p => p.tool === filter);
  const tools    = ["all", ...Array.from(new Set(projects.map(p => p.tool)))];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "#131313", color: "#fff", fontFamily: "'Inter', sans-serif",
      overflow: "hidden",
    }}>

      {/* ── TOPBAR ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: 52, borderBottom: "1px solid #222",
        background: "#1C1B1B", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: "#F0563A",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 14, color: "#fff",
          }}>S</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>SUARIK</span>
          <span style={{ color: "#444", fontSize: 18 }}>/</span>
          <span style={{ color: "#ccc", fontSize: 14 }}>📁 Projetos</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => router.push("/dashboard")} style={{
            padding: "5px 14px", borderRadius: 6, border: "1px solid #333",
            background: "transparent", color: "#aaa", fontSize: 12, cursor: "pointer",
          }}>Dashboard</button>
          <button onClick={() => router.push("/storyboard")} style={{
            padding: "5px 14px", borderRadius: 6, border: "1px solid #6305ef55",
            background: "#6305ef22", color: "#a78bfa", fontSize: 12, cursor: "pointer", fontWeight: 600,
          }}>⚡ Editor</button>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", background: "#F0563A",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13,
          }}>{initials}</div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{
          width: 200, background: "#1C1B1B", borderRight: "1px solid #222",
          display: "flex", flexDirection: "column", padding: "16px 12px",
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>
            Filtrar por ferramenta
          </p>
          {tools.map(t => {
            const cfg  = TOOL_CONFIG[t];
            const count = t === "all" ? projects.length : projects.filter(p => p.tool === t).length;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: 8, marginBottom: 4,
                  border: "none", cursor: "pointer", textAlign: "left",
                  background: filter === t ? "#F0563A18" : "transparent",
                  color:      filter === t ? "#F0563A"   : "#888",
                  fontWeight: filter === t ? 600          : 400,
                  fontSize: 13,
                }}
              >
                <span>{cfg ? `${cfg.icon} ${cfg.label}` : "📁 Todos"}</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>{count}</span>
              </button>
            );
          })}

          <div style={{ flex: 1 }} />
          <div style={{ borderTop: "1px solid #222", paddingTop: 12 }}>
            <p style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Criar novo
            </p>
            {Object.entries(TOOL_CONFIG).map(([key, cfg]) => (
              <button key={key} onClick={() => router.push(cfg.route)} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "7px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                background: "transparent", color: "#666", fontSize: 12, textAlign: "left",
              }}>
                <span>{cfg.icon}</span>{cfg.label}
              </button>
            ))}
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ flex: 1, overflowY: "auto", padding: 28, minWidth: 0 }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📁 Meus Projetos</h1>
              <p style={{ color: "#555", fontSize: 13, marginTop: 4 }}>
                {filtered.length} projeto{filtered.length !== 1 ? "s" : ""} salvos
              </p>
            </div>
            <button onClick={loadProjects} style={{
              padding: "7px 16px", borderRadius: 8, border: "1px solid #2a2a2a",
              background: "#1a1a1a", color: "#888", fontSize: 12, cursor: "pointer",
            }}>
              ↺ Atualizar
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#444" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", margin: "0 auto 16px",
                border: "2px solid #333", borderTopColor: "#F0563A",
                animation: "spin 0.7s linear infinite",
              }} />
              Carregando projetos...
            </div>
          )}

          {/* Empty */}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 20px", color: "#333" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <p style={{ fontSize: 15, marginBottom: 8, color: "#555" }}>
                Nenhum projeto ainda
              </p>
              <p style={{ fontSize: 13, color: "#444", marginBottom: 24 }}>
                Gere conteúdo nas ferramentas — ele aparece aqui automaticamente.
              </p>
              <button onClick={() => router.push("/dashboard")} style={{
                padding: "10px 24px", borderRadius: 8,
                background: "linear-gradient(135deg, #F0563A, #c44527)",
                border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>
                Ir para o Dashboard
              </button>
            </div>
          )}

          {/* Grid */}
          {!loading && filtered.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 16,
            }}>
              {filtered.map(p => {
                const cfg = TOOL_CONFIG[p.tool] ?? { icon: "📄", label: p.tool, color: "#888", route: "/" };
                const isVideo = p.tool === "lipsync";
                const dur = fmtDur(p.meta?.duration as number | undefined);

                return (
                  <div
                    key={p.id}
                    style={{
                      background: "#1a1a1a", borderRadius: 12,
                      border: preview?.id === p.id ? `1.5px solid ${cfg.color}` : "1px solid #2a2a2a",
                      overflow: "hidden", cursor: "pointer", transition: "all 0.15s",
                    }}
                    onClick={() => setPreview(preview?.id === p.id ? null : p)}
                  >
                    {/* Thumbnail / preview area */}
                    <div style={{
                      height: 120, background: "#111",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative", overflow: "hidden",
                    }}>
                      {isVideo && p.result_url ? (
                        <video
                          src={p.result_url}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          muted
                          onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
                          onMouseLeave={e => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime = 0; }}
                        />
                      ) : (
                        <div style={{
                          width: 52, height: 52, borderRadius: 12,
                          background: `${cfg.color}18`, border: `1px solid ${cfg.color}44`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 24,
                        }}>
                          {cfg.icon}
                        </div>
                      )}
                      {/* Tool badge */}
                      <div style={{
                        position: "absolute", top: 8, left: 8,
                        padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: `${cfg.color}22`, color: cfg.color,
                        backdropFilter: "blur(4px)",
                      }}>
                        {cfg.icon} {cfg.label}
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ padding: "12px 14px" }}>
                      <p style={{
                        fontSize: 13, fontWeight: 600, color: "#ddd", margin: "0 0 4px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {p.title}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#444" }}>
                          {fmtDate(p.created_at)}
                        </span>
                        {dur && <span style={{ fontSize: 11, color: cfg.color }}>{dur}</span>}
                      </div>
                    </div>

                    {/* Expanded actions */}
                    {preview?.id === p.id && (
                      <div style={{
                        padding: "0 14px 14px",
                        display: "flex", flexDirection: "column", gap: 6,
                        borderTop: "1px solid #2a2a2a",
                        paddingTop: 12,
                      }}>
                        {/* Audio player inline */}
                        {(p.tool === "audio" || p.tool === "voiceclone") && p.result_url && (
                          <audio controls src={p.result_url} style={{ width: "100%", height: 32, marginBottom: 4 }} />
                        )}

                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={e => { e.stopPropagation(); openInTool(p); }}
                            style={{
                              flex: 1, padding: "8px 0", borderRadius: 7,
                              background: `${cfg.color}18`, border: `1px solid ${cfg.color}44`,
                              color: cfg.color, fontSize: 12, fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            ⚡ Abrir no Editor
                          </button>
                          {p.result_url && (
                            <a
                              href={p.result_url}
                              download
                              onClick={e => e.stopPropagation()}
                              style={{
                                width: 36, height: 36, borderRadius: 7,
                                border: "1px solid #333", background: "#111",
                                color: "#888", fontSize: 14,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                textDecoration: "none",
                              }}
                              title="Baixar"
                            >↓</a>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                            disabled={deleting === p.id}
                            style={{
                              width: 36, height: 36, borderRadius: 7,
                              border: "1px solid #3a1a1a", background: "#1a0a0a",
                              color: "#ef4444", fontSize: 14, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                            title="Apagar"
                          >
                            {deleting === p.id ? "…" : "✕"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
