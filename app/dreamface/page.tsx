"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { useToast, ToastContainer } from "@/components/Toast";
import { UpsellModal } from "@/components/UpsellModal";
import SuarikLogo from "@/components/SuarikLogo";

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage     = "setup" | "processing" | "done" | "error";
type AudioMode = "tts" | "upload";
type ActiveTab = "lipsync" | "talkingphoto" | "videotranslate";

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  bg:"#060606", bg2:"#09090B", bg3:"#0F0F0F", bg4:"#141414", bg5:"#1C1C1C",
  b:"#131313",  b2:"#1A1A1A", b3:"#222",
  t:"#EAEAEA",  t2:"#7A7A7A", t3:"#444", t4:"#252525",
  o:"#E8512A",  o2:"#FF6B3D", os:"rgba(232,81,42,.07)", om:"rgba(232,81,42,.16)",
  grn:"#3ECF8E", gs:"rgba(62,207,142,.07)",  gm:"rgba(62,207,142,.18)",
  pur:"#9B8FF8", ps:"rgba(155,143,248,.07)", pm:"rgba(155,143,248,.16)",
  blu:"#4A9EFF", bs:"rgba(74,158,255,.07)",  bm:"rgba(74,158,255,.16)",
};

const VOICES = [
  { id: "English_expressive_narrator",        label: "EN — Expressive Narrator" },
  { id: "English_Graceful_Lady",              label: "EN — Graceful Lady" },
  { id: "English_Insightful_Speaker",         label: "EN — Insightful Speaker" },
  { id: "English_radiant_girl",               label: "EN — Radiant Girl" },
  { id: "English_Persuasive_Man",             label: "EN — Persuasive Man" },
  { id: "English_Lucky_Robot",                label: "EN — Lucky Robot" },
  { id: "Chinese (Mandarin)_Lyrical_Voice",   label: "ZH — Lyrical Voice" },
  { id: "Chinese (Mandarin)_HK_Flight_Attendant", label: "ZH — HK Flight Attendant" },
  { id: "Japanese_Whisper_Belle",             label: "JA — Whisper Belle" },
];

