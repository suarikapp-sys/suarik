"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { CreditsBar, InsufficientCreditsModal } from "@/components/CreditsBar";
import { useToast, ToastContainer } from "@/components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = "setup" | "processing" | "done" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function uploadToR2(blob: Blob, filename: string, contentType: string): Promise<string> {
  const { uploadUrl, publicUrl } = await fetch("/api/upload", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType }),
  }).then(r => r.json());
  // Upload direto ao R2 via presigned URL (CORS configurado no bucket)
  const r2Res = await fetch(uploadUrl, {
    method:  "PUT",
    headers: { "Content-Type": contentType },
    body:    blob,
  });
  if (!r2Res.ok) throw new Error(`Upload falhou (HTTP ${r2Res.status})`);
  return publicUrl as string;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Preset motion prompts ────────────────────────────────────────────────────
const MOTION_PRESETS = [
  { label: "Acenar",       prompt: "wave hello naturally, friendly smile"                             },
  { label: "Falar",        prompt: "talk expressively, natural head movements while speaking"         },
  { label: "Dançar",       prompt: "dance to upbeat music, energetic upper body movement"             },
  { label: "Respirar",     prompt: "subtle breathing, calm natural idle motion"                       },
  { label: "Rir",          prompt: "laugh naturally, shoulders moving with laughter"                  },
  { label: "Acenar cabeça",prompt: "nod head in agreement, positive affirmation gesture"             },
  { label: "Apresentar",   prompt: "present something with open arms, welcoming gesture"              },
  { label: "Pensar",       prompt: "thinking pose, hand on chin, looking contemplative"               },
];

