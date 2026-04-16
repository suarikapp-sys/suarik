"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { useToast, ToastContainer } from "@/components/Toast";
import { UpsellModal } from "@/components/UpsellModal";
import SuarikLogo from "@/components/SuarikLogo";

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = "setup" | "cloning" | "ready" | "generating" | "done" | "error";
type SavedVoice = { voiceId: string; voiceName: string; createdAt: number };

const C = {
  bg:"#060606", bg2:"#09090B", bg3:"#0F0F0F", bg4:"#141414", bg5:"#1C1C1C",
  b:"#131313",  b2:"#1A1A1A", b3:"#222",
  t:"#EAEAEA",  t2:"#7A7A7A", t3:"#444", t4:"#252525",
  o:"#E8512A",  o2:"#FF6B3D", os:"rgba(232,81,42,.07)", om:"rgba(232,81,42,.16)",
  grn:"#3ECF8E", gs:"rgba(62,207,142,.07)",  gm:"rgba(62,207,142,.18)",
  blu:"#4A9EFF", bs:"rgba(74,158,255,.07)",  bm:"rgba(74,158,255,.18)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function uploadToR2(blob: Blob, filename: string, contentType: string): Promise<string> {
  const res = await fetch("/api/upload", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType }),
  });
  if (!res.ok) throw new Error(`Falha ao obter URL de upload (HTTP ${res.status})`);
  const { uploadUrl, key, downloadUrl, publicUrl } = await res.json() as { uploadUrl: string; key: string; downloadUrl?: string; publicUrl: string };
  if (!uploadUrl || !key) throw new Error("Resposta inválida do servidor de upload");
  const proxyRes = await fetch(`/api/upload/proxy?target=${encodeURIComponent(uploadUrl)}`, {
    method: "PUT", headers: { "Content-Type": contentType }, body: blob,
  });
  if (!proxyRes.ok) throw new Error(`Upload falhou (HTTP ${proxyRes.status})`);
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (!isLocalhost) return `${window.location.origin}/api/voiceclone/audio?key=${encodeURIComponent(key)}`;
  return (downloadUrl ?? publicUrl) as string;
}