const NAV_ITEMS = [
  { id: "lipsync",        label: "LipSync",        sub: "Sincronização labial",  cost: 50 },
  { id: "talkingphoto",   label: "Talking Photo",  sub: "Foto que fala",         cost: 40 },
  { id: "videotranslate", label: "Video Translate", sub: "Traduz o lip sync",    cost: 60 },
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

const HOW_STEPS: Record<ActiveTab, string[]> = {
  lipsync:        ["Upload do vídeo avatar", "Gera ou carrega áudio", "Configura parâmetros", "Gera o LipSync"],
  talkingphoto:   ["Upload da foto",         "Gera ou carrega áudio", "Gera a Talking Photo", ""],
  videotranslate: ["Upload do vídeo",        "Escolhe o idioma alvo", "Traduz com dubbing",   ""],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function uploadToR2(blob: Blob, filename: string, contentType: string): Promise<string> {
  const { uploadUrl, publicUrl } = await fetch("/api/upload", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType }),
  }).then(r => r.json());
  const r2Res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!r2Res.ok) throw new Error(`Upload falhou (HTTP ${r2Res.status})`);
  return publicUrl as string;
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Component ────────────────────────────────────────────────────────────────
export default function DreamFacePage() {
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

  const { credits, plan, spend, cost, refresh, refund } = useCredits();
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
  const [audioFile,    setAudioFile]    = useState<File | null>(null);
  const [audioUrl,     setAudioUrl]     = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [genAudio,     setGenAudio]     = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioRef      = useRef<HTMLAudioElement>(null);
  const [playing,      setPlaying]      = useState(false);

  // ── Step 3 (LipSync): Settings ──
  const [enhance,    setEnhance]    = useState(true);
  const [fps,        setFps]        = useState<"25" | "original">("25");
  const [paramsOpen, setParamsOpen] = useState(false);

  // ── Generation state — isolado por ferramenta (evita cascata de erros) ──
  type ToolState = { stage: Stage; progress: number; statusMsg: string; errorMsg: string; resultVideo: string | null };
  const initialToolState: ToolState = { stage: "setup", progress: 0, statusMsg: "", errorMsg: "", resultVideo: null };
  const [toolStates, setToolStates] = useState<Record<ActiveTab, ToolState>>({
    lipsync:        { ...initialToolState },
    talkingphoto:   { ...initialToolState },
    videotranslate: { ...initialToolState },
  });
  const patchTool = useCallback((tool: ActiveTab, patch: Partial<ToolState>) => {
    setToolStates(s => ({ ...s, [tool]: { ...s[tool], ...patch } }));
  }, []);
  const { stage, progress, statusMsg, errorMsg, resultVideo } = toolStates[activeTab];

  // ── Upload handlers ──────────────────────────────────────────────────────
  const handleVideoSelect = useCallback(async (file: File) => {
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setUploadingVideo(true);
    try {
      const url = await uploadToR2(file, file.name, file.type || "video/mp4");
      setAvatarUrl(url);
    } catch (e) {
      console.error("Upload video:", e);
      toast.error("Falha ao fazer upload do vídeo. Tenta novamente.");
      setAvatarFile(null); setAvatarPreview(null); setAvatarUrl(null);
    } finally { setUploadingVideo(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhotoSelect = useCallback(async (file: File) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setUploadingPhoto(true);
    try {
      const url = await uploadToR2(file, file.name, file.type || "image/jpeg");
      setPhotoUrl(url);
    } catch (e) {
      console.error("Upload photo:", e);
      toast.error("Falha ao fazer upload da foto. Tenta novamente.");
      setPhotoFile(null); setPhotoPreview(null); setPhotoUrl(null);
    } finally { setUploadingPhoto(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTransVideoSelect = useCallback(async (file: File) => {
    setTransVideoFile(file);
    setTransPreview(URL.createObjectURL(file));
    setUploadingTrans(true);
    try {
      const url = await uploadToR2(file, file.name, file.type || "video/mp4");
      setTransVideoUrl(url);
    } catch (e) {
      console.error("Upload trans video:", e);
      toast.error("Falha ao fazer upload do vídeo. Tenta novamente.");
      setTransVideoFile(null); setTransPreview(null); setTransVideoUrl(null);
    } finally { setUploadingTrans(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateTTS = useCallback(async () => {
    if (!ttsScript.trim()) return;
    setGenAudio(true);
    try {
      const res  = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: ttsScript.trim(), voiceId, speed }) });
      if (!res.ok) throw new Error("Erro ao gerar TTS");
      const blob = await res.blob();
      if (audioPreview) URL.revokeObjectURL(audioPreview);
      setAudioPreview(URL.createObjectURL(blob));
      const url = await uploadToR2(blob, `tts_${Date.now()}.mp3`, "audio/mpeg");
      setAudioUrl(url);
    } catch (e) { console.error("TTS:", e); }
    finally { setGenAudio(false); }
  }, [ttsScript, voiceId, speed, audioPreview]);

  const handleAudioFileSelect = useCallback(async (file: File) => {
    setAudioFile(file);
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioPreview(URL.createObjectURL(file));
    setGenAudio(true);
    try {
      const url = await uploadToR2(file, file.name, file.type || "audio/mpeg");
      setAudioUrl(url);
    } catch (e) { console.error("Upload audio:", e); }
    finally { setGenAudio(false); }
  }, [audioPreview]);

  const pollResult = useCallback(async (tid: string, tool: ActiveTab, refundId: string) => {
    const MAX_ELAPSED = 600_000; // 10 min
    let elapsed = 0;
    let delay   = 3000;
    let consecutiveFails = 0;

    while (elapsed < MAX_ELAPSED) {
      await sleep(delay);
      elapsed += delay;
      delay    = Math.min(15_000, Math.round(delay * 1.5));
      patchTool(tool, { progress: Math.min(95, Math.round(10 + (elapsed / MAX_ELAPSED) * 85)) });

      try {
        const res  = await fetch("/api/dreamface/poll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: tid }) });
        if (!res.ok) { consecutiveFails++; if (consecutiveFails > 5) break; continue; }
        consecutiveFails = 0;
        const data = await res.json() as { status: number; videoUrl: string | null; error?: string };
        if (data.error) { patchTool(tool, { stage: "error", errorMsg: data.error }); await refund(tool, refundId); return; }
        if (data.status === 1) patchTool(tool, { statusMsg: "⏳ Na fila..." });
        if (data.status === 2) patchTool(tool, { statusMsg: "🔄 Processando..." });
        if (data.status === 3 && data.videoUrl) {
          patchTool(tool, { progress: 100, resultVideo: data.videoUrl, stage: "done" });
          const msgs: Record<string, string> = { lipsync: "LipSync gerado! 🎤", talkingphoto: "Talking Photo criado! 🖼️", videotranslate: "Vídeo traduzido! 🌍" };
          toast.success(msgs[tool] ?? "Vídeo gerado com sucesso!");
          fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool, title: `${tool} — ${new Date().toLocaleString("pt-BR")}`, result_url: data.videoUrl, meta: { taskId: tid } }) }).catch(() => {});
          return;
        }
        if (data.status === 4) { patchTool(tool, { stage: "error", errorMsg: "Geração falhou. Verifica o vídeo e o áudio e tenta novamente." }); toast.error("Geração falhou."); await refund(tool, refundId); return; }
      } catch (e) { console.error("Poll:", e); consecutiveFails++; if (consecutiveFails > 5) break; }
    }
    await refund(tool, refundId);
    patchTool(tool, { stage: "error", errorMsg: "Timeout — o servidor demorou mais de 10 min." });
    toast.error("Tempo limite excedido. Tente novamente.");
  }, [toast, refund, patchTool]);

  const handleGenerate = useCallback(async () => {
    if (!avatarUrl || !audioUrl) return;
    const cr = await spend("lipsync");
    if (!cr.ok) { setShowCreditModal(true); return; }
    const { refundId } = cr;
    patchTool("lipsync", { stage: "processing", progress: 5, statusMsg: "🚀 Enviando para a Newport AI...", errorMsg: "", resultVideo: null });
    try {
      const res  = await fetch("/api/dreamface", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ srcVideoUrl: avatarUrl, audioUrl, videoEnhance: enhance ? 1 : 0, fps: fps === "original" ? "original" : undefined }) });
      const data = await res.json() as { taskId?: string; error?: string };
      if (data.error || !data.taskId) {
        patchTool("lipsync", { stage: "error", errorMsg: data.error ?? "Erro ao iniciar job" });
        await refund("lipsync", refundId);
        return;
      }
      patchTool("lipsync", { statusMsg: "✅ Job criado! Aguardando processamento...", progress: 10 });
      await pollResult(data.taskId, "lipsync", refundId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      patchTool("lipsync", { stage: "error", errorMsg: msg });
      toast.error(msg); await refund("lipsync", refundId);
    }
  }, [avatarUrl, audioUrl, enhance, fps, pollResult, spend, toast, refund, patchTool]);

  const handleGenerateTalkingPhoto = useCallback(async () => {
    if (!photoUrl || !audioUrl) return;
    const cr = await spend("talkingphoto");
    if (!cr.ok) { setShowCreditModal(true); return; }
    const { refundId } = cr;
    patchTool("talkingphoto", { stage: "processing", progress: 5, statusMsg: "🚀 Enviando para a Newport AI...", errorMsg: "", resultVideo: null });
    try {
      const res  = await fetch("/api/talkingphoto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: photoUrl, audioUrl }) });
      const data = await res.json() as { taskId?: string; error?: string };
      if (data.error || !data.taskId) {
        patchTool("talkingphoto", { stage: "error", errorMsg: data.error ?? "Erro ao iniciar job" });
        await refund("talkingphoto", refundId);
        return;
      }
      patchTool("talkingphoto", { statusMsg: "✅ Job criado! Aguardando processamento...", progress: 10 });
      await pollResult(data.taskId, "talkingphoto", refundId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      patchTool("talkingphoto", { stage: "error", errorMsg: msg });
      toast.error(msg); await refund("talkingphoto", refundId);
    }
  }, [photoUrl, audioUrl, pollResult, spend, toast, refund, patchTool]);

  const handleGenerateTranslate = useCallback(async () => {
    if (!transVideoUrl) return;
    const cr = await spend("videotranslate");
    if (!cr.ok) { setShowCreditModal(true); return; }
    const { refundId } = cr;
    patchTool("videotranslate", { stage: "processing", progress: 5, statusMsg: "🚀 Enviando para a Newport AI...", errorMsg: "", resultVideo: null });
    try {
      const res  = await fetch("/api/videotranslate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoUrl: transVideoUrl, targetLanguage: targetLang }) });
      const data = await res.json() as { taskId?: string; error?: string };
      if (data.error || !data.taskId) {
        patchTool("videotranslate", { stage: "error", errorMsg: data.error ?? "Erro ao iniciar job" });
        await refund("videotranslate", refundId);
        return;
      }
      patchTool("videotranslate", { statusMsg: "✅ Job criado! Aguardando processamento...", progress: 10 });
      await pollResult(data.taskId, "videotranslate", refundId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      patchTool("videotranslate", { stage: "error", errorMsg: msg });
      toast.error(msg); await refund("videotranslate", refundId);
    }
  }, [transVideoUrl, targetLang, pollResult, spend, toast, refund, patchTool]);

  // ── Derived flags ─────────────────────────────────────────────────────────
  const canGenerateLipsync = !!avatarUrl && !!audioUrl && !uploadingVideo && !genAudio;
  const canGeneratePhoto   = !!photoUrl  && !!audioUrl && !uploadingPhoto && !genAudio;
  const canGenerateTrans   = !!transVideoUrl && !uploadingTrans;

  const togglePlay = () => {
    if (!audioRef.current || !audioPreview) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else          { audioRef.current.play();  setPlaying(true);  }
  };

  // ── Step states for how-it-works ─────────────────────────────────────────
  const hasMedia = activeTab === "lipsync" ? !!avatarUrl : activeTab === "talkingphoto" ? !!photoUrl : !!transVideoUrl;
  const hasAudio = !!audioUrl;

  function stepCls(n: number) {
    if (activeTab === "videotranslate") {
      if (n === 1) return hasMedia ? "done" : "active";
      if (n === 2) return hasMedia ? (canGenerateTrans ? "done" : "active") : "";
      return "";
    }
    if (n === 1) return hasMedia ? "done" : "active";
    if (n === 2) return hasAudio ? "done" : hasMedia ? "active" : "";
    if (n === 3) return (hasMedia && hasAudio) ? "active" : "";
    if (n === 4) return "";
    return "";
  }

  // ── Processing labels ─────────────────────────────────────────────────────
  const ldTitle = activeTab === "talkingphoto" ? "Gerando Talking Photo" : activeTab === "videotranslate" ? "Traduzindo Vídeo" : "Gerando LipSync";
  const ldSub   = activeTab === "talkingphoto" ? "Newport AI animando a foto..." : activeTab === "videotranslate" ? "Newport AI traduzindo o áudio..." : "Newport AI processando sincronização labial...";

  // ── Center media ──────────────────────────────────────────────────────────
  const currentFile    = activeTab === "lipsync" ? avatarFile    : activeTab === "talkingphoto" ? photoFile    : transVideoFile;
  const currentPreview = activeTab === "lipsync" ? avatarPreview : activeTab === "talkingphoto" ? photoPreview : transPreview;
  const currentUploading = activeTab === "lipsync" ? uploadingVideo : activeTab === "talkingphoto" ? uploadingPhoto : uploadingTrans;

  function handleUploadClick() {
    if (activeTab === "lipsync") videoInputRef.current?.click();
    else if (activeTab === "talkingphoto") photoInputRef.current?.click();
    else transVideoInputRef.current?.click();
  }
  function handleRemoveMedia() {
    if (activeTab === "lipsync") { setAvatarFile(null); setAvatarPreview(null); setAvatarUrl(null); }
    else if (activeTab === "talkingphoto") { setPhotoFile(null); setPhotoPreview(null); setPhotoUrl(null); }
    else { setTransVideoFile(null); setTransPreview(null); setTransVideoUrl(null); }
  }

  const uploadLabel    = activeTab === "lipsync" ? "Arraste o vídeo avatar aqui" : activeTab === "talkingphoto" ? "Arraste a foto aqui" : "Arraste o vídeo aqui";
  const uploadSubLabel = activeTab === "lipsync" ? "MP4 · MOV · WebM · rosto frontal" : activeTab === "talkingphoto" ? "JPG · PNG · WebP · rosto frontal" : "MP4 · MOV · WebM";
  const uploadFeats    = activeTab === "lipsync"
    ? [{c:C.o,t:"Sincronização labial precisa"},{c:C.grn,t:"Newport AI · 4K suportado"},{c:C.pur,t:"Expressão facial preservada"}]
    : activeTab === "talkingphoto"
    ? [{c:C.o,t:"Foto animada com áudio"},{c:C.grn,t:"Newport AI · Alta qualidade"},{c:C.pur,t:"Expressão natural"}]
    : [{c:C.o,t:"Tradução automática"},{c:C.grn,t:"Newport AI · Dubbing"},{c:C.blu,t:"10+ idiomas suportados"}];

  const genDisabled = activeTab === "lipsync"
    ? !canGenerateLipsync || uploadingVideo || genAudio
    : activeTab === "talkingphoto"
    ? !canGeneratePhoto || uploadingPhoto || genAudio
    : !canGenerateTrans || uploadingTrans;

  function handleMainGenerate() {
    if (activeTab === "lipsync") {
      if (!avatarUrl && !uploadingVideo) { videoInputRef.current?.click(); return; }
      if (!audioUrl && !genAudio) return;
      if (canGenerateLipsync) handleGenerate();
    } else if (activeTab === "talkingphoto") {
      if (!photoUrl && !uploadingPhoto) { photoInputRef.current?.click(); return; }
      if (!audioUrl && !genAudio) return;
      if (canGeneratePhoto) handleGenerateTalkingPhoto();
    } else {
      if (!transVideoUrl && !uploadingTrans) { transVideoInputRef.current?.click(); return; }
      if (canGenerateTrans) handleGenerateTranslate();
    }
  }

  const genLabel = activeTab === "lipsync"
    ? (uploadingVideo ? "Carregando vídeo..." : genAudio ? "Processando áudio..." : !avatarUrl ? "Adicionar vídeo avatar" : !audioUrl ? "Adicionar áudio" : `Gerar LipSync · ${cost("lipsync")} créditos`)
    : activeTab === "talkingphoto"
    ? (uploadingPhoto ? "Carregando foto..." : genAudio ? "Processando áudio..." : !photoUrl ? "Adicionar foto" : !audioUrl ? "Adicionar áudio" : `Gerar Talking Photo · ${cost("talkingphoto")} créditos`)
    : (uploadingTrans ? "Carregando vídeo..." : !transVideoUrl ? "Adicionar vídeo" : `Traduzir Vídeo · ${cost("videotranslate")} créditos`);

  const howSteps = HOW_STEPS[activeTab].filter(Boolean);
  const costVal  = NAV_ITEMS.find(n => n.id === activeTab)!.cost;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, color: C.t, fontFamily: "'Geist',system-ui,sans-serif", display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        @keyframes av-ring-pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.8;transform:scale(1.03)} }
        @keyframes ring-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes ld-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(232,81,42,.15)} 50%{box-shadow:0 0 0 12px rgba(232,81,42,0)} }
        @keyframes sync-pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(232,81,42,.4)} 50%{opacity:.6;box-shadow:0 0 0 4px rgba(232,81,42,0)} }
        .df-sbi { display:flex;align-items:center;gap:8px;padding:8px 9px;border-radius:7px;cursor:pointer;transition:all .15s;margin-bottom:2px;color:${C.t3};border:1px solid transparent; }
        .df-sbi:hover { background:${C.bg3};color:${C.t2}; }
        .df-sbi.on { background:${C.bg3};color:${C.t};border-color:${C.b2}; }
        .df-sbi-cr { font-size:9px;font-weight:700;padding:2px 6px;border-radius:8px;margin-left:auto;background:${C.bg4};color:${C.t4};border:1px solid ${C.b};flex-shrink:0; }
        .df-sbi.on .df-sbi-cr { background:${C.os};color:${C.o};border-color:${C.om}; }
        .df-step-hd { display:flex;align-items:center;gap:9px;padding:10px 14px;cursor:pointer;user-select:none;transition:background .15s; }
        .df-step-hd:hover { background:${C.bg3}; }
        .df-chev.open { transform:rotate(180deg); }
        .df-fps-opt { flex:1;text-align:center;padding:6px;border-radius:5px;font-size:11px;font-weight:600;border:1px solid ${C.b};color:${C.t3};cursor:pointer;transition:all .15s;background:none;font-family:inherit; }
        .df-fps-opt:hover { border-color:${C.b2};color:${C.t2}; }
        .df-fps-opt.on { background:${C.o};border-color:${C.o};color:#fff; }
        .df-at { font-size:11px;font-weight:500;padding:5px 12px;border-radius:6px 6px 0 0;cursor:pointer;color:${C.t3};transition:all .15s;border:1px solid transparent;border-bottom:none; }
        .df-at:hover { color:${C.t2}; }
        .df-at.on { background:${C.bg};color:${C.t};border-color:${C.b};border-bottom-color:${C.bg}; }
        .df-gen-btn { width:100%;padding:12px;background:${C.o};color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .25s;display:flex;align-items:center;justify-content:center;gap:7px; }
        .df-gen-btn:hover:not(:disabled) { background:${C.o2};transform:translateY(-1px);box-shadow:0 8px 28px rgba(232,81,42,.3); }
        .df-gen-btn:disabled { background:${C.bg4};color:${C.t4};cursor:not-allowed;transform:none;box-shadow:none; }
        .df-upload-zone { border:1.5px dashed ${C.b2};border-radius:7px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:all .2s;padding:20px 14px;text-align:center;background:none;width:100%;font-family:inherit; }
        .df-upload-zone:hover { border-color:rgba(232,81,42,.4);background:${C.os}; }
        .df-lang-btn { flex:1;min-width:0;padding:7px 10px;border-radius:6px;font-size:11px;font-weight:600;border:1px solid ${C.b};color:${C.t3};cursor:pointer;transition:all .15s;background:none;font-family:inherit;text-align:left; }
        .df-lang-btn:hover { border-color:${C.b2};color:${C.t2}; }
        .df-lang-btn.on { background:${C.os};border-color:${C.om};color:${C.o}; }
        input[type=range] { width:100%;-webkit-appearance:none;height:3px;border-radius:2px;background:${C.bg4};outline:none;cursor:pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:${C.o};cursor:pointer;border:2px solid ${C.bg}; }
      `}</style>

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 46, background: C.bg, borderBottom: `1px solid ${C.b}`, display: "flex", alignItems: "center", padding: "0 14px", gap: 8, flexShrink: 0, zIndex: 100 }}>
        <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t3, cursor: "pointer", padding: "5px 8px", borderRadius: 6, transition: "all .15s", border: "none", background: "none", fontFamily: "inherit" }}
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
          <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>LipSync Studio</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 6 }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1L4.5 4.5H1.5l2.5 2L3 10l3-2 3 2-1-3.5 2.5-2H7.5L6 1z" fill={C.o} opacity=".85"/></svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.t }}>{credits?.toLocaleString() ?? "—"}</span>
            <span style={{ fontSize: 10, color: C.t3 }}>/ 15k</span>
          </div>
          <div style={{ width: 1, height: 14, background: C.b, flexShrink: 0 }} />
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.o, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {initials}
          </div>
        </div>
      </div>

      {/* ── MAIN GRID ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "196px 1fr 1fr", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
        <div style={{ borderRight: `1px solid ${C.b}`, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>
          <div style={{ padding: "10px 8px 6px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" as const, color: C.t4, padding: "0 8px 8px" }}>DreamFace Studio</div>
            {NAV_ITEMS.map(item => (
              <div key={item.id} className={`df-sbi${activeTab === item.id ? " on" : ""}`} onClick={() => setActiveTab(item.id as ActiveTab)}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: C.bg4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {item.id === "lipsync" && <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke={activeTab === "lipsync" ? C.o : C.t3} strokeWidth="1.2"/><path d="M4.5 7.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5" stroke={activeTab === "lipsync" ? C.o : C.t3} strokeWidth="1.1" strokeLinecap="round"/><path d="M5.5 5.5h.4M8.1 5.5h.4" stroke={activeTab === "lipsync" ? C.o : C.t3} strokeWidth="1.2" strokeLinecap="round"/></svg>}
                  {item.id === "talkingphoto" && <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="2" stroke={activeTab === "talkingphoto" ? C.o : C.t3} strokeWidth="1.1"/><circle cx="5" cy="5.5" r=".8" fill={activeTab === "talkingphoto" ? C.o : C.t3}/><circle cx="9" cy="5.5" r=".8" fill={activeTab === "talkingphoto" ? C.o : C.t3}/><path d="M5 8.5c0 .8.9 1.5 2 1.5s2-.7 2-1.5" stroke={activeTab === "talkingphoto" ? C.o : C.t3} strokeWidth=".9" strokeLinecap="round"/></svg>}
                  {item.id === "videotranslate" && <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke={activeTab === "videotranslate" ? C.o : C.t3} strokeWidth="1.1"/><path d="M5 3V2M9 3V2M1 6h12" stroke={activeTab === "videotranslate" ? C.o : C.t3} strokeWidth="1" strokeLinecap="round"/></svg>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: activeTab === item.id ? 500 : 400, whiteSpace: "nowrap" as const }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: C.t4, marginTop: 1 }}>{item.sub}</div>
                </div>
                <span className="df-sbi-cr">{item.cost}cr</span>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: C.b, margin: "5px 8px" }} />

          {/* How it works */}
          <div style={{ margin: 8, background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 11, padding: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: C.t4, marginBottom: 8 }}>Como funciona</div>
            {howSteps.map((txt, i) => {
              const cls = stepCls(i + 1);
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: i < howSteps.length - 1 ? 6 : 0 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, flexShrink: 0, marginTop: 1,
                    background: cls === "done" ? C.gs : cls === "active" ? C.os : C.bg4,
                    border: `1px solid ${cls === "done" ? C.gm : cls === "active" ? C.om : C.b}`,
                    color: cls === "done" ? C.grn : cls === "active" ? C.o : C.t4
                  }}>{cls === "done" ? "✓" : i + 1}</div>
                  <div style={{ fontSize: 11, color: cls === "done" || cls === "active" ? C.t2 : C.t3, lineHeight: 1.45 }}>{txt}</div>
                </div>
              );
            })}
          </div>

          {/* Cost card */}
          <div style={{ margin: 8, background: C.os, border: `1px solid ${C.om}`, borderRadius: 11, padding: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: C.o, marginBottom: 6 }}>Custo por geração</div>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-.04em", color: C.t, lineHeight: 1 }}>
              {costVal} <span style={{ fontSize: 14, fontWeight: 400, color: C.t3 }}>créditos</span>
            </div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>resultado em ~2–4 min</div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${C.b}`, padding: "9px 10px", marginTop: "auto", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t3 }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1L4.5 4.5H1.5l2.5 2L3 10l3-2 3 2-1-3.5 2.5-2H7.5L6 1z" fill={C.o} opacity=".8"/></svg>
              <strong style={{ color: C.t2 }}>{credits?.toLocaleString() ?? "—"}</strong>&nbsp;créditos
            </div>
          </div>
        </div>

        {/* ── CENTER ───────────────────────────────────────────────────────── */}
        <div style={{ borderRight: `1px solid ${C.b}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Avatar stage */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 30%,rgba(232,81,42,.04) 0%,transparent 60%),#080810`, zIndex: 0 }} />
            <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px)", backgroundSize: "48px 48px", opacity: .6 }} />

            {/* Empty state */}
            {!currentPreview && (
              <div onClick={handleUploadClick} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, position: "relative", zIndex: 3, textAlign: "center" }}>
                  <div style={{ position: "relative", width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ position: "absolute", inset: -16, borderRadius: "50%", border: "1px solid rgba(232,81,42,.12)", animation: "av-ring-pulse 3s ease-in-out infinite", animationDelay: "0s" }} />
                    <div style={{ position: "absolute", inset: -32, borderRadius: "50%", border: "1px solid rgba(232,81,42,.12)", animation: "av-ring-pulse 3s ease-in-out infinite", animationDelay: ".8s" }} />
                    <div style={{ width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,.03)", border: "1.5px dashed rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {activeTab === "talkingphoto"
                        ? <svg width="36" height="36" viewBox="0 0 40 40" fill="none"><rect x="4" y="4" width="32" height="32" rx="6" stroke="rgba(255,255,255,.25)" strokeWidth="1.3"/><circle cx="14" cy="16" r="4" stroke="rgba(255,255,255,.25)" strokeWidth="1.2"/><path d="M4 32l10-8 6 6 6-5 10 7" stroke="rgba(255,255,255,.25)" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                        : <svg width="36" height="36" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="14" r="7" stroke="rgba(255,255,255,.25)" strokeWidth="1.3"/><path d="M5 38c0-8.3 6.7-15 15-15s15 6.7 15 15" stroke="rgba(255,255,255,.25)" strokeWidth="1.3" strokeLinecap="round"/></svg>}
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.t, letterSpacing: "-.015em" }}>{uploadLabel}</div>
                  <div style={{ fontSize: 12, color: C.t2 }}>{uploadSubLabel}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    {uploadFeats.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: C.t3 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: f.c, flexShrink: 0 }} />
                        <span>{f.t}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: C.t4, padding: "4px 12px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 20, letterSpacing: ".04em", marginTop: 4 }}>ou clique para selecionar</div>
                </div>
              </div>
            )}

            {/* Filled state */}
            {currentPreview && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, zIndex: 2, padding: 20 }}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 40%,rgba(232,81,42,.06) 0%,transparent 65%),#060608" }} />
                <div style={{ width: 180, height: 220, borderRadius: 16, position: "relative", overflow: "hidden", boxShadow: "0 0 0 1px rgba(255,255,255,.06),0 24px 60px rgba(0,0,0,.7),0 8px 24px rgba(0,0,0,.5)", zIndex: 3, flexShrink: 0 }}>
                  {activeTab === "talkingphoto"
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={currentPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <video src={currentPreview} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  <div style={{ position: "absolute", top: 8, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 5 }}>
                    {currentUploading
                      ? <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(232,81,42,.15)", border: "1px solid rgba(232,81,42,.3)", borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 600, color: C.o }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.o, animation: "sync-pulse 1s ease-in-out infinite" }} />
                          A carregar...
                        </div>
                      : <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(62,207,142,.12)", border: "1px solid rgba(62,207,142,.25)", borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 600, color: C.grn }}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                          Pronto
                        </div>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, zIndex: 3, width: "100%", maxWidth: 240 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.t, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{currentFile?.name ?? "arquivo"}</div>
                    <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{currentUploading ? "Carregando..." : "Pronto para gerar"}</div>
                  </div>
                  <button onClick={handleRemoveMedia} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.b2}`, background: C.bg4, color: C.t3, cursor: "pointer", fontFamily: "inherit" }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    Trocar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step indicator */}
          <div style={{ borderTop: `1px solid ${C.b}`, padding: "10px 14px", flexShrink: 0, display: "flex", alignItems: "center", gap: 8, background: C.bg }}>
            {[
              { label: activeTab === "videotranslate" ? "Vídeo" : activeTab === "talkingphoto" ? "Foto" : "Avatar", n: 1 },
              { label: activeTab === "videotranslate" ? "Idioma" : "Áudio", n: 2 },
              { label: "Gerar", n: 3 },
            ].map((s, i) => {
              const cls = i === 0 ? (hasMedia ? "done" : "active") : i === 1 ? (activeTab === "videotranslate" ? (hasMedia && !canGenerateTrans ? "active" : canGenerateTrans ? "done" : "") : (hasAudio ? "done" : hasMedia ? "active" : "")) : ((activeTab === "videotranslate" ? canGenerateTrans : (hasMedia && hasAudio)) ? "active" : "");
              return (
                <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  {i > 0 && <span style={{ color: C.t4, fontSize: 10 }}>→</span>}
                  <div style={{ width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, flexShrink: 0, transition: "all .2s",
                    background: cls === "done" ? C.grn : cls === "active" ? C.o : C.bg4,
                    border: cls === "done" || cls === "active" ? "none" : `1px solid ${C.b2}`,
                    color: cls === "done" ? C.bg : cls === "active" ? "#fff" : C.t4
                  }}>{cls === "done" ? "✓" : s.n}</div>
                  <span style={{ color: cls === "done" ? C.t2 : cls === "active" ? C.t : C.t3 }}>{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* Hidden inputs */}
          <input ref={videoInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoSelect(f); e.target.value = ""; }} />
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); e.target.value = ""; }} />
          <input ref={transVideoInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleTransVideoSelect(f); e.target.value = ""; }} />
        </div>

        {/* ── RIGHT ────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: `${C.b2} transparent` } as React.CSSProperties}>

            {/* ─── Audio section ─────────────────────────────────────────── */}
            {activeTab !== "videotranslate" && (
              <div style={{ borderBottom: `1px solid ${C.b}`, flexShrink: 0 }}>
                <div className="df-step-hd">
                  <div style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0,
                    background: audioUrl ? C.grn : hasMedia ? C.os : C.bg4,
                    border: audioUrl ? "none" : `1px solid ${hasMedia ? C.om : C.b2}`,
                    color: audioUrl ? C.bg : hasMedia ? C.o : C.t4
                  }}>{audioUrl ? "✓" : "2"}</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.t, letterSpacing: "-.01em" }}>Áudio</span>
                  {audioUrl
                    ? <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, marginLeft: 4, letterSpacing: ".05em", textTransform: "uppercase" as const, background: C.gs, color: C.grn }}>Pronto ✓</span>
                    : <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, marginLeft: 4, letterSpacing: ".05em", textTransform: "uppercase" as const, background: "rgba(226,75,74,.08)", color: "#E24B4A" }}>Obrigatório</span>}
                </div>

                {/* Audio tabs */}
                <div style={{ display: "flex", gap: 1, padding: "10px 14px 0", background: C.bg }}>
                  <div className={`df-at${audioMode === "tts" ? " on" : ""}`} onClick={() => setAudioMode("tts")}>Gerar TTS</div>
                  <div className={`df-at${audioMode === "upload" ? " on" : ""}`} onClick={() => setAudioMode("upload")}>Upload Áudio</div>
                </div>

                {/* TTS panel */}
                {audioMode === "tts" && (
                  <div style={{ padding: "12px 14px", background: C.bg, borderTop: `1px solid ${C.b}` }}>
                    <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
                      style={{ width: "100%", background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, padding: "8px 30px 8px 11px", color: C.t, fontFamily: "inherit", fontSize: 13, outline: "none", cursor: "pointer", appearance: "none" as const, WebkitAppearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%23555' stroke-width='1.2' stroke-linecap='round' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", marginBottom: 10 }}>
                      {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                      <div style={{ background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: C.t4, marginBottom: 4 }}>Velocidade</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.t }}>{speed.toFixed(1)}×</div>
                        <input type="range" min={0.5} max={2} step={0.1} value={speed} onChange={e => setSpeed(+e.target.value)} style={{ marginTop: 4 }} />
                      </div>
                      <div style={{ background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: C.t4, marginBottom: 4 }}>Idioma</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.t }}>Auto</div>
                      </div>
                    </div>
                    <textarea value={ttsScript} onChange={e => setTtsScript(e.target.value)} placeholder="Escreva o script que o avatar irá falar..."
                      style={{ width: "100%", background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, padding: "9px 11px", color: C.t, fontFamily: "inherit", fontSize: 12, resize: "none", height: 68, outline: "none", lineHeight: 1.65, marginBottom: 8, caretColor: C.o }}
                      onFocus={e => (e.currentTarget.style.borderColor = "rgba(232,81,42,.3)")}
                      onBlur={e => (e.currentTarget.style.borderColor = C.b)} />
                    <button onClick={handleGenerateTTS} disabled={!ttsScript.trim() || genAudio}
                      style={{ width: "100%", padding: 9, background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, fontSize: 12, fontWeight: 600, color: C.t2, cursor: !ttsScript.trim() || genAudio ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: !ttsScript.trim() || genAudio ? .5 : 1 }}>
                      {genAudio ? <><span style={{ width: 12, height: 12, border: "1.5px solid rgba(255,255,255,.2)", borderTopColor: C.t, borderRadius: "50%", animation: "ring-spin 1s linear infinite", display: "inline-block" }} /> Gerando...</> : <><svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="4" y="2" width="6" height="8" rx="3" stroke="currentColor" strokeWidth="1.2"/><path d="M2.5 8.5c0 2.5 2 4.5 4.5 4.5s4.5-2 4.5-4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> Gerar Áudio com MiniMax</>}
                    </button>
                  </div>
                )}

                {/* Upload panel */}
                {audioMode === "upload" && (
                  <div style={{ padding: 14, background: C.bg, borderTop: `1px solid ${C.b}` }}>
                    {audioFile
                      ? <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.t, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{audioFile.name}</div>
                            <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{(audioFile.size / 1024 / 1024).toFixed(1)} MB</div>
                          </div>
                          {genAudio ? <span style={{ width: 14, height: 14, border: "1.5px solid rgba(255,255,255,.2)", borderTopColor: C.t, borderRadius: "50%", animation: "ring-spin 1s linear infinite", display: "inline-block", flexShrink: 0 }} />
                            : <span style={{ color: C.grn, fontSize: 11, flexShrink: 0 }}>✓ Pronto</span>}
                          <button onClick={() => { setAudioFile(null); setAudioUrl(null); setAudioPreview(null); }} style={{ fontSize: 10, background: "none", border: "none", color: C.t3, cursor: "pointer" }}>✕</button>
                        </div>
                      : <button className="df-upload-zone" onClick={() => audioInputRef.current?.click()}>
                          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 14V4M6 8l4-4 4 4M2 18h16" stroke={C.t3} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Upload de áudio</div>
                          <div style={{ fontSize: 11, color: C.t3 }}>MP3 · WAV · M4A · WebM</div>
                        </button>}
                    <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleAudioFileSelect(f); }} />
                  </div>
                )}

                {/* Audio preview */}
                {audioPreview && (
                  <div style={{ padding: "10px 14px", background: C.bg, borderTop: `1px solid ${C.b}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={togglePlay} style={{ width: 24, height: 24, borderRadius: "50%", background: C.gs, border: `1px solid ${C.gm}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.grn, flexShrink: 0, fontFamily: "inherit" }}>
                        {playing ? "⏸" : "▶"}
                      </button>
                      <span style={{ fontSize: 11, color: C.t2 }}>{audioMode === "tts" ? VOICES.find(v => v.id === voiceId)?.label : audioFile?.name ?? "Áudio"}</span>
                      <button onClick={() => { setAudioUrl(null); setAudioPreview(null); setAudioFile(null); if (audioRef.current) audioRef.current.pause(); setPlaying(false); }}
                        style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: `1px solid ${C.gm}`, background: C.gs, color: C.grn, cursor: "pointer", fontFamily: "inherit", marginLeft: "auto" }}>
                        Trocar
                      </button>
                    </div>
                    <audio ref={audioRef} src={audioPreview} onEnded={() => setPlaying(false)} style={{ display: "none" }} />
                  </div>
                )}
              </div>
            )}

            {/* ─── Language selector (videotranslate) ─────────────────────── */}
            {activeTab === "videotranslate" && (
              <div style={{ borderBottom: `1px solid ${C.b}`, flexShrink: 0, padding: "12px 14px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: C.t4, marginBottom: 10 }}>Idioma de Destino</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {LANGUAGES.map(lang => (
                    <button key={lang.code} className={`df-lang-btn${targetLang === lang.code ? " on" : ""}`} onClick={() => setTargetLang(lang.code)}>
                      {targetLang === lang.code && <span style={{ marginRight: 4, fontSize: 8, color: C.o }}>●</span>}
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Parameters (lipsync only) ──────────────────────────────── */}
            {activeTab === "lipsync" && (
              <div style={{ borderBottom: `1px solid ${C.b}`, flexShrink: 0 }}>
                <div className="df-step-hd" onClick={() => setParamsOpen(p => !p)}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, background: C.bg4, border: `1px solid ${C.b2}`, color: C.t4 }}>3</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.t, letterSpacing: "-.01em" }}>Parâmetros</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, marginLeft: 4, letterSpacing: ".05em", textTransform: "uppercase" as const, background: C.bg4, color: C.t4 }}>Opcional</span>
                  <svg className={`df-chev${paramsOpen ? " open" : ""}`} style={{ marginLeft: "auto", color: C.t4, transition: "transform .2s", flexShrink: 0 }} width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 6l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </div>
                {paramsOpen && (
                  <div style={{ padding: "12px 14px", background: C.bg }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: C.t2 }}>Enhance — Melhora nitidez</span>
                      <div onClick={() => setEnhance(e => !e)} style={{ width: 30, height: 17, borderRadius: 9, position: "relative" as const, cursor: "pointer", transition: "background .2s", background: enhance ? C.o : C.bg4, border: enhance ? "none" : `1px solid ${C.b2}`, flexShrink: 0 }}>
                        <div style={{ position: "absolute" as const, width: 13, height: 13, borderRadius: "50%", background: "#fff", top: 2, left: enhance ? 15 : 2, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: C.t4, marginBottom: 6 }}>FPS de saída</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {(["25", "original"] as const).map(f => (
                          <button key={f} className={`df-fps-opt${fps === f ? " on" : ""}`} onClick={() => setFps(f)}>{f === "25" ? "25 FPS" : "Original"}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Generate footer ───────────────────────────────────────────── */}
          <div style={{ borderTop: `1px solid ${C.b}`, padding: "10px 14px", flexShrink: 0, background: C.bg }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 11, color: C.t3 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1L4.5 4.5H1.5l2.5 2L3 10l3-2 3 2-1-3.5 2.5-2H7.5L6 1z" fill={C.o} opacity=".85"/></svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.t }}>{costVal}</span>
              <span>créditos por geração · ~2–4 min</span>
            </div>
            <button className="df-gen-btn" onClick={handleMainGenerate} disabled={genDisabled}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" opacity=".4"/><path d="M5 7l1.5 1.5L9 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              {genLabel}
            </button>
          </div>
        </div>
      </div>

      {/* ── LOADING OVERLAY ────────────────────────────────────────────────── */}
      {stage === "processing" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4,4,4,.93)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(16px)" }}>
          <div style={{ position: "relative", marginBottom: 20, width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid transparent", borderTopColor: C.o, animation: "ring-spin 1.1s linear infinite" }} />
            <div style={{ position: "absolute", inset: 5, borderRadius: "50%", border: "1px solid transparent", borderBottomColor: "rgba(232,81,42,.3)", animation: "ring-spin 1.8s linear infinite reverse" }} />
            <div style={{ width: 64, height: 64, borderRadius: 14, background: C.bg3, border: `1px solid ${C.b2}`, display: "flex", alignItems: "center", justifyContent: "center", animation: "ld-pulse 2s ease-in-out infinite" }}>
              <SuarikLogo size={36} />
            </div>
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase" as const, color: C.o, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ flex: 1, maxWidth: 28, height: 1, background: "rgba(232,81,42,.2)" }} />LipSync Studio<span style={{ flex: 1, maxWidth: 28, height: 1, background: "rgba(232,81,42,.2)" }} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.025em", color: C.t, marginBottom: 4, textAlign: "center" }}>{ldTitle}</div>
          <div style={{ fontSize: 12, color: C.t2, marginBottom: 24, fontWeight: 300, textAlign: "center" }}>{ldSub}</div>
          <div style={{ background: C.bg, border: `1px solid ${C.b}`, borderRadius: 11, overflow: "hidden", width: "100%", maxWidth: 360, marginBottom: 14 }}>
            {[
              { lbl: "Enviando arquivos", det: "R2 Storage", state: progress > 5 ? "done" : "active" },
              { lbl: "Job criado na Newport AI", det: "API", state: progress > 10 ? "done" : progress > 5 ? "active" : "idle" },
              { lbl: "Processando sincronização", det: "~2–4 min", state: progress > 50 ? "done" : progress > 10 ? "active" : "idle" },
              { lbl: activeTab === "videotranslate" ? "Tradução concluída" : activeTab === "talkingphoto" ? "Talking Photo pronto" : "LipSync pronto", det: "", state: progress >= 100 ? "done" : "idle" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", borderBottom: i < 3 ? `1px solid ${C.b}` : "none", background: s.state === "done" ? "rgba(62,207,142,.03)" : s.state === "active" ? "rgba(232,81,42,.04)" : "transparent", transition: "background .3s" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: s.state === "done" ? "rgba(62,207,142,.14)" : s.state === "active" ? C.om : C.bg4, color: s.state === "done" ? C.grn : s.state === "active" ? C.o : C.t4 }}>
                  {s.state === "done" ? "✓" : s.state === "active" ? "▶" : "○"}
                </div>
                <span style={{ fontSize: 11, color: s.state === "idle" ? C.t4 : s.state === "active" ? C.t : C.t3 }}>{s.lbl}</span>
                {s.det && <span style={{ fontSize: 9, marginLeft: "auto", whiteSpace: "nowrap" as const, color: s.state === "done" ? C.grn : C.t4 }}>{s.det}</span>}
              </div>
            ))}
          </div>
          <div style={{ width: "100%", maxWidth: 360, height: 2, background: C.bg4, borderRadius: 1, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", background: `linear-gradient(90deg,${C.o},${C.o2})`, borderRadius: 1, transition: "width .5s cubic-bezier(.16,1,.3,1)", width: `${progress}%` }} />
          </div>
          <div style={{ fontSize: 11, color: C.t4 }}>{progress}%</div>
          <div style={{ fontSize: 11, color: C.t2, marginTop: 4 }}>{statusMsg}</div>
        </div>
      )}

      {/* ── RESULT OVERLAY ─────────────────────────────────────────────────── */}
      {stage === "done" && resultVideo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4,4,4,.97)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, backdropFilter: "blur(24px)" }}>
          <div style={{ width: "100%", maxWidth: 600 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.grn, animation: "sync-pulse 1s ease-in-out infinite" }} />
              <span style={{ fontSize: 11, color: C.t3, letterSpacing: ".06em", textTransform: "uppercase" as const }}>
                {activeTab === "talkingphoto" ? "Talking Photo Concluído" : activeTab === "videotranslate" ? "Tradução Concluída" : "LipSync Concluído"}
              </span>
            </div>
            <video src={resultVideo} controls autoPlay style={{ width: "100%", borderRadius: 12, background: "#0e0e0e", maxHeight: "55vh", marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { sessionStorage.setItem("vb_pending_video", resultVideo); sessionStorage.setItem("vb_restore_requested", "1"); router.push("/storyboard"); }}
                style={{ flex: 1, padding: "14px 0", borderRadius: 10, fontWeight: 700, fontSize: 13, color: "#fff", border: "none", cursor: "pointer", background: `linear-gradient(135deg,${C.o},#c44527)`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                ⚡ Entrar no Editor →
              </button>
              <a href={resultVideo} download="result.mp4"
                style={{ padding: "14px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, color: C.t, border: `1px solid ${C.b2}`, background: C.bg3, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none" }}>
                ⬇ Download
              </a>
              <button onClick={() => patchTool(activeTab, { stage: "setup", resultVideo: null, progress: 0 })}
                style={{ padding: "14px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, color: C.t, border: `1px solid ${C.b2}`, background: C.bg3, cursor: "pointer", fontFamily: "inherit" }}>
                ↺ Nova
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ERROR OVERLAY ──────────────────────────────────────────────────── */}
      {stage === "error" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4,4,4,.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(24px)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: C.t }}>Algo correu mal</h2>
          <p style={{ fontSize: 13, color: C.t2, marginBottom: 24, textAlign: "center", maxWidth: 400, lineHeight: 1.6 }}>{errorMsg}</p>
          <button onClick={() => patchTool(activeTab, { stage: "setup", progress: 0, errorMsg: "" })}
            style={{ padding: "12px 32px", borderRadius: 8, fontWeight: 700, fontSize: 13, color: "#fff", border: "none", cursor: "pointer", background: C.o, fontFamily: "inherit" }}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showCreditModal && <UpsellModal onClose={() => setShowCreditModal(false)} tool="lipsync" />}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