const DURATION_OPTIONS = [2, 4, 6, 8, 10];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DreamActPage() {
  const router   = useRouter();
  const supabase = createClient();

  // ── Auth ──
  const [initials, setInitials] = useState("US");
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setInitials((user.email ?? "U")[0].toUpperCase());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Credits ──
  const { credits, plan, spend, cost, refresh } = useCredits();

  const refund = async (action: string) => {
    try {
      await fetch("/api/credits/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      refresh();
    } catch { /* non-fatal */ }
  };
  const { toasts, remove: removeToast, toast } = useToast();
  const [showCreditModal, setShowCreditModal] = useState(false);

  // ── Step 1: image ──
  const [imageFile,     setImageFile]     = useState<File | null>(null);
  const [imagePreview,  setImagePreview]  = useState<string | null>(null);
  const [imageUrl,      setImageUrl]      = useState<string | null>(null);
  const [uploadingImg,  setUploadingImg]  = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── Step 2: prompt ──
  const [prompt,   setPrompt]   = useState("");
  const [duration, setDuration] = useState(4);

  // ── Generation ──
  const [stage,      setStage]      = useState<Stage>("setup");
  const [progress,   setProgress]   = useState(0);
  const [statusMsg,  setStatusMsg]  = useState("");
  const [errorMsg,   setErrorMsg]   = useState("");
  const [resultVideo,setResultVideo]= useState<string | null>(null);

  // ── Upload image ──
  const handleImageSelect = useCallback(async (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setUploadingImg(true);
    try {
      const url = await uploadToR2(file, `dreamact-img-${Date.now()}.${file.name.split(".").pop()}`, file.type || "image/jpeg");
      setImageUrl(url);
    } catch {
      setErrorMsg("Erro ao enviar imagem.");
      toast.error("Falha ao fazer upload da imagem. Tenta novamente.");
      setImageFile(null); setImagePreview(null); setImageUrl(null);
    }
    finally { setUploadingImg(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Poll ──
  const pollResult = useCallback(async (taskId: string) => {
    let elapsed = 0;
    while (elapsed < 300_000) {
      await sleep(4000);
      elapsed += 4000;
      setProgress(Math.min(90, 10 + (elapsed / 120_000) * 80));
      try {
        const res  = await fetch("/api/dreamact/poll", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body:   JSON.stringify({ taskId }),
        });
        const data = await res.json() as { status: number; videoUrl: string | null };
        if (data.status === 1) setStatusMsg("⏳ Na fila...");
        if (data.status === 2) setStatusMsg("🎬 Animando...");
        if (data.status === 3 && data.videoUrl) {
          setProgress(100);
          setResultVideo(data.videoUrl);
          setStage("done");
          toast.success("Avatar animado com sucesso! 🎭");
          // Save to projects
          fetch("/api/projects", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tool: "dreamact", title: `DreamAct — ${prompt.slice(0, 50)}`,
              result_url: data.videoUrl, meta: { taskId, duration },
            }),
          }).catch(() => {});
          return;
        }
        if (data.status === 4) {
          setStage("error");
          setErrorMsg("Geração falhou. Tente com outra imagem ou prompt.");
          toast.error("Geração falhou. Tente com outra imagem ou prompt.");
          await refund("dreamact");
          return;
        }
      } catch { /* retry */ }
    }
    await refund("dreamact");
    setStage("error");
    setErrorMsg("Tempo limite excedido.");
    toast.error("Tempo limite excedido. Tente novamente.");
  }, [prompt, duration]);

  // ── Generate ──
  const handleGenerate = useCallback(async () => {
    if (!imageUrl || !prompt.trim()) return;
    const cr = await spend("dreamact");
    if (!cr.ok) { setShowCreditModal(true); return; }

    setStage("processing");
    setProgress(5);
    setStatusMsg("🚀 Enviando para Newport AI...");
    setErrorMsg("");

    try {
      const res  = await fetch("/api/dreamact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ imageUrl, prompt: prompt.trim(), duration }),
      });
      const data = await res.json() as { taskId?: string; error?: string };
      if (!data.taskId) {
        setStage("error");
        setErrorMsg(data.error ?? "Erro ao iniciar job");
        return;
      }
      setProgress(10);
      setStatusMsg("✅ Job criado! Processando...");
      await pollResult(data.taskId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setStage("error");
      setErrorMsg(msg);
      toast.error(msg);
      await refund("dreamact");
    }
  }, [imageUrl, prompt, duration, spend, pollResult, toast]);

  const canGenerate = !!imageUrl && !!prompt.trim() && !uploadingImg;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "#131313", color: "#fff", fontFamily: "'Inter', sans-serif",
      overflow: "hidden",
    }}>

      {/* ── PROCESSING OVERLAY ── */}
      {stage === "processing" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(13,13,13,0.97)", backdropFilter: "blur(24px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ position: "relative", width: 100, height: 100, marginBottom: 32 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "3px solid transparent", borderTopColor: "#a78bfa", borderRightColor: "#a78bfa55",
              animation: "spin 1s linear infinite",
            }} />
            <div style={{
              position: "absolute", inset: 10, borderRadius: "50%",
              border: "3px solid transparent", borderTopColor: "#F0563A", borderLeftColor: "#F0563A55",
              animation: "spin 1.5s linear infinite reverse",
            }} />
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 32,
            }}>🎭</div>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Animando Avatar</h2>
          <p style={{ color: "#666", fontSize: 14, marginBottom: 32 }}>{statusMsg}</p>
          <div style={{ width: 320, height: 4, background: "#222", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: "linear-gradient(90deg, #a78bfa, #F0563A)",
              width: `${progress}%`, transition: "width 0.5s ease",
            }} />
          </div>
          <span style={{ fontSize: 12, color: "#444", marginTop: 8 }}>{Math.round(progress)}%</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── RESULT OVERLAY ── */}
      {stage === "done" && resultVideo && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(13,13,13,0.97)", backdropFilter: "blur(24px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 32,
        }}>
          <div style={{ width: "100%", maxWidth: 560 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>DreamAct Concluído</span>
            </div>
            <video
              src={resultVideo} controls autoPlay
              style={{ width: "100%", borderRadius: 16, background: "#000", maxHeight: "55vh", marginBottom: 20 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  sessionStorage.setItem("vb_pending_video", resultVideo);
                  sessionStorage.setItem("vb_restore_requested", "1");
                  router.push("/storyboard");
                }}
                style={{
                  flex: 1, height: 50, borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #F0563A, #c44527)",
                  color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}
              >⚡ Entrar no Editor →</button>
              <a
                href={resultVideo} download="dreamact.mp4"
                style={{
                  padding: "0 20px", height: 50, borderRadius: 12,
                  border: "1px solid #333", background: "#1a1a1a",
                  color: "#ccc", fontSize: 14, fontWeight: 600,
                  display: "flex", alignItems: "center", textDecoration: "none",
                }}
              >↓ Download</a>
              <button
                onClick={() => { setStage("setup"); setResultVideo(null); setProgress(0); }}
                style={{
                  padding: "0 20px", height: 50, borderRadius: 12,
                  border: "1px solid #333", background: "#1a1a1a",
                  color: "#888", fontSize: 14, cursor: "pointer",
                }}
              >↺ Novo</button>
            </div>
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
        </div>
      )}

      {/* ── ERROR OVERLAY ── */}
      {stage === "error" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(13,13,13,0.95)", backdropFilter: "blur(24px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Algo correu mal</h2>
          <p style={{ color: "#666", fontSize: 14, marginBottom: 24, textAlign: "center", maxWidth: 320 }}>{errorMsg}</p>
          <button
            onClick={() => { setStage("setup"); setProgress(0); setErrorMsg(""); }}
            style={{
              padding: "12px 32px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #F0563A, #c44527)",
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >Tentar novamente</button>
        </div>
      )}

      {/* ── TOPBAR ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: 52, borderBottom: "1px solid #222",
        background: "#1C1B1B", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{
            background: "transparent", border: "none", color: "#777", fontSize: 13,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 600,
          }}>← Voltar</button>
          <span style={{ color: "#333", fontSize: 16 }}>|</span>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: "#F0563A",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 14, color: "#fff",
          }}>S</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>SUARIK</span>
          <span style={{ color: "#444", fontSize: 18 }}>/</span>
          <span style={{ color: "#a78bfa", fontSize: 14, fontWeight: 600 }}>🎭 DreamAct</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <CreditsBar credits={credits} plan={plan} compact />
          <button onClick={() => router.push("/dreamface")} style={{
            padding: "5px 14px", borderRadius: 6, border: "1px solid #333",
            background: "transparent", color: "#aaa", fontSize: 12, cursor: "pointer",
          }}>DreamFace</button>
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
            fontWeight: 700, fontSize: 13, color: "#fff",
          }}>{initials}</div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{
          width: 220, background: "#1C1B1B", borderRight: "1px solid #222",
          display: "flex", flexDirection: "column", padding: "16px 12px",
          flexShrink: 0, overflowY: "auto",
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 4 }}>🎭 DreamAct</h3>
          <p style={{ fontSize: 11, color: "#444", marginBottom: 16, lineHeight: 1.5 }}>
            Anime qualquer foto com movimentos naturais usando IA.
          </p>

          {/* Steps */}
          <p style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
            Como funciona
          </p>
          {[
            "1. Upload uma foto",
            "2. Descreva o movimento",
            "3. Escolha a duração",
            "4. Gere e exporte",
          ].map((s, i) => (
            <div key={i} style={{ fontSize: 11, color: "#555", marginBottom: 6, lineHeight: 1.5 }}>
              {s}
            </div>
          ))}

          <div style={{ height: 1, background: "#222", margin: "16px 0" }} />

          {/* Credit info */}
          <div style={{
            padding: "10px 12px", borderRadius: 8,
            background: "#a78bfa10", border: "1px solid #a78bfa22",
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600, margin: "0 0 4px" }}>
              {cost("dreamact")} créditos por geração
            </p>
            <p style={{ fontSize: 10, color: "#555", margin: 0, lineHeight: 1.5 }}>
              Resultado em ~1-3 min
            </p>
          </div>

          <div style={{ flex: 1 }} />

          {/* Nav to other tools */}
          <div style={{ borderTop: "1px solid #222", paddingTop: 12 }}>
            <p style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Ferramentas
            </p>
            {[
              { icon: "🎤", label: "LipSync",    route: "/dreamface"  },
              { icon: "🎙️", label: "Audio",      route: "/audio"      },
              { icon: "🧬", label: "Voice Clone",route: "/voiceclone" },
              { icon: "🎬", label: "Editor",     route: "/timeline"   },
            ].map(t => (
              <button key={t.route} onClick={() => router.push(t.route)} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "7px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                background: "transparent", color: "#666", fontSize: 12, textAlign: "left",
              }}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* LEFT — image upload + preview */}
          <div style={{
            width: "40%", borderRight: "1px solid #1a1a1a",
            display: "flex", flexDirection: "column", padding: 24, gap: 16, overflowY: "auto",
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Imagem do Avatar</h2>

            {/* Drop zone */}
            <div
              onClick={() => imageInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith("image/")) handleImageSelect(file);
              }}
              style={{
                flex: 1, minHeight: 280, borderRadius: 14,
                border: `2px dashed ${imagePreview ? "#a78bfa44" : "#2a2a2a"}`,
                background: "#111", cursor: "pointer",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                overflow: "hidden", position: "relative",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#a78bfa88")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = imagePreview ? "#a78bfa44" : "#2a2a2a")}
            >
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview} alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🖼️</div>
                  <p style={{ fontSize: 14, color: "#aaa", margin: 0, fontWeight: 600 }}>Arraste ou clique</p>
                  <p style={{ fontSize: 12, color: "#444", marginTop: 6 }}>JPG, PNG, WEBP</p>
                  <p style={{ fontSize: 11, color: "#333", marginTop: 4 }}>Melhor: rosto frontal, fundo limpo</p>
                </>
              )}
              {uploadingImg && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(13,13,13,0.85)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", marginBottom: 8,
                    border: "2px solid #333", borderTopColor: "#a78bfa",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  <span style={{ fontSize: 12, color: "#888" }}>Enviando...</span>
                </div>
              )}
              <input
                ref={imageInputRef} type="file" accept="image/*"
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); }}
              />
            </div>

            {/* Image status */}
            {imageUrl && !uploadingImg && (
              <div style={{
                padding: "10px 14px", borderRadius: 8,
                background: "#a78bfa10", border: "1px solid #a78bfa30",
                display: "flex", alignItems: "center", gap: 8, fontSize: 12,
              }}>
                <span style={{ color: "#34d399" }}>✓</span>
                <span style={{ color: "#a78bfa" }}>Imagem pronta para animar</span>
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); setImageUrl(null); }}
                  style={{
                    marginLeft: "auto", background: "transparent", border: "none",
                    color: "#555", cursor: "pointer", fontSize: 14,
                  }}
                >✕</button>
              </div>
            )}

            {/* Tips */}
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <p style={{ fontSize: 11, color: "#666", fontWeight: 600, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 0.8 }}>
                💡 Dicas para melhor resultado
              </p>
              <ul style={{ fontSize: 11, color: "#444", margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
                <li>Rosto frontal ou ¾ funciona melhor</li>
                <li>Fundo limpo ou neutro</li>
                <li>Boa iluminação</li>
                <li>Sem oclusões (óculos escuros, máscara)</li>
              </ul>
            </div>
          </div>

          {/* RIGHT — prompt + generate */}
          <div style={{ flex: 1, padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Movimento & Ação</h2>

            {/* Preset prompts */}
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                Movimentos rápidos
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {MOTION_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setPrompt(p.prompt)}
                    style={{
                      padding: "7px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                      border:      prompt === p.prompt ? "1.5px solid #a78bfa" : "1px solid #2a2a2a",
                      background:  prompt === p.prompt ? "#a78bfa18"           : "#1a1a1a",
                      color:       prompt === p.prompt ? "#a78bfa"             : "#888",
                      fontWeight:  prompt === p.prompt ? 600                   : 400,
                      transition:  "all 0.15s",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom prompt */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Descreva o movimento (EN ou PT)
                </label>
                <span style={{ fontSize: 11, color: "#555" }}>{prompt.length} / 200</span>
              </div>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value.slice(0, 200))}
                placeholder="Ex: wave hello, smile naturally, nod head in agreement..."
                rows={3}
                style={{
                  width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
                  borderRadius: 8, padding: "12px 14px", color: "#fff",
                  fontSize: 13, lineHeight: 1.6, resize: "vertical",
                  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              <p style={{ fontSize: 11, color: "#444", marginTop: 4 }}>
                Dica: escreva em inglês para melhor resultado
              </p>
            </div>

            {/* Duration */}
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                Duração do vídeo
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {DURATION_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.15s",
                      border:     duration === d ? "1.5px solid #a78bfa" : "1px solid #2a2a2a",
                      background: duration === d ? "#a78bfa18"           : "#1a1a1a",
                      color:      duration === d ? "#a78bfa"             : "#666",
                    }}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            {imageUrl && prompt.trim() && (
              <div style={{
                padding: "14px 16px", borderRadius: 10,
                background: "#a78bfa08", border: "1px solid #a78bfa22",
              }}>
                <p style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600, margin: "0 0 6px" }}>
                  Pronto para animar
                </p>
                <p style={{ fontSize: 12, color: "#555", margin: 0, lineHeight: 1.6 }}>
                  Avatar: {imageFile?.name ?? "imagem"} · {duration}s · {cost("dreamact")} créditos
                </p>
              </div>
            )}

            <div style={{ flex: 1 }} />

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              style={{
                width: "100%", height: 54, borderRadius: 12, border: "none",
                cursor: canGenerate ? "pointer" : "not-allowed",
                background: canGenerate
                  ? "linear-gradient(135deg, #a78bfa, #6305ef)"
                  : "#222",
                color:  canGenerate ? "#fff" : "#444",
                fontSize: 15, fontWeight: 700, letterSpacing: 0.5,
                boxShadow: canGenerate ? "0 0 32px rgba(167,139,250,0.3)" : "none",
                transition: "all 0.2s",
              }}
            >
              {uploadingImg
                ? "⏳ Enviando imagem..."
                : `🎭 Animar Avatar (${cost("dreamact")} créditos)`
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Credits modal ── */}
      {showCreditModal && (
        <InsufficientCreditsModal
          action="dreamact"
          cost={cost("dreamact")}
          credits={credits}
          onClose={() => setShowCreditModal(false)}
        />
      )}

      {/* ── Toasts ── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea:focus { border-color: #a78bfa44 !important; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
