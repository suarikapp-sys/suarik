"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { CreditsBar, InsufficientCreditsModal } from "@/components/CreditsBar";
import { useToast, ToastContainer } from "@/components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = "setup" | "cloning" | "ready" | "generating" | "done" | "error";

type SavedVoice = {
  voiceId:   string;
  voiceName: string;
  createdAt: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Uploads blob to R2 and returns a clean proxy URL (/api/voiceclone/audio?key=...)
// so external APIs like Newport AI can fetch it without presigned-URL complexity.
async function uploadToR2(blob: Blob, filename: string, contentType: string): Promise<string> {
  const res = await fetch("/api/upload", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ filename, contentType }),
  });
  if (!res.ok) throw new Error(`Falha ao obter URL de upload (HTTP ${res.status})`);
  const { uploadUrl, key, downloadUrl, publicUrl } = await res.json() as {
    uploadUrl: string; key: string; downloadUrl?: string; publicUrl: string;
  };
  if (!uploadUrl || !key) throw new Error("Resposta inválida do servidor de upload");
  // Route through proxy to avoid CORS/403 on direct R2 PUT from browser
  const proxyRes = await fetch(`/api/upload/proxy?target=${encodeURIComponent(uploadUrl)}`, {
    method:  "PUT",
    headers: { "Content-Type": contentType },
    body:    blob,
  });
  if (!proxyRes.ok) throw new Error(`Upload falhou (HTTP ${proxyRes.status})`);
  // In production: use clean proxy URL (simple, no presigned complexity, no long AWS params)
  // In development: Newport AI can't reach localhost — use presigned R2 URL instead
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (!isLocalhost) {
    return `${window.location.origin}/api/voiceclone/audio?key=${encodeURIComponent(key)}`;
  }
  return (downloadUrl ?? publicUrl) as string;
}