function fmtSec(s: number) { return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`; }

// ─── Mini Waveform ────────────────────────────────────────────────────────────
function MiniWave({ progress, active }: { progress: number; active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 36 }}>
      {Array.from({ length: 36 }).map((_, i) => {
        const filled = i / 36 <= progress;
        const h = Math.round(4 + Math.abs(Math.sin(i * 0.5 + 0.8) * 22 + Math.sin(i * 1.1) * 6));
        return <div key={i} style={{ flex: 1, borderRadius: 2, height: h, backgroundColor: filled ? C.grn : active ? "rgba(62,207,142,.25)" : "rgba(255,255,255,.08)", transition: "background-color 0.1s" }} />;
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function VoiceClonePage() {
  const router   = useRouter();
  const supabase = createClient();

  const [initials, setInitials] = useState("US");
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setInitials((user.email ?? "U")[0].toUpperCase());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { credits, spend, cost, refresh, refund } = useCredits();
  const { toasts, remove: removeToast, toast } = useToast();
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditAction,    setCreditAction]    = useState("voiceclone");

  const [stage,     setStage]     = useState<Stage>("setup");
  const [errMsg,    setErrMsg]    = useState("");
  const [progress,  setProgress]  = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"clone"|"use">("clone");

  // sample
  const [sampleFile,      setSampleFile]      = useState<File | null>(null);
  const [sampleUrl,       setSampleUrl]       = useState<string | null>(null);
  const [sampleObjUrl,    setSampleObjUrl]    = useState<string | null>(null);
  const [voiceName,       setVoiceName]       = useState("");
  const [uploadingSample, setUploadingSample] = useState(false);
  const sampleInputRef = useRef<HTMLInputElement>(null);

  // recording
  const [recording,  setRecording]  = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecRef  = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // voices
  const [savedVoices,  setSavedVoices]  = useState<SavedVoice[]>([]);
  const [activeVoiceId,setActiveVoiceId]= useState<string | null>(null);
  const [renamingId,   setRenamingId]   = useState<string | null>(null);
  const [renameValue,  setRenameValue]  = useState("");

  // TTS
  const [ttsText,    setTtsText]    = useState("");
  const [ttsSpeed,   setTtsSpeed]   = useState(1.0);
  const [audioResult,setAudioResult]= useState<string | null>(null);
  const [audioDur,   setAudioDur]   = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]   = useState(false);
  const [playProg,setPlayProg]  = useState(0);

  // Carrega vozes do servidor (Supabase) — source of truth
  const loadVoices = useCallback(async () => {
    try {
      const res = await fetch("/api/voices");
      if (!res.ok) return;
      const j = await res.json() as { voices: Array<{ voice_id: string; voice_name: string; created_at: string }> };
      const mapped: SavedVoice[] = (j.voices ?? []).map(v => ({
        voiceId:   v.voice_id,
        voiceName: v.voice_name,
        createdAt: new Date(v.created_at).getTime(),
      }));
      setSavedVoices(mapped);
    } catch { /* offline / non-fatal */ }
  }, []);
  useEffect(() => { loadVoices(); }, [loadVoices]);

  function addLocalVoice(v: SavedVoice) {
    setSavedVoices(s => [v, ...s.filter(x => x.voiceId !== v.voiceId)]);
  }

  async function deleteVoice(voiceId: string) {
    const prev = savedVoices;
    setSavedVoices(s => s.filter(x => x.voiceId !== voiceId));
    if (activeVoiceId === voiceId) {
      const remaining = prev.filter(x => x.voiceId !== voiceId);
      setActiveVoiceId(remaining[0]?.voiceId ?? null);
      if (remaining.length === 0) setStage("setup");
    }
    try {
      const res = await fetch("/api/voices", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
      if (!res.ok) throw new Error("delete failed");
      toast.success("Voz removida");
    } catch {
      setSavedVoices(prev); // rollback
      toast.error("Falha ao remover voz");
    }
  }

  async function commitRename(voiceId: string) {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    const prev = savedVoices;
    setSavedVoices(s => s.map(x => x.voiceId === voiceId ? { ...x, voiceName: name } : x));
    setRenamingId(null);
    try {
      const res = await fetch("/api/voices", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, voiceName: name }),
      });
      if (!res.ok) throw new Error("rename failed");
      toast.success("Nome actualizado");
    } catch {
      setSavedVoices(prev); // rollback
      toast.error("Falha ao renomear voz");
    }
  }

  async function handleSampleSelect(file: File) {
    setSampleFile(file);
    const obj = URL.createObjectURL(file);
    setSampleObjUrl(obj);
    setUploadingSample(true); setErrMsg("");
    try {
      const ext = (file as File & { name?: string }).name?.split(".").pop() ?? file.type.split("/")[1]?.replace("mpeg","mp3") ?? "webm";
      const url = await uploadToR2(file, `sample-${Date.now()}.${ext}`, file.type || "audio/webm");
      setSampleUrl(url);
    } catch (e) { setErrMsg(e instanceof Error ? e.message : "Erro ao enviar áudio de amostra."); }
    finally { setUploadingSample(false); }
  }

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
      mr.start(100); mediaRecRef.current = mr;
      setRecording(true); setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch { setErrMsg("Não foi possível acessar o microfone."); }
  }

  function stopRecording() {
    mediaRecRef.current?.stop();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setRecording(false);
  }

  const cloneVoice = useCallback(async () => {
    if (!sampleUrl || !voiceName.trim()) return;
    setStage("cloning"); setProgress(10); setStatusMsg("A analisar amostra de voz...");
    try {
      const res = await fetch("/api/voiceclone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audioUrl: sampleUrl, voiceName: voiceName.trim() }) });
      if (res.status === 402) { setStage("setup"); setCreditAction("voiceclone"); setShowCreditModal(true); return; }
      const j = await res.json() as { voiceId?: string; error?: string; debug?: Record<string, unknown> };
      if (j.voiceId) {
        // Server já persistiu em cloned_voices — só atualizamos UI local
        const cloned: SavedVoice = { voiceId: j.voiceId, voiceName: voiceName.trim(), createdAt: Date.now() };
        addLocalVoice(cloned); setActiveVoiceId(j.voiceId);
        setProgress(100); setStatusMsg("Voz clonada!"); setStage("ready");
        toast.success(`Voz "${voiceName}" clonada com sucesso! 🧬`);
        setActiveTab("use");
        refresh(); // refresh credits
        return;
      }
      if (j.debug) console.error("[voiceclone] Debug:", JSON.stringify(j.debug, null, 2));
      throw new Error(j.error ?? "Erro ao iniciar clonagem");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setErrMsg(msg); setStage("error"); toast.error(msg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleUrl, voiceName, savedVoices, toast]);

  const generateTTS = useCallback(async () => {
    if (!ttsText.trim() || !activeVoiceId) return;
    const creditResult = await spend("tts", { chars: ttsText.trim().length });
    if (!creditResult.ok) { setCreditAction("tts"); setShowCreditModal(true); return; }
    const { refundId: ttsRefundId } = creditResult;
    setStage("generating"); setProgress(10); setStatusMsg("Gerando áudio com sua voz...");
    try {
      const miniMaxVoices = ["English_expressive_narrator","English_Graceful_Lady","English_Insightful_Speaker","English_radiant_girl","English_Persuasive_Man","English_Lucky_Robot","Chinese (Mandarin)_Lyrical_Voice","Chinese (Mandarin)_HK_Flight_Attendant","Japanese_Whisper_Belle"];
      const endpoint = miniMaxVoices.includes(activeVoiceId) ? "/api/tts" : "/api/tts-cloned";
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: ttsText.trim(), voiceId: activeVoiceId, speed: ttsSpeed }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})) as { error?: string }; throw new Error(j.error ?? `Erro ${res.status}`); }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const dur = await new Promise<number>(resolve => {
        const a = new Audio(url);
        a.addEventListener("loadedmetadata", () => resolve(a.duration), { once: true });
        a.addEventListener("error", () => resolve(0), { once: true });
      });
      let persistUrl: string | null = null;
      try { persistUrl = await uploadToR2(blob, `clone-tts-${Date.now()}.mp3`, "audio/mpeg"); } catch { /* non-fatal */ }
      if (persistUrl) {
        fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool: "voiceclone", title: ttsText.trim().slice(0, 60), result_url: persistUrl, meta: { voiceId: activeVoiceId, voiceName, duration: dur } }) }).catch(() => {});
      }
      setAudioResult(persistUrl ?? url); setAudioDur(dur); setStage("done"); toast.success("Áudio gerado com sua voz clonada! 🎙️");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar áudio";
      setErrMsg(msg); setStage("error"); toast.error(msg);
      await refund("tts", ttsRefundId, { chars: ttsText.trim().length });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsText, activeVoiceId, ttsSpeed, toast]);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else          { a.play().then(() => setPlaying(true)).catch(() => {}); }
  }

  function handleSendToEditor() {
    if (audioResult && !audioResult.startsWith("blob:")) {
      sessionStorage.setItem("vb_pending_audio", JSON.stringify({ url: audioResult, label: voiceName, duration: audioDur }));
    }
    router.push("/storyboard");
  }

  async function handleDownload() {
    if (!audioResult) return;
    try {
      const res = await fetch(audioResult); const blob = await res.blob();
      const obj = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = obj; a.download = `suarik-${voiceName || "clone"}-${Date.now()}.mp3`; a.click();
      setTimeout(() => URL.revokeObjectURL(obj), 10000);
    } catch { window.open(audioResult, "_blank"); }
  }

  const isCloning    = stage === "cloning";
  const isGenerating = stage === "generating";
  const isBusy       = isCloning || isGenerating;

  const VOICE_TAGS = ["Narração", "Podcast", "VSL", "Cursos", "Apresentação", "Comercial"];
  const [activeTags, setActiveTags] = useState<string[]>(["Narração"]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, color: C.t, fontFamily: "'Geist',system-ui,sans-serif", display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        @keyframes ring-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes ld-pulse-blue { 0%,100%{box-shadow:0 0 0 0 rgba(74,158,255,.15)} 50%{box-shadow:0 0 0 12px rgba(74,158,255,0)} }
        @keyframes rec-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(226,75,74,.4)} 50%{box-shadow:0 0 0 6px rgba(226,75,74,0)} }
        .vc-vi { display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:7px;cursor:pointer;transition:all .15s;margin-bottom:2px;border:1px solid transparent; }
        .vc-vi:hover { background:${C.bg3}; }
        .vc-vi.on { background:${C.bg3};border-color:${C.b2}; }
        .vc-mt { font-size:12px;font-weight:500;padding:10px 16px;cursor:pointer;color:${C.t3};border-bottom:2px solid transparent;transition:all .15s;display:flex;align-items:center;gap:6px;background:none;border-top:none;border-left:none;border-right:none;font-family:inherit; }
        .vc-mt:hover { color:${C.t2}; }
        .vc-mt.on { color:${C.t};border-bottom-color:${C.blu}; }
        .vc-tag { font-size:10px;padding:4px 10px;border-radius:20px;border:1px solid ${C.b};color:${C.t3};cursor:pointer;transition:all .15s;user-select:none;background:none;font-family:inherit; }
        .vc-tag:hover { border-color:${C.b2};color:${C.t2}; }
        .vc-tag.on { background:${C.bs};border-color:${C.bm};color:${C.blu}; }
        .vc-clone-btn { flex:1;padding:12px;background:${C.blu};color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .25s;display:flex;align-items:center;justify-content:center;gap:7px; }
        .vc-clone-btn:hover:not(:disabled) { background:#3A8EEF;transform:translateY(-1px);box-shadow:0 8px 28px rgba(74,158,255,.3); }
        .vc-clone-btn:disabled { background:${C.bg4};color:${C.t4};cursor:not-allowed;transform:none;box-shadow:none; }
        .vc-gen-btn { width:100%;padding:10px;background:${C.blu};color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px; }
        .vc-gen-btn:hover:not(:disabled) { background:#3A8EEF;transform:translateY(-1px);box-shadow:0 6px 20px rgba(74,158,255,.25); }
        .vc-gen-btn:disabled { background:${C.bg4};color:${C.t4};cursor:not-allowed; }
        input[type=range] { width:100%;-webkit-appearance:none;height:3px;border-radius:2px;background:${C.bg4};outline:none;cursor:pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:${C.blu};cursor:pointer;border:2px solid ${C.bg}; }
      `}</style>

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 46, background: C.bg, borderBottom: `1px solid ${C.b}`, display: "flex", alignItems: "center", padding: "0 14px", gap: 8, flexShrink: 0, zIndex: 100 }}>
        <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t3, cursor: "pointer", padding: "5px 8px", borderRadius: 6, border: "none", background: "none", fontFamily: "inherit" }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = C.bg3; (e.currentTarget as HTMLElement).style.color = C.t2; }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = C.t3; }}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M8 2L3 6.5l5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Voltar
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 10px", borderLeft: `1px solid ${C.b}`, borderRight: `1px solid ${C.b}`, flexShrink: 0 }}>
          <SuarikLogo size={18} showName />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.t4 }}>·</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Voice Clone</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 6 }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1L4.5 4.5H1.5l2.5 2L3 10l3-2 3 2-1-3.5 2.5-2H7.5L6 1z" fill={C.o} opacity=".85"/></svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.t }}>{credits?.toLocaleString() ?? "—"}</span>
            <span style={{ fontSize: 10, color: C.t3 }}>/ 15k</span>
          </div>
          <div style={{ width: 1, height: 14, background: C.b, flexShrink: 0 }} />
          <button onClick={() => { setActiveTab("clone"); setSampleFile(null); setSampleUrl(null); setSampleObjUrl(null); setVoiceName(""); setStage("setup"); }}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.b}`, background: C.bg3, color: C.t2, cursor: "pointer", fontFamily: "inherit" }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            Novo Clone
          </button>
          <div style={{ width: 1, height: 14, background: C.b, flexShrink: 0 }} />
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.o, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials}</div>
        </div>
      </div>

      {/* ── MAIN GRID ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
        <div style={{ borderRight: `1px solid ${C.b}`, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>
          <div style={{ padding: "12px 10px 8px", borderBottom: `1px solid ${C.b}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.t }}>Minhas Vozes</span>
              <span style={{ fontSize: 10, color: C.t4, background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 10, padding: "2px 7px" }}>{savedVoices.length} voz{savedVoices.length !== 1 ? "es" : ""}</span>
            </div>
            <button onClick={() => { setActiveTab("clone"); setStage("setup"); setSampleFile(null); setSampleUrl(null); setSampleObjUrl(null); setVoiceName(""); }}
              style={{ width: "100%", padding: 8, background: C.blu, color: "#fff", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              Clonar Nova Voz
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
            {savedVoices.length === 0
              ? (
                <div style={{ textAlign: "center", padding: "28px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${C.blu}14`, border: `1px solid ${C.blu}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.blu} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 1 0 6 0V5a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, lineHeight: 1.4 }}>Nenhuma voz clonada</div>
                  <div style={{ fontSize: 11, color: C.t4, lineHeight: 1.5, maxWidth: 170 }}>Suba 20s de áudio limpo pra criar sua primeira voz personalizada.</div>
                  <button onClick={() => { setActiveTab("clone"); setStage("setup"); setSampleFile(null); setSampleUrl(null); setSampleObjUrl(null); setVoiceName(""); }}
                    style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: C.blu, background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                    Clonar primeira voz →
                  </button>
                </div>
              )
              : savedVoices.map(v => {
                  const isActive = activeVoiceId === v.voiceId;
                  const isRen    = renamingId === v.voiceId;
                  const colors   = ["#4A9EFF","#3ECF8E","#9B8FF8","#E8512A","#F5A623"];
                  const clr      = colors[v.voiceName.charCodeAt(0) % colors.length];
                  return (
                    <div key={v.voiceId} className={`vc-vi${isActive ? " on" : ""}`}
                      onClick={() => { if (!isRen) { setActiveVoiceId(v.voiceId); if (stage === "setup" || stage === "error") setStage("ready"); setActiveTab("use"); } }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${clr}20`, border: `1px solid ${clr}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: clr, flexShrink: 0 }}>
                        {v.voiceName[0]?.toUpperCase() ?? "V"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isRen
                          ? <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commitRename(v.voiceId); if (e.key === "Escape") setRenamingId(null); }} onBlur={() => commitRename(v.voiceId)} maxLength={40} onClick={e => e.stopPropagation()} style={{ width: "100%", background: C.bg3, border: `1px solid ${C.blu}`, borderRadius: 4, padding: "2px 6px", color: C.t, fontSize: 12, outline: "none" }} />
                          : <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? C.blu : C.t, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{v.voiceName}</div>}
                        <div style={{ fontSize: 10, color: C.t3, marginTop: 1 }}>{new Date(v.createdAt).toLocaleDateString("pt-BR")}</div>
                      </div>
                      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); setRenamingId(v.voiceId); setRenameValue(v.voiceName); }} style={{ width: 18, height: 18, borderRadius: 4, background: "none", border: `1px solid ${C.b}`, color: C.t4, fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Renomear">✏</button>
                        <button onClick={e => { e.stopPropagation(); if (confirm(`Apagar "${v.voiceName}"?`)) deleteVoice(v.voiceId); }} style={{ width: 18, height: 18, borderRadius: 4, background: "none", border: `1px solid ${C.b}`, color: C.t4, fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Apagar">✕</button>
                      </div>
                    </div>
                  );
                })}
          </div>

          <div style={{ borderTop: `1px solid ${C.b}`, padding: "9px 10px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.t3 }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><rect x="1" y="4" width="10" height="7" rx="1" stroke={C.t4} strokeWidth="1"/><path d="M4 4V3a2 2 0 014 0v1" stroke={C.t4} strokeWidth="1"/></svg>
              Voz protegida · uso privado
            </div>
          </div>
        </div>

        {/* ── MAIN ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${C.b}`, flexShrink: 0, background: C.bg }}>
            <button className={`vc-mt${activeTab === "clone" ? " on" : ""}`} onClick={() => setActiveTab("clone")}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              Clonar Voz
            </button>
            <button className={`vc-mt${activeTab === "use" ? " on" : ""}`} onClick={() => setActiveTab("use")} disabled={!activeVoiceId && savedVoices.length === 0} style={{ opacity: !activeVoiceId && savedVoices.length === 0 ? .4 : 1 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="3.5" y="1" width="5" height="7" rx="2.5" stroke="currentColor" strokeWidth="1"/><path d="M1.5 7c0 2.5 2 4.5 4.5 4.5S10.5 9.5 10.5 7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
              Usar Voz Clonada
            </button>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: `${C.b2} transparent` } as React.CSSProperties}>

            {/* ── CLONE TAB ─────────────────────────────────────────────── */}
            {activeTab === "clone" && (
              <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
                {/* Error banner */}
                {stage === "error" && (
                  <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 8, background: "rgba(226,75,74,.08)", border: "1px solid rgba(226,75,74,.3)", color: "#E24B4A", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>⚠ {errMsg}</span>
                    <button onClick={() => { setStage("setup"); setErrMsg(""); }} style={{ background: "none", border: "none", color: "#E24B4A", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>Tentar novamente</button>
                  </div>
                )}

                {/* Voice name card */}
                <div style={{ background: C.bg2, border: `1px solid ${C.b}`, borderRadius: 11, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.t, marginBottom: 10 }}>Nome da voz</div>
                  <input value={voiceName} onChange={e => setVoiceName(e.target.value)} placeholder="Ex: Gabriel · Narrador DR" maxLength={40}
                    style={{ width: "100%", background: C.bg3, border: `1px solid ${sampleObjUrl && !voiceName.trim() ? "rgba(245,166,35,.4)" : C.b}`, borderRadius: 7, padding: "10px 12px", color: C.t, fontFamily: "inherit", fontSize: 14, fontWeight: 500, outline: "none", caretColor: C.blu, marginBottom: 10 }}
                    onFocus={e => (e.currentTarget.style.borderColor = "rgba(74,158,255,.4)")}
                    onBlur={e => (e.currentTarget.style.borderColor = sampleObjUrl && !voiceName.trim() ? "rgba(245,166,35,.4)" : C.b)} />
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                    {VOICE_TAGS.map(tag => (
                      <button key={tag} className={`vc-tag${activeTags.includes(tag) ? " on" : ""}`} onClick={() => setActiveTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag])}>{tag}</button>
                    ))}
                  </div>
                </div>

                {/* Recording stage */}
                <div style={{ background: C.bg2, border: `1px solid ${C.b}`, borderRadius: 11, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.b}`, display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="5" y="1" width="8" height="11" rx="4" stroke={C.blu} strokeWidth="1.3"/><path d="M3 10c0 3.3 2.7 6 6 6s6-2.7 6-6" stroke={C.blu} strokeWidth="1.3" strokeLinecap="round"/><path d="M9 16v1.5" stroke={C.blu} strokeWidth="1.3" strokeLinecap="round"/></svg>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.t, letterSpacing: "-.015em" }}>Amostras de voz</div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Grave ou faça upload de pelo menos 10 segundos de áudio limpo</div>
                    </div>
                  </div>

                  {/* Recording controls */}
                  <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Upload / Record cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <button onClick={() => sampleInputRef.current?.click()}
                        style={{ padding: "16px 12px", borderRadius: 9, cursor: "pointer", textAlign: "center", border: `1.5px dashed ${C.b2}`, background: C.bg, fontFamily: "inherit", transition: "all .15s" }}
                        onMouseOver={e => (e.currentTarget.style.borderColor = "rgba(74,158,255,.4)")}
                        onMouseOut={e => (e.currentTarget.style.borderColor = C.b2)}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
                        <div style={{ fontSize: 13, color: C.t2, fontWeight: 600 }}>Enviar arquivo</div>
                        <div style={{ fontSize: 10, color: C.t3, marginTop: 3 }}>MP3 · WAV · M4A · WebM</div>
                      </button>
                      <button onClick={recording ? stopRecording : startRecording}
                        style={{ padding: "16px 12px", borderRadius: 9, cursor: "pointer", textAlign: "center", border: `1.5px solid ${recording ? "rgba(226,75,74,.6)" : C.b2}`, background: recording ? "rgba(226,75,74,.06)" : C.bg, fontFamily: "inherit", transition: "all .15s", animation: recording ? "rec-pulse 1s ease-in-out infinite" : "none" }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{recording ? "⏹" : "🎙️"}</div>
                        <div style={{ fontSize: 13, color: recording ? "#E24B4A" : C.t2, fontWeight: 600 }}>
                          {recording ? `Gravando… ${fmtSec(recSeconds)}` : "Gravar agora"}
                        </div>
                        <div style={{ fontSize: 10, color: C.t3, marginTop: 3 }}>{recording ? "Clique para parar" : "Direto pelo microfone"}</div>
                      </button>
                    </div>
                    <input ref={sampleInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleSampleSelect(f); }} />

                    {/* Sample preview */}
                    {sampleObjUrl && (
                      <div style={{ padding: "12px 14px", borderRadius: 9, display: "flex", alignItems: "center", gap: 12,
                        background: uploadingSample ? C.bg3 : sampleUrl ? C.gs : errMsg ? "rgba(226,75,74,.06)" : "rgba(245,166,35,.05)",
                        border: `1px solid ${uploadingSample ? C.b : sampleUrl ? C.gm : errMsg ? "rgba(226,75,74,.3)" : "rgba(245,166,35,.3)"}` }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{uploadingSample ? "⏳" : sampleUrl ? "✓" : errMsg ? "⚠" : "⏫"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: uploadingSample ? C.t2 : sampleUrl ? C.grn : errMsg ? "#E24B4A" : "#F5A623", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                            {sampleFile instanceof File ? sampleFile.name : "Gravação"}
                          </div>
                          <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                            {uploadingSample ? "A enviar para o servidor…" : sampleUrl ? "Áudio carregado — pronto para clonar" : errMsg ? errMsg : "A preparar upload…"}
                          </div>
                        </div>
                        {sampleObjUrl && <audio src={sampleObjUrl} controls style={{ height: 28, flexShrink: 0 }} />}
                      </div>
                    )}

                    {/* Hint */}
                    <div style={{ padding: "10px 12px", borderRadius: 7, background: C.bg4, border: `1px solid ${C.b}`, fontSize: 11, color: C.t4, lineHeight: 1.6 }}>
                      <span style={{ color: C.t3, fontWeight: 600 }}>Requisitos: </span>
                      Mín. 10 seg · MP3, WAV, M4A · Voz humana real (não IA/TTS) · Sem música ou ruído de fundo
                    </div>
                  </div>

                  {/* Upload alt */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: `1px solid ${C.b}` }}>
                    <span style={{ fontSize: 11, color: C.t3 }}>Prefere fazer upload de um áudio existente?</span>
                    <button onClick={() => sampleInputRef.current?.click()}
                      style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 7, border: `1px solid ${C.b}`, background: C.bg3, color: C.t2, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const }}>
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 8V2M3.5 5.5L6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Upload MP3 / WAV
                    </button>
                  </div>
                </div>

                {/* Clone footer */}
                <div style={{ background: C.bg2, border: `1px solid ${C.b}`, borderRadius: 11, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 11, color: C.t3 }}><strong style={{ color: C.t2 }}>100 créditos</strong> por clone · ~5 min</div>
                  <button className="vc-clone-btn" onClick={cloneVoice} disabled={!sampleUrl || !voiceName.trim() || uploadingSample}>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="4" y="1" width="6" height="8" rx="3" stroke="currentColor" strokeWidth="1.2"/><path d="M2 10c0 2.2 2.2 4 5 4s5-1.8 5-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    {uploadingSample ? "A enviar amostra…" : !sampleUrl ? "Aguardando upload…" : !voiceName.trim() ? "Dá um nome à voz" : "Clonar Voz"}
                  </button>
                </div>
              </div>
            )}

            {/* ── USE TAB ───────────────────────────────────────────────── */}
            {activeTab === "use" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "100%", overflow: "hidden" }}>
                {/* Voice info */}
                <div style={{ borderRight: `1px solid ${C.b}`, padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
                  {activeVoiceId ? (() => {
                    const v = savedVoices.find(sv => sv.voiceId === activeVoiceId);
                    const colors = ["#4A9EFF","#3ECF8E","#9B8FF8","#E8512A","#F5A623"];
                    const clr = colors[(v?.voiceName.charCodeAt(0) ?? 0) % colors.length];
                    return v ? (
                      <>
                        <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${clr}20`, border: `2px solid ${clr}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: clr, flexShrink: 0 }}>
                          {v.voiceName[0]?.toUpperCase() ?? "V"}
                        </div>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.025em", color: C.t }}>{v.voiceName}</div>
                          <div style={{ fontSize: 12, color: C.t3 }}>Clonada em {new Date(v.createdAt).toLocaleDateString("pt-BR")}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 2, height: 48 }}>
                          {Array.from({ length: 28 }).map((_, i) => {
                            const h = Math.round(4 + Math.abs(Math.sin(i * 0.5) * 18 + Math.sin(i * 1.1) * 6));
                            return <div key={i} style={{ flex: 1, borderRadius: 2, height: h, background: `${clr}60` }} />;
                          })}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          <div style={{ background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, padding: "9px 11px" }}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: C.t4, marginBottom: 4 }}>Qualidade</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.t }}>Alta</div>
                          </div>
                          <div style={{ background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, padding: "9px 11px" }}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: C.t4, marginBottom: 4 }}>Motor</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.t }}>MiniMax</div>
                          </div>
                          <div style={{ background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, padding: "9px 11px" }}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: C.t4, marginBottom: 4 }}>Custo TTS</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.t }}>{cost("tts")} cr</div>
                          </div>
                          <div style={{ background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, padding: "9px 11px" }}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: C.t4, marginBottom: 4 }}>Idiomas</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.t }}>PT · EN · ES</div>
                          </div>
                        </div>
                      </>
                    ) : null;
                  })() : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 32 }}>🎙️</div>
                      <div style={{ fontSize: 14, color: C.t2 }}>Seleciona uma voz na barra lateral</div>
                      <button onClick={() => setActiveTab("clone")} style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${C.bm}`, background: C.bs, color: C.blu, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        + Clonar Voz
                      </button>
                    </div>
                  )}
                </div>

                {/* Generation panel */}
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.t }}>Gerar áudio com voz clonada</div>
                  <textarea value={ttsText} onChange={e => setTtsText(e.target.value)} maxLength={10000}
                    placeholder="Digite o texto para gerar com sua voz clonada..."
                    style={{ width: "100%", background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, padding: "10px 12px", color: C.t, fontFamily: "inherit", fontSize: 13, fontWeight: 300, resize: "none", height: 110, outline: "none", lineHeight: 1.7, caretColor: C.blu }}
                    onFocus={e => (e.currentTarget.style.borderColor = "rgba(74,158,255,.35)")}
                    onBlur={e => (e.currentTarget.style.borderColor = C.b)} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div style={{ background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: C.t4, marginBottom: 4 }}>Velocidade</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.t, marginBottom: 4 }}>{ttsSpeed.toFixed(1)}×</div>
                      <input type="range" min={0.5} max={2.0} step={0.1} value={ttsSpeed} onChange={e => setTtsSpeed(parseFloat(e.target.value))} />
                    </div>
                    <div style={{ background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: C.t4, marginBottom: 4 }}>Caracteres</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.t }}>{ttsText.length} / 10k</div>
                    </div>
                  </div>
                  <button className="vc-gen-btn" onClick={generateTTS} disabled={!ttsText.trim() || !activeVoiceId}>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="4" y="2" width="6" height="8" rx="3" stroke="currentColor" strokeWidth="1.2"/><path d="M2.5 8.5c0 2.5 2 4.5 4.5 4.5s4.5-2 4.5-4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    Gerar Áudio com Voz Clonada
                  </button>

                  {/* Result player */}
                  {stage === "done" && audioResult && (
                    <div style={{ padding: 14, borderRadius: 9, background: C.bg3, border: `1px solid ${C.gm}` }}>
                      <audio ref={audioRef} src={audioResult}
                        onTimeUpdate={() => { const a = audioRef.current; if (a?.duration) setPlayProg(a.currentTime / a.duration); }}
                        onEnded={() => { setPlaying(false); setPlayProg(0); }} />
                      <div style={{ marginBottom: 10 }}><MiniWave progress={playProg} active={playing} /></div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <button onClick={togglePlay} style={{ flex: 1, height: 38, borderRadius: 7, background: C.grn, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          {playing ? "⏸ Pausar" : "▶ Ouvir"}
                        </button>
                        <button onClick={handleDownload} style={{ flex: 1, height: 38, borderRadius: 7, background: C.bg4, border: `1px solid ${C.b2}`, color: C.t2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          ⬇ Download
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={handleSendToEditor} disabled={!!audioResult?.startsWith("blob:")}
                          style={{ flex: 1, height: 38, borderRadius: 7, border: `1px solid ${C.bm}`, background: C.bs, color: C.blu, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: audioResult?.startsWith("blob:") ? .5 : 1 }}>
                          ⚡ Enviar ao Editor
                        </button>
                        <button onClick={() => router.push("/dreamface")}
                          style={{ flex: 1, height: 38, borderRadius: 7, border: `1px solid ${C.om}`, background: C.os, color: C.o, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          🎭 LipSync
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── LOADING OVERLAY ────────────────────────────────────────────────── */}
      {isBusy && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4,4,4,.93)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(16px)" }}>
          <div style={{ position: "relative", marginBottom: 20, width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid transparent", borderTopColor: C.blu, animation: "ring-spin 1.1s linear infinite" }} />
            <div style={{ position: "absolute", inset: 5, borderRadius: "50%", border: "1px solid transparent", borderBottomColor: "rgba(74,158,255,.3)", animation: "ring-spin 1.8s linear infinite reverse" }} />
            <div style={{ width: 64, height: 64, borderRadius: 14, background: C.bg3, border: `1px solid ${C.b2}`, display: "flex", alignItems: "center", justifyContent: "center", animation: "ld-pulse-blue 2s ease-in-out infinite" }}>
              <span style={{ fontSize: 26 }}>🧬</span>
            </div>
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase" as const, color: C.blu, marginBottom: 6 }}>Voice Clone</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: C.t, marginBottom: 4 }}>{isCloning ? "Clonando Voz" : "Gerando Áudio"}</div>
          <div style={{ fontSize: 12, color: C.t2, marginBottom: 24, textAlign: "center" }}>{statusMsg}</div>
          <div style={{ width: "100%", maxWidth: 360, height: 2, background: C.bg4, borderRadius: 1, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", background: `linear-gradient(90deg,${C.blu},#7AC0FF)`, borderRadius: 1, transition: "width .5s cubic-bezier(.16,1,.3,1)", width: `${progress}%` }} />
          </div>
          <div style={{ fontSize: 11, color: C.t4 }}>{progress}%</div>
        </div>
      )}

      {showCreditModal && <UpsellModal onClose={() => setShowCreditModal(false)} tool="voice" />}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
