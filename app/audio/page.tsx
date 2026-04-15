"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCredits, computeCost } from "@/hooks/useCredits";
import { InsufficientCreditsModal } from "@/components/CreditsBar";
import { useToast, ToastContainer } from "@/components/Toast";
import { AUDIO_VAULT } from "../lib/audioVault";
import { trackEvent } from "@/components/PostHogProvider";
import { TTS_VOICES } from "@/app/lib/ttsVoices";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:"#060606", bg2:"#09090B", bg3:"#0F0F0F", bg4:"#141414", bg5:"#1C1C1C",
  b:"#131313",  b2:"#1A1A1A",  b3:"#222",
  t:"#EAEAEA",  t2:"#7A7A7A",  t3:"#444",  t4:"#252525",
  o:"#E8512A",  o2:"#FF6B3D",  os:"rgba(232,81,42,.07)",  om:"rgba(232,81,42,.16)",
  grn:"#3ECF8E", gs:"rgba(62,207,142,.07)", gm:"rgba(62,207,142,.18)",
  pur:"#9B8FF8",  ps:"rgba(155,143,248,.07)", pm:"rgba(155,143,248,.16)",
  blu:"#4A9EFF",  bs:"rgba(74,158,255,.07)",  bm:"rgba(74,158,255,.16)",
  amb:"#F5A623",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function uploadToR2(blob: Blob, filename: string, contentType: string): Promise<string> {
  const { uploadUrl, publicUrl } = await fetch("/api/upload", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ filename, contentType }),
  }).then(r => r.json());
  const proxyRes = await fetch(`/api/upload/proxy?target=${encodeURIComponent(uploadUrl)}`, {
    method:  "PUT",
    headers: { "Content-Type": contentType },
    body:    blob,
  });
  if (!proxyRes.ok) throw new Error(`Upload falhou (HTTP ${proxyRes.status})`);
  return publicUrl as string;
}

// ─── Voice helpers ────────────────────────────────────────────────────────────
const VCOLS = [C.o, C.grn, C.blu, C.pur, C.amb, "#E24B4A"] as const;
function vColor(id: string) {
  return VCOLS[id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % VCOLS.length];
}
function miniWv(id: string): number[] {
  const s = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: 13 }, (_, i) =>
    Math.max(3, Math.round(4 + Math.abs(Math.sin(s * 0.07 + i * 0.55)) * 11 + Math.abs(Math.cos(s * 0.05 + i * 0.9)) * 3))
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type AudioEntry = {
  id:         string;
  text:       string;
  voiceId:    string;
  voiceLabel: string;
  emotion:    string;
  speed:      number;
  blob:       Blob;
  url:        string;
  duration:   number;
  createdAt:  number;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const VOICES = TTS_VOICES as unknown as { id: string; label: string; lang: string; gender: string }[];

const EMOTIONS = [
  { id: "neutral",   label: "Neutro",   icon: "😐" },
  { id: "happy",     label: "Feliz",    icon: "😄" },
  { id: "sad",       label: "Triste",   icon: "😢" },
  { id: "angry",     label: "Raiva",    icon: "😠" },
  { id: "surprised", label: "Surpreso", icon: "😲" },
  { id: "fearful",   label: "Medo",     icon: "😨" },
];

const PRESET_SCRIPTS = [
  { label: "Copy Finanças", dot: C.o,
    text: "Você está deixando dinheiro na mesa todo mês. Existe um mecanismo oculto no sistema bancário que drena seus recursos silenciosamente. Mas hoje vou te mostrar como virar esse jogo." },
  { label: "Copy Nutra", dot: C.grn,
    text: "Você sabia que existe uma substância natural que reduz a inflamação em até 73%? Médicos não falam sobre isso porque a indústria farmacêutica não quer que você saiba." },
  { label: "Chamada para ação", dot: C.amb,
    text: "Chamada para ação urgente: essa oferta expira em 24 horas. Se você sair dessa página agora, pode não ver esse preço novamente. Clique no botão abaixo e garanta o seu." },
  { label: "Intro de podcast", dot: C.pur,
    text: "Bem-vindo ao Método Acelerado. Nos próximos 30 dias vou te mostrar exatamente o que fiz para sair do zero e chegar a 6 dígitos por mês." },
  { label: "Depoimento fictício", dot: C.blu,
    text: "Eu estava no mesmo lugar que você. Endividado, sem perspectiva, trabalhando 12 horas por dia e não saindo do lugar. Até que descobri esse método que mudou tudo." },
];

const MUSIC_MOODS = [
  { id: "energetic",     label: "Energético",   icon: "⚡" },
  { id: "calm",          label: "Calmo",         icon: "🌊" },
  { id: "dramatic",      label: "Dramático",     icon: "🎭" },
  { id: "happy",         label: "Alegre",        icon: "😄" },
  { id: "sad",           label: "Melancólico",   icon: "😢" },
  { id: "tense",         label: "Tenso",         icon: "😰" },
  { id: "inspirational", label: "Inspiracional", icon: "✨" },
];

const SFX_PRESETS = [
  "Aplauso", "Trovão", "Passos", "Campainha", "Explosão",
  "Vento", "Chuva", "Teclado", "Riso", "Silvo",
];

type ActiveTab = "tts" | "music" | "sfx" | "library" | "history";

// ─── WAV encoder (for trimmer) ────────────────────────────────────────────────
function audioBufferToWav(buf: AudioBuffer): Blob {
  const numCh = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
  const data = new Float32Array(len * numCh);
  for (let c = 0; c < numCh; c++) buf.getChannelData(c).forEach((v, i) => { data[i * numCh + c] = v; });
  const pcm = new Int16Array(data.length);
  data.forEach((v, i) => { pcm[i] = Math.max(-1, Math.min(1, v)) * 0x7fff; });
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (off: number, val: number, b: number) =>
    b === 4 ? view.setUint32(off, val, true) : b === 2 ? view.setUint16(off, val, true) : view.setUint8(off, val);
  [..."RIFF"].forEach((c, i) => write(i, c.charCodeAt(0), 1));
  write(4, 36 + pcm.byteLength, 4);
  [..."WAVE"].forEach((c, i) => write(8 + i, c.charCodeAt(0), 1));
  [..."fmt "].forEach((c, i) => write(12 + i, c.charCodeAt(0), 1));
  write(16, 16, 4); write(20, 1, 2); write(22, numCh, 2);
  write(24, sr, 4); write(28, sr * numCh * 2, 4); write(32, numCh * 2, 2); write(34, 16, 2);
  [..."data"].forEach((c, i) => write(36 + i, c.charCodeAt(0), 1));
  write(40, pcm.byteLength, 4);
  return new Blob([header, pcm.buffer], { type: "audio/wav" });
}

// ─── Waveform ─────────────────────────────────────────────────────────────────
function Waveform({ active, progress }: { active: boolean; progress: number }) {
  const bars = 40;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 40, padding: "0 2px" }}>
      {Array.from({ length: bars }).map((_, i) => {
        const filled = i / bars <= progress;
        const h = Math.round(6 + Math.abs(Math.sin((i * 0.45) + 1.2) * 22 + Math.sin(i * 0.9) * 6));
        return (
          <div key={i} style={{
            flex: 1, borderRadius: 2, height: h,
            backgroundColor: filled
              ? C.o
              : active ? `rgba(232,81,42,0.28)` : `rgba(255,255,255,0.1)`,
            transition: "background-color 0.1s",
          }} />
        );
      })}
    </div>
  );
}

