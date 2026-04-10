"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { CreditsBar, InsufficientCreditsModal } from "@/components/CreditsBar";
import { useToast, ToastContainer } from "@/components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = "setup" | "processing" | "done" | "error";
type AudioMode = "tts" | "upload";
type ActiveTab = "lipsync" | "talkingphoto" | "videotranslate";

const VOICES = [
  // English Voices
  { id: "English_expressive_narrator", label: "English — Expressive Narrator" },
  { id: "English_Graceful_Lady", label: "English — Graceful Lady" },
  { id: "English_Insightful_Speaker", label: "English — Insightful Speaker" },
  { id: "English_radiant_girl", label: "English — Radiant Girl" },
  { id: "English_Persuasive_Man", label: "English — Persuasive Man" },
  { id: "English_Lucky_Robot", label: "English — Lucky Robot" },
  // Chinese Voices
  { id: "Chinese (Mandarin)_Lyrical_Voice", label: "Chinese (Mandarin) — Lyrical Voice" },
  { id: "Chinese (Mandarin)_HK_Flight_Attendant", label: "Chinese (Mandarin) — HK Flight Attendant" },
  // Japanese Voices
  { id: "Japanese_Whisper_Belle", label: "Japanese — Whisper Belle" },
];

const NAV_ITEMS = [
  { id: "lipsync",        icon: "🎤", label: "LipSync",        cost: 50 },
  { id: "talkingphoto",   icon: "🖼️", label: "Talking Photo",  cost: 40 },
  { id: "videotranslate", icon: "🌍", label: "Video Translate", cost: 60 },
] as const;

const LANGUAGES = [
  { code: "pt-BR", label: "Português BR" },
  { code: "en",    label: "English"      },
  { code: "es",    label: "Español"      },
  { code: "fr",    label: "Français"     },
  { code: "de",    label: "Deutsch"      },
  { code: "it",    label: "Italiano"     },
  { code: "ja",    label: "日本語"        },
  { code: "zh",    label: "中文"          },
  { code: "ko",    label: "한국어"        },
  { code: "ar",    label: "العربية"       },
];

