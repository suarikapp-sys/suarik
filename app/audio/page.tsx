"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { CreditsBar, InsufficientCreditsModal } from "@/components/CreditsBar";
import { useToast, ToastContainer } from "@/components/Toast";
import { AUDIO_VAULT } from "../lib/audioVault";

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function uploadToR2(blob: Blob, filename: string, contentType: string): Promise<string> {
  const { uploadUrl, publicUrl } = await fetch("/api/upload", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ filename, contentType }),
  }).then(r => r.json());
  await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": contentType } });
  return publicUrl as string;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type AudioEntry = {
  id:        string;
  text:      string;
  voiceId:   string;
  voiceLabel:string;
  emotion:   string;
  speed:     number;
  blob:      Blob;
  url:       string;   // object URL
  duration:  number;
  createdAt: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const VOICES = [
  // English Voices
  { id: "English_expressive_narrator", label: "English — Expressive Narrator", lang: "EN", gender: "M" },
  { id: "English_Graceful_Lady", label: "English — Graceful Lady", lang: "EN", gender: "F" },
  { id: "English_Insightful_Speaker", label: "English — Insightful Speaker", lang: "EN", gender: "M" },
  { id: "English_radiant_girl", label: "English — Radiant Girl", lang: "EN", gender: "F" },
  { id: "English_Persuasive_Man", label: "English — Persuasive Man", lang: "EN", gender: "M" },
  { id: "English_Lucky_Robot", label: "English — Lucky Robot", lang: "EN", gender: "M" },
  // Chinese Voices
  { id: "Chinese (Mandarin)_Lyrical_Voice", label: "Chinese (Mandarin) — Lyrical Voice", lang: "ZH", gender: "F" },
  { id: "Chinese (Mandarin)_HK_Flight_Attendant", label: "Chinese (Mandarin) — HK Flight Attendant", lang: "ZH", gender: "F" },
  // Japanese Voices
  { id: "Japanese_Whisper_Belle", label: "Japanese — Whisper Belle", lang: "JA", gender: "F" },
];

const EMOTIONS = [
  { id: "neutral",   label: "Neutro",   icon: "😐" },
  { id: "happy",     label: "Feliz",    icon: "😄" },
  { id: "sad",       label: "Triste",   icon: "😢" },
  { id: "angry",     label: "Raiva",    icon: "😠" },
  { id: "surprised", label: "Surpreso", icon: "😲" },
  { id: "fearful",   label: "Medo",     icon: "😨" },
];

const PRESET_SCRIPTS = [
  { label: "Narração de produto",  text: "Apresentamos a solução que vai transformar o seu negócio. Simples, poderosa e eficiente. Experimente agora e descubra o futuro." },
  { label: "Chamada para ação",    text: "Não perca essa oportunidade única! Clique no link da bio e garanta o seu acesso agora mesmo. Vagas limitadas!" },
  { label: "Intro de podcast",     text: "Bem-vindo ao canal. Hoje vamos falar sobre um assunto que vai mudar a forma como você pensa sobre produtividade e resultados." },
  { label: "Depoimento fictício",  text: "Antes eu não sabia por onde começar. Depois que descobri esse método, minha vida mudou completamente. Hoje estou colhendo os resultados." },
];

const MUSIC_MOODS = [
  { id: "energetic",     label: "Energético",    icon: "⚡" },
  { id: "calm",          label: "Calmo",          icon: "🌊" },
  { id: "dramatic",      label: "Dramático",      icon: "🎭" },
  { id: "happy",         label: "Alegre",         icon: "😄" },
  { id: "sad",           label: "Melancólico",    icon: "😢" },
  { id: "tense",         label: "Tenso",          icon: "😰" },
  { id: "inspirational", label: "Inspiracional",  icon: "✨" },
];

const SFX_PRESETS = [
  "Aplauso", "Trovão", "Passos", "Campainha", "Explosão",
  "Vento", "Chuva", "Teclado", "Riso", "Silvo",
];

const NAV_ITEMS = [
  { id: "tts",     icon: "🎙️", label: "TTS Studio",   cost: 10  },
  { id: "music",   icon: "🎵", label: "Music AI",      cost: 15  },
  { id: "sfx",     icon: "⚡", label: "SFX / Efeitos", cost: 10  },
  { id: "library", icon: "📚", label: "Biblioteca"              },
  { id: "history", icon: "🕘", label: "Histórico"               },
] as const;

type ActiveTab = "tts" | "music" | "sfx" | "library" | "history";

// ─── Waveform ─────────────────────────────────────────────────────────────────
function Waveform({ active, progress }: { active: boolean; progress: number }) {
  const bars = 48;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 48, padding: "0 4px" }}>
      {Array.from({ length: bars }).map((_, i) => {
        const filled = i / bars <= progress;
        const h = Math.round(8 + Math.abs(Math.sin((i * 0.45) + 1.2) * 28 + Math.sin(i * 0.9) * 8));
        return (
          <div key={i} style={{
            flex: 1, borderRadius: 2,
            height: h,
            backgroundColor: filled
              ? "#F0563A"
              : active ? "rgba(240,86,58,0.3)" : "rgba(255,255,255,0.12)",
            transition: "background-color 0.1s",
          }} />
        );
      })}
    </div>
  );
}