// ─── Audio Player ─────────────────────────────────────────────────────────────
function AudioPlayer({ entry, onSendToTimeline }: {
  entry:             AudioEntry;
  onSendToTimeline:  (e: AudioEntry) => void;
}) {
  const audioRef    = useRef<HTMLAudioElement>(null);
  const [playing,   setPlaying]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [current,   setCurrent]   = useState(0);
  const [rate,      setRate]      = useState(1);
  const [showTrim,  setShowTrim]  = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd,   setTrimEnd]   = useState(0);
  const [trimming,  setTrimming]  = useState(false);

  useEffect(() => {
    setPlaying(false); setProgress(0); setCurrent(0);
    setTrimStart(0); setTrimEnd(entry.duration || 0); setShowTrim(false);
    if (audioRef.current) { audioRef.current.src = entry.url; audioRef.current.load(); }
  }, [entry.url, entry.duration]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else         { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
  }

  const applyTrim = async () => {
    if (trimStart >= trimEnd) return;
    setTrimming(true);
    try {
      const arrayBuf = await entry.blob.arrayBuffer();
      const ctx      = new AudioContext();
      const decoded  = await ctx.decodeAudioData(arrayBuf);
      const sr       = decoded.sampleRate;
      const startS   = Math.floor(trimStart * sr);
      const endS     = Math.min(Math.floor(trimEnd * sr), decoded.length);
      const trimmed  = ctx.createBuffer(decoded.numberOfChannels, endS - startS, sr);
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        trimmed.copyToChannel(decoded.getChannelData(c).slice(startS, endS), c);
      }
      const wavBlob = audioBufferToWav(trimmed);
      const url     = URL.createObjectURL(wavBlob);
      if (audioRef.current) { audioRef.current.src = url; audioRef.current.load(); }
      entry.url = url; entry.blob = wavBlob; entry.duration = trimEnd - trimStart;
      setTrimStart(0); setTrimEnd(entry.duration); setShowTrim(false);
      await ctx.close();
    } catch { /* silent */ } finally { setTrimming(false); }
  };

  const colSel = `1px solid ${C.b2}`;
  const colDef = `1px solid ${C.b}`;

  return (
    <div style={{ background: C.bg, borderRadius: 11, padding: 14, border: colSel }}>
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (!a || !a.duration) return;
          setProgress(a.currentTime / a.duration);
          setCurrent(a.currentTime);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrent(0); }}
      />

      {/* Meta */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: 1 }}>
          {entry.voiceLabel || "Áudio"} · {entry.emotion}
        </span>
        <span style={{ fontSize: 10, color: C.t4 }}>
          {new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* Waveform seek */}
      <div onClick={handleSeek} style={{ cursor: "pointer", marginBottom: 6, borderRadius: 5, overflow: "hidden", background: C.bg4, padding: "2px 0" }}>
        <Waveform active={playing} progress={progress} />
      </div>

      {/* Time row */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.t4, marginBottom: 10 }}>
        <span>{fmt(current)}</span>
        <span>{fmt(entry.duration)}</span>
      </div>

      {/* Speed buttons */}
      <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
        {[0.5, 0.75, 1, 1.5, 2].map(r => (
          <button key={r} onClick={() => setRate(r)} style={{
            flex: 1, padding: "4px 0", borderRadius: 5, fontSize: 10, cursor: "pointer", border: "none",
            background: rate === r ? C.o    : C.bg4,
            color:      rate === r ? "#fff" : C.t3,
            fontWeight: rate === r ? 700    : 400,
          }}>
            {r}×
          </button>
        ))}
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <button onClick={toggle} style={{
          flex: 1, height: 38, borderRadius: 7, border: "none", cursor: "pointer",
          background: C.o, color: "#fff", fontWeight: 700, fontSize: 17,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {playing ? "⏸" : "▶"}
        </button>
        <a href={entry.url} download={`suarik-${entry.id}.mp3`} style={{
          width: 38, height: 38, borderRadius: 7, border: colDef,
          background: C.bg4, color: C.t2, fontSize: 15,
          display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
        }} title="Baixar MP3">↓</a>
        <button onClick={() => setShowTrim(t => !t)} style={{
          width: 38, height: 38, borderRadius: 7, cursor: "pointer", fontSize: 14,
          border: showTrim ? `1px solid ${C.om}` : colDef,
          background: showTrim ? C.os : C.bg4,
          color:      showTrim ? C.o  : C.t2,
        }} title="Trimmer">✂</button>
        <button onClick={() => onSendToTimeline(entry)} style={{
          flex: 1, height: 38, borderRadius: 7,
          border: `1px solid rgba(155,143,248,.2)`, background: C.ps,
          color: C.pur, fontWeight: 700, fontSize: 11, cursor: "pointer",
        }}>⚡ Editor</button>
      </div>

      {/* Trimmer */}
      {showTrim && (
        <div style={{ background: C.bg4, borderRadius: 7, padding: 11, border: colDef, marginTop: 4 }}>
          <div style={{ fontSize: 10, color: C.t3, marginBottom: 9 }}>✂ {fmt(trimStart)} → {fmt(trimEnd)}</div>
          <div style={{ marginBottom: 7 }}>
            <label style={{ fontSize: 9, color: C.t4 }}>Início: {fmt(trimStart)}</label>
            <input type="range" min={0} max={entry.duration} step={0.1} value={trimStart}
              onChange={e => setTrimStart(Math.min(+e.target.value, trimEnd - 0.5))}
              style={{ width: "100%", accentColor: C.o }} />
          </div>
          <div style={{ marginBottom: 9 }}>
            <label style={{ fontSize: 9, color: C.t4 }}>Fim: {fmt(trimEnd)}</label>
            <input type="range" min={0} max={entry.duration} step={0.1} value={trimEnd}
              onChange={e => setTrimEnd(Math.max(+e.target.value, trimStart + 0.5))}
              style={{ width: "100%", accentColor: C.o }} />
          </div>
          <button onClick={applyTrim} disabled={trimming || trimStart >= trimEnd} style={{
            width: "100%", padding: "7px 0", borderRadius: 5, border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 600, color: "#fff",
            background: trimming ? C.b2 : C.o,
          }}>
            {trimming ? "Cortando..." : "✓ Aplicar Corte"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AudioPage() {
  const router   = useRouter();
  const supabase = createClient();

  // ── Auth ──
  const [initials, setInitials] = useState("US");
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setInitials((user.email ?? "U")[0].toUpperCase());
    });
    loadHistoryFromDB();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Active tab ──
  const [activeTab, setActiveTab] = useState<ActiveTab>("tts");

  // ── TTS Form ──
  const [text,      setText]      = useState("");
  const [voiceId,   setVoiceId]   = useState(VOICES[0].id);
  const [voiceLang, setVoiceLang] = useState("PT");
  const [emotion,   setEmotion]   = useState("neutral");
  const [speed,     setSpeed]     = useState(1.0);
  const [vol,       setVol]       = useState(1.0);
  const [pitch,     setPitch]     = useState(0);

  // ── TTS Generation ──
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState<string | null>(null);

  // ── Music ──
  const [musicPrompt,     setMusicPrompt]     = useState("");
  const [musicDuration,   setMusicDuration]   = useState(30);
  const [musicMood,       setMusicMood]       = useState("energetic");
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [musicError,      setMusicError]      = useState<string | null>(null);
  const [musicEntry,      setMusicEntry]      = useState<AudioEntry | null>(null);

  // ── SFX ──
  const [sfxPrompt,     setSfxPrompt]     = useState("");
  const [sfxDuration,   setSfxDuration]   = useState(5);
  const [generatingSfx, setGeneratingSfx] = useState(false);
  const [sfxError,      setSfxError]      = useState<string | null>(null);

  // ── Library (Jamendo) ──
  const [pixabayQuery,    setPixabayQuery]    = useState("");
  const [pixabayResults,  setPixabayResults]  = useState<{ id: string; name: string; artist_name: string; audio: string; duration: number }[]>([]);
  const [pixabayLoading,  setPixabayLoading]  = useState(false);
  const [pixabayPage,     setPixabayPage]     = useState(1);
  const [pixabayTotal,    setPixabayTotal]    = useState(0);
  const [pixabayPlaying,  setPixabayPlaying]  = useState<string | null>(null);
  const [pixabaySearched, setPixabaySearched] = useState(false);

  // ── History ──
  const [historySearch,  setHistorySearch]  = useState("");
  const [historyFilter,  setHistoryFilter]  = useState<"all" | "tts" | "music" | "sfx">("all");
  const [historyPage,    setHistoryPage]    = useState(0);
  const [historyFromDB,  setHistoryFromDB]  = useState<AudioEntry[]>([]);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);

  // ── Session history ──
  const [history,     setHistory]     = useState<AudioEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<AudioEntry | null>(null);

  // ── Voice Preview ──
  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Credits ──
  const { credits, plan, cost, refresh } = useCredits();
  const { toasts, remove: removeToast, toast } = useToast();
  const [showCreditModal,   setShowCreditModal]   = useState(false);
  const [creditModalAction, setCreditModalAction] = useState<string>("tts");

  const charCount = text.length;
  const voiceObj  = VOICES.find(v => v.id === voiceId) ?? VOICES[0];

  // ── Voice Preview ──
  const loadVoicePreview = useCallback(async (vid: string) => {
    const cacheKey = `voice_preview_${vid}`;
    const cached   = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
    if (cached) {
      setPreviewUrl(cached);
      if (previewAudioRef.current) {
        previewAudioRef.current.src = cached;
        previewAudioRef.current.play().catch(() => {});
      }
      return;
    }
    setLoadingPreview(vid);
    try {
      const res = await fetch("/api/tts/preview", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ voiceId: vid }),
      });
      if (!res.ok) throw new Error("Preview falhou");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const reader = new FileReader();
      reader.onloadend = () => {
        try { localStorage.setItem(cacheKey, reader.result as string); } catch { /* quota */ }
      };
      reader.readAsDataURL(blob);
      setPreviewUrl(url);
      setTimeout(() => {
        if (previewAudioRef.current) {
          previewAudioRef.current.src = url;
          previewAudioRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      toast.error("Não foi possível gerar o preview.");
    } finally {
      setLoadingPreview(null);
    }
  }, [toast]);

  // ── Free Music Search ──
  const searchPixabay = useCallback(async (page = 1) => {
    const q = pixabayQuery.trim() || "ambient";
    setPixabayLoading(true);
    try {
      const res  = await fetch(`/api/music-library?q=${encodeURIComponent(q)}&page=${page}`);
      const data = await res.json();
      setPixabayResults(data.results ?? []);
      setPixabayTotal(data.total ?? 0);
      setPixabayPage(page);
      setPixabaySearched(true);
    } catch {
      setPixabayResults([]);
    } finally {
      setPixabayLoading(false);
    }
  }, [pixabayQuery]);

  // ── History helpers ──
  const determineType = (e: AudioEntry) => {
    if (e.voiceId === "music-ai") return "music";
    if (e.voiceId === "sfx")      return "sfx";
    return "tts";
  };

  const loadHistoryFromDB = useCallback(async () => {
    try {
      const res  = await fetch("/api/projects");
      if (!res.ok) return;
      const data = await res.json();
      const audioProjects = (data.projects ?? [])
        .filter((p: Record<string, unknown>) => p.tool === "audio")
        .map((p: Record<string, unknown>) => ({
          id:         p.id as string,
          text:       p.title as string,
          voiceId:    (p.meta as Record<string, unknown>)?.voiceId    as string ?? "unknown",
          voiceLabel: (p.meta as Record<string, unknown>)?.voiceLabel as string ?? "",
          emotion:    (p.meta as Record<string, unknown>)?.emotion    as string ?? "",
          speed:      (p.meta as Record<string, unknown>)?.speed      as number ?? 1,
          blob:       new Blob(),
          url:        p.result_url as string ?? "",
          duration:   (p.meta as Record<string, unknown>)?.duration   as number ?? 0,
          createdAt:  new Date(p.created_at as string).getTime(),
        }));
      setHistoryFromDB(audioProjects);
    } catch { /* silent */ }
  }, []);

  const deleteHistoryEntry = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await fetch("/api/projects", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id }),
      });
      setHistory(h => h.filter(e => e.id !== id));
      setHistoryFromDB(h => h.filter(e => e.id !== id));
      toast.success("Entrada removida");
    } catch {
      toast.error("Erro ao deletar");
    } finally {
      setDeletingId(null);
    }
  }, [toast]);

  // ── TTS Generate ──
  const generate = useCallback(async () => {
    if (!text.trim() || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: text.trim(), voiceId, speed, vol, pitch, emotion }),
      });
      if (res.status === 402) {
        setCreditModalAction("tts"); setShowCreditModal(true);
        setGenerating(false); return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `Erro ${res.status}`);
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const duration = await new Promise<number>(resolve => {
        const a = new Audio(url);
        a.addEventListener("loadedmetadata", () => resolve(a.duration), { once: true });
        a.addEventListener("error", () => resolve(0), { once: true });
      });
      let persistUrl: string | null = null;
      try { persistUrl = await uploadToR2(blob, `audio-${Date.now()}.mp3`, "audio/mpeg"); }
      catch { /* non-fatal */ }
      if (persistUrl) {
        fetch("/api/projects", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            tool: "audio", title: text.trim().slice(0, 60), result_url: persistUrl,
            meta: { voiceId, voiceLabel: voiceObj.label, emotion, speed, duration },
          }),
        }).catch(() => {});
      }
      const entry: AudioEntry = {
        id: Date.now().toString(36), text: text.trim().slice(0, 80) + (text.length > 80 ? "…" : ""),
        voiceId, voiceLabel: voiceObj.label, emotion, speed,
        blob, url: persistUrl ?? url, duration, createdAt: Date.now(),
      };
      setHistory(h => [entry, ...h]);
      setActiveEntry(entry);
      toast.success("Áudio gerado!");
      trackEvent("tts_generated", { voice: voiceId, chars: text.length, source: "audio_studio" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar áudio";
      setGenError(msg); toast.error(msg);
    } finally {
      setGenerating(false); refresh();
    }
  }, [text, voiceId, emotion, speed, vol, pitch, generating, voiceObj.label, toast, refresh]);

  // ── Music Generate ──
  const generateMusic = useCallback(async () => {
    if (!musicPrompt.trim() || generatingMusic) return;
    setGeneratingMusic(true); setMusicError(null);
    try {
      const res = await fetch("/api/music", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt: musicPrompt.trim(), type: "music", duration: musicDuration, mood: musicMood }),
      });
      if (res.status === 402) {
        setCreditModalAction("music"); setShowCreditModal(true);
        setGeneratingMusic(false); return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `Erro ${res.status}`);
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const duration = await new Promise<number>(resolve => {
        const a = new Audio(url);
        a.addEventListener("loadedmetadata", () => resolve(a.duration), { once: true });
        a.addEventListener("error", () => resolve(0), { once: true });
      });
      let persistUrl: string | null = null;
      try { persistUrl = await uploadToR2(blob, `music-${Date.now()}.mp3`, "audio/mpeg"); }
      catch { /* non-fatal */ }
      if (persistUrl) {
        fetch("/api/projects", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "audio", title: musicPrompt.trim().slice(0, 60), result_url: persistUrl,
            meta: { voiceLabel: "Music AI", emotion: musicMood, duration },
          }),
        }).catch(() => {});
      }
      const entry: AudioEntry = {
        id: Date.now().toString(36), text: musicPrompt.trim().slice(0, 80) + (musicPrompt.length > 80 ? "…" : ""),
        voiceId: "music-ai", voiceLabel: "Music AI", emotion: musicMood, speed: 1,
        blob, url: persistUrl ?? url, duration, createdAt: Date.now(),
      };
      setMusicEntry(entry); setHistory(h => [entry, ...h]); setActiveEntry(entry);
      toast.success("Música gerada! 🎵");
      trackEvent("music_generated", { mood: musicMood, duration: musicDuration });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar música";
      setMusicError(msg); toast.error(msg);
    } finally {
      setGeneratingMusic(false); refresh();
    }
  }, [musicPrompt, musicDuration, musicMood, generatingMusic, toast, refresh]);

  // ── SFX Generate ──
  const generateSfx = useCallback(async () => {
    if (!sfxPrompt.trim() || generatingSfx) return;
    setGeneratingSfx(true); setSfxError(null);
    try {
      const res = await fetch("/api/music", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt: sfxPrompt.trim(), type: "sfx", duration: sfxDuration }),
      });
      if (res.status === 402) {
        setCreditModalAction("sfx"); setShowCreditModal(true);
        setGeneratingSfx(false); return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `Erro ${res.status}`);
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const duration = await new Promise<number>(resolve => {
        const a = new Audio(url);
        a.addEventListener("loadedmetadata", () => resolve(a.duration), { once: true });
        a.addEventListener("error", () => resolve(0), { once: true });
      });
      let persistUrl: string | null = null;
      try { persistUrl = await uploadToR2(blob, `sfx-${Date.now()}.mp3`, "audio/mpeg"); }
      catch { /* non-fatal */ }
      if (persistUrl) {
        fetch("/api/projects", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "audio", title: sfxPrompt.trim().slice(0, 60), result_url: persistUrl,
            meta: { voiceLabel: "SFX", emotion: "sfx", duration },
          }),
        }).catch(() => {});
      }
      const entry: AudioEntry = {
        id: Date.now().toString(36), text: sfxPrompt.trim().slice(0, 80) + (sfxPrompt.length > 80 ? "…" : ""),
        voiceId: "sfx", voiceLabel: "SFX", emotion: "sfx", speed: 1,
        blob, url: persistUrl ?? url, duration, createdAt: Date.now(),
      };
      setHistory(h => [entry, ...h]); setActiveEntry(entry);
      toast.success("SFX gerado! ⚡");
      trackEvent("sfx_generated", { prompt: sfxPrompt.slice(0, 60), duration: sfxDuration });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar SFX";
      setSfxError(msg); toast.error(msg);
    } finally {
      setGeneratingSfx(false); refresh();
    }
  }, [sfxPrompt, sfxDuration, generatingSfx, toast, refresh]);

  // ── Keyboard shortcut ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (activeTab === "tts"   && !generating)      generate();
        if (activeTab === "music" && !generatingMusic) generateMusic();
        if (activeTab === "sfx"   && !generatingSfx)   generateSfx();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, generating, generatingMusic, generatingSfx, generate, generateMusic, generateSfx]);

  // ── Send to timeline ──
  function handleSendToTimeline(entry: AudioEntry) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("vb_pending_audio", JSON.stringify({ url: entry.url, label: entry.voiceLabel, duration: entry.duration }));
      sessionStorage.setItem("vb_restore_requested", "1");
    }
    router.push("/storyboard");
  }

  const isLoading = generating || generatingMusic || generatingSfx;

  // ─── Derived ──────────────────────────────────────────────────────────────────
  const ttsLabel   = activeTab === "tts"   ? "TTS Studio"   : activeTab === "music" ? "Music AI" : activeTab === "sfx" ? "SFX / Efeitos" : activeTab === "library" ? "Biblioteca" : "Histórico";
  const filteredVoices = VOICES.filter(v => v.lang === voiceLang);

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.t, fontFamily: "'Geist', system-ui, sans-serif", overflow: "hidden" }}>
      <style>{`
        @keyframes spin        { to   { transform: rotate(360deg); } }
        @keyframes ring-spin   { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes ld-pulse    { 0%,100% { box-shadow: 0 0 0 0 rgba(232,81,42,.15); } 50% { box-shadow: 0 0 0 12px rgba(232,81,42,0); } }
        @keyframes ld-progress { from { width: 0%; } to { width: 88%; } }
        input[type=range] { cursor: pointer; height: 3px; border-radius: 2px; -webkit-appearance: none; background: ${C.bg4}; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${C.o}; cursor: pointer; border: 2px solid ${C.bg}; }
        textarea:focus { border-color: rgba(232,81,42,.25) !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.b2}; border-radius: 2px; }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── TOPBAR ── */}
      <header style={{ height: 46, background: C.bg, borderBottom: `1px solid ${C.b}`, display: "flex", alignItems: "center", padding: "0 14px", gap: 8, flexShrink: 0, zIndex: 100 }}>
        <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t3, cursor: "pointer", padding: "5px 8px", borderRadius: 6, border: "none", background: "none", fontFamily: "inherit" }}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M8 2L3 6.5l5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Voltar
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 10px", borderLeft: `1px solid ${C.b}`, borderRight: `1px solid ${C.b}`, flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="8" fill="#111"/>
            <rect x="12" y="10" width="40" height="11" rx="4" fill="#E8E8E8"/>
            <rect x="41" y="10" width="11" height="24" rx="4" fill="#E8E8E8"/>
            <rect x="12" y="43" width="40" height="11" rx="4" fill={C.o}/>
            <rect x="12" y="30" width="11" height="24" rx="4" fill={C.o}/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t, letterSpacing: "-.025em" }}>Suarik</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.t4 }}>·</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Audio Studio</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          {/* Credits */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 6 }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L4.5 4.5H1.5l2.5 2L3 10l3-2 3 2-1-3.5 2.5-2H7.5L6 1z" fill={C.o} opacity=".85"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.t }}>{(credits ?? 0).toLocaleString("pt-BR")}</span>
            <span style={{ fontSize: 10, color: C.t3 }}>cr</span>
          </div>

          <div style={{ width: 1, height: 14, background: C.b, flexShrink: 0 }} />

          {/* Library & History shortcuts */}
          <button onClick={() => setActiveTab("library")} style={{
            display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500,
            padding: "6px 10px", borderRadius: 6,
            border: activeTab === "library" ? `1px solid ${C.b2}` : `1px solid ${C.b}`,
            background: activeTab === "library" ? C.bg3 : C.bg3,
            color: activeTab === "library" ? C.t : C.t2, cursor: "pointer", fontFamily: "inherit",
          }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1"/><rect x="7" y="3" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1"/></svg>
            Biblioteca
          </button>

          <button onClick={() => setActiveTab("history")} style={{
            display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500,
            padding: "6px 10px", borderRadius: 6,
            border: activeTab === "history" ? `1px solid ${C.b2}` : `1px solid ${C.b}`,
            background: activeTab === "history" ? C.bg3 : C.bg3,
            color: activeTab === "history" ? C.t : C.t2, cursor: "pointer", fontFamily: "inherit",
          }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1"/><path d="M6 3.5v2.5l2 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
            Histórico
          </button>

          {/* Generate button */}
          <button onClick={() => activeTab === "music" ? generateMusic() : activeTab === "sfx" ? generateSfx() : generate()}
            disabled={isLoading}
            style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
              padding: "6px 12px", borderRadius: 6,
              background: isLoading ? C.bg3 : C.o,
              border: isLoading ? `1px solid ${C.b}` : `1px solid ${C.o}`,
              color: isLoading ? C.t2 : "#fff",
              cursor: isLoading ? "default" : "pointer", fontFamily: "inherit",
            }}>
            {isLoading
              ? <><span style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px solid ${C.t4}`, borderTopColor: C.t2, animation: "spin .7s linear infinite", display: "inline-block" }} /> A gerar...</>
              : <><svg width="11" height="11" viewBox="0 0 14 14" fill="none"><rect x="4" y="2" width="6" height="8" rx="3" stroke="currentColor" strokeWidth="1.2"/><path d="M2.5 8.5c0 2.5 2 4.5 4.5 4.5s4.5-2 4.5-4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> Gerar Áudio</>
            }
          </button>

          {/* Avatar */}
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.o, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: "#fff", flexShrink: 0 }}>
            {initials}
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 260px", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ borderRight: `1px solid ${C.b}`, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>

          {/* Nav: Ferramentas */}
          <div style={{ padding: "10px 8px 6px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.t4, padding: "0 8px 5px" }}>
              Ferramentas
            </div>
            {(["tts", "music", "sfx"] as const).map(id => {
              const on  = activeTab === id;
              const cr  = id === "tts" ? `${computeCost("tts", { chars: text.length })}cr` : id === "music" ? `${computeCost("music", { duration: musicDuration })}cr` : `${computeCost("sfx")}cr`;
              const lbl = id === "tts" ? "TTS Studio" : id === "music" ? "Music AI" : "SFX / Efeitos";
              const ico = id === "tts"
                ? <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="4" y="2" width="6" height="8" rx="3" stroke={on ? C.o : C.t3} strokeWidth="1.2"/><path d="M2.5 8.5c0 2.5 2 4.5 4.5 4.5s4.5-2 4.5-4.5" stroke={on ? C.o : C.t3} strokeWidth="1.2" strokeLinecap="round"/></svg>
                : id === "music"
                  ? <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7h2.5l2-4.5 2 9 2-4.5H12" stroke={on ? C.o : C.t3} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 5v4M5.5 3v8M8 4.5v5M10.5 3v8M13 5v4" stroke={on ? C.o : C.t3} strokeWidth="1.1" strokeLinecap="round"/></svg>;
              return (
                <div key={id} onClick={() => setActiveTab(id)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 7,
                  cursor: "pointer", marginBottom: 1,
                  color: on ? C.t : C.t3,
                  background: on ? C.bg3 : "transparent",
                  border: on ? `1px solid ${C.b2}` : "1px solid transparent",
                }}>
                  <div style={{ width: 24, height: 24, borderRadius: 5, background: on ? C.bg5 : C.bg4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {ico}
                  </div>
                  <span style={{ fontSize: 12, flex: 1, whiteSpace: "nowrap", fontWeight: on ? 500 : 400 }}>{lbl}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8, background: on ? C.os : C.bg4, color: on ? C.o : C.t4, border: `1px solid ${on ? C.om : C.b}`, flexShrink: 0 }}>
                    {cr}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ height: 1, background: C.b, margin: "5px 8px" }} />

          {/* Scripts (only for TTS) */}
          {activeTab === "tts" && (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "0 8px 6px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.t4, padding: "0 9px 5px" }}>
                Scripts Prontos
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {PRESET_SCRIPTS.map((s, i) => (
                  <div key={i} onClick={() => setText(s.text)} style={{
                    display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px",
                    borderRadius: 7, cursor: "pointer", marginBottom: 2,
                    border: `1px solid transparent`,
                    transition: "all .15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.bg3; e.currentTarget.style.borderColor = C.b; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: C.t3, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                        {s.text.slice(0, 80)}…
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${C.b}`, padding: "9px 10px", marginTop: "auto", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t3 }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M6 1L4.5 4.5H1.5l2.5 2L3 10l3-2 3 2-1-3.5 2.5-2H7.5L6 1z" fill={C.o} opacity=".8"/>
              </svg>
              <strong style={{ color: C.t2, fontWeight: 600 }}>{(credits ?? 0).toLocaleString("pt-BR")}</strong>
              &nbsp;créditos
            </div>
          </div>
        </aside>

        {/* ── CENTER ── */}
        <main style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderRight: `1px solid ${C.b}` }}>

          {/* ── TTS TAB ── */}
          {activeTab === "tts" && <>
            {/* Center header */}
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.b}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="2" width="6" height="8" rx="3" stroke={C.o} strokeWidth="1.3"/><path d="M3 9.5c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke={C.o} strokeWidth="1.3" strokeLinecap="round"/></svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.t, letterSpacing: "-.02em" }}>TTS Studio</span>
              <span style={{ fontSize: 11, color: C.t3 }}>· MiniMax · alta fidelidade</span>
            </div>

            {/* Script */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", padding: "9px 14px", borderBottom: `1px solid ${C.b}`, gap: 8 }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1.5" stroke={C.t4} strokeWidth="1"/><path d="M3 4h6M3 6.5h4M3 9h5" stroke={C.t4} strokeWidth=".9" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.t4 }}>Script</span>
                <span style={{ fontSize: 10, color: C.t4, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                  {charCount.toLocaleString()} / 10.000
                </span>
              </div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                maxLength={10000}
                placeholder="Digite ou cole o texto que será convertido em voz…"
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  color: C.t, fontFamily: "'Geist', system-ui, sans-serif",
                  fontSize: 13.5, fontWeight: 300, padding: 14, resize: "none",
                  height: 100, lineHeight: 1.75, caretColor: C.o,
                }}
              />
            </div>

            {/* Language pills */}
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.b}`, display: "flex", gap: 5, flexWrap: "wrap", flexShrink: 0 }}>
              {[
                { code: "PT", flag: "🇧🇷" }, { code: "EN", flag: "🇺🇸" }, { code: "ES", flag: "🇪🇸" },
                { code: "FR", flag: "🇫🇷" }, { code: "DE", flag: "🇩🇪" }, { code: "JA", flag: "🇯🇵" },
                { code: "ZH", flag: "🇨🇳" }, { code: "KO", flag: "🇰🇷" },
              ].map(({ code, flag }) => {
                const on = voiceLang === code;
                return (
                  <div key={code} onClick={() => setVoiceLang(code)} style={{
                    fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                    border: on ? `1px solid ${C.o}` : `1px solid ${C.b}`,
                    background: on ? C.o : "transparent",
                    color: on ? "#fff" : C.t3, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5, userSelect: "none",
                  }}>
                    <span style={{ fontSize: 12 }}>{flag}</span>{code}
                  </div>
                );
              })}
            </div>

            {/* Voices + sliders — scrollable */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.t4, marginBottom: 8 }}>Voz</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                {filteredVoices.map(v => {
                  const on  = voiceId === v.id;
                  const col = vColor(v.id);
                  const wv  = miniWv(v.id);
                  return (
                    <div key={v.id} onClick={() => setVoiceId(v.id)} style={{
                      background: C.bg2, border: on ? `1px solid ${C.o}` : `1px solid ${C.b}`,
                      borderRadius: 11, padding: "11px 12px", cursor: "pointer",
                      transition: "all .2s", position: "relative", overflow: "hidden",
                      ...(on ? { background: C.os } : {}),
                    }}>
                      {/* Header: avatar + name + play btn */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, border: `1px solid ${col}33`, background: `${col}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: col }}>
                          {v.label.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: on ? C.t : C.t, letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.label}</div>
                          <div style={{ fontSize: 10, color: C.t3 }}>{v.gender === "M" ? "♂ Masculino" : "♀ Feminino"}</div>
                        </div>
                        <div
                          onClick={e => { e.stopPropagation(); loadVoicePreview(v.id); }}
                          style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, cursor: "pointer", transition: "all .15s", display: "flex", alignItems: "center", justifyContent: "center", border: on ? `1px solid ${C.om}` : `1px solid ${C.b}`, background: on ? C.os : C.bg4, color: on ? C.o : C.t3 }}
                        >
                          {loadingPreview === v.id
                            ? <span style={{ width: 8, height: 8, borderRadius: "50%", border: `1.5px solid ${C.t4}`, borderTopColor: C.t3, animation: "spin .7s linear infinite", display: "inline-block" }} />
                            : <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M3 2l6 3-6 3V2z" fill="currentColor"/></svg>
                          }
                        </div>
                      </div>
                      {/* Mini waveform */}
                      <div style={{ display: "flex", alignItems: "center", gap: 1.5, height: 16, marginBottom: 6 }}>
                        {wv.map((h, j) => (
                          <div key={j} style={{ width: 2, height: h, borderRadius: 1, background: col, opacity: on ? .8 : .35, transition: "opacity .2s" }} />
                        ))}
                      </div>
                      {/* Tags */}
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {v.gender === "M"
                          ? <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: on ? C.os : C.bg3, border: `1px solid ${on ? C.om : C.b}`, color: on ? C.o : C.t4, letterSpacing: ".03em" }}>Masculino</span>
                          : <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: on ? C.os : C.bg3, border: `1px solid ${on ? C.om : C.b}`, color: on ? C.o : C.t4, letterSpacing: ".03em" }}>Feminino</span>
                        }
                        <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: on ? C.os : C.bg3, border: `1px solid ${on ? C.om : C.b}`, color: on ? C.o : C.t4, letterSpacing: ".03em" }}>{v.lang}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Voice preview player */}
              {previewUrl && (
                <div style={{ marginBottom: 14, padding: "10px 12px", background: C.bg4, borderRadius: 8, border: `1px solid ${C.b2}` }}>
                  <div style={{ fontSize: 10, color: C.t3, marginBottom: 6 }}>Preview de voz</div>
                  <audio ref={previewAudioRef} controls src={previewUrl} style={{ width: "100%", height: 30, accentColor: C.o }} />
                </div>
              )}

              {/* Emotion */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.t4, marginBottom: 8 }}>Emoção</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {EMOTIONS.map(em => {
                    const on = emotion === em.id;
                    return (
                      <button key={em.id} onClick={() => setEmotion(em.id)} style={{
                        padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                        border: on ? `1px solid ${C.o}` : `1px solid ${C.b}`,
                        background: on ? C.o : "transparent",
                        color: on ? "#fff" : C.t3, fontWeight: on ? 600 : 400,
                      }}>
                        {em.icon} {em.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sliders */}
              <div style={{ paddingBottom: 12 }}>
                {[
                  { label: "Intensidade emocional", val: `${Math.round(vol * 20)}%`, min: 0.1, max: 5, step: 0.1, value: vol, onChange: (v: number) => setVol(v) },
                  { label: "Velocidade",            val: `${speed.toFixed(1)}×`,     min: 0.5, max: 2, step: 0.1, value: speed, onChange: (v: number) => setSpeed(v) },
                  { label: "Tom (pitch)",           val: pitch > 0 ? `+${pitch}` : `${pitch}`, min: -12, max: 12, step: 1, value: pitch, onChange: (v: number) => setPitch(v) },
                ].map(sl => (
                  <div key={sl.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: C.t3 }}>{sl.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.o }}>{sl.val}</span>
                    </div>
                    <input type="range" min={sl.min} max={sl.max} step={sl.step} value={sl.value}
                      onChange={e => sl.onChange(parseFloat(e.target.value))}
                      style={{ width: "100%", accentColor: C.o }} />
                  </div>
                ))}
              </div>

              {/* Error */}
              {genError && (
                <div style={{ padding: "10px 12px", borderRadius: 7, background: C.os, border: `1px solid ${C.om}`, color: C.o, fontSize: 12, marginBottom: 10 }}>
                  ⚠ {genError}
                </div>
              )}
            </div>

            {/* Generate footer */}
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.b}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, background: C.bg }}>
              <div style={{ fontSize: 11, color: C.t3, whiteSpace: "nowrap" }}>
                <strong style={{ color: C.t2, fontWeight: 600 }}>{computeCost("tts", { chars: text.length })} créditos</strong> por geração
              </div>
              <button onClick={generate} disabled={!text.trim() || generating}
                title={`Custo: ${computeCost("tts", { chars: text.length })} créditos (≈ 1 crédito a cada 100 caracteres). Reembolso automático em caso de falha.`}
                style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: 11, background: !text.trim() || generating ? C.bg4 : C.o,
                color: !text.trim() || generating ? C.t3 : "#fff",
                border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700,
                cursor: !text.trim() || generating ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="4" y="2" width="6" height="8" rx="3" stroke="currentColor" strokeWidth="1.2"/><path d="M2.5 8.5c0 2.5 2 4.5 4.5 4.5s4.5-2 4.5-4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                {generating ? "A gerar…" : "Gerar Áudio com MiniMax"}
              </button>
            </div>
          </>}

          {/* ── MUSIC TAB ── */}
          {activeTab === "music" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.b}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h2.5l2-4.5 2 9 2-4.5H12" stroke={C.o} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.t, letterSpacing: "-.02em" }}>Music AI</span>
                <span style={{ fontSize: 11, color: C.t3 }}>· até 60 segundos</span>
              </div>
              <div style={{ padding: "14px 18px" }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.t4, marginBottom: 7 }}>Descreva a música</div>
                  <textarea value={musicPrompt} onChange={e => setMusicPrompt(e.target.value)}
                    placeholder="Ex: trilha épica orquestral para abertura de vídeo corporativo..." rows={4}
                    style={{ width: "100%", background: C.bg4, border: `1px solid ${C.b}`, borderRadius: 7, padding: "12px 14px", color: C.t, fontSize: 13, lineHeight: 1.7, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.t4, marginBottom: 8 }}>Mood</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {MUSIC_MOODS.map(m => {
                      const on = musicMood === m.id;
                      return <button key={m.id} onClick={() => setMusicMood(m.id)} style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: on ? `1px solid ${C.o}` : `1px solid ${C.b}`, background: on ? C.o : "transparent", color: on ? "#fff" : C.t3, fontWeight: on ? 600 : 400 }}>{m.icon} {m.label}</button>;
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: C.t3 }}>Duração</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.o }}>{musicDuration}s</span>
                  </div>
                  <input type="range" min={5} max={60} step={5} value={musicDuration} onChange={e => setMusicDuration(parseInt(e.target.value))} style={{ width: "100%", accentColor: C.o }} />
                </div>
                {musicError && <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 7, background: C.os, border: `1px solid ${C.om}`, color: C.o, fontSize: 12 }}>⚠ {musicError}</div>}
                <button onClick={generateMusic} disabled={!musicPrompt.trim() || generatingMusic}
                  title={`Custo: ${computeCost("music", { duration: musicDuration })} créditos (proporcional à duração). Reembolso automático em caso de falha.`}
                  style={{ width: "100%", padding: "11px 0", borderRadius: 7, border: "none", cursor: !musicPrompt.trim() || generatingMusic ? "not-allowed" : "pointer", background: !musicPrompt.trim() || generatingMusic ? C.bg4 : C.o, color: !musicPrompt.trim() || generatingMusic ? C.t3 : "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                  {generatingMusic ? "🎵 A gerar música…" : `🎵 Gerar Música (${computeCost("music", { duration: musicDuration })} cr)`}
                </button>
                {musicEntry && <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.t4, marginBottom: 10 }}>Último resultado</div>
                  <AudioPlayer entry={musicEntry} onSendToTimeline={handleSendToTimeline} />
                </div>}
              </div>
            </div>
          )}

          {/* ── SFX TAB ── */}
          {activeTab === "sfx" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.b}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5v4M5.5 3v8M8 4.5v5M10.5 3v8M13 5v4" stroke={C.o} strokeWidth="1.1" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.t, letterSpacing: "-.02em" }}>SFX / Efeitos</span>
                <span style={{ fontSize: 11, color: C.t3 }}>· até 15 segundos</span>
              </div>
              <div style={{ padding: "14px 18px" }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.t4, marginBottom: 8 }}>Atalhos rápidos</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {SFX_PRESETS.map(p => {
                      const on = sfxPrompt === p;
                      return <button key={p} onClick={() => setSfxPrompt(p)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: on ? `1px solid ${C.o}` : `1px solid ${C.b}`, background: on ? C.o : "transparent", color: on ? "#fff" : C.t3, fontWeight: on ? 600 : 400 }}>{p}</button>;
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.t4, marginBottom: 7 }}>Descreva o efeito</div>
                  <textarea value={sfxPrompt} onChange={e => setSfxPrompt(e.target.value)}
                    placeholder="Ex: aplauso de plateia, trovão distante, passos em madeira..." rows={3}
                    style={{ width: "100%", background: C.bg4, border: `1px solid ${C.b}`, borderRadius: 7, padding: "12px 14px", color: C.t, fontSize: 13, lineHeight: 1.7, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: C.t3 }}>Duração</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.o }}>{sfxDuration}s</span>
                  </div>
                  <input type="range" min={2} max={15} step={1} value={sfxDuration} onChange={e => setSfxDuration(parseInt(e.target.value))} style={{ width: "100%", accentColor: C.o }} />
                </div>
                {sfxError && <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 7, background: C.os, border: `1px solid ${C.om}`, color: C.o, fontSize: 12 }}>⚠ {sfxError}</div>}
                <button onClick={generateSfx} disabled={!sfxPrompt.trim() || generatingSfx}
                  title={`Custo: ${computeCost("sfx")} créditos por efeito. Reembolso automático em caso de falha.`}
                  style={{ width: "100%", padding: "11px 0", borderRadius: 7, border: "none", cursor: !sfxPrompt.trim() || generatingSfx ? "not-allowed" : "pointer", background: !sfxPrompt.trim() || generatingSfx ? C.bg4 : C.o, color: !sfxPrompt.trim() || generatingSfx ? C.t3 : "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                  {generatingSfx ? "⚡ A gerar SFX…" : `⚡ Gerar SFX (${computeCost("sfx")} cr)`}
                </button>
              </div>
            </div>
          )}

          {/* ── LIBRARY TAB ── */}
          {activeTab === "library" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.b}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="5" height="10" rx="1" stroke={C.o} strokeWidth="1.2"/><rect x="9" y="4" width="4" height="8" rx="1" stroke={C.o} strokeWidth="1.2"/></svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.t, letterSpacing: "-.02em" }}>Biblioteca</span>
              </div>

              <div style={{ padding: "14px 18px" }}>
                {/* Audio Vault */}
                {Object.entries(AUDIO_VAULT).length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.o, marginBottom: 12 }}>🎵 Acervo Pessoal</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                      {Object.entries(AUDIO_VAULT).map(([category, tracks]) => (
                        <div key={category} style={{ background: C.bg4, borderRadius: 9, padding: 14, border: `1px solid ${C.b}` }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, textTransform: "uppercase", marginBottom: 10, letterSpacing: .8 }}>
                            {category.replace(/_/g, " ")}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {tracks.map((track, idx) => (
                              <button key={idx} onClick={() => { const a = new Audio(track.url); a.play().catch(() => {}); }} style={{ padding: "9px 11px", borderRadius: 6, border: `1px solid ${C.b}`, background: C.bg, color: C.t2, cursor: "pointer", fontSize: 11, textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13 }}>▶</span>
                                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Jamendo Free Library */}
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.grn, marginBottom: 12 }}>🎵 Biblioteca Gratuita</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <input value={pixabayQuery} onChange={e => setPixabayQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchPixabay(1)}
                      placeholder="Buscar músicas… (ex: ambient, cinematic, hype)"
                      style={{ flex: 1, padding: "9px 12px", borderRadius: 7, fontSize: 12, background: C.bg4, border: `1px solid ${C.b}`, color: C.t, outline: "none" }} />
                    <button onClick={() => searchPixabay(1)} disabled={pixabayLoading} style={{ padding: "9px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: C.o, border: "none", color: "#fff", cursor: "pointer", opacity: pixabayLoading ? .6 : 1 }}>
                      {pixabayLoading ? "..." : "🔍"}
                    </button>
                  </div>
                  {pixabayResults.length > 0 && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, marginBottom: 14 }}>
                        {pixabayResults.map(track => {
                          const playing = pixabayPlaying === track.id;
                          const fmtDur  = `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}`;
                          return (
                            <div key={track.id} style={{ background: playing ? C.bg5 : C.bg4, borderRadius: 9, padding: 12, border: playing ? `1px solid ${C.om}` : `1px solid ${C.b}` }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.t, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>{track.name}</div>
                                <span style={{ fontSize: 10, color: C.t4, flexShrink: 0 }}>{fmtDur}</span>
                              </div>
                              <div style={{ fontSize: 10, color: C.t3, marginBottom: 9 }}>{track.artist_name}</div>
                              <audio id={`pxaudio-${track.id}`} src={track.audio} onPlay={() => setPixabayPlaying(track.id)} onPause={() => setPixabayPlaying(null)} onEnded={() => setPixabayPlaying(null)} />
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                                <button onClick={() => {
                                  const el = document.getElementById(`pxaudio-${track.id}`) as HTMLAudioElement | null;
                                  if (!el) return;
                                  pixabayResults.forEach(t => { if (t.id !== track.id) { const o = document.getElementById(`pxaudio-${t.id}`) as HTMLAudioElement | null; o?.pause(); } });
                                  playing ? el.pause() : el.play().catch(() => {});
                                }} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: playing ? C.o : C.b2, color: "#fff", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  {playing ? "⏸" : "▶"}
                                </button>
                                <div style={{ flex: 1, height: 3, borderRadius: 2, background: C.b3, overflow: "hidden" }}>
                                  <div style={{ height: "100%", borderRadius: 2, background: playing ? C.o : C.b3, width: playing ? "100%" : "0%", transition: playing ? `width ${track.duration}s linear` : "none" }} />
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 5 }}>
                                <button onClick={async () => {
                                  const blob = await fetch(track.audio).then(r => r.blob()).catch(() => null);
                                  const url  = blob ? URL.createObjectURL(blob) : track.audio;
                                  const entry: AudioEntry = { id: `lib-${track.id}-${Date.now()}`, text: track.name, voiceId: "music-ai", voiceLabel: track.artist_name, emotion: "library", speed: 1, blob: blob ?? new Blob(), url, duration: track.duration, createdAt: Date.now() };
                                  setMusicEntry(entry); setActiveEntry(entry); setActiveTab("tts");
                                  toast.success(`"${track.name}" adicionado ao player`);
                                }} style={{ flex: 1, padding: "5px 0", borderRadius: 5, border: `1px solid ${C.om}`, background: C.os, color: C.o, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                                  ⚡ Usar
                                </button>
                                <button onClick={async () => {
                                  try {
                                    const res = await fetch(track.audio); const blob = await res.blob();
                                    const obj = URL.createObjectURL(blob); const a = document.createElement("a");
                                    a.href = obj; a.download = `${track.name}.mp3`; a.click();
                                    setTimeout(() => URL.revokeObjectURL(obj), 10000);
                                  } catch { window.open(track.audio, "_blank"); }
                                }} style={{ padding: "5px 9px", borderRadius: 5, border: `1px solid ${C.b}`, background: C.bg, color: C.t2, fontSize: 10, cursor: "pointer" }}>⬇</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button onClick={() => searchPixabay(pixabayPage - 1)} disabled={pixabayPage <= 1 || pixabayLoading} style={{ padding: "6px 14px", borderRadius: 6, background: C.bg4, border: `1px solid ${C.b}`, color: C.t2, cursor: "pointer", fontSize: 11 }}>← Anterior</button>
                        <span style={{ padding: "6px 11px", fontSize: 11, color: C.t4 }}>Pág. {pixabayPage} · {pixabayTotal}</span>
                        <button onClick={() => searchPixabay(pixabayPage + 1)} disabled={pixabayPage * 12 >= pixabayTotal || pixabayLoading} style={{ padding: "6px 14px", borderRadius: 6, background: C.bg4, border: `1px solid ${C.b}`, color: C.t2, cursor: "pointer", fontSize: 11 }}>Próxima →</button>
                      </div>
                    </>
                  )}
                  {!pixabayLoading && pixabayResults.length === 0 && (
                    <div style={{ textAlign: "center", padding: "28px 0", color: C.t4, fontSize: 13 }}>
                      {pixabaySearched ? "Nenhuma música encontrada." : "Digite um termo e clique em 🔍 para buscar."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === "history" && (() => {
            const allEntries = [...history, ...historyFromDB.filter(db => !history.find(h => h.id === db.id))].sort((a, b) => b.createdAt - a.createdAt);
            const filtered   = allEntries.filter(e => {
              const typeOk   = historyFilter === "all" || determineType(e) === historyFilter;
              const searchOk = !historySearch || e.text.toLowerCase().includes(historySearch.toLowerCase());
              return typeOk && searchOk;
            });
            const pages = Math.ceil(filtered.length / 20) || 1;
            const paged = filtered.slice(historyPage * 20, historyPage * 20 + 20);
            const typeIco = (e: AudioEntry) => ({ tts: "🎙️", music: "🎵", sfx: "⚡" })[determineType(e)];
            return (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.b}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke={C.o} strokeWidth="1.3"/><path d="M7 4.5v3l2 1" stroke={C.o} strokeWidth="1.1" strokeLinecap="round"/></svg>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.t, letterSpacing: "-.02em" }}>Histórico</span>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap" }}>
                    <input value={historySearch} onChange={e => { setHistorySearch(e.target.value); setHistoryPage(0); }} placeholder="Buscar por texto…"
                      style={{ flex: 1, minWidth: 160, padding: "7px 11px", borderRadius: 7, fontSize: 12, background: C.bg4, border: `1px solid ${C.b}`, color: C.t, outline: "none" }} />
                    {(["all", "tts", "music", "sfx"] as const).map(f => (
                      <button key={f} onClick={() => { setHistoryFilter(f); setHistoryPage(0); }} style={{ padding: "7px 12px", borderRadius: 7, fontSize: 11, cursor: "pointer", border: "none", background: historyFilter === f ? C.o : C.bg4, color: historyFilter === f ? "#fff" : C.t3, fontFamily: "inherit" }}>
                        {f === "all" ? "Todos" : f === "tts" ? "🎙️ TTS" : f === "music" ? "🎵 Music" : "⚡ SFX"}
                      </button>
                    ))}
                  </div>
                  {paged.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "50px 20px", color: C.t4, fontSize: 13 }}>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>🎙️</div>
                      {allEntries.length === 0
                        ? <><span>Nenhum áudio gerado ainda. </span><span style={{ color: C.o, cursor: "pointer" }} onClick={() => setActiveTab("tts")}>Ir para o Studio</span></>
                        : "Nenhum resultado para este filtro."}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {paged.map(e => (
                          <div key={e.id} style={{ padding: "12px 14px", borderRadius: 9, background: C.bg4, border: `1px solid ${C.b}`, display: "flex", alignItems: "center", gap: 11 }}>
                            <div style={{ fontSize: 18, flexShrink: 0 }}>{typeIco(e)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: C.t, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.text}</div>
                              <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
                                {e.voiceLabel && `${e.voiceLabel} · `}{Math.round(e.duration)}s · {new Date(e.createdAt).toLocaleDateString("pt-BR")}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                              {e.url && (
                                <button onClick={() => setActiveEntry(e)} style={{ padding: "4px 9px", borderRadius: 5, fontSize: 11, background: C.bg, border: `1px solid ${C.b}`, color: C.t2, cursor: "pointer" }}>▶</button>
                              )}
                              {determineType(e) === "tts" && e.text && (
                                <button onClick={() => { setText(e.text); setActiveTab("tts"); toast.success("Prompt copiado"); }} style={{ padding: "4px 9px", borderRadius: 5, fontSize: 11, background: C.bg, border: `1px solid ${C.b}`, color: C.t2, cursor: "pointer" }}>↻</button>
                              )}
                              <button onClick={() => deleteHistoryEntry(e.id)} disabled={deletingId === e.id} style={{ padding: "4px 9px", borderRadius: 5, fontSize: 11, background: C.bg, border: `1px solid ${C.b}`, color: deletingId === e.id ? C.t4 : "#F05", cursor: "pointer" }}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {pages > 1 && (
                        <div style={{ display: "flex", gap: 7, justifyContent: "center", marginTop: 14 }}>
                          <button onClick={() => setHistoryPage(p => Math.max(0, p - 1))} disabled={historyPage === 0} style={{ padding: "6px 14px", borderRadius: 6, background: C.bg4, border: `1px solid ${C.b}`, color: C.t2, cursor: "pointer", fontSize: 11 }}>← Anterior</button>
                          <span style={{ padding: "6px 11px", fontSize: 11, color: C.t4 }}>{historyPage + 1} / {pages}</span>
                          <button onClick={() => setHistoryPage(p => Math.min(pages - 1, p + 1))} disabled={historyPage >= pages - 1} style={{ padding: "6px 14px", borderRadius: 6, background: C.bg4, border: `1px solid ${C.b}`, color: C.t2, cursor: "pointer", fontSize: 11 }}>Próxima →</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </main>

        {/* ── RIGHT PANEL: PLAYER ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg2 }}>
          {/* Header */}
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.b}`, display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 8h3l2-4.5 2 9 2-4.5H12" stroke={C.t2} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.t }}>Player</span>
            <span style={{ fontSize: 10, color: C.t4, marginLeft: "auto" }}>
              {activeEntry ? "Pronto para ouvir" : "Aguardando geração"}
            </span>
          </div>

          {/* Player area */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {activeEntry ? (
              <AudioPlayer entry={activeEntry} onSendToTimeline={handleSendToTimeline} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "40px 12px", opacity: .5, textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.bg4, border: `1px solid ${C.b2}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="10" stroke={C.b3} strokeWidth="1.5"/><path d="M10 9l7 4-7 4V9z" fill={C.t4} opacity=".5"/></svg>
                </div>
                <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.6 }}>Gere um áudio para<br/>ouvir aqui</div>
              </div>
            )}

            {/* Recent list */}
            {history.length > 0 && (
              <>
                <div style={{ height: 1, background: C.b, margin: "14px 0 12px" }} />
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.t4, marginBottom: 9 }}>
                  Recentes ({history.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {history.slice(0, 8).map(e => {
                    const on = activeEntry?.id === e.id;
                    return (
                      <button key={e.id} onClick={() => setActiveEntry(e)} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "7px 9px",
                        borderRadius: 7, border: "none", cursor: "pointer", textAlign: "left",
                        background: on ? C.os : "transparent", color: on ? C.o : C.t3,
                        fontFamily: "inherit",
                      }}>
                        {/* Mini waveform for hist item */}
                        <div style={{ display: "flex", alignItems: "center", gap: 1, height: 18, flexShrink: 0 }}>
                          {[4,8,14,7,11,5,13].map((h, i) => (
                            <div key={i} style={{ width: 2, height: h, borderRadius: 1, background: on ? C.o : C.grn, opacity: h / 15 }} />
                          ))}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: on ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.text.slice(0, 26)}…</div>
                          <div style={{ fontSize: 9, color: on ? C.o : C.t4, marginTop: 1 }}>{e.voiceLabel}</div>
                        </div>
                        <span style={{ fontSize: 9, color: on ? C.o : C.t4, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{Math.round(e.duration)}s</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── LOADING OVERLAY ── */}
      {isLoading && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4,4,4,.93)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(16px)" }}>
          <div style={{ position: "relative", width: 80, height: 80, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid transparent", borderTopColor: C.o, animation: "ring-spin 1.1s linear infinite" }} />
            <div style={{ position: "absolute", inset: 5, borderRadius: "50%", border: "1px solid transparent", borderBottomColor: "rgba(232,81,42,.3)", animation: "ring-spin 1.8s linear infinite reverse" }} />
            <div style={{ width: 64, height: 64, borderRadius: 14, background: C.bg3, border: `1px solid ${C.b2}`, display: "flex", alignItems: "center", justifyContent: "center", animation: "ld-pulse 2s ease-in-out infinite" }}>
              <svg width="36" height="36" viewBox="0 0 64 64">
                <rect x="12" y="10" width="40" height="11" rx="4" fill="#E8E8E8" opacity=".9"/>
                <rect x="41" y="10" width="11" height="24" rx="4" fill="#E8E8E8" opacity=".9"/>
                <rect x="12" y="43" width="40" height="11" rx="4" fill={C.o}/>
                <rect x="12" y="30" width="11" height="24" rx="4" fill={C.o}/>
              </svg>
            </div>
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: C.o, marginBottom: 6 }}>
            Audio Studio
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.025em", color: C.t, marginBottom: 4, textAlign: "center" }}>
            {generating ? "Gerando áudio com MiniMax" : generatingMusic ? "Compondo música com IA" : "Gerando SFX com IA"}
          </div>
          <div style={{ fontSize: 12, color: C.t2, marginBottom: 24, fontWeight: 300, textAlign: "center" }}>
            {generating ? "Sintetizando voz de alta fidelidade..." : generatingMusic ? "Composição em andamento..." : "Processando efeito sonoro..."}
          </div>
          <div style={{ width: "100%", maxWidth: 360, height: 2, background: C.bg4, borderRadius: 1, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", background: `linear-gradient(90deg,${C.o},${C.o2})`, borderRadius: 1, animation: "ld-progress 4s ease-out forwards" }} />
          </div>
          <div style={{ fontSize: 11, color: C.t4 }}>Processando…</div>
        </div>
      )}

      {/* ── Credits modal ── */}
      {showCreditModal && (
        <InsufficientCreditsModal
          action={creditModalAction}
          cost={cost(creditModalAction)}
          credits={credits}
          onClose={() => setShowCreditModal(false)}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Hidden preview audio element */}
      <audio ref={previewAudioRef} style={{ display: "none" }} />

      {/* Suppress the variable-is-assigned warning */}
      <span style={{ display: "none" }}>{ttsLabel}</span>
    </div>
  );
}