const SIDEBAR_INFO: Record<ActiveTab, string[]> = {
  lipsync:        ["1. Upload vídeo avatar", "2. Gera ou carrega áudio", "3. Generate LipSync"],
  talkingphoto:   ["1. Upload uma foto",     "2. Gera ou carrega áudio", "3. Generate Talking Photo"],
  videotranslate: ["1. Upload o vídeo",      "2. Escolhe o idioma",      "3. Traduzir Vídeo"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function uploadToR2(blob: Blob, filename: string, contentType: string): Promise<string> {
  const { uploadUrl, publicUrl } = await fetch("/api/upload", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ filename, contentType }),
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

// ─── Component ────────────────────────────────────────────────────────────────
export default function DreamFacePage() {
  const router   = useRouter();
  const supabase = createClient();

  // auth
  const [initials, setInitials] = useState("US");
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setInitials((user.email ?? "U")[0].toUpperCase());
    });
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

  // navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>("lipsync");

  // ── Step 1 (LipSync): Avatar Video ──
  const [avatarFile,     setAvatarFile]     = useState<File | null>(null);
  const [avatarPreview,  setAvatarPreview]  = useState<string | null>(null);
  const [avatarUrl,      setAvatarUrl]      = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1 (Talking Photo): Photo ──
  const [photoFile,      setPhotoFile]      = useState<File | null>(null);
  const [photoUrl,       setPhotoUrl]       = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview,   setPhotoPreview]   = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1 (Video Translate): Video ──
  const [transVideoFile, setTransVideoFile] = useState<File | null>(null);
  const [transVideoUrl,  setTransVideoUrl]  = useState<string | null>(null);
  const [uploadingTrans, setUploadingTrans] = useState(false);
  const [transPreview,   setTransPreview]   = useState<string | null>(null);
  const [targetLang,     setTargetLang]     = useState("en");
  const transVideoInputRef = useRef<HTMLInputElement>(null);

  // ── Step 2: Audio (shared) ──
  const [audioMode,    setAudioMode]    = useState<AudioMode>("tts");
  const [ttsScript,    setTtsScript]    = useState("");
  const [voiceId,      setVoiceId]      = useState(VOICES[0].id);
  const [speed,        setSpeed]        = useState(1.0);
  const [emotion,      setEmotion]      = useState(75);
  const [audioFile,    setAudioFile]    = useState<File | null>(null);
  const [audioUrl,     setAudioUrl]     = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [genAudio,     setGenAudio]     = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioRef      = useRef<HTMLAudioElement>(null);
  const [playing,      setPlaying]      = useState(false);

  // ── Step 3 (LipSync): Settings ──
  const [enhance, setEnhance] = useState(true);
  const [fps,     setFps]     = useState<"25" | "original">("25");

  // ── Generation (shared) ──
  const [stage,        setStage]        = useState<Stage>("setup");
  const [resultVideo,  setResultVideo]  = useState<string | null>(null);
  const [progress,     setProgress]     = useState(0);
  const [statusMsg,    setStatusMsg]    = useState("");
  const [errorMsg,     setErrorMsg]     = useState("");
  const [resultSource, setResultSource] = useState<ActiveTab>("lipsync");

  // ── Upload avatar video ───────────────────────────────────────────────────
  const handleVideoSelect = useCallback(async (file: File) => {
    setAvatarFile(file);
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setUploadingVideo(true);
    try {
      const url = await uploadToR2(file, file.name, file.type || "video/mp4");
      setAvatarUrl(url);
    } catch (e) {
      console.error("Upload video:", e);
      toast.error("Falha ao fazer upload do vídeo. Tenta novamente.");
      setAvatarFile(null); setAvatarPreview(null); setAvatarUrl(null);
    } finally {
      setUploadingVideo(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Upload photo ──────────────────────────────────────────────────────────
  const handlePhotoSelect = useCallback(async (file: File) => {
    setPhotoFile(file);
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setUploadingPhoto(true);
    try {
      const url = await uploadToR2(file, file.name, file.type || "image/jpeg");
      setPhotoUrl(url);
    } catch (e) {
      console.error("Upload photo:", e);
      toast.error("Falha ao fazer upload da foto. Tenta novamente.");
      setPhotoFile(null); setPhotoPreview(null); setPhotoUrl(null);
    } finally {
      setUploadingPhoto(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Upload translate video ────────────────────────────────────────────────
  const handleTransVideoSelect = useCallback(async (file: File) => {
    setTransVideoFile(file);
    const preview = URL.createObjectURL(file);
    setTransPreview(preview);
    setUploadingTrans(true);
    try {
      const url = await uploadToR2(file, file.name, file.type || "video/mp4");
      setTransVideoUrl(url);
    } catch (e) {
      console.error("Upload trans video:", e);
      toast.error("Falha ao fazer upload do vídeo. Tenta novamente.");
      setTransVideoFile(null); setTransPreview(null); setTransVideoUrl(null);
    } finally {
      setUploadingTrans(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Generate TTS and upload to R2 ────────────────────────────────────────
  const handleGenerateTTS = useCallback(async () => {
    if (!ttsScript.trim()) return;
    setGenAudio(true);
    try {
      const res  = await fetch("/api/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: ttsScript.trim(), voiceId, speed }),
      });
      if (!res.ok) throw new Error("Erro ao gerar TTS");
      const blob = await res.blob();
      if (audioPreview) URL.revokeObjectURL(audioPreview);
      setAudioPreview(URL.createObjectURL(blob));
      const url = await uploadToR2(blob, `tts_${Date.now()}.mp3`, "audio/mpeg");
      setAudioUrl(url);
    } catch (e) {
      console.error("TTS:", e);
    } finally {
      setGenAudio(false);
    }
  }, [ttsScript, voiceId, speed, audioPreview]);

  // ── Upload audio file ─────────────────────────────────────────────────────
  const handleAudioFileSelect = useCallback(async (file: File) => {
    setAudioFile(file);
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioPreview(URL.createObjectURL(file));
    setGenAudio(true);
    try {
      const url = await uploadToR2(file, file.name, file.type || "audio/mpeg");
      setAudioUrl(url);
    } catch (e) {
      console.error("Upload audio:", e);
    } finally {
      setGenAudio(false);
    }
  }, [audioPreview]);

  // ── Poll for results ──────────────────────────────────────────────────────
  const pollResult = useCallback(async (tid: string, tool: string) => {
    let elapsed = 0;
    while (elapsed < 600_000) {
      await sleep(4000);
      elapsed += 4000;
      const p = Math.min(95, 10 + (elapsed / 120_000) * 85);
      setProgress(Math.round(p));

      try {
        const res  = await fetch("/api/dreamface/poll", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ taskId: tid }),
        });
        const data = await res.json() as { status: number; videoUrl: string | null; error?: string };

        if (data.error) { setStage("error"); setErrorMsg(data.error); return; }

        if (data.status === 1) setStatusMsg("⏳ Na fila...");
        if (data.status === 2) setStatusMsg("🔄 Processando...");
        if (data.status === 3 && data.videoUrl) {
          setProgress(100);
          setResultVideo(data.videoUrl);
          setStage("done");
          const successMsgs: Record<string, string> = {
            lipsync:        "LipSync gerado com sucesso! 🎤",
            talkingphoto:   "Talking Photo criado com sucesso! 🖼️",
            videotranslate: "Vídeo traduzido com sucesso! 🌍",
          };
          toast.success(successMsgs[tool] ?? "Vídeo gerado com sucesso! ✓");
          fetch("/api/projects", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tool,
              title:      `${tool} — ${new Date().toLocaleString("pt-BR")}`,
              result_url: data.videoUrl,
              meta:       { taskId: tid },
            }),
          }).catch(() => {});
          return;
        }
        if (data.status === 4) {
          setStage("error");
          setErrorMsg("Geração falhou. Verifica o vídeo e o áudio e tenta novamente.");
          toast.error("Geração falhou. Verifica o arquivo e tenta novamente.");
          await refund(tool);
          return;
        }
      } catch (e) {
        console.error("Poll:", e);
      }
    }
    await refund(tool);
    setStage("error");
    setErrorMsg("Timeout — o servidor demorou mais de 10 min.");
    toast.error("Tempo limite excedido. Tente novamente.");
  }, [toast]);

  // ── Start LipSync generation ──────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!avatarUrl || !audioUrl) return;

    const creditResult = await spend("lipsync");
    if (!creditResult.ok) { setShowCreditModal(true); return; }

    setResultSource("lipsync");
    setStage("processing");
    setProgress(5);
    setStatusMsg("🚀 Enviando para a Newport AI...");
    setErrorMsg("");

    try {
      const res  = await fetch("/api/dreamface", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          srcVideoUrl:  avatarUrl,
          audioUrl:     audioUrl,
          videoEnhance: enhance ? 1 : 0,
          fps:          fps === "original" ? "original" : undefined,
        }),
      });
      const data = await res.json() as { taskId?: string; error?: string };
      if (data.error || !data.taskId) {
        setStage("error");
        setErrorMsg(data.error ?? "Erro ao iniciar job");
        return;
      }
      setStatusMsg("✅ Job criado! Aguardando processamento...");
      setProgress(10);
      await pollResult(data.taskId, "lipsync");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setStage("error");
      setErrorMsg(msg);
      toast.error(msg);
      await refund("lipsync");
    }
  }, [avatarUrl, audioUrl, enhance, fps, pollResult, spend, toast]);

  // ── Start Talking Photo generation ───────────────────────────────────────
  const handleGenerateTalkingPhoto = useCallback(async () => {
    if (!photoUrl || !audioUrl) return;

    const creditResult = await spend("talkingphoto");
    if (!creditResult.ok) { setShowCreditModal(true); return; }

    setResultSource("talkingphoto");
    setStage("processing");
    setProgress(5);
    setStatusMsg("🚀 Enviando para a Newport AI...");
    setErrorMsg("");

    try {
      const res  = await fetch("/api/talkingphoto", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ imageUrl: photoUrl, audioUrl }),
      });
      const data = await res.json() as { taskId?: string; error?: string };
      if (data.error || !data.taskId) {
        setStage("error");
        setErrorMsg(data.error ?? "Erro ao iniciar job");
        return;
      }
      setStatusMsg("✅ Job criado! Aguardando processamento...");
      setProgress(10);
      await pollResult(data.taskId, "talkingphoto");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setStage("error");
      setErrorMsg(msg);
      toast.error(msg);
      await refund("talkingphoto");
    }
  }, [photoUrl, audioUrl, pollResult, spend, toast]);

  // ── Start Video Translate generation ─────────────────────────────────────
  const handleGenerateTranslate = useCallback(async () => {
    if (!transVideoUrl) return;

    const creditResult = await spend("videotranslate");
    if (!creditResult.ok) { setShowCreditModal(true); return; }

    setResultSource("videotranslate");
    setStage("processing");
    setProgress(5);
    setStatusMsg("🚀 Enviando para a Newport AI...");
    setErrorMsg("");

    try {
      const res  = await fetch("/api/videotranslate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ videoUrl: transVideoUrl, targetLanguage: targetLang }),
      });
      const data = await res.json() as { taskId?: string; error?: string };
      if (data.error || !data.taskId) {
        setStage("error");
        setErrorMsg(data.error ?? "Erro ao iniciar job");
        return;
      }
      setStatusMsg("✅ Job criado! Aguardando processamento...");
      setProgress(10);
      await pollResult(data.taskId, "videotranslate");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setStage("error");
      setErrorMsg(msg);
      toast.error(msg);
      await refund("videotranslate");
    }
  }, [transVideoUrl, targetLang, pollResult, spend, toast]);

  // ── Derived can-generate flags ────────────────────────────────────────────
  const canGenerateLipsync  = !!avatarUrl && !!audioUrl && !uploadingVideo && !genAudio;
  const canGeneratePhoto    = !!photoUrl  && !!audioUrl && !uploadingPhoto && !genAudio;
  const canGenerateTrans    = !!transVideoUrl && !uploadingTrans;

  // ── Audio toggle ──────────────────────────────────────────────────────────
  const togglePlay = () => {
    if (!audioRef.current || !audioPreview) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else          { audioRef.current.play();  setPlaying(true);  }
  };

  // ── Processing overlay label ───────────────────────────────────────────────
  const processingEmoji = resultSource === "talkingphoto" ? "🖼️" : resultSource === "videotranslate" ? "🌍" : "🎭";
  const processingLabel = resultSource === "talkingphoto" ? "Gerando Talking Photo" : resultSource === "videotranslate" ? "Traduzindo Vídeo" : "Gerando LipSync";

  // ── Result title ───────────────────────────────────────────────────────────
  const resultTitle = resultSource === "talkingphoto" ? "Talking Photo Concluído" : resultSource === "videotranslate" ? "Tradução Concluída" : "LipSync Concluído";

  // ── Shared Audio Section ──────────────────────────────────────────────────
  const AudioSection = ({ stepNum }: { stepNum: number }) => (
    <div className="rounded-xl p-5 space-y-4"
      style={{ background: "#1C1B1B", border: "1px solid rgba(92,64,55,0.15)" }}>
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
          style={{ background: audioUrl ? "rgba(52,211,153,0.15)" : "rgba(99,5,239,0.15)", color: audioUrl ? "#34d399" : "#cfbdff", border: `1px solid ${audioUrl ? "#34d399" : "#cfbdff"}44` }}>
          {audioUrl ? "✓" : stepNum}
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wider">Áudio</h3>
        <span className="text-[9px] font-mono opacity-40 uppercase">Obrigatório</span>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg overflow-hidden" style={{ background: "#0e0e0e" }}>
        {(["tts", "upload"] as AudioMode[]).map(mode => (
          <button key={mode} onClick={() => setAudioMode(mode)}
            className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-all"
            style={{
              background:   audioMode === mode ? "rgba(99,5,239,0.2)" : "transparent",
              color:        audioMode === mode ? "#cfbdff" : "rgba(229,226,225,0.4)",
              borderBottom: audioMode === mode ? "2px solid #6305ef" : "2px solid transparent",
            }}>
            {mode === "tts" ? "🤖 Gerar TTS" : "📁 Upload Áudio"}
          </button>
        ))}
      </div>

      {audioMode === "tts" ? (
        <div className="space-y-3">
          <textarea
            value={ttsScript}
            onChange={e => setTtsScript(e.target.value)}
            placeholder="Escreve o script que o avatar irá falar..."
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg text-xs resize-none outline-none placeholder-white/20"
            style={{ background: "#0e0e0e", border: "1px solid rgba(92,64,55,0.2)", color: "#E5E2E1", fontFamily: "inherit" }}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-mono uppercase opacity-40 block mb-1">Voz</label>
              <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                style={{ background: "#0e0e0e", border: "1px solid rgba(92,64,55,0.2)", color: "#E5E2E1" }}>
                {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-mono uppercase opacity-40 block mb-1">Velocidade — {speed.toFixed(1)}×</label>
              <input type="range" min={0.5} max={2} step={0.1} value={speed}
                onChange={e => setSpeed(+e.target.value)}
                className="w-full h-1 mt-2" style={{ accentColor: "#cfbdff" }} />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase opacity-40 block mb-1">Emoção — {emotion}%</label>
            <input type="range" min={0} max={100} value={emotion}
              onChange={e => setEmotion(+e.target.value)}
              className="w-full h-1" style={{ accentColor: "#F0563A" }} />
          </div>
          <button onClick={handleGenerateTTS} disabled={!ttsScript.trim() || genAudio}
            className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#6305ef,#9b59ef)" }}>
            {genAudio
              ? <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> Gerando...</>
              : <>{audioUrl ? "✓ Regenerar TTS" : "✦ Gerar Áudio com MiniMax"}</>}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {audioFile ? (
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "#0e0e0e" }}>
              <span className="text-xl">🎵</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{audioFile.name}</p>
                <p className="text-[9px] opacity-40">{(audioFile.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              {genAudio
                ? <span className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin shrink-0" />
                : <span className="text-emerald-400 text-xs shrink-0">✓ Pronto</span>
              }
              <button onClick={() => { setAudioFile(null); setAudioUrl(null); setAudioPreview(null); }}
                className="text-[10px] opacity-40 hover:opacity-100 transition-opacity shrink-0">✕</button>
            </div>
          ) : (
            <button onClick={() => audioInputRef.current?.click()}
              className="w-full py-4 rounded-xl border-2 border-dashed text-sm font-bold uppercase tracking-wider transition-all hover:border-[#cfbdff]/60 hover:bg-[#6305ef]/5"
              style={{ borderColor: "rgba(92,64,55,0.3)", color: "rgba(229,226,225,0.5)" }}>
              + Carregar MP3 / WAV
            </button>
          )}
          <input ref={audioInputRef} type="file" accept="audio/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleAudioFileSelect(f); }} />
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen overflow-hidden select-none"
      style={{ background: "#131313", color: "#E5E2E1", fontFamily: "'DM Sans', sans-serif" }}>

      {/* PROCESSING OVERLAY */}
      {stage === "processing" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "rgba(13,13,13,0.97)", backdropFilter: "blur(24px)" }}>
          <div className="relative w-32 h-32 mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-transparent"
              style={{ borderTopColor: "#F0563A", animation: "spin 1s linear infinite" }} />
            <div className="absolute inset-3 rounded-full border-4 border-transparent"
              style={{ borderTopColor: "#6305ef", animation: "spin 1.5s linear infinite reverse" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl">{processingEmoji}</span>
            </div>
          </div>
          <h2 className="text-2xl font-black mb-2">{processingLabel}</h2>
          <p className="text-sm opacity-50 font-mono mb-8">{statusMsg}</p>
          <div className="w-80 h-2 rounded-full overflow-hidden" style={{ background: "#2a2a2a" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg,#F0563A,#6305ef)" }} />
          </div>
          <p className="mt-3 font-mono text-xs opacity-30">{progress}%</p>
          <p className="mt-8 text-[10px] font-mono opacity-20 uppercase tracking-widest">
            Powered by Newport AI · DreamFace Engine
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* RESULT OVERLAY */}
      {stage === "done" && resultVideo && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-8"
          style={{ background: "rgba(13,13,13,0.97)", backdropFilter: "blur(24px)" }}>
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs font-mono uppercase tracking-widest opacity-60">{resultTitle}</p>
            </div>
            <video
              src={resultVideo}
              controls
              autoPlay
              className="w-full rounded-xl shadow-2xl mb-6"
              style={{ background: "#0e0e0e", maxHeight: "60vh" }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  sessionStorage.setItem("vb_pending_video", resultVideo);
                  sessionStorage.setItem("vb_restore_requested", "1");
                  router.push("/storyboard");
                }}
                className="flex-1 py-4 rounded-xl font-black text-sm uppercase tracking-wider text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg,#F0563A,#c44527)", boxShadow: "0 0 24px rgba(240,86,58,0.4)" }}>
                ⚡ Entrar no Editor →
              </button>
              <a
                href={resultVideo}
                download="result.mp4"
                className="px-6 py-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.1)" }}>
                ⬇ Download
              </a>
              <button
                onClick={() => { setStage("setup"); setResultVideo(null); setProgress(0); }}
                className="px-6 py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all hover:opacity-90"
                style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.1)" }}>
                ↺ Nova
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR OVERLAY */}
      {stage === "error" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-8"
          style={{ background: "rgba(13,13,13,0.95)", backdropFilter: "blur(24px)" }}>
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-black mb-2">Algo correu mal</h2>
          <p className="text-sm opacity-60 mb-6 text-center max-w-sm">{errorMsg}</p>
          <button
            onClick={() => { setStage("setup"); setProgress(0); }}
            className="px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-wider text-white"
            style={{ background: "linear-gradient(135deg,#F0563A,#c44527)" }}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 w-full z-40 h-14 flex items-center justify-between px-6"
        style={{ background: "#131313", borderBottom: "1px solid rgba(92,64,55,0.15)" }}>
        <div className="flex items-center gap-8">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-white transition-colors">
            <span>←</span>Voltar
          </button>
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-sm"
              style={{ background: "#F0563A", boxShadow: "0 0 16px rgba(240,86,58,0.4)" }}>S</div>
            <span className="text-lg font-black tracking-tighter text-white">SUARIK</span>
          </button>
          <nav className="hidden md:flex gap-6">
            {["Timeline", "Assets", "Export"].map(item => (
              <button key={item} className="text-sm font-bold tracking-tight opacity-40 hover:opacity-100 transition-opacity">
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <CreditsBar credits={credits} plan={plan} compact />
          <span className="text-[10px] font-mono uppercase tracking-widest opacity-30">DreamFace Studio</span>
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white"
            style={{ background: "linear-gradient(135deg,#F0563A,#FF7A5C)" }}>{initials}</div>
        </div>
      </header>

      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-14 bottom-0 w-60 z-30 flex flex-col"
        style={{ background: "#1C1B1B", borderRight: "1px solid rgba(92,64,55,0.15)" }}>

        <div className="p-5 pb-3">
          <h2 className="text-base font-bold" style={{ color: "#F0563A" }}>DreamFace Studio</h2>
          <p className="text-[9px] font-mono uppercase tracking-widest opacity-40 mt-0.5">LipSync · AI · 4K</p>
        </div>

        <nav className="px-3 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as ActiveTab)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all text-xs font-mono uppercase tracking-widest rounded-md"
              style={{
                background:  activeTab === item.id ? "#2A2A2A" : "transparent",
                color:       activeTab === item.id ? "#F0563A" : "rgba(229,226,225,0.5)",
                borderRight: activeTab === item.id ? "2px solid #F0563A" : "2px solid transparent",
              }}>
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
                style={{
                  background: activeTab === item.id ? "rgba(240,86,58,0.15)" : "rgba(255,255,255,0.06)",
                  color:      activeTab === item.id ? "#F0563A" : "rgba(229,226,225,0.3)",
                }}>
                {item.cost}cr
              </span>
            </button>
          ))}
        </nav>

        {/* Dynamic info box */}
        <div className="mx-3 mt-4 p-3 rounded-xl" style={{ background: "rgba(240,86,58,0.06)", border: "1px solid rgba(240,86,58,0.1)" }}>
          <p className="text-[9px] font-mono uppercase tracking-widest opacity-50 mb-1">Como funciona</p>
          <ol className="text-[9px] opacity-60 space-y-1 leading-relaxed">
            {SIDEBAR_INFO[activeTab].map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>

        <div className="mt-auto p-3 border-t" style={{ borderColor: "rgba(92,64,55,0.1)" }}>
          <button onClick={() => router.push("/storyboard")}
            className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#F0563A,#c44527)" }}>
            → Abrir Timeline
          </button>
        </div>
      </aside>

      {/* ── MAIN ───────────────────────────────────────────────────────────── */}
      <main className="ml-60 pt-14 min-h-screen flex flex-col">
        <div className="flex flex-1 overflow-hidden">

          {/* ─── LEFT: Preview ─────────────────────────────────────────────── */}
          <div className="w-[40%] p-6 flex flex-col gap-4" style={{ borderRight: "1px solid rgba(92,64,55,0.12)" }}>

            {/* LipSync: avatar video preview */}
            {activeTab === "lipsync" && (
              <div className="flex-1 rounded-2xl overflow-hidden relative flex items-center justify-center"
                style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.04)", minHeight: 280 }}>
                {avatarPreview ? (
                  <video src={avatarPreview} loop muted playsInline autoPlay
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-8">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto mb-4"
                      style={{ background: "rgba(240,86,58,0.06)", border: "1px solid rgba(240,86,58,0.12)" }}>
                      🎭
                    </div>
                    <p className="text-xs font-mono opacity-30 uppercase tracking-widest">Avatar aguardando upload</p>
                    <p className="text-[10px] opacity-20 mt-1">Aceita MP4 · MOV · WebM</p>
                  </div>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-md text-[9px] font-mono uppercase"
                  style={{ background: "rgba(20,20,20,0.85)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${avatarUrl ? "bg-emerald-400" : uploadingVideo ? "bg-yellow-400 animate-pulse" : "bg-white/20"}`} />
                  {uploadingVideo ? "Carregando..." : avatarUrl ? "Avatar Pronto" : "Sem Vídeo"}
                </div>
                {!avatarPreview && (
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "linear-gradient(135deg,#F0563A,#c44527)" }}>
                    + Upload Avatar
                  </button>
                )}
              </div>
            )}

            {/* Talking Photo: photo preview */}
            {activeTab === "talkingphoto" && (
              <div className="flex-1 rounded-2xl overflow-hidden relative flex items-center justify-center"
                style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.04)", minHeight: 280 }}>
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="Photo preview"
                    className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center p-8">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto mb-4"
                      style={{ background: "rgba(240,86,58,0.06)", border: "1px solid rgba(240,86,58,0.12)" }}>
                      🖼️
                    </div>
                    <p className="text-xs font-mono opacity-30 uppercase tracking-widest">Foto aguardando upload</p>
                    <p className="text-[10px] opacity-20 mt-1">Aceita JPG · PNG · WebP</p>
                  </div>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-md text-[9px] font-mono uppercase"
                  style={{ background: "rgba(20,20,20,0.85)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${photoUrl ? "bg-emerald-400" : uploadingPhoto ? "bg-yellow-400 animate-pulse" : "bg-white/20"}`} />
                  {uploadingPhoto ? "Carregando..." : photoUrl ? "Foto Pronta" : "Sem Foto"}
                </div>
                {!photoPreview && (
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "linear-gradient(135deg,#F0563A,#c44527)" }}>
                    + Upload Foto
                  </button>
                )}
              </div>
            )}

            {/* Video Translate: video preview */}
            {activeTab === "videotranslate" && (
              <div className="flex-1 rounded-2xl overflow-hidden relative flex items-center justify-center"
                style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.04)", minHeight: 280 }}>
                {transPreview ? (
                  <video src={transPreview} loop muted playsInline autoPlay
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-8">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto mb-4"
                      style={{ background: "rgba(240,86,58,0.06)", border: "1px solid rgba(240,86,58,0.12)" }}>
                      🌍
                    </div>
                    <p className="text-xs font-mono opacity-30 uppercase tracking-widest">Vídeo aguardando upload</p>
                    <p className="text-[10px] opacity-20 mt-1">Aceita MP4 · MOV · WebM</p>
                  </div>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-md text-[9px] font-mono uppercase"
                  style={{ background: "rgba(20,20,20,0.85)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${transVideoUrl ? "bg-emerald-400" : uploadingTrans ? "bg-yellow-400 animate-pulse" : "bg-white/20"}`} />
                  {uploadingTrans ? "Carregando..." : transVideoUrl ? "Vídeo Pronto" : "Sem Vídeo"}
                </div>
                {!transPreview && (
                  <button
                    onClick={() => transVideoInputRef.current?.click()}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "linear-gradient(135deg,#F0563A,#c44527)" }}>
                    + Upload Vídeo
                  </button>
                )}
              </div>
            )}

            {/* Audio preview (shown for lipsync + talkingphoto) */}
            {activeTab !== "videotranslate" && (
              <div className="rounded-xl p-4" style={{ background: "#1C1B1B", border: "1px solid rgba(92,64,55,0.15)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[9px] font-mono uppercase tracking-widest opacity-50">Áudio</p>
                  {audioPreview && (
                    <button onClick={togglePlay}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
                      style={{ background: "rgba(240,86,58,0.15)", border: "1px solid rgba(240,86,58,0.3)", color: "#F0563A" }}>
                      {playing ? "⏸" : "▶"}
                    </button>
                  )}
                </div>
                <div className="flex items-end gap-[2px] h-8">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className="flex-1 rounded-sm transition-all"
                      style={{
                        height: `${Math.round(4 + Math.abs(Math.sin(i * 1.3)) * 24)}px`,
                        background: audioUrl ? "#F0563A" : "rgba(255,255,255,0.08)",
                        opacity: playing ? 0.9 : 0.5,
                        animation: playing ? `wave-bar ${0.8 + (i % 5) * 0.1}s ease-in-out infinite alternate` : "none",
                      }} />
                  ))}
                </div>
                <p className="text-[9px] font-mono opacity-30 mt-2 uppercase">
                  {audioUrl ? (audioMode === "tts" ? `TTS · ${VOICES.find(v => v.id === voiceId)?.label}` : "Áudio carregado") : "Sem áudio"}
                </p>
                <audio ref={audioRef} src={audioPreview ?? undefined}
                  onEnded={() => setPlaying(false)} className="hidden" />
              </div>
            )}

            <style>{`
              @keyframes wave-bar { from { transform: scaleY(0.6); } to { transform: scaleY(1.2); } }
            `}</style>
          </div>

          {/* ─── RIGHT: Controls ─────────────────────────────────────────────── */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>

            {/* ════════════════ LIPSYNC TAB ════════════════ */}
            {activeTab === "lipsync" && (
              <>
                <div>
                  <h1 className="text-xl font-black">LipSync Studio</h1>
                  <p className="text-xs opacity-40 mt-0.5">Sincronização labial de alta precisão · Newport AI</p>
                </div>

                {/* Step 1: Avatar Video */}
                <div className="rounded-xl p-5 space-y-4"
                  style={{ background: "#1C1B1B", border: "1px solid rgba(92,64,55,0.15)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                      style={{ background: avatarUrl ? "rgba(52,211,153,0.15)" : "rgba(240,86,58,0.15)", color: avatarUrl ? "#34d399" : "#F0563A", border: `1px solid ${avatarUrl ? "#34d399" : "#F0563A"}44` }}>
                      {avatarUrl ? "✓" : "1"}
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wider">Vídeo Avatar</h3>
                    <span className="text-[9px] font-mono opacity-40 uppercase">Obrigatório</span>
                  </div>
                  <p className="text-xs opacity-50">Carrega um vídeo de uma pessoa a falar. Este será o rosto que fará o lipsync.</p>

                  {avatarFile ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "#0e0e0e" }}>
                      <span className="text-xl">🎥</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{avatarFile.name}</p>
                        <p className="text-[9px] opacity-40">{(avatarFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      {uploadingVideo
                        ? <span className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin shrink-0" />
                        : <span className="text-emerald-400 text-xs shrink-0">✓ Pronto</span>
                      }
                      <button onClick={() => { setAvatarFile(null); setAvatarPreview(null); setAvatarUrl(null); }}
                        className="text-[10px] opacity-40 hover:opacity-100 transition-opacity shrink-0">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => videoInputRef.current?.click()}
                      className="w-full py-4 rounded-xl border-2 border-dashed text-sm font-bold uppercase tracking-wider transition-all hover:border-[#F0563A]/60 hover:bg-[#F0563A]/5"
                      style={{ borderColor: "rgba(92,64,55,0.3)", color: "rgba(229,226,225,0.5)" }}>
                      + Carregar Vídeo
                    </button>
                  )}
                  <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoSelect(f); }} />
                </div>

                {/* Step 2: Audio */}
                <AudioSection stepNum={2} />

                {/* Step 3: Settings */}
                <div className="rounded-xl p-5 space-y-4"
                  style={{ background: "#1C1B1B", border: "1px solid rgba(92,64,55,0.15)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                      style={{ background: "rgba(0,218,243,0.1)", color: "#00daf3", border: "1px solid #00daf344" }}>3</div>
                    <h3 className="text-sm font-bold uppercase tracking-wider">Parâmetros</h3>
                    <span className="text-[9px] font-mono opacity-40 uppercase">Opcional</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setEnhance(e => !e)}
                      className="flex items-center gap-3 p-3 rounded-lg transition-all"
                      style={{
                        background: enhance ? "rgba(0,218,243,0.08)" : "#0e0e0e",
                        border: `1px solid ${enhance ? "rgba(0,218,243,0.3)" : "rgba(92,64,55,0.15)"}`,
                      }}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${enhance ? "bg-[#00daf3]" : "bg-[#2a2a2a]"}`}>
                        {enhance ? "✓" : ""}
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: enhance ? "#00daf3" : "rgba(229,226,225,0.5)" }}>Enhance</p>
                        <p className="text-[8px] opacity-40">Melhora nitidez</p>
                      </div>
                    </button>

                    <div>
                      <label className="text-[9px] font-mono uppercase opacity-40 block mb-1.5">FPS de saída</label>
                      <div className="flex rounded-lg overflow-hidden" style={{ background: "#0e0e0e" }}>
                        {(["25", "original"] as const).map(f => (
                          <button key={f} onClick={() => setFps(f)}
                            className="flex-1 py-2 text-[9px] font-bold uppercase tracking-wider transition-all"
                            style={{
                              background: fps === f ? "rgba(0,218,243,0.15)" : "transparent",
                              color:      fps === f ? "#00daf3" : "rgba(229,226,225,0.4)",
                            }}>
                            {f === "25" ? "25 FPS" : "Original"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={() => {
                    if (!avatarUrl && !uploadingVideo) { videoInputRef.current?.click(); return; }
                    if (!audioUrl && !genAudio) { audioInputRef.current?.click(); return; }
                    if (canGenerateLipsync) handleGenerate();
                  }}
                  disabled={uploadingVideo || genAudio}
                  className="w-full py-5 rounded-2xl font-black text-base uppercase tracking-wider text-white flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{
                    background: canGenerateLipsync
                      ? "linear-gradient(135deg,#F0563A 0%,#6305ef 100%)"
                      : (!avatarUrl || !audioUrl) ? "#2a2a2a" : "#2a2a2a",
                    boxShadow: canGenerateLipsync ? "0 0 32px rgba(240,86,58,0.35), 0 0 64px rgba(99,5,239,0.15)" : "none",
                    cursor: uploadingVideo || genAudio ? "not-allowed" : "pointer",
                  }}>
                  <span className="text-2xl">⚡</span>
                  {uploadingVideo        ? "A carregar vídeo..."
                    : genAudio           ? "A processar áudio..."
                    : !avatarUrl && !audioUrl ? "📁 Carregar vídeo e áudio"
                    : !avatarUrl         ? "📁 Carregar vídeo avatar"
                    : !audioUrl          ? "📁 Carregar áudio"
                    : `Gerar LipSync (${cost("lipsync")} créditos)`}
                </button>

                <p className="text-center text-[9px] font-mono opacity-20 uppercase tracking-widest">
                  Powered by Newport AI · DreamFace Engine
                </p>
              </>
            )}

            {/* ════════════════ TALKING PHOTO TAB ════════════════ */}
            {activeTab === "talkingphoto" && (
              <>
                <div>
                  <h1 className="text-xl font-black">Talking Photo</h1>
                  <p className="text-xs opacity-40 mt-0.5">Anima qualquer foto com áudio · Newport AI</p>
                </div>

                {/* Step 1: Photo Upload */}
                <div className="rounded-xl p-5 space-y-4"
                  style={{ background: "#1C1B1B", border: "1px solid rgba(92,64,55,0.15)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                      style={{ background: photoUrl ? "rgba(52,211,153,0.15)" : "rgba(240,86,58,0.15)", color: photoUrl ? "#34d399" : "#F0563A", border: `1px solid ${photoUrl ? "#34d399" : "#F0563A"}44` }}>
                      {photoUrl ? "✓" : "1"}
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wider">Foto</h3>
                    <span className="text-[9px] font-mono opacity-40 uppercase">Obrigatório</span>
                  </div>
                  <p className="text-xs opacity-50">Carrega uma foto de um rosto. A foto será animada com o áudio fornecido.</p>

                  {photoFile ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "#0e0e0e" }}>
                      <span className="text-xl">🖼️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{photoFile.name}</p>
                        <p className="text-[9px] opacity-40">{(photoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      {uploadingPhoto
                        ? <span className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin shrink-0" />
                        : <span className="text-emerald-400 text-xs shrink-0">✓ Pronto</span>
                      }
                      <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoUrl(null); }}
                        className="text-[10px] opacity-40 hover:opacity-100 transition-opacity shrink-0">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handlePhotoSelect(f); }}
                      className="w-full py-8 rounded-xl border-2 border-dashed text-sm font-bold uppercase tracking-wider transition-all hover:border-[#F0563A]/60 hover:bg-[#F0563A]/5 flex flex-col items-center gap-2"
                      style={{ borderColor: "rgba(92,64,55,0.3)", color: "rgba(229,226,225,0.5)" }}>
                      <span className="text-3xl">🖼️</span>
                      <span>+ Carregar Foto</span>
                      <span className="text-[9px] opacity-40 font-normal normal-case">ou arrasta e larga aqui</span>
                    </button>
                  )}
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); }} />
                </div>

                {/* Step 2: Audio */}
                <AudioSection stepNum={2} />

                {/* Generate Button */}
                <button
                  onClick={() => {
                    if (!photoUrl && !uploadingPhoto) { photoInputRef.current?.click(); return; }
                    if (!audioUrl && !genAudio) { audioInputRef.current?.click(); return; }
                    if (canGeneratePhoto) handleGenerateTalkingPhoto();
                  }}
                  disabled={uploadingPhoto || genAudio}
                  className="w-full py-5 rounded-2xl font-black text-base uppercase tracking-wider text-white flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{
                    background: canGeneratePhoto
                      ? "linear-gradient(135deg,#F0563A 0%,#6305ef 100%)"
                      : "#2a2a2a",
                    boxShadow: canGeneratePhoto ? "0 0 32px rgba(240,86,58,0.35), 0 0 64px rgba(99,5,239,0.15)" : "none",
                    cursor: uploadingPhoto || genAudio ? "not-allowed" : "pointer",
                  }}>
                  <span className="text-2xl">🖼️</span>
                  {uploadingPhoto        ? "A carregar foto..."
                    : genAudio           ? "A processar áudio..."
                    : !photoUrl && !audioUrl ? "📁 Carregar foto e áudio"
                    : !photoUrl          ? "📁 Carregar foto"
                    : !audioUrl          ? "📁 Carregar áudio"
                    : `Gerar Talking Photo (${cost("talkingphoto")} créditos)`}
                </button>

                <p className="text-center text-[9px] font-mono opacity-20 uppercase tracking-widest">
                  Powered by Newport AI · DreamFace Engine
                </p>
              </>
            )}

            {/* ════════════════ VIDEO TRANSLATE TAB ════════════════ */}
            {activeTab === "videotranslate" && (
              <>
                <div>
                  <h1 className="text-xl font-black">Video Translate</h1>
                  <p className="text-xs opacity-40 mt-0.5">Tradução automática de vídeo com dubbing · Newport AI</p>
                </div>

                {/* Step 1: Video Upload */}
                <div className="rounded-xl p-5 space-y-4"
                  style={{ background: "#1C1B1B", border: "1px solid rgba(92,64,55,0.15)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                      style={{ background: transVideoUrl ? "rgba(52,211,153,0.15)" : "rgba(240,86,58,0.15)", color: transVideoUrl ? "#34d399" : "#F0563A", border: `1px solid ${transVideoUrl ? "#34d399" : "#F0563A"}44` }}>
                      {transVideoUrl ? "✓" : "1"}
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wider">Vídeo</h3>
                    <span className="text-[9px] font-mono opacity-40 uppercase">Obrigatório</span>
                  </div>
                  <p className="text-xs opacity-50">Carrega o vídeo que queres traduzir. O áudio será gerado no idioma escolhido.</p>

                  {transVideoFile ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "#0e0e0e" }}>
                      <span className="text-xl">🎬</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{transVideoFile.name}</p>
                        <p className="text-[9px] opacity-40">{(transVideoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      {uploadingTrans
                        ? <span className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin shrink-0" />
                        : <span className="text-emerald-400 text-xs shrink-0">✓ Pronto</span>
                      }
                      <button onClick={() => { setTransVideoFile(null); setTransPreview(null); setTransVideoUrl(null); }}
                        className="text-[10px] opacity-40 hover:opacity-100 transition-opacity shrink-0">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => transVideoInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleTransVideoSelect(f); }}
                      className="w-full py-8 rounded-xl border-2 border-dashed text-sm font-bold uppercase tracking-wider transition-all hover:border-[#F0563A]/60 hover:bg-[#F0563A]/5 flex flex-col items-center gap-2"
                      style={{ borderColor: "rgba(92,64,55,0.3)", color: "rgba(229,226,225,0.5)" }}>
                      <span className="text-3xl">🌍</span>
                      <span>+ Carregar Vídeo</span>
                      <span className="text-[9px] opacity-40 font-normal normal-case">ou arrasta e larga aqui</span>
                    </button>
                  )}
                  <input ref={transVideoInputRef} type="file" accept="video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleTransVideoSelect(f); }} />
                </div>

                {/* Step 2: Language selector */}
                <div className="rounded-xl p-5 space-y-4"
                  style={{ background: "#1C1B1B", border: "1px solid rgba(92,64,55,0.15)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                      style={{ background: "rgba(99,5,239,0.15)", color: "#cfbdff", border: "1px solid #cfbdff44" }}>
                      2
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wider">Idioma de Destino</h3>
                    <span className="text-[9px] font-mono opacity-40 uppercase">Obrigatório</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {LANGUAGES.map(lang => (
                      <button key={lang.code} onClick={() => setTargetLang(lang.code)}
                        className="px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-left flex items-center gap-2"
                        style={{
                          background:   targetLang === lang.code ? "rgba(99,5,239,0.2)" : "#0e0e0e",
                          border:       `1px solid ${targetLang === lang.code ? "rgba(99,5,239,0.5)" : "rgba(92,64,55,0.2)"}`,
                          color:        targetLang === lang.code ? "#cfbdff" : "rgba(229,226,225,0.5)",
                        }}>
                        {targetLang === lang.code && <span className="text-[8px]">●</span>}
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={() => {
                    if (!transVideoUrl && !uploadingTrans) { transVideoInputRef.current?.click(); return; }
                    if (canGenerateTrans) handleGenerateTranslate();
                  }}
                  disabled={uploadingTrans}
                  className="w-full py-5 rounded-2xl font-black text-base uppercase tracking-wider text-white flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{
                    background: canGenerateTrans
                      ? "linear-gradient(135deg,#F0563A 0%,#6305ef 100%)"
                      : "#2a2a2a",
                    boxShadow: canGenerateTrans ? "0 0 32px rgba(240,86,58,0.35), 0 0 64px rgba(99,5,239,0.15)" : "none",
                    cursor: uploadingTrans ? "not-allowed" : "pointer",
                  }}>
                  <span className="text-2xl">🌍</span>
                  {uploadingTrans   ? "A carregar vídeo..."
                    : !transVideoUrl ? "📁 Carregar vídeo para traduzir"
                    : `Traduzir Vídeo (${cost("videotranslate")} créditos)`}
                </button>

                <p className="text-center text-[9px] font-mono opacity-20 uppercase tracking-widest">
                  Powered by Newport AI · DreamFace Engine
                </p>
              </>
            )}

          </div>
        </div>
      </main>

      {showCreditModal && (
        <InsufficientCreditsModal
          action={activeTab}
          cost={cost(activeTab)}
          credits={credits}
          onClose={() => setShowCreditModal(false)}
        />
      )}

      {/* ── Toasts ── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