// ─── WAV encoder (for trimmer) ────────────────────────────────────────────────
function audioBufferToWav(buf: AudioBuffer): Blob {
  const numCh = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
  const data = new Float32Array(len * numCh);
  for (let c = 0; c < numCh; c++) buf.getChannelData(c).forEach((v, i) => { data[i * numCh + c] = v; });
  const pcm = new Int16Array(data.length);
  data.forEach((v, i) => { pcm[i] = Math.max(-1, Math.min(1, v)) * 0x7fff; });
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (off: number, val: number, b: number) => b === 4 ? view.setUint32(off, val, true) : b === 2 ? view.setUint16(off, val, true) : view.setUint8(off, val);
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

// ─── Audio Player ─────────────────────────────────────────────────────────────
function AudioPlayer({ entry, onSendToTimeline }: { entry: AudioEntry; onSendToTimeline: (e: AudioEntry) => void }) {
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
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      const sr = decoded.sampleRate;
      const startSample = Math.floor(trimStart * sr);
      const endSample   = Math.min(Math.floor(trimEnd * sr), decoded.length);
      const length      = endSample - startSample;
      const trimmed = ctx.createBuffer(decoded.numberOfChannels, length, sr);
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        trimmed.copyToChannel(decoded.getChannelData(c).slice(startSample, endSample), c);
      }
      // Encode to WAV blob
      const wavBlob = audioBufferToWav(trimmed);
      const url = URL.createObjectURL(wavBlob);
      if (audioRef.current) { audioRef.current.src = url; audioRef.current.load(); }
      entry.url = url; entry.blob = wavBlob; entry.duration = trimEnd - trimStart;
      setTrimStart(0); setTrimEnd(entry.duration); setShowTrim(false);
      await ctx.close();
    } catch { /* silent */ } finally { setTrimming(false); }
  };

  return (
    <div style={{ background: "#1a1a1a", borderRadius: 12, padding: 16, border: "1px solid #2a2a2a" }}>
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

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>
          {entry.voiceLabel} · {entry.emotion}
        </span>
        <span style={{ fontSize: 11, color: "#555" }}>
          {new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div onClick={handleSeek} style={{ cursor: "pointer", marginBottom: 8, borderRadius: 6, overflow: "hidden", background: "#111", padding: "4px 0" }}>
        <Waveform active={playing} progress={progress} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 10 }}>
        <span>{fmt(current)}</span>
        <span>{fmt(entry.duration)}</span>
      </div>

      {/* Speed control */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {[0.5, 0.75, 1, 1.5, 2].map(r => (
          <button key={r} onClick={() => setRate(r)}
            style={{ flex: 1, padding: "4px 0", borderRadius: 6, fontSize: 11, cursor: "pointer", border: "none",
              background: rate === r ? "#F0563A" : "#111",
              color:      rate === r ? "#fff"    : "#666",
              fontWeight: rate === r ? 700       : 400 }}>
            {r}x
          </button>
        ))}
      </div>

      {/* Main controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button onClick={toggle} style={{ flex: 1, height: 40, borderRadius: 8, border: "none", cursor: "pointer", background: "#F0563A", color: "#fff", fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {playing ? "⏸" : "▶"}
        </button>
        <a href={entry.url} download={`suarik-audio-${entry.id}.mp3`}
          style={{ width: 40, height: 40, borderRadius: 8, border: "1px solid #333", background: "#222", color: "#ccc", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
          title="Baixar MP3">↓</a>
        <button onClick={() => setShowTrim(t => !t)}
          style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${showTrim ? "#F0563A55" : "#333"}`, background: showTrim ? "#F0563A22" : "#222", color: showTrim ? "#F0563A" : "#ccc", fontSize: 15, cursor: "pointer" }}
          title="Trimmer">✂</button>
        <button onClick={() => onSendToTimeline(entry)}
          style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #6305ef55", background: "#6305ef22", color: "#a78bfa", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          ⚡ Editor
        </button>
      </div>

      {/* Trimmer panel */}
      {showTrim && (
        <div style={{ background: "#111", borderRadius: 8, padding: 12, border: "1px solid #2a2a2a", marginTop: 4 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>✂ Trimmer — {fmt(trimStart)} → {fmt(trimEnd)}</div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 10, color: "#666" }}>Início: {fmt(trimStart)}</label>
            <input type="range" min={0} max={entry.duration} step={0.1} value={trimStart}
              onChange={e => setTrimStart(Math.min(+e.target.value, trimEnd - 0.5))}
              style={{ width: "100%", accentColor: "#F0563A" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, color: "#666" }}>Fim: {fmt(trimEnd)}</label>
            <input type="range" min={0} max={entry.duration} step={0.1} value={trimEnd}
              onChange={e => setTrimEnd(Math.max(+e.target.value, trimStart + 0.5))}
              style={{ width: "100%", accentColor: "#F0563A" }} />
          </div>
          <button onClick={applyTrim} disabled={trimming || trimStart >= trimEnd}
            style={{ width: "100%", padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: trimming ? "#333" : "#F0563A", color: "#fff" }}>
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

  // ── TTS Form state ──
  const [text,      setText]      = useState("");
  const [voiceId,   setVoiceId]   = useState(VOICES[0].id);
  const [emotion,   setEmotion]   = useState("neutral");
  const [speed,     setSpeed]     = useState(1.0);
  const [vol,       setVol]       = useState(1.0);
  const [pitch,     setPitch]     = useState(0);

  // ── TTS Generation ──
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState<string | null>(null);

  // ── Music state ──
  const [musicPrompt,     setMusicPrompt]     = useState("");
  const [musicDuration,   setMusicDuration]   = useState(30);
  const [musicMood,       setMusicMood]       = useState("energetic");
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [musicError,      setMusicError]      = useState<string | null>(null);
  const [musicEntry,      setMusicEntry]      = useState<AudioEntry | null>(null);

  // ── SFX state ──
  const [sfxPrompt,     setSfxPrompt]     = useState("");
  const [sfxDuration,   setSfxDuration]   = useState(5);
  const [generatingSfx, setGeneratingSfx] = useState(false);
  const [sfxError,      setSfxError]      = useState<string | null>(null);

  // ── Free Music Library (Jamendo) ──
  const [pixabayQuery,   setPixabayQuery]   = useState("");
  const [pixabayResults, setPixabayResults] = useState<{ id: string; name: string; artist_name: string; audio: string; duration: number }[]>([]);
  const [pixabayLoading, setPixabayLoading] = useState(false);
  const [pixabayPage,    setPixabayPage]    = useState(1);
  const [pixabayTotal,   setPixabayTotal]   = useState(0);
  const [pixabayPlaying, setPixabayPlaying] = useState<string | null>(null);
  const [pixabaySearched, setPixabaySearched] = useState(false);

  // ── History state ──
  const [historySearch,   setHistorySearch]   = useState("");
  const [historyFilter,   setHistoryFilter]   = useState<"all" | "tts" | "music" | "sfx">("all");
  const [historyPage,     setHistoryPage]     = useState(0);
  const [historyFromDB,   setHistoryFromDB]   = useState<AudioEntry[]>([]);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);

  // ── History ──
  const [history,      setHistory]      = useState<AudioEntry[]>([]);
  const [activeEntry,  setActiveEntry]  = useState<AudioEntry | null>(null);

  // ── Voice Preview ──
  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null); // voiceId em loading
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Credits ──
  const { credits, plan, spend, cost, refresh } = useCredits();
  const { toasts, remove: removeToast, toast } = useToast();
  const [showCreditModal,  setShowCreditModal]  = useState(false);
  const [creditModalAction, setCreditModalAction] = useState<string>("tts");

  const charCount = text.length;
  const voiceObj  = VOICES.find(v => v.id === voiceId) ?? VOICES[0];

  // ── Voice Preview ──
  const loadVoicePreview = useCallback(async (vid: string) => {
    // Check localStorage cache (24h)
    const cacheKey = `voice_preview_${vid}`;
    const cached = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: vid }),
      });
      if (!res.ok) throw new Error("Preview falhou");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      // Cache base64 in localStorage for 24h
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

  // ── Free Music Search (Jamendo via proxy) ──
  const searchPixabay = useCallback(async (page = 1) => {
    const q = pixabayQuery.trim() || "ambient";
    setPixabayLoading(true);
    try {
      const res = await fetch(`/api/music-library?q=${encodeURIComponent(q)}&page=${page}`);
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
      const res = await fetch("/api/projects");
      if (!res.ok) return;
      const data = await res.json();
      const audioProjects = (data.projects ?? [])
        .filter((p: Record<string, unknown>) => p.tool === "audio")
        .map((p: Record<string, unknown>) => ({
          id:         p.id as string,
          text:       p.title as string,
          voiceId:    (p.meta as Record<string, unknown>)?.voiceId as string ?? "unknown",
          voiceLabel: (p.meta as Record<string, unknown>)?.voiceLabel as string ?? "",
          emotion:    (p.meta as Record<string, unknown>)?.emotion as string ?? "",
          speed:      (p.meta as Record<string, unknown>)?.speed as number ?? 1,
          blob:       new Blob(),
          url:        p.result_url as string ?? "",
          duration:   (p.meta as Record<string, unknown>)?.duration as number ?? 0,
          createdAt:  new Date(p.created_at as string).getTime(),
        }));
      setHistoryFromDB(audioProjects);
    } catch { /* silent */ }
  }, []);

  const deleteHistoryEntry = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
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

    const result = await spend("tts");
    if (!result.ok) { setCreditModalAction("tts"); setShowCreditModal(true); return; }

    setGenerating(true);
    setGenError(null);

    try {
      const res = await fetch("/api/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), voiceId, speed, vol, pitch, emotion }),
      });

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
      try {
        persistUrl = await uploadToR2(blob, `audio-${Date.now()}.mp3`, "audio/mpeg");
      } catch { /* non-fatal */ }

      if (persistUrl) {
        fetch("/api/projects", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool:       "audio",
            title:      text.trim().slice(0, 60),
            result_url: persistUrl,
            meta:       { voiceId, voiceLabel: voiceObj.label, emotion, speed, duration },
          }),
        }).catch(() => {});
      }

      const entry: AudioEntry = {
        id:         Date.now().toString(36),
        text:       text.trim().slice(0, 80) + (text.length > 80 ? "…" : ""),
        voiceId,
        voiceLabel: voiceObj.label,
        emotion,
        speed,
        blob,
        url:        persistUrl ?? url,
        duration,
        createdAt:  Date.now(),
      };

      setHistory(h => [entry, ...h]);
      setActiveEntry(entry);
      toast.success("Áudio gerado com sucesso!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar áudio";
      setGenError(msg);
      toast.error(msg);
      // Refund the 10 credits on API failure so user isn't charged for nothing
      try {
        await fetch("/api/credits/refund", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "tts" }),
        });
        refresh();
      } catch { /* non-fatal */ }
    } finally {
      setGenerating(false);
    }
  }, [text, voiceId, emotion, speed, vol, pitch, generating, voiceObj.label, toast, refresh]);

  // ── Music Generate ──
  const generateMusic = useCallback(async () => {
    if (!musicPrompt.trim() || generatingMusic) return;

    const result = await spend("music");
    if (!result.ok) { setCreditModalAction("music"); setShowCreditModal(true); return; }

    setGeneratingMusic(true);
    setMusicError(null);

    try {
      const res = await fetch("/api/music", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: musicPrompt.trim(), type: "music", duration: musicDuration, mood: musicMood }),
      });

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
      try {
        persistUrl = await uploadToR2(blob, `music-${Date.now()}.mp3`, "audio/mpeg");
      } catch { /* non-fatal */ }

      if (persistUrl) {
        fetch("/api/projects", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool:       "audio",
            title:      musicPrompt.trim().slice(0, 60),
            result_url: persistUrl,
            meta:       { voiceLabel: "Music AI", emotion: musicMood, duration },
          }),
        }).catch(() => {});
      }

      const entry: AudioEntry = {
        id:         Date.now().toString(36),
        text:       musicPrompt.trim().slice(0, 80) + (musicPrompt.length > 80 ? "…" : ""),
        voiceId:    "music-ai",
        voiceLabel: "Music AI",
        emotion:    musicMood,
        speed:      1,
        blob,
        url:        persistUrl ?? url,
        duration,
        createdAt:  Date.now(),
      };

      setMusicEntry(entry);
      setHistory(h => [entry, ...h]);
      setActiveEntry(entry);
      toast.success("Música gerada com sucesso! 🎵");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar música";
      setMusicError(msg);
      toast.error(msg);
    } finally {
      setGeneratingMusic(false);
    }
  }, [musicPrompt, musicDuration, musicMood, generatingMusic, toast]);

  // ── SFX Generate ──
  const generateSfx = useCallback(async () => {
    if (!sfxPrompt.trim() || generatingSfx) return;

    const result = await spend("sfx");
    if (!result.ok) { setCreditModalAction("sfx"); setShowCreditModal(true); return; }

    setGeneratingSfx(true);
    setSfxError(null);

    try {
      const res = await fetch("/api/music", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: sfxPrompt.trim(), type: "sfx", duration: sfxDuration }),
      });

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
      try {
        persistUrl = await uploadToR2(blob, `sfx-${Date.now()}.mp3`, "audio/mpeg");
      } catch { /* non-fatal */ }

      if (persistUrl) {
        fetch("/api/projects", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool:       "audio",
            title:      sfxPrompt.trim().slice(0, 60),
            result_url: persistUrl,
            meta:       { voiceLabel: "SFX", emotion: "sfx", duration },
          }),
        }).catch(() => {});
      }

      const entry: AudioEntry = {
        id:         Date.now().toString(36),
        text:       sfxPrompt.trim().slice(0, 80) + (sfxPrompt.length > 80 ? "…" : ""),
        voiceId:    "sfx",
        voiceLabel: "SFX",
        emotion:    "sfx",
        speed:      1,
        blob,
        url:        persistUrl ?? url,
        duration,
        createdAt:  Date.now(),
      };

      setHistory(h => [entry, ...h]);
      setActiveEntry(entry);
      toast.success("SFX gerado com sucesso! ⚡");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar SFX";
      setSfxError(msg);
      toast.error(msg);
    } finally {
      setGeneratingSfx(false);
    }
  }, [sfxPrompt, sfxDuration, generatingSfx, toast]);

  // ── Send to timeline ──
  function handleSendToTimeline(entry: AudioEntry) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("vb_pending_audio", JSON.stringify({
        url:       entry.url,
        label:     entry.voiceLabel,
        duration:  entry.duration,
      }));
      sessionStorage.setItem("vb_restore_requested", "1");
    }
    router.push("/storyboard");
  }

  // ── Preset ──
  function applyPreset(t: string) { setText(t); }

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
            width: 32, height: 32, borderRadius: 8,
            background: "#F0563A", display: "flex", alignItems: "center",
            justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#fff",
          }}>S</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>SUARIK</span>
          <span style={{ color: "#444", fontSize: 18, marginLeft: 4 }}>/</span>
          <span style={{ color: "#ccc", fontSize: 14 }}>Audio Studio</span>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <CreditsBar credits={credits} plan={plan} compact />
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              padding: "5px 14px", borderRadius: 6, border: "1px solid #333",
              background: "transparent", color: "#aaa", fontSize: 12, cursor: "pointer",
            }}
          >Dashboard</button>
          <button
            onClick={() => router.push("/storyboard")}
            style={{
              padding: "5px 14px", borderRadius: 6, border: "1px solid #6305ef55",
              background: "#6305ef22", color: "#a78bfa", fontSize: 12, cursor: "pointer", fontWeight: 600,
            }}
          >⚡ Editor</button>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", background: "#F0563A",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13, color: "#fff",
          }}>{initials}</div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT SIDEBAR ── */}
        <aside style={{
          width: 220, background: "#1C1B1B", borderRight: "1px solid #222",
          display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto",
        }}>
          {/* Nav */}
          <div style={{ padding: "16px 12px 8px" }}>
            <p style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>
              Ferramentas
            </p>
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "9px 12px", borderRadius: 8,
                  border: "none", cursor: "pointer", marginBottom: 2, textAlign: "left",
                  background: activeTab === item.id ? "#F0563A18" : "transparent",
                  color:      activeTab === item.id ? "#F0563A"   : "#888",
                  fontWeight: activeTab === item.id ? 600          : 400,
                  fontSize: 13,
                }}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {"cost" in item && (
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    color: activeTab === item.id ? "#F0563A" : "#555",
                    background: activeTab === item.id ? "#F0563A18" : "#1a1a1a",
                    border: `1px solid ${activeTab === item.id ? "#F0563A44" : "#2a2a2a"}`,
                    borderRadius: 10, padding: "1px 6px",
                  }}>
                    {item.cost}cr
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: "#222", margin: "8px 12px" }} />

          {/* Presets — only show for TTS tab */}
          {activeTab === "tts" && (
            <div style={{ padding: "8px 12px" }}>
              <p style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
                Scripts Prontos
              </p>
              {PRESET_SCRIPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => applyPreset(p.text)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "7px 10px", borderRadius: 6, marginBottom: 4,
                    border: "1px solid #2a2a2a", background: "#111",
                    color: "#aaa", fontSize: 11, cursor: "pointer",
                    lineHeight: 1.4,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Other tools */}
          <div style={{ padding: "8px 12px 16px", borderTop: "1px solid #222" }}>
            <p style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Outras Ferramentas
            </p>
            <button
              onClick={() => router.push("/dreamface")}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "9px 12px", borderRadius: 8,
                border: "none", cursor: "pointer",
                background: "transparent", color: "#888", fontSize: 13, textAlign: "left",
              }}
            >
              <span>🎭</span> LipSync
            </button>
            <button
              onClick={() => router.push("/storyboard")}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "9px 12px", borderRadius: 8,
                border: "none", cursor: "pointer",
                background: "transparent", color: "#888", fontSize: 13, textAlign: "left",
              }}
            >
              <span>🎬</span> Timeline Editor
            </button>
          </div>
        </aside>

        {/* ── MAIN CENTER ── */}
        <main style={{ flex: 1, overflowY: "auto", padding: 28, minWidth: 0 }}>

          {/* ── TTS TAB ── */}
          {activeTab === "tts" && (
            <div style={{ maxWidth: 720, margin: "0 auto" }}>

              {/* Section title */}
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🎙️ TTS Studio</h1>
                <p style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
                  Converta texto em voz com MiniMax · modelos de alta fidelidade
                </p>
              </div>

              {/* Script textarea */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Script
                  </label>
                  <span style={{ fontSize: 11, color: charCount > 9000 ? "#F0563A" : "#555" }}>
                    {charCount.toLocaleString()} / 10.000
                  </span>
                </div>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  maxLength={10000}
                  placeholder="Digite ou cole o texto que será convertido em voz..."
                  rows={7}
                  style={{
                    width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
                    borderRadius: 10, padding: "14px 16px", color: "#fff",
                    fontSize: 14, lineHeight: 1.7, resize: "vertical",
                    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Voice selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 10 }}>
                  Voz
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {VOICES.map(v => (
                    <div
                      key={v.id}
                      style={{
                        padding: "10px 12px", borderRadius: 10, textAlign: "left",
                        transition: "all 0.15s",
                        border:     voiceId === v.id ? "1.5px solid #F0563A" : "1px solid #2a2a2a",
                        background: voiceId === v.id ? "#F0563A18"           : "#1a1a1a",
                        cursor: "pointer",
                      }}
                      onClick={() => setVoiceId(v.id)}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: voiceId === v.id ? "#F0563A" : "#ccc", marginBottom: 2 }}>
                        {v.label}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 10, color: "#555" }}>
                          {v.lang} · {v.gender === "M" ? "Masculino" : "Feminino"}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); loadVoicePreview(v.id); }}
                          disabled={loadingPreview === v.id}
                          title="Preview desta voz"
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 13, padding: "2px 4px", borderRadius: 4,
                            color: loadingPreview === v.id ? "#555" : "#888",
                            opacity: loadingPreview === v.id ? 0.5 : 1,
                          }}
                        >
                          {loadingPreview === v.id ? "⏳" : "🔊"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Preview player inline */}
                {previewUrl && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "#111", borderRadius: 8, border: "1px solid #2a2a2a" }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Preview de voz</div>
                    <audio
                      ref={previewAudioRef}
                      controls
                      src={previewUrl}
                      style={{ width: "100%", height: 32, accentColor: "#F0563A" }}
                    />
                  </div>
                )}
              </div>

              {/* Emotion */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 10 }}>
                  Emoção
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EMOTIONS.map(em => (
                    <button
                      key={em.id}
                      onClick={() => setEmotion(em.id)}
                      style={{
                        padding: "7px 14px", borderRadius: 20, fontSize: 12,
                        cursor: "pointer", transition: "all 0.15s",
                        border:      emotion === em.id ? "1.5px solid #F0563A" : "1px solid #2a2a2a",
                        background:  emotion === em.id ? "#F0563A18"           : "#1a1a1a",
                        color:       emotion === em.id ? "#F0563A"             : "#888",
                        fontWeight:  emotion === em.id ? 600                   : 400,
                      }}
                    >
                      {em.icon} {em.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 28 }}>
                {/* Speed */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.8 }}>Velocidade</label>
                    <span style={{ fontSize: 11, color: "#F0563A", fontWeight: 600 }}>{speed.toFixed(1)}×</span>
                  </div>
                  <input
                    type="range" min={0.5} max={2.0} step={0.1}
                    value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#F0563A" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginTop: 2 }}>
                    <span>0.5×</span><span>2.0×</span>
                  </div>
                </div>

                {/* Volume */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.8 }}>Volume</label>
                    <span style={{ fontSize: 11, color: "#F0563A", fontWeight: 600 }}>{vol.toFixed(1)}</span>
                  </div>
                  <input
                    type="range" min={0.1} max={5.0} step={0.1}
                    value={vol} onChange={e => setVol(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#F0563A" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginTop: 2 }}>
                    <span>0.1</span><span>5.0</span>
                  </div>
                </div>

                {/* Pitch */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.8 }}>Tom</label>
                    <span style={{ fontSize: 11, color: "#F0563A", fontWeight: 600 }}>
                      {pitch > 0 ? `+${pitch}` : pitch}
                    </span>
                  </div>
                  <input
                    type="range" min={-12} max={12} step={1}
                    value={pitch} onChange={e => setPitch(parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#F0563A" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginTop: 2 }}>
                    <span>-12</span><span>+12</span>
                  </div>
                </div>
              </div>

              {/* Error */}
              {genError && (
                <div style={{
                  marginBottom: 16, padding: "10px 14px", borderRadius: 8,
                  background: "#F0563A18", border: "1px solid #F0563A55", color: "#F0563A",
                  fontSize: 13,
                }}>
                  ⚠ {genError}
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={generate}
                disabled={!text.trim() || generating}
                style={{
                  width: "100%", height: 52, borderRadius: 12, border: "none",
                  cursor: !text.trim() || generating ? "not-allowed" : "pointer",
                  background: !text.trim() || generating
                    ? "#2a2a2a"
                    : "linear-gradient(135deg, #F0563A, #d4400a)",
                  color: !text.trim() || generating ? "#555" : "#fff",
                  fontSize: 15, fontWeight: 700, letterSpacing: 0.5,
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}
              >
                {generating ? (
                  <>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%",
                      border: "2px solid #555", borderTopColor: "#aaa",
                      animation: "spin 0.7s linear infinite", display: "inline-block",
                    }} />
                    Gerando áudio...
                  </>
                ) : (
                  <>✦ Gerar Áudio <span style={{ fontSize: 11, opacity: 0.7 }}>({cost("tts")} créditos)</span></>
                )}
              </button>

            </div>
          )}

          {/* ── MUSIC TAB ── */}
          {activeTab === "music" && (
            <div style={{ maxWidth: 720, margin: "0 auto" }}>

              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🎵 Music AI</h1>
                <p style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
                  Gere trilhas sonoras originais com IA · até 60 segundos
                </p>
              </div>

              {/* Prompt */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 6 }}>
                  Descreva a música
                </label>
                <textarea
                  value={musicPrompt}
                  onChange={e => setMusicPrompt(e.target.value)}
                  placeholder="Ex: trilha épica orquestral para abertura de vídeo corporativo..."
                  rows={4}
                  style={{
                    width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
                    borderRadius: 10, padding: "14px 16px", color: "#fff",
                    fontSize: 14, lineHeight: 1.7, resize: "vertical",
                    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Mood */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 10 }}>
                  Mood / Estilo
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {MUSIC_MOODS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMusicMood(m.id)}
                      style={{
                        padding: "7px 14px", borderRadius: 20, fontSize: 12,
                        cursor: "pointer", transition: "all 0.15s",
                        border:     musicMood === m.id ? "1.5px solid #F0563A" : "1px solid #2a2a2a",
                        background: musicMood === m.id ? "#F0563A18"           : "#1a1a1a",
                        color:      musicMood === m.id ? "#F0563A"             : "#888",
                        fontWeight: musicMood === m.id ? 600                   : 400,
                      }}
                    >
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration slider */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Duração
                  </label>
                  <span style={{ fontSize: 12, color: "#F0563A", fontWeight: 600 }}>{musicDuration}s</span>
                </div>
                <input
                  type="range" min={5} max={60} step={5}
                  value={musicDuration} onChange={e => setMusicDuration(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "#F0563A" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginTop: 2 }}>
                  <span>5s</span><span>60s</span>
                </div>
              </div>

              {/* Error */}
              {musicError && (
                <div style={{
                  marginBottom: 16, padding: "10px 14px", borderRadius: 8,
                  background: "#F0563A18", border: "1px solid #F0563A55", color: "#F0563A",
                  fontSize: 13,
                }}>
                  ⚠ {musicError}
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={generateMusic}
                disabled={!musicPrompt.trim() || generatingMusic}
                style={{
                  width: "100%", height: 52, borderRadius: 12, border: "none",
                  cursor: !musicPrompt.trim() || generatingMusic ? "not-allowed" : "pointer",
                  background: !musicPrompt.trim() || generatingMusic
                    ? "#2a2a2a"
                    : "linear-gradient(135deg, #F0563A, #d4400a)",
                  color: !musicPrompt.trim() || generatingMusic ? "#555" : "#fff",
                  fontSize: 15, fontWeight: 700, letterSpacing: 0.5,
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}
              >
                {generatingMusic ? (
                  <>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%",
                      border: "2px solid #555", borderTopColor: "#aaa",
                      animation: "spin 0.7s linear infinite", display: "inline-block",
                    }} />
                    Gerando música...
                  </>
                ) : (
                  <>🎵 Gerar Música <span style={{ fontSize: 11, opacity: 0.7 }}>(15 créditos)</span></>
                )}
              </button>

              {/* Last result preview */}
              {musicEntry && (
                <div style={{ marginTop: 24 }}>
                  <p style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                    Último resultado
                  </p>
                  <AudioPlayer entry={musicEntry} onSendToTimeline={handleSendToTimeline} />
                </div>
              )}

            </div>
          )}

          {/* ── SFX TAB ── */}
          {activeTab === "sfx" && (
            <div style={{ maxWidth: 720, margin: "0 auto" }}>

              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>⚡ SFX / Efeitos</h1>
                <p style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
                  Gere efeitos sonoros instantâneos com IA · até 15 segundos
                </p>
              </div>

              {/* Quick presets */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 10 }}>
                  Atalhos rápidos
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SFX_PRESETS.map(preset => (
                    <button
                      key={preset}
                      onClick={() => setSfxPrompt(preset)}
                      style={{
                        padding: "6px 14px", borderRadius: 20, fontSize: 12,
                        cursor: "pointer", transition: "all 0.15s",
                        border:     sfxPrompt === preset ? "1.5px solid #F0563A" : "1px solid #2a2a2a",
                        background: sfxPrompt === preset ? "#F0563A18"           : "#1a1a1a",
                        color:      sfxPrompt === preset ? "#F0563A"             : "#888",
                        fontWeight: sfxPrompt === preset ? 600                   : 400,
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 6 }}>
                  Descreva o efeito
                </label>
                <textarea
                  value={sfxPrompt}
                  onChange={e => setSfxPrompt(e.target.value)}
                  placeholder="Ex: aplauso de plateia, trovão distante, passos em madeira..."
                  rows={3}
                  style={{
                    width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
                    borderRadius: 10, padding: "14px 16px", color: "#fff",
                    fontSize: 14, lineHeight: 1.7, resize: "vertical",
                    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Duration slider */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Duração
                  </label>
                  <span style={{ fontSize: 12, color: "#F0563A", fontWeight: 600 }}>{sfxDuration}s</span>
                </div>
                <input
                  type="range" min={2} max={15} step={1}
                  value={sfxDuration} onChange={e => setSfxDuration(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "#F0563A" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginTop: 2 }}>
                  <span>2s</span><span>15s</span>
                </div>
              </div>

              {/* Error */}
              {sfxError && (
                <div style={{
                  marginBottom: 16, padding: "10px 14px", borderRadius: 8,
                  background: "#F0563A18", border: "1px solid #F0563A55", color: "#F0563A",
                  fontSize: 13,
                }}>
                  ⚠ {sfxError}
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={generateSfx}
                disabled={!sfxPrompt.trim() || generatingSfx}
                style={{
                  width: "100%", height: 52, borderRadius: 12, border: "none",
                  cursor: !sfxPrompt.trim() || generatingSfx ? "not-allowed" : "pointer",
                  background: !sfxPrompt.trim() || generatingSfx
                    ? "#2a2a2a"
                    : "linear-gradient(135deg, #F0563A, #d4400a)",
                  color: !sfxPrompt.trim() || generatingSfx ? "#555" : "#fff",
                  fontSize: 15, fontWeight: 700, letterSpacing: 0.5,
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}
              >
                {generatingSfx ? (
                  <>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%",
                      border: "2px solid #555", borderTopColor: "#aaa",
                      animation: "spin 0.7s linear infinite", display: "inline-block",
                    }} />
                    Gerando SFX...
                  </>
                ) : (
                  <>⚡ Gerar SFX <span style={{ fontSize: 11, opacity: 0.7 }}>(10 créditos)</span></>
                )}
              </button>

            </div>
          )}

          {/* ── LIBRARY TAB ── */}
          {activeTab === "library" && (
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>📚 Biblioteca</h1>
                <p style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
                  Acervo pessoal de áudios + biblioteca gratuita
                </p>
              </div>

              {/* Personal Audio Vault */}
              <div style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#F0563A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
                  🎵 Acervo Pessoal
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {Object.entries(AUDIO_VAULT).map(([category, tracks]) => (
                    <div key={category} style={{ background: "#1a1a1a", borderRadius: 12, padding: 16, border: "1px solid #2a2a2a" }}>
                      <h3 style={{ fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", margin: "0 0 12px 0", letterSpacing: 0.8 }}>
                        {category.replace(/_/g, " ")}
                      </h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {tracks.map((track, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              // Could play or copy URL
                              const audio = new Audio(track.url);
                              audio.play().catch(() => {});
                            }}
                            style={{
                              padding: "10px 12px", borderRadius: 6, border: "1px solid #333",
                              background: "#0a0a0a", color: "#ccc", cursor: "pointer",
                              fontSize: 11, textAlign: "left", transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#1a1a1a";
                              e.currentTarget.style.borderColor = "#F0563A";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#0a0a0a";
                              e.currentTarget.style.borderColor = "#333";
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 14 }}>▶</span>
                              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {track.title}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pixabay Free Library */}
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#88cc88", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
                  🎵 Biblioteca Gratuita — Jamendo Music
                </h2>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <input
                    value={pixabayQuery}
                    onChange={e => setPixabayQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && searchPixabay(1)}
                    placeholder="Buscar músicas... (ex: ambient, cinematic, hype)"
                    style={{
                      flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 13,
                      background: "#111", border: "1px solid #333", color: "#fff", outline: "none",
                    }}
                  />
                  <button
                    onClick={() => searchPixabay(1)}
                    disabled={pixabayLoading}
                    style={{
                      padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: "#F0563A", border: "none", color: "#fff", cursor: "pointer",
                      opacity: pixabayLoading ? 0.6 : 1,
                    }}
                  >
                    {pixabayLoading ? "..." : "🔍 Buscar"}
                  </button>
                </div>

                {pixabayResults.length > 0 && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginBottom: 16 }}>
                      {pixabayResults.map(track => (
                        <div key={track.id} style={{ background: "#1a1a1a", borderRadius: 10, padding: 14, border: "1px solid #2a2a2a" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#ccc", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {track.name}
                          </div>
                          <div style={{ fontSize: 10, color: "#555", marginBottom: 8 }}>
                            {track.artist_name} · {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, "0")}
                          </div>
                          <audio
                            controls
                            src={track.audio}
                            onPlay={() => setPixabayPlaying(track.id)}
                            onPause={() => setPixabayPlaying(null)}
                            style={{ width: "100%", height: 28, accentColor: "#F0563A" }}
                          />
                          <a
                            href={track.audio}
                            download={`${track.name}.mp3`}
                            style={{ display: "block", marginTop: 8, textAlign: "center", fontSize: 11, color: "#888", textDecoration: "none" }}
                          >
                            ⬇ Download
                          </a>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <button
                        onClick={() => searchPixabay(pixabayPage - 1)}
                        disabled={pixabayPage <= 1 || pixabayLoading}
                        style={{ padding: "7px 16px", borderRadius: 6, background: "#1a1a1a", border: "1px solid #333", color: "#aaa", cursor: "pointer", fontSize: 12 }}
                      >
                        ← Anterior
                      </button>
                      <span style={{ padding: "7px 12px", fontSize: 12, color: "#666" }}>
                        Página {pixabayPage} · {pixabayTotal} resultados
                      </span>
                      <button
                        onClick={() => searchPixabay(pixabayPage + 1)}
                        disabled={pixabayPage * 12 >= pixabayTotal || pixabayLoading}
                        style={{ padding: "7px 16px", borderRadius: 6, background: "#1a1a1a", border: "1px solid #333", color: "#aaa", cursor: "pointer", fontSize: 12 }}
                      >
                        Próxima →
                      </button>
                    </div>
                  </>
                )}

                {!pixabayLoading && pixabayResults.length === 0 && (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#444", fontSize: 13 }}>
                    {pixabaySearched
                      ? "Nenhuma música encontrada. Tente outro termo."
                      : "Digite um termo e clique em Buscar para encontrar músicas gratuitas."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === "history" && (() => {
            const allEntries = [
              ...history,
              ...historyFromDB.filter(db => !history.find(h => h.id === db.id)),
            ].sort((a, b) => b.createdAt - a.createdAt);

            const filtered = allEntries.filter(e => {
              const typeOk = historyFilter === "all" || determineType(e) === historyFilter;
              const searchOk = !historySearch || e.text.toLowerCase().includes(historySearch.toLowerCase());
              return typeOk && searchOk;
            });
            const pages = Math.ceil(filtered.length / 20) || 1;
            const paged = filtered.slice(historyPage * 20, historyPage * 20 + 20);
            const typeIcon = (e: AudioEntry) => ({ tts: "🎙️", music: "🎵", sfx: "⚡" })[determineType(e)];

            return (
              <div style={{ maxWidth: 720, margin: "0 auto" }}>
                <div style={{ marginBottom: 20 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 16px" }}>🕘 Histórico</h1>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={historySearch}
                      onChange={e => { setHistorySearch(e.target.value); setHistoryPage(0); }}
                      placeholder="Buscar por texto..."
                      style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13, background: "#111", border: "1px solid #333", color: "#fff", outline: "none" }}
                    />
                    {(["all", "tts", "music", "sfx"] as const).map(f => (
                      <button key={f} onClick={() => { setHistoryFilter(f); setHistoryPage(0); }}
                        style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: "none",
                          background: historyFilter === f ? "#F0563A" : "#1a1a1a",
                          color: historyFilter === f ? "#fff" : "#888" }}>
                        {f === "all" ? "Todos" : f === "tts" ? "🎙️ TTS" : f === "music" ? "🎵 Music" : "⚡ SFX"}
                      </button>
                    ))}
                  </div>
                </div>

                {paged.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "#444", fontSize: 14 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🎙️</div>
                    {allEntries.length === 0
                      ? <><span>Nenhum áudio gerado ainda. </span><span style={{ color: "#F0563A", cursor: "pointer" }} onClick={() => setActiveTab("tts")}>Ir para o Studio</span></>
                      : "Nenhum resultado para este filtro."}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {paged.map(e => (
                        <div key={e.id} style={{ padding: "14px 16px", borderRadius: 10, background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ fontSize: 20, flexShrink: 0 }}>{typeIcon(e)}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.text}</div>
                            <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
                              {e.voiceLabel && `${e.voiceLabel} · `}{Math.round(e.duration)}s · {new Date(e.createdAt).toLocaleDateString("pt-BR")}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            {e.url && (
                              <button onClick={() => setActiveEntry(e)}
                                style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, background: "#111", border: "1px solid #333", color: "#aaa", cursor: "pointer" }}>
                                ▶
                              </button>
                            )}
                            {determineType(e) === "tts" && e.text && (
                              <button onClick={() => { setText(e.text); setActiveTab("tts"); toast.success("Prompt copiado"); }}
                                style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, background: "#111", border: "1px solid #333", color: "#aaa", cursor: "pointer" }}>
                                ↻
                              </button>
                            )}
                            <button onClick={() => deleteHistoryEntry(e.id)}
                              disabled={deletingId === e.id}
                              style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, background: "#111", border: "1px solid #333", color: deletingId === e.id ? "#444" : "#F05", cursor: "pointer" }}>
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {pages > 1 && (
                      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
                        <button onClick={() => setHistoryPage(p => Math.max(0, p - 1))} disabled={historyPage === 0}
                          style={{ padding: "7px 16px", borderRadius: 6, background: "#1a1a1a", border: "1px solid #333", color: "#aaa", cursor: "pointer", fontSize: 12 }}>
                          ← Anterior
                        </button>
                        <span style={{ padding: "7px 12px", fontSize: 12, color: "#666" }}>
                          {historyPage + 1} / {pages}
                        </span>
                        <button onClick={() => setHistoryPage(p => Math.min(pages - 1, p + 1))} disabled={historyPage >= pages - 1}
                          style={{ padding: "7px 16px", borderRadius: 6, background: "#1a1a1a", border: "1px solid #333", color: "#aaa", cursor: "pointer", fontSize: 12 }}>
                          Próxima →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside style={{
          width: 300, background: "#1a1a1a", borderLeft: "1px solid #222",
          display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto",
          padding: 20,
        }}>
          <p style={{
            fontSize: 10, color: "#555", textTransform: "uppercase",
            letterSpacing: 1.2, marginBottom: 16, margin: "0 0 16px",
          }}>
            Player
          </p>

          {activeEntry ? (
            <AudioPlayer entry={activeEntry} onSendToTimeline={handleSendToTimeline} />
          ) : (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              color: "#333", textAlign: "center", gap: 12, padding: "40px 0",
            }}>
              <div style={{ fontSize: 48 }}>🎧</div>
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Gere um áudio para<br />ouvir aqui
              </p>
            </div>
          )}

          {/* Recent list */}
          {history.length > 0 && (
            <>
              <div style={{ height: 1, background: "#222", margin: "20px 0" }} />
              <p style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>
                Recentes ({history.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.slice(0, 8).map(e => (
                  <button
                    key={e.id}
                    onClick={() => setActiveEntry(e)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                      borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                      background: activeEntry?.id === e.id ? "#F0563A18" : "transparent",
                      color: activeEntry?.id === e.id ? "#F0563A" : "#888",
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>
                      {activeEntry?.id === e.id ? "▶" : "◦"}
                    </span>
                    <span style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.text.slice(0, 32)}…
                    </span>
                    <span style={{ fontSize: 10, color: "#444", flexShrink: 0 }}>
                      {Math.round(e.duration)}s
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── Créditos insuficientes ── */}
      {showCreditModal && (
        <InsufficientCreditsModal
          action={creditModalAction}
          cost={cost(creditModalAction)}
          credits={credits}
          onClose={() => setShowCreditModal(false)}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Spinner keyframe ── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=range] { cursor: pointer; height: 4px; border-radius: 2px; }
        textarea:focus { border-color: #F0563A55 !important; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