function fmtSec(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// ─── Mini Waveform ────────────────────────────────────────────────────────────
function MiniWave({ progress, active }: { progress: number; active: boolean }) {
  const bars = 36;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 36 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const filled = i / bars <= progress;
        const h = Math.round(4 + Math.abs(Math.sin(i * 0.5 + 0.8) * 22 + Math.sin(i * 1.1) * 6));
        return (
          <div key={i} style={{
            flex: 1, borderRadius: 2, height: h,
            backgroundColor: filled
              ? "#34d399"
              : active ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)",
            transition: "background-color 0.1s",
          }} />
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function VoiceClonePage() {
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
  const [creditAction,    setCreditAction]    = useState("voiceclone");

  // ── Stage ──
  const [stage,    setStage]    = useState<Stage>("setup");
  const [errMsg,   setErrMsg]   = useState("");
  const [progress, setProgress] = useState(0);
  const [statusMsg,setStatusMsg]= useState("");

  // ── Step 1: sample audio ──
  const [sampleFile,    setSampleFile]    = useState<File | null>(null);
  const [sampleUrl,     setSampleUrl]     = useState<string | null>(null);  // R2 url
  const [sampleObjUrl,  setSampleObjUrl]  = useState<string | null>(null);  // local preview
  const [voiceName,     setVoiceName]     = useState("");
  const [uploadingSample, setUploadingSample] = useState(false);
  const sampleInputRef = useRef<HTMLInputElement>(null);

  // ── Step 2: recording ──
  const [recording,   setRecording]   = useState(false);
  const [recSeconds,  setRecSeconds]  = useState(0);
  const mediaRecRef   = useRef<MediaRecorder | null>(null);
  const recChunksRef  = useRef<Blob[]>([]);
  const recTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Step 3: cloned voice ──
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const [savedVoices,   setSavedVoices]   = useState<SavedVoice[]>([]);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);

  // ── Voice management (rename/delete) ──
  const [renamingId,  setRenamingId]  = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ── Step 4: TTS with clone ──
  const [ttsText,    setTtsText]    = useState("");
  const [ttsSpeed,   setTtsSpeed]   = useState(1.0);
  const [audioResult,setAudioResult]= useState<string | null>(null);
  const [audioDur,   setAudioDur]   = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]   = useState(false);
  const [playProg,setPlayProg]  = useState(0);

  // ── Load saved voices from localStorage ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem("suarik_cloned_voices");
      if (raw) setSavedVoices(JSON.parse(raw) as SavedVoice[]);
    } catch {}
  }, []);

  function persistVoice(v: SavedVoice) {
    const updated = [v, ...savedVoices.filter(x => x.voiceId !== v.voiceId)].slice(0, 10);
    setSavedVoices(updated);
    try { localStorage.setItem("suarik_cloned_voices", JSON.stringify(updated)); } catch {}
  }

  function deleteVoice(voiceId: string) {
    const updated = savedVoices.filter(x => x.voiceId !== voiceId);
    setSavedVoices(updated);
    try { localStorage.setItem("suarik_cloned_voices", JSON.stringify(updated)); } catch {}
    if (activeVoiceId === voiceId) {
      setActiveVoiceId(updated[0]?.voiceId ?? null);
      if (updated.length === 0) setStage("setup");
    }
    toast.success("Voz removida");
  }

  function commitRename(voiceId: string) {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    const updated = savedVoices.map(x => x.voiceId === voiceId ? { ...x, voiceName: name } : x);
    setSavedVoices(updated);
    try { localStorage.setItem("suarik_cloned_voices", JSON.stringify(updated)); } catch {}
    setRenamingId(null);
    toast.success("Nome actualizado");
  }

  // ── Handle sample file select ──
  async function handleSampleSelect(file: File) {
    setSampleFile(file);
    const obj = URL.createObjectURL(file);
    setSampleObjUrl(obj);
    setUploadingSample(true);
    setErrMsg("");
    try {
      const ext = (file as File & { name?: string }).name?.split(".").pop()
        ?? file.type.split("/")[1]?.replace("mpeg", "mp3")
        ?? "webm";
      const contentType = file.type || "audio/webm";
      const url = await uploadToR2(file, `sample-${Date.now()}.${ext}`, contentType);
      setSampleUrl(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar áudio de amostra.";
      setErrMsg(msg);
    } finally {
      setUploadingSample(false);
    }
  }

  // ── Recording ──
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recChunksRef.current, { type: "audio/webm" });
        await handleSampleSelect(blob as unknown as File);
      };
      mr.start(100);
      mediaRecRef.current = mr;
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      setErrMsg("Não foi possível acessar o microfone.");
    }
  }

  function stopRecording() {
    mediaRecRef.current?.stop();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setRecording(false);
  }

  // ── Clone voice ──
  const cloneVoice = useCallback(async () => {
    if (!sampleUrl || !voiceName.trim()) return;
    setStage("cloning");
    setProgress(10);
    setStatusMsg("A descarregar e analisar amostra de voz...");

    try {
      const res = await fetch("/api/voiceclone", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ audioUrl: sampleUrl, voiceName: voiceName.trim() }),
      });
      if (res.status === 402) {
        setStage("setup");
        setCreditAction("voiceclone"); setShowCreditModal(true); return;
      }
      const j = await res.json() as { voiceId?: string; taskId?: string; error?: string; debug?: Record<string, unknown> };

      // MiniMax returns voiceId directly (synchronous) — no polling needed
      if (j.voiceId) {
        const cloned: SavedVoice = {
          voiceId:   j.voiceId,
          voiceName: voiceName.trim(),
          createdAt: Date.now(),
        };
        persistVoice(cloned);
        setClonedVoiceId(j.voiceId);
        setActiveVoiceId(j.voiceId);
        setProgress(100);
        setStatusMsg("Voz clonada com sucesso!");
        setStage("ready");
        toast.success(`Voz "${voiceName}" clonada com sucesso! 🧬`);
        return;
      }

      // No voiceId returned — error
      if (j.debug) console.error("[voiceclone] Debug:", JSON.stringify(j.debug, null, 2));
      throw new Error(j.error ?? "Erro ao iniciar clonagem");

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setErrMsg(msg);
      setStage("error");
      toast.error(msg);
    }
  }, [sampleUrl, voiceName, savedVoices, toast]);

  // ── Generate TTS with cloned voice ──
  const generateTTS = useCallback(async () => {
    if (!ttsText.trim() || !activeVoiceId) return;
    const creditResult = await spend("tts");
    if (!creditResult.ok) { setCreditAction("tts"); setShowCreditModal(true); return; }
    setStage("generating");
    setProgress(10);
    setStatusMsg("Gerando áudio com sua voz...");

    try {
      const isMiniMaxVoice = [
        "English_expressive_narrator",
        "English_Graceful_Lady",
        "English_Insightful_Speaker",
        "English_radiant_girl",
        "English_Persuasive_Man",
        "English_Lucky_Robot",
        "Chinese (Mandarin)_Lyrical_Voice",
        "Chinese (Mandarin)_HK_Flight_Attendant",
        "Japanese_Whisper_Belle",
      ].includes(activeVoiceId);
      const ttsEndpoint = isMiniMaxVoice ? "/api/tts" : "/api/tts-cloned";

      const res = await fetch(ttsEndpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: ttsText.trim(), voiceId: activeVoiceId, speed: ttsSpeed }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? `Erro ${res.status}`);
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);

      const dur = await new Promise<number>(resolve => {
        const a = new Audio(url);
        a.addEventListener("loadedmetadata", () => resolve(a.duration), { once: true });
        a.addEventListener("error", () => resolve(0), { once: true });
      });

      // Upload to R2 for persistence
      let persistUrl: string | null = null;
      try {
        persistUrl = await uploadToR2(blob, `clone-tts-${Date.now()}.mp3`, "audio/mpeg");
      } catch { /* non-fatal */ }

      // Save to projects
      if (persistUrl) {
        fetch("/api/projects", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool:       "voiceclone",
            title:      ttsText.trim().slice(0, 60),
            result_url: persistUrl,
            meta:       { voiceId: activeVoiceId, voiceName, duration: dur },
          }),
        }).catch(() => {});
      }

      setAudioResult(persistUrl ?? url);
      setAudioDur(dur);
      setStage("done");
      toast.success("Áudio gerado com sua voz clonada! 🎙️");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar áudio";
      setErrMsg(msg);
      setStage("error");
      toast.error(msg);
      await refund("tts");
    }
  }, [ttsText, activeVoiceId, ttsSpeed, toast]);

  // ── Audio player controls ──
  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else         { a.play().then(() => setPlaying(true)).catch(() => {}); }
  }

  function handleSendToEditor() {
    if (audioResult && typeof window !== "undefined") {
      // Only store if it's a persisted URL (not a blob: URL which dies on navigation)
      const url = audioResult.startsWith("blob:") ? null : audioResult;
      if (url) {
        sessionStorage.setItem("vb_pending_audio", JSON.stringify({ url, label: voiceName, duration: audioDur }));
      }
    }
    router.push("/storyboard");
  }

  async function handleDownload() {
    if (!audioResult) return;
    try {
      // Fetch the audio and create a local blob download (works for cross-origin URLs)
      const res  = await fetch(audioResult);
      const blob = await res.blob();
      const obj  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = obj;
      a.download = `suarik-${voiceName || "clone"}-${Date.now()}.mp3`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(obj), 10000);
    } catch {
      window.open(audioResult, "_blank");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const isCloning    = stage === "cloning";
  const isGenerating = stage === "generating";
  const isBusy       = isCloning || isGenerating;

  // ── Processing overlay ──
  if (isBusy) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#0d0d0d",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: "#fff", fontFamily: "'Inter', sans-serif",
      }}>
        {/* Spinner */}
        <div style={{ position: "relative", width: 80, height: 80, marginBottom: 32 }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "3px solid transparent",
            borderTopColor: "#34d399", borderRightColor: "#34d39966",
            animation: "spin 1s linear infinite",
          }} />
          <div style={{
            position: "absolute", inset: 8, borderRadius: "50%",
            border: "3px solid transparent",
            borderTopColor: "#6305ef", borderLeftColor: "#6305ef66",
            animation: "spin 1.4s linear infinite reverse",
          }} />
          <div style={{
            position: "absolute", inset: "50%", transform: "translate(-50%,-50%)",
            fontSize: 22,
          }}>🧬</div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          {isCloning ? "Clonando Voz" : "Gerando Áudio"}
        </h2>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 32, textAlign: "center", maxWidth: 300 }}>
          {statusMsg}
        </p>

        {/* Progress bar */}
        <div style={{ width: 320, height: 4, background: "#222", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: "linear-gradient(90deg, #34d399, #6305ef)",
            width: `${progress}%`, transition: "width 0.5s ease",
          }} />
        </div>
        <span style={{ fontSize: 12, color: "#444", marginTop: 8 }}>{progress}%</span>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
          <span style={{ color: "#444", fontSize: 18, marginLeft: 4 }}>/</span>
          <span style={{ color: "#34d399", fontSize: 14, fontWeight: 600 }}>🧬 Voice Clone</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <CreditsBar credits={credits} plan={plan} compact />
          <button onClick={() => router.push("/audio")} style={{
            padding: "5px 14px", borderRadius: 6, border: "1px solid #333",
            background: "transparent", color: "#aaa", fontSize: 12, cursor: "pointer",
          }}>Audio Studio</button>
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

        {/* ── LEFT — saved voices ── */}
        <aside style={{
          width: 220, background: "#1C1B1B", borderRight: "1px solid #222",
          display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto",
          padding: "16px 12px",
        }}>
          <p style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>
            Vozes Salvas
          </p>

          {savedVoices.length === 0 ? (
            <div style={{ color: "#333", fontSize: 12, textAlign: "center", padding: "24px 0", lineHeight: 1.6 }}>
              🧬<br />Nenhuma voz clonada ainda
            </div>
          ) : (
            savedVoices.map(v => {
              const isActive  = activeVoiceId === v.voiceId;
              const isRenaming = renamingId === v.voiceId;
              return (
                <div
                  key={v.voiceId}
                  className="voice-item"
                  style={{
                    borderRadius: 8, marginBottom: 6, overflow: "hidden",
                    border: isActive ? "1.5px solid #34d399" : "1px solid #2a2a2a",
                    background: isActive ? "#34d39910" : "#111",
                  }}
                >
                  {/* Main row */}
                  <div
                    onClick={() => !isRenaming && (() => { setActiveVoiceId(v.voiceId); if (stage === "setup" || stage === "error") setStage("ready"); })()}
                    style={{ padding: "10px 12px", cursor: isRenaming ? "default" : "pointer" }}
                  >
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") commitRename(v.voiceId); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={() => commitRename(v.voiceId)}
                        maxLength={40}
                        onClick={e => e.stopPropagation()}
                        style={{
                          width: "100%", background: "#1a1a1a", border: "1px solid #34d399",
                          borderRadius: 4, padding: "3px 6px", color: "#fff",
                          fontSize: 12, outline: "none", boxSizing: "border-box",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? "#34d399" : "#ccc", display: "block" }}>
                        {v.voiceName}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: "#444", marginTop: 2, display: "block" }}>
                      {new Date(v.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {/* Action row — always visible */}
                  <div style={{ display: "flex", borderTop: "1px solid #1a1a1a" }}>
                    <button
                      onClick={e => { e.stopPropagation(); setRenamingId(v.voiceId); setRenameValue(v.voiceName); }}
                      title="Renomear"
                      style={{ flex: 1, padding: "5px 0", background: "transparent", border: "none", color: "#555", fontSize: 11, cursor: "pointer", transition: "color 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#aaa")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#555")}
                    >✏️</button>
                    <button
                      onClick={e => { e.stopPropagation(); if (confirm(`Apagar "${v.voiceName}"?`)) deleteVoice(v.voiceId); }}
                      title="Apagar"
                      style={{ flex: 1, padding: "5px 0", background: "transparent", border: "none", color: "#555", fontSize: 11, cursor: "pointer", transition: "color 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#F0563A")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#555")}
                    >🗑️</button>
                  </div>
                </div>
              );
            })
          )}

          <div style={{ flex: 1 }} />
          <div style={{ borderTop: "1px solid #222", paddingTop: 12, marginTop: 12 }}>
            <p style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Ferramentas
            </p>
            {[
              { icon: "🎙️", label: "Audio Studio", route: "/audio"     },
              { icon: "🎭", label: "LipSync",      route: "/dreamface" },
              { icon: "🎬", label: "Editor",       route: "/timeline"  },
            ].map(t => (
              <button key={t.route} onClick={() => router.push(t.route)} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                background: "transparent", color: "#666", fontSize: 12, textAlign: "left",
              }}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ flex: 1, overflowY: "auto", padding: 32, minWidth: 0 }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>

            {/* ── Error state ── */}
            {stage === "error" && (
              <div style={{
                marginBottom: 20, padding: "14px 18px", borderRadius: 10,
                background: "#F0563A12", border: "1px solid #F0563A44", color: "#F0563A", fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span>⚠ {errMsg}</span>
                <button onClick={() => { setStage("setup"); setErrMsg(""); }} style={{
                  background: "transparent", border: "none", color: "#F0563A",
                  cursor: "pointer", fontSize: 12, textDecoration: "underline",
                }}>Tentar novamente</button>
              </div>
            )}

            {/* ══ SECTION 1: Clone ══════════════════════════════════════════ */}
            {(stage === "setup" || stage === "error" || stage === "ready") && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: "#34d39918",
                    border: "1px solid #34d39944", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 18, flexShrink: 0,
                  }}>🧬</div>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Clonar nova voz</h2>
                    <p style={{ fontSize: 12, color: "#555", margin: 0 }}>Mínimo 10 segundos de áudio limpo</p>
                  </div>
                </div>

                {/* Voice name */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, color: sampleObjUrl && !voiceName.trim() ? "#f59e0b" : "#888" }}>
                    Nome da voz {sampleObjUrl && !voiceName.trim() && <span style={{ fontWeight: 700 }}>← preenche aqui</span>}
                  </label>
                  <input
                    value={voiceName}
                    onChange={e => setVoiceName(e.target.value)}
                    placeholder="Ex: Minha Voz, Narrador João..."
                    maxLength={40}
                    style={{
                      width: "100%", background: "#1a1a1a",
                      border: `1px solid ${sampleObjUrl && !voiceName.trim() ? "#f59e0b66" : "#2a2a2a"}`,
                      borderRadius: 8, padding: "11px 14px", color: "#fff",
                      fontSize: 14, outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Upload or record */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  {/* Upload file */}
                  <div
                    onClick={() => sampleInputRef.current?.click()}
                    style={{
                      padding: "20px 16px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                      border: "1.5px dashed #2a2a2a", background: "#111",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "#34d39966")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  >
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                    <p style={{ fontSize: 13, color: "#aaa", margin: 0, fontWeight: 600 }}>Enviar arquivo</p>
                    <p style={{ fontSize: 11, color: "#444", marginTop: 4 }}>MP3, WAV, M4A, WebM</p>
                    <input
                      ref={sampleInputRef}
                      type="file"
                      accept="audio/*"
                      style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleSampleSelect(f); }}
                    />
                  </div>

                  {/* Record */}
                  <div
                    onClick={recording ? stopRecording : startRecording}
                    style={{
                      padding: "20px 16px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                      border: `1.5px solid ${recording ? "#ef444466" : "#2a2a2a"}`,
                      background: recording ? "#ef444412" : "#111",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 8 }}>
                      {recording ? "⏹" : "🎙️"}
                    </div>
                    <p style={{ fontSize: 13, color: recording ? "#ef4444" : "#aaa", margin: 0, fontWeight: 600 }}>
                      {recording ? `Gravando… ${fmtSec(recSeconds)}` : "Gravar agora"}
                    </p>
                    <p style={{ fontSize: 11, color: "#444", marginTop: 4 }}>
                      {recording ? "Clique para parar" : "Direto pelo microfone"}
                    </p>
                  </div>
                </div>

                {/* Preview sample */}
                {sampleObjUrl && (
                  <div style={{
                    marginBottom: 16, padding: "14px 16px", borderRadius: 10,
                    background: uploadingSample ? "#11111108" : sampleUrl ? "#34d39908" : errMsg ? "#ef444408" : "#f59e0b08",
                    border: `1px solid ${uploadingSample ? "#2a2a2a" : sampleUrl ? "#34d39930" : errMsg ? "#ef444430" : "#f59e0b30"}`,
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <span style={{ fontSize: 20 }}>
                      {uploadingSample ? "⏳" : sampleUrl ? "✓" : errMsg ? "⚠" : "⏫"}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: uploadingSample ? "#888" : sampleUrl ? "#34d399" : errMsg ? "#ef4444" : "#f59e0b" }}>
                        {sampleFile instanceof File ? sampleFile.name : "Gravação"}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: "#555", marginTop: 2 }}>
                        {uploadingSample ? "A enviar para o servidor…"
                          : sampleUrl    ? "Áudio carregado — pronto para clonar"
                          : errMsg       ? errMsg
                          : "A preparar upload…"}
                      </p>
                    </div>
                    <audio src={sampleObjUrl} controls style={{ height: 32 }} />
                  </div>
                )}

                {/* Audio requirements hint */}
                <div style={{
                  marginBottom: 14, padding: "10px 14px", borderRadius: 8,
                  background: "#1a1a1a", border: "1px solid #2a2a2a", fontSize: 11, color: "#666",
                  lineHeight: 1.6,
                }}>
                  <span style={{ color: "#888", fontWeight: 600 }}>Requisitos do áudio: </span>
                  Mín. 10 seg · MP3, WAV, M4A · Voz humana real (não IA/TTS)
                  <span style={{ color: "#555" }}> · Sem música ou ruído de fundo</span>
                </div>

                {/* Clone button */}
                <button
                  onClick={cloneVoice}
                  disabled={!sampleUrl || !voiceName.trim() || uploadingSample}
                  style={{
                    width: "100%", height: 50, borderRadius: 10, border: "none",
                    cursor: (!sampleUrl || !voiceName.trim() || uploadingSample) ? "not-allowed" : "pointer",
                    background: (!sampleUrl || !voiceName.trim() || uploadingSample)
                      ? "#222" : "linear-gradient(135deg, #34d399, #059669)",
                    color: (!sampleUrl || !voiceName.trim() || uploadingSample) ? "#555" : "#fff",
                    fontSize: 15, fontWeight: 700, letterSpacing: 0.5,
                  }}
                >
                  {uploadingSample        ? "A enviar amostra…"
                    : !sampleUrl && errMsg ? "⚠ Upload falhou — tenta de novo"
                    : !sampleUrl          ? "⏳ A aguardar upload…"
                    : !voiceName.trim()   ? "← Dá um nome à voz primeiro"
                    : "🧬 Clonar Voz"}
                </button>
              </div>
            )}

            {/* ══ SECTION 2: TTS com voz clonada ════════════════════════════ */}
            {(["ready", "done", "generating"].includes(stage)) && activeVoiceId && (
              <div style={{
                padding: 24, borderRadius: 12, background: "#1a1a1a",
                border: "1px solid #2a2a2a",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, background: "#6305ef18",
                    border: "1px solid #6305ef44", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 16,
                  }}>🎙️</div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Gerar com voz clonada</h2>
                    <p style={{ fontSize: 12, color: "#555", margin: 0 }}>
                      {savedVoices.find(v => v.voiceId === activeVoiceId)?.voiceName ?? activeVoiceId}
                    </p>
                  </div>
                </div>

                {/* Text area */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.8 }}>
                      Texto
                    </label>
                    <span style={{ fontSize: 11, color: "#555" }}>{ttsText.length} / 10.000</span>
                  </div>
                  <textarea
                    value={ttsText}
                    onChange={e => setTtsText(e.target.value)}
                    maxLength={10000}
                    placeholder="Digite o texto para gerar com sua voz clonada..."
                    rows={5}
                    style={{
                      width: "100%", background: "#111", border: "1px solid #2a2a2a",
                      borderRadius: 8, padding: "12px 14px", color: "#fff",
                      fontSize: 14, lineHeight: 1.7, resize: "vertical",
                      outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Speed */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.8 }}>
                      Velocidade
                    </label>
                    <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>{ttsSpeed.toFixed(1)}×</span>
                  </div>
                  <input
                    type="range" min={0.5} max={2.0} step={0.1} value={ttsSpeed}
                    onChange={e => setTtsSpeed(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#a78bfa" }}
                  />
                </div>

                <button
                  onClick={generateTTS}
                  disabled={!ttsText.trim()}
                  style={{
                    width: "100%", height: 48, borderRadius: 10, border: "none",
                    cursor: !ttsText.trim() ? "not-allowed" : "pointer",
                    background: !ttsText.trim()
                      ? "#222" : "linear-gradient(135deg, #6305ef, #4c04b8)",
                    color: !ttsText.trim() ? "#444" : "#fff",
                    fontSize: 14, fontWeight: 700,
                  }}
                >
                  ✦ Gerar Áudio com Voz Clonada
                </button>

                {/* ── Result player ── */}
                {stage === "done" && audioResult && (
                  <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: "#111", border: "1px solid #34d39930" }}>
                    <audio
                      ref={audioRef}
                      src={audioResult}
                      onTimeUpdate={() => {
                        const a = audioRef.current;
                        if (a && a.duration) setPlayProg(a.currentTime / a.duration);
                      }}
                      onEnded={() => { setPlaying(false); setPlayProg(0); }}
                    />

                    <div onClick={() => {
                      const a = audioRef.current;
                      if (!a || !a.duration) return;
                    }} style={{ cursor: "pointer", marginBottom: 10 }}>
                      <MiniWave progress={playProg} active={playing} />
                    </div>

                    {/* Row 1: play + download */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <button onClick={togglePlay} style={{
                        flex: 1, height: 42, borderRadius: 8, border: "none",
                        background: "#34d399", color: "#fff", fontSize: 18, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        fontWeight: 700,
                      }}>
                        {playing ? "⏸" : "▶"} <span style={{ fontSize: 13 }}>{playing ? "Pausar" : "Ouvir"}</span>
                      </button>
                      <button onClick={handleDownload} style={{
                        flex: 1, height: 42, borderRadius: 8, border: "1px solid #333",
                        background: "#1a1a1a", color: "#ccc", fontSize: 13, fontWeight: 600,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}>
                        ⬇ Descarregar MP3
                      </button>
                    </div>

                    {/* Row 2: send to editor + dreamface */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handleSendToEditor}
                        disabled={audioResult?.startsWith("blob:")}
                        title={audioResult?.startsWith("blob:") ? "A guardar áudio…" : "Enviar ao Editor"}
                        style={{
                          flex: 1, height: 42, borderRadius: 8,
                          border: "1px solid #6305ef55",
                          background: audioResult?.startsWith("blob:") ? "#111" : "#6305ef22",
                          color: audioResult?.startsWith("blob:") ? "#444" : "#a78bfa",
                          fontSize: 13, fontWeight: 700, cursor: audioResult?.startsWith("blob:") ? "not-allowed" : "pointer",
                        }}
                      >
                        ⚡ Enviar ao Editor
                      </button>
                      <button onClick={() => router.push("/dreamface")} style={{
                        flex: 1, height: 42, borderRadius: 8,
                        border: "1px solid #F0563A44",
                        background: "#F0563A11", color: "#F0563A",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      }}>
                        🎭 Ir para LipSync
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>

      </div>

      {showCreditModal && (
        <InsufficientCreditsModal
          action={creditAction}
          cost={cost(creditAction)}
          credits={credits}
          onClose={() => setShowCreditModal(false)}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=range] { cursor: pointer; height: 4px; }
        textarea:focus { border-color: #34d39944 !important; }
        input:focus { border-color: #34d39944 !important; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
