"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, Mic, Sparkles, ChevronDown,
  X, Zap, Check, Brain, Film,
  Music2, Download, FileCode2,
  BookOpen, Wand2, CloudUpload, Upload,
  RefreshCw, Flame, Settings,
} from "lucide-react";
import { useToast, ToastContainer } from "@/components/Toast";
import { trackEvent } from "@/components/PostHogProvider";
import { TTS_VOICES } from "@/app/lib/ttsVoices";
import type { DirectResponseScene, GenerateResponse, WhisperWord, BackgroundTrack, WinningAd } from "./types";
import { analyzeCopyForDirectResponse, extractAudioAsWav } from "./utils";
import { WorkstationView, buildDrsFromWhisper } from "./components/WorkstationView";
import { UploadModal } from "./components/UploadModal";
import { GeneratingView } from "./components/GeneratingView";
import { HomeRightPanel } from "./components/HomeRightPanel";
import { UpsellModal } from "@/components/UpsellModal";
import { WinningAdsDrawer } from "./components/WinningAdsDrawer";
import {
  NICHES, TEMPLATES, ASPECTS, BROLL_IMAGES, POWER_WORDS, LOADING_MSGS,
} from "./constants";
import { useTheme } from "@/components/ThemeProvider";

// ─── Emotion map (matches v7 design) ────────────────────────────────────────
const EMOTS = [
  { name: "Choque",       hex: "#E8512A" },
  { name: "Urgência",     hex: "#F5A623" },
  { name: "Mistério",     hex: "#9B8FF8" },
  { name: "Esperança",    hex: "#3ECF8E" },
  { name: "Prova Social", hex: "#4A9EFF" },
  { name: "CTA",          hex: "#E24B4A" },
];

function fmtSec(s: number) { return "0:" + String(s).padStart(2, "0"); }

// ─── Main component ──────────────────────────────────────────────────────────
export default function SuarikHome() {
  const router = useRouter();
  const { toasts, remove: removeToast, toast } = useToast();

  // ── User profile ──────────────────────────────────────────────────────────
  const [userInitials,  setUserInitials]  = useState("·");
  const [userDisplay,   setUserDisplay]   = useState("...");
  const [userPlan,      setUserPlan]      = useState("Free");
  const [userCredits,   setUserCredits]   = useState<number|null>(null);

  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      if (res.ok) {
        const d = await res.json() as { credits?: number };
        if (typeof d.credits === "number") setUserCredits(d.credits);
      }
    } catch { /* non-critical */ }
  }, []);

  // ── Cross-tool pending payloads ───────────────────────────────────────────
  const [pendingTtsUrl,    setPendingTtsUrl]    = useState<string|null>(null);
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string|null>(null);

  // ── Core state ────────────────────────────────────────────────────────────
  const [copy,             setCopy]          = useState("");
  const [niche,            setNiche]         = useState("dr_nutra_pain");
  const [aspect,           setAspect]        = useState(0);
  const [error,            setError]         = useState<string|null>(null);
  const [result,           setResult]        = useState<GenerateResponse|null>(null);
  const [drScenes,         setDrScenes]      = useState<DirectResponseScene[]>([]);
  const [bgMusicUrl,       setBgMusicUrl]    = useState<string|undefined>(undefined);
  const [isUploadModalOpen,setUploadOpen]    = useState(false);
  const [isGenerating,     setIsGenerating]  = useState(false);
  const [isGenerated,      setIsGenerated]   = useState(false);
  const [paywallOpen,      setPaywallOpen]   = useState(false);
  const [winningAdsOpen,   setWinningAdsOpen]= useState(false);
  const [selectedAd,       setSelectedAd]   = useState<WinningAd|null>(null);
  const [activeTag,        setActiveTag]     = useState("All");
  const [videoFile,        setVideoFile]     = useState<File|null>(null);
  const [homeTtsVoice,     setHomeTtsVoice]  = useState("English_expressive_narrator");
  const [homeTtsLoading,   setHomeTtsLoading]= useState(false);
  const [homeTtsUrl,       setHomeTtsUrl]    = useState<string|null>(null);
  const [homeTtsError,     setHomeTtsError]  = useState<string|null>(null);
  const [isDragOver,       setIsDragOver]    = useState(false);
  const [isEnriching,      setIsEnriching]   = useState(false);
  const [enrichStep,       setEnrichStep]    = useState(0);
  const [videoLang,        setVideoLang]     = useState<"auto"|"pt"|"en"|"es">("auto");
  const [pendingEnrichTrigger, setPendingEnrichTrigger] = useState(false);

  // ── v7 UI state ───────────────────────────────────────────────────────────
  const { theme, toggleTheme } = useTheme();
  const [editorMode,    setEditorMode]   = useState<"simple"|"compose">("simple");
  const [rightSubTab,   setRightSubTab]  = useState<"hooks"|"analise">("hooks");
  const [selectedScene, setSelectedScene]= useState(0);
  const [hooksFilter,   setHooksFilter]  = useState("All");
  const [selectedHooks, setSelectedHooks]= useState(new Set<number>());
  const [audMode,       setAudMode]      = useState<"tts"|"upload">("tts");
  const [inlineOpen,    setInlineOpen]   = useState(false);

  // ── Upload progress ───────────────────────────────────────────────────────
  const [r2PublicUrl,     setR2PublicUrl]     = useState<string|null>(null);
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const [whisperWords,    setWhisperWords]    = useState<WhisperWord[]>([]);

  // ── Load user + session on mount ──────────────────────────────────────────
  useEffect(() => {
    const supabase = (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      return createClient();
    })();
    supabase.then(async (client) => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const name = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Usuário";
      const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
      setUserInitials(initials);
      setUserDisplay(name.split(" ")[0]);
      const { data: prof } = await client.from("profiles").select("plan,credits").eq("id", user.id).single();
      const planLabels: Record<string,string> = { free:"Free", starter:"Starter", pro:"PRO", agency:"Agency", premium:"Premium" };
      setUserPlan(planLabels[prof?.plan] ?? "Free");
      setUserCredits(prof?.credits ?? 0);

      const openUploadFlag = sessionStorage.getItem("vb_open_upload_modal");
      if (openUploadFlag) { sessionStorage.removeItem("vb_open_upload_modal"); setEditorMode("compose"); }

      const enricherPending = sessionStorage.getItem("vb_enricher_pending");
      if (enricherPending) {
        sessionStorage.removeItem("vb_enricher_pending");
        try {
          const pendingFile = await new Promise<File | null>((resolve, reject) => {
            const req = indexedDB.open("enricherDB", 1);
            req.onupgradeneeded = () => req.result.createObjectStore("files");
            req.onsuccess = () => {
              const tx = req.result.transaction("files", "readonly");
              const getReq = tx.objectStore("files").get("pending");
              getReq.onsuccess = () => { req.result.close(); resolve(getReq.result || null); };
              getReq.onerror = () => reject(getReq.error);
            };
            req.onerror = () => reject(req.error);
          });
          if (pendingFile) {
            await new Promise<void>((resolve) => {
              const req = indexedDB.open("enricherDB", 1);
              req.onsuccess = () => {
                const tx = req.result.transaction("files", "readwrite");
                tx.objectStore("files").delete("pending");
                tx.oncomplete = () => { req.result.close(); resolve(); };
                tx.onerror = () => resolve();
              };
              req.onerror = () => resolve();
            });
            setVideoFile(pendingFile);
            setEditorMode("compose");
            setPendingEnrichTrigger(true);
          }
        } catch { /* silent */ }
      }

      const restoreRequested = sessionStorage.getItem("vb_restore_requested");
      sessionStorage.removeItem("vb_restore_requested");
      const savedResult   = sessionStorage.getItem("vb_project_result");
      const savedCopy     = sessionStorage.getItem("vb_project_copy");
      const savedDrScenes = sessionStorage.getItem("vb_project_drScenes");
      if (restoreRequested && savedResult && savedCopy) {
        try {
          const parsedResult   = JSON.parse(savedResult);
          const parsedDrScenes = savedDrScenes ? JSON.parse(savedDrScenes) : [];
          setCopy(savedCopy);
          setResult(parsedResult);
          setDrScenes(parsedDrScenes);
          if (parsedResult.background_tracks?.[0]?.url) setBgMusicUrl(parsedResult.background_tracks[0].url);
          setIsGenerated(true);
        } catch { /* ignore */ }
      }

      const pendingAudioRaw = sessionStorage.getItem("vb_pending_audio");
      if (pendingAudioRaw) {
        sessionStorage.removeItem("vb_pending_audio");
        try {
          const pa = JSON.parse(pendingAudioRaw) as { url: string; label?: string };
          if (pa?.url) { setHomeTtsUrl(pa.url); setPendingTtsUrl(pa.url); }
        } catch { /* ignore */ }
      }

      const pendingVideoUrl = sessionStorage.getItem("vb_pending_video");
      const legacyAvatarUrl = sessionStorage.getItem("vb_pending_avatar_url");
      const avatarUrl = pendingVideoUrl ?? legacyAvatarUrl;
      if (pendingVideoUrl) sessionStorage.removeItem("vb_pending_video");
      if (legacyAvatarUrl) sessionStorage.removeItem("vb_pending_avatar_url");
      if (avatarUrl) {
        setPendingAvatarUrl(avatarUrl);
        setEditorMode("compose");
        const hasSavedSession = !!sessionStorage.getItem("vb_project_result");
        if (!hasSavedSession) {
          const emptyResult = { project_vibe: "ugc", music_style: "Suspense", scenes: [], background_tracks: [] };
          sessionStorage.setItem("vb_project_result", JSON.stringify(emptyResult));
          sessionStorage.setItem("vb_project_copy", "Avatar");
          sessionStorage.setItem("vb_project_drScenes", "[]");
          sessionStorage.setItem("vb_restore_requested", "1");
          setResult(emptyResult as GenerateResponse);
          setDrScenes([]);
          setCopy("Avatar");
          setIsGenerated(true);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleHomeRaioX = useCallback((ad: WinningAd) => {
    setSelectedAd(ad);
    setWinningAdsOpen(true);
  }, []);

  const aspectFormats = ["landscape","portrait","landscape"] as const;
  const themeMap: Record<number,string> = { 0:"vsl_long", 1:"social_organic", 2:"cinematic" };

  const handleHomeTts = async () => {
    if (!copy.trim() || homeTtsLoading) return;
    setHomeTtsLoading(true);
    setHomeTtsError(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: copy.trim(), voiceId: homeTtsVoice }),
      });
      if (!res.ok) {
        const d = await res.json().catch(()=>({error:"Erro desconhecido"}));
        throw new Error(d.error ?? "Erro ao gerar voz");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setHomeTtsUrl(prev => { if(prev) URL.revokeObjectURL(prev); return url; });
    } catch(e: unknown) {
      setHomeTtsError(e instanceof Error ? e.message : "Erro ao gerar voz");
    } finally {
      setHomeTtsLoading(false);
      refreshCredits();
    }
  };

  const handleGenerate = async () => {
    if (!copy.trim() || isGenerating) return;
    setIsGenerating(true); setIsGenerated(false); setError(null); setResult(null);
    try {
      const [drs] = await Promise.all([
        fetch("/api/generate-timeline", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({copy}),
        }).then(async res=>{
          if(!res.ok) return { scenes: analyzeCopyForDirectResponse(copy), backgroundMusicUrl: undefined, backgroundTracks: undefined };
          const d = await res.json();
          if(d?.scenes && Array.isArray(d.scenes) && d.scenes.length>0)
            return { scenes: d.scenes as DirectResponseScene[], backgroundMusicUrl: d.backgroundMusicUrl as string|undefined, backgroundTracks: d.backgroundTracks as BackgroundTrack[]|undefined };
          if(Array.isArray(d) && d.length>0)
            return { scenes: d as DirectResponseScene[], backgroundMusicUrl: undefined, backgroundTracks: undefined };
          return { scenes: analyzeCopyForDirectResponse(copy), backgroundMusicUrl: undefined, backgroundTracks: undefined };
        }),
        new Promise<void>(r=>setTimeout(r,3000)),
      ]);
      const result: GenerateResponse = {
        project_vibe:      themeMap[aspect] ?? "ugc",
        music_style:       niche,
        scenes:            [],
        background_tracks: drs.backgroundTracks ?? [],
      };
      sessionStorage.setItem("vb_project_result",   JSON.stringify(result));
      sessionStorage.setItem("vb_project_copy",      copy);
      sessionStorage.setItem("vb_project_drScenes",  JSON.stringify(drs.scenes));
      setResult(result);
      setDrScenes(drs.scenes);
      if(drs.backgroundMusicUrl) setBgMusicUrl(drs.backgroundMusicUrl);
      if(homeTtsUrl) setPendingTtsUrl(homeTtsUrl);
      setIsGenerated(true);
      toast.success(`Storyboard com ${drs.scenes.length} cenas gerado! 🎬`);
      trackEvent("storyboard_generated", { scenes: drs.scenes.length, niche, aspect: String(aspect) });
      fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool:"storyboard", title: copy.trim().slice(0,80)||"Storyboard sem título", meta:{ scenes: drs.scenes.length, niche, aspect } }),
      }).catch(()=>{});
    } catch(e:unknown){
      setError(e instanceof Error?e.message:"Erro ao gerar.");
      toast.error(e instanceof Error?e.message:"Erro ao gerar storyboard.");
    } finally{
      setIsGenerating(false);
      refreshCredits();
    }
  };

  const handleBack = () => { setIsGenerated(false); setResult(null); setIsEnriching(false); setEnrichStep(0); };

  const ENRICH_STEPS = [
    "🔗 Solicitando passe de segurança...",
    "☁️ Enviando vídeo para a nuvem...",
    "🎧 Extraindo áudio + transcrevendo com Whisper IA...",
    "🎬 GPT-4o analisando cenas + buscando B-rolls HD...",
  ];

  const handleEnrich = async () => {
    if (!videoFile || isEnriching) return;
    setIsEnriching(true); setEnrichStep(0); setError("");
    try {
      const videoDuration = await new Promise<number>((resolve) => {
        const probe = document.createElement("video");
        const probeUrl = URL.createObjectURL(videoFile);
        probe.preload = "metadata";
        probe.src = probeUrl;
        probe.onloadedmetadata = () => { const dur = isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 60; URL.revokeObjectURL(probeUrl); resolve(dur); };
        probe.onerror = () => { URL.revokeObjectURL(probeUrl); resolve(60); };
      });
      setEnrichStep(1); setUploadProgress(0);
      const presignRes = await fetch("/api/upload", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ filename: videoFile.name, contentType: videoFile.type || "video/mp4" }) });
      if (!presignRes.ok) { const errBody = await presignRes.json().catch(()=>({})); throw new Error(errBody.error || `Falha ao solicitar URL de upload (${presignRes.status})`); }
      const { uploadUrl, publicUrl } = await presignRes.json();
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", videoFile.type || "video/mp4");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { setUploadProgress(100); resolve(); } else reject(new Error(`Upload falhou (HTTP ${xhr.status})`)); };
        xhr.onerror = () => reject(new Error("Erro de rede no upload. Tente novamente."));
        xhr.send(videoFile);
      });
      setR2PublicUrl(publicUrl);
      setEnrichStep(2); setUploadProgress(0);
      let whisperText = "";
      let wWords: { word: string; start: number; end: number }[] = [];
      try {
        const wavBlob = await extractAudioAsWav(videoFile);
        const wavPresignRes = await fetch("/api/upload", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ filename: videoFile.name.replace(/\.[^.]+$/, ".wav"), contentType: "audio/wav" }) });
        let audioPublicUrl: string | null = null;
        if (wavPresignRes.ok) {
          const { uploadUrl: wavUploadUrl, publicUrl: wavPublicUrl } = await wavPresignRes.json();
          const wavUpRes = await fetch(wavUploadUrl, { method:"PUT", headers:{"Content-Type":"audio/wav"}, body: wavBlob });
          if (wavUpRes.ok || wavUpRes.status === 200) audioPublicUrl = wavPublicUrl;
        }
        if (audioPublicUrl) {
          const txRes = await fetch("/api/transcribe", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ publicUrl: audioPublicUrl, language: videoLang === "auto" ? undefined : videoLang }) });
          if (txRes.ok) { const txData = await txRes.json(); whisperText = txData.text || ""; wWords = txData.words || []; setWhisperWords(wWords); }
        }
      } catch {
        try {
          const txRes = await fetch("/api/transcribe", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ publicUrl }) });
          if (txRes.ok) { const txData = await txRes.json(); whisperText = txData.text || ""; wWords = txData.words || []; setWhisperWords(wWords); }
        } catch { /* silent */ }
      }
      setEnrichStep(3);
      let finalDrs: DirectResponseScene[];
      let backgroundMusicUrl: string | undefined;
      let enrichBgTracks: BackgroundTrack[] = [];
      if (whisperText) {
        try {
          const enrichRes = await fetch("/api/enrich-scenes", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ text: whisperText, words: wWords, videoDuration }) });
          if (enrichRes.ok) { const enrichData = await enrichRes.json(); finalDrs = enrichData.scenes || []; backgroundMusicUrl = enrichData.backgroundMusicUrl; if (enrichData.backgroundTracks?.length) enrichBgTracks = enrichData.backgroundTracks; }
          else { finalDrs = wWords.length > 0 ? buildDrsFromWhisper(wWords, videoDuration) : analyzeCopyForDirectResponse(whisperText); }
        } catch { finalDrs = wWords.length > 0 ? buildDrsFromWhisper(wWords, videoDuration) : analyzeCopyForDirectResponse(whisperText); }
      } else {
        finalDrs = buildDrsFromWhisper([], videoDuration);
        setError("⚠️ Não foi possível transcrever o áudio do vídeo.");
      }
      const finalResult: GenerateResponse = {
        project_vibe: "ugc_alto_impacto", music_style: "Suspense Emocional", scenes: [],
        background_tracks: enrichBgTracks.length ? enrichBgTracks : [
          ...(backgroundMusicUrl ? [{ url: backgroundMusicUrl, title: "Trilha Principal (IA)", is_premium_vault: true }] : []),
          { url: "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3", title: "Epic Orchestral Cinematic", is_premium_vault: true },
        ].slice(0, 3),
      };
      sessionStorage.setItem("vb_project_result", JSON.stringify(finalResult));
      sessionStorage.setItem("vb_project_copy", videoFile?.name ?? "Vídeo enriquecido");
      sessionStorage.setItem("vb_project_drScenes", JSON.stringify(finalDrs));
      setResult(finalResult); setDrScenes(finalDrs);
      if(homeTtsUrl) setPendingTtsUrl(homeTtsUrl);
      if (backgroundMusicUrl) setBgMusicUrl(backgroundMusicUrl);
      setIsEnriching(false); setEnrichStep(0); setIsGenerated(true);
      toast.success("Vídeo enriquecido com IA! 🎬");
      trackEvent("video_enriched", { scenes: finalDrs.length });
      fetch("/api/projects", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ tool:"storyboard", title: videoFile?.name ?? "Vídeo enriquecido", meta:{ enriched:true } }) }).catch(()=>{});
    } catch (err: unknown) {
      setIsEnriching(false); setEnrichStep(0);
      ["vb_project_result","vb_project_copy","vb_project_drScenes","vb_project_title"].forEach(k => sessionStorage.removeItem(k));
      const msg = err instanceof Error ? err.message : "Erro inesperado no upload.";
      setError(msg); toast.error(msg);
    } finally { refreshCredits(); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pendingEnrichTrigger && videoFile) { setPendingEnrichTrigger(false); handleEnrich(); }
  }, [pendingEnrichTrigger, videoFile]);

  // ── Computed values ───────────────────────────────────────────────────────
  const scriptScenes = useMemo(() =>
    copy.trim().split(/\n\n+/).filter(p => p.trim().length > 10), [copy]);

  const wordCount = useMemo(() =>
    copy.trim() ? copy.trim().split(/\s+/).length : 0, [copy]);

  const estimatedDurationSec = useMemo(() => Math.round(wordCount / 2.8), [wordCount]);

  const estimatedDurationFmt = useMemo(() => {
    const m = Math.floor(estimatedDurationSec / 60);
    const s = estimatedDurationSec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }, [estimatedDurationSec]);

  const detectedPowerWords = useMemo(() => {
    if (!copy) return [];
    const words = copy.toLowerCase().split(/\s+/);
    const found = new Set<string>();
    words.forEach(w => {
      const clean = w.replace(/[^a-záéíóúãõçêâîôû]/g, "");
      if (POWER_WORDS.has(clean)) found.add(clean);
    });
    return Array.from(found);
  }, [copy]);

  const brollSuggestions = useMemo(() => {
    if (!copy) return [];
    const words = copy.toLowerCase().split(/\s+/);
    const found: Array<{word: string; img: string}> = [];
    const seen = new Set<string>();
    words.forEach(w => {
      const clean = w.replace(/[^a-záéíóúãõçêâîôû]/g, "");
      if (BROLL_IMAGES[clean] && !seen.has(clean)) { seen.add(clean); found.push({word: clean, img: BROLL_IMAGES[clean]}); }
    });
    return found;
  }, [copy]);

  const engagementScore = useMemo(() => {
    if (!copy || wordCount === 0) return 0;
    const powerCount = detectedPowerWords.length;
    const brollCount = brollSuggestions.length;
    const sceneCount = scriptScenes.length;
    return Math.min(100, Math.round(
      (powerCount / Math.max(1, wordCount / 30)) * 40 +
      (brollCount / Math.max(1, sceneCount)) * 35 +
      Math.min(25, sceneCount * 8)
    ));
  }, [copy, wordCount, detectedPowerWords, brollSuggestions, scriptScenes]);

  // ── Status dot ────────────────────────────────────────────────────────────
  const statusInfo = useMemo(() => {
    if (copy.trim() && scriptScenes.length > 0)
      return { color: "#F5A623", shadow: "0 0 6px #F5A623", txt: `${scriptScenes.length} cenas detectadas — clique em Gerar` };
    if (copy.trim())
      return { color: "#F5A623", shadow: "0 0 6px #F5A623", txt: "Cole seu roteiro e clique em Gerar" };
    return { color: "#444", shadow: "none", txt: "Escolha um modo para começar" };
  }, [copy, scriptScenes]);

  // ── Early returns ─────────────────────────────────────────────────────────
  if (isGenerated && result) {
    return <WorkstationView result={result} copy={copy} drScenes={drScenes} initialBgMusicUrl={bgMusicUrl} videoFile={videoFile} whisperWords={whisperWords} initialTtsUrl={pendingTtsUrl} initialAvatarUrl={pendingAvatarUrl} onBack={handleBack} onCreditChange={refreshCredits}/>;
  }

  const D = theme === "dark"
    ? { bg:"#060606", bg2:"#09090B", bg3:"#0F0F0F", bg4:"#141414", bg5:"#1C1C1C", border:"#131313", border2:"#1A1A1A", border3:"#222", text:"#EAEAEA", text2:"#7A7A7A", text3:"#444", text4:"#252525", card:"#09090B", shadow:"rgba(0,0,0,.7)" }
    : { bg:"#F4F4F6", bg2:"#FAFAFA", bg3:"#EFEFEF", bg4:"#E6E6E8", bg5:"#DADADC", border:"#E2E2E4", border2:"#D6D6D8", border3:"#CACACE", text:"#0C0C0C", text2:"#606060", text3:"#999", text4:"#C8C8C8", card:"#FFFFFF", shadow:"rgba(0,0,0,.07)" };

  const hasContent = !!(videoFile || copy.trim());

  const canGenerate = editorMode === "simple" ? copy.trim().length > 0 : hasContent;
  const genLabel = videoFile ? "Enriquecer com IA" : "Gerar Sequência";
  const genHandler = videoFile ? handleEnrich : handleGenerate;
  const genDisabled = videoFile ? isEnriching : (!copy.trim() || isGenerating);

  // ── Compose slot states ───────────────────────────────────────────────────
  const hasRot = copy.trim().length > 0;
  const hasVid = !!videoFile;
  const hasAud = !!homeTtsUrl;

  return (
    <>
      <style>{`
        @keyframes dot-pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes ring-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes ac-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
        @keyframes ld-pulse{0%,100%{box-shadow:0 0 0 0 rgba(232,81,42,.15)}50%{box-shadow:0 0 0 12px rgba(232,81,42,0)}}
        @keyframes wv{0%,100%{height:4px;opacity:.5}50%{height:20px;opacity:1}}
        @keyframes gen-btn-shimmer{0%{left:-100%}100%{left:100%}}

        .v7-root *,.v7-root *::before,.v7-root *::after{box-sizing:border-box;margin:0;padding:0}
        .v7-root{height:100vh;overflow:hidden;display:flex;flex-direction:column;font-family:'Geist',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
        svg.ico{display:block;flex-shrink:0}

        /* scrollbars */
        .v7-root ::-webkit-scrollbar{width:3px;height:3px}
        .v7-root ::-webkit-scrollbar-track{background:transparent}
        .v7-root ::-webkit-scrollbar-thumb{border-radius:2px}

        /* scene items */
        .si{display:flex;gap:0;border-radius:7px;cursor:pointer;transition:all .15s;margin-bottom:2px;border:1px solid transparent;overflow:hidden}
        .si:hover{background:var(--v7-bg3)}
        .si.on{background:var(--v7-bg3);border-color:var(--v7-border2)}

        /* hook cards */
        .hk{border-radius:8px;overflow:hidden;cursor:pointer;position:relative;aspect-ratio:4/5;transition:all .2s;border:1px solid var(--v7-border)}
        .hk:hover{border-color:var(--v7-border2);transform:translateY(-2px);box-shadow:0 6px 18px var(--v7-shadow)}
        .hk.sel{border-color:#3ECF8E;box-shadow:0 0 0 2px rgba(62,207,142,.18)}

        /* model item */
        .mi{display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:6px;cursor:pointer;transition:all .15s;margin-bottom:1px}
        .mi:hover{background:var(--v7-bg3)}
        .mi.on .mi-lbl{color:#E8512A}
        .mi.on .mi-dot{background:#E8512A}

        /* gen button */
        .gen-btn{display:flex;align-items:center;gap:6px;background:#E8512A;color:#fff;border:none;border-radius:7px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;margin-left:auto;white-space:nowrap;position:relative;overflow:hidden}
        .gen-btn::before{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);transition:left .4s}
        .gen-btn:hover::before{left:100%}
        .gen-btn:hover:not(:disabled){background:#FF6B3D;transform:translateY(-1px);box-shadow:0 8px 28px rgba(232,81,42,.3)}
        .gen-btn:disabled{opacity:.4;cursor:not-allowed}

        /* mode toggle */
        .mode-btn{font-size:11px;font-weight:600;padding:5px 14px;border-radius:6px;cursor:pointer;color:var(--v7-text3);transition:all .2s;border:none;background:none;font-family:inherit;white-space:nowrap;display:flex;align-items:center;gap:5px}
        .mode-btn:hover{color:var(--v7-text2)}
        .mode-btn.on{background:var(--v7-bg);color:var(--v7-text);box-shadow:0 1px 3px var(--v7-shadow);border:1px solid var(--v7-border2)}

        /* sub tabs */
        .sub-tab{font-size:11px;font-weight:500;padding:7px 12px;cursor:pointer;color:var(--v7-text3);border-bottom:2px solid transparent;transition:all .15s;margin-bottom:-1px;white-space:nowrap;background:none;border-left:none;border-right:none;border-top:none;font-family:inherit}
        .sub-tab:hover{color:var(--v7-text2)}
        .sub-tab.on{color:var(--v7-text);border-bottom-color:#E8512A}

        /* hooks filter */
        .hf{font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;border:1px solid var(--v7-border);color:var(--v7-text3);cursor:pointer;white-space:nowrap;transition:all .15s;letter-spacing:.04em;text-transform:uppercase;background:none;font-family:inherit}
        .hf:hover{border-color:var(--v7-border2);color:var(--v7-text2)}
        .hf.on{background:#E8512A;border-color:#E8512A;color:#fff}

        /* analise card */
        .ac{background:var(--v7-bg);border:1px solid var(--v7-border);border-radius:11px;padding:11px;margin-bottom:7px;animation:ac-in .35s cubic-bezier(.16,1,.3,1) both}

        /* compose col upload zone */
        .cc-upload{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;cursor:pointer;transition:all .2s;text-align:center}
        .cc-upload:hover{background:rgba(74,158,255,.03)}

        /* upload zone */
        .upload-zone{border:1.5px dashed var(--v7-border2);border-radius:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;cursor:pointer;transition:all .25s;padding:48px 32px;text-align:center;width:100%;max-width:420px}
        .upload-zone:hover{border-color:rgba(232,81,42,.45);background:rgba(232,81,42,.03)}
        .upload-zone.drag{border-color:#E8512A;background:rgba(232,81,42,.07)}

        /* tb chip */
        .tb-chip{display:flex;align-items:center;gap:5px;background:var(--v7-bg3);border:1px solid var(--v7-border);border-radius:6px;padding:4px 9px;font-size:11px;color:var(--v7-text2);cursor:pointer;transition:all .15s;white-space:nowrap;user-select:none;font-family:inherit}
        .tb-chip:hover{border-color:var(--v7-border2)}
        .tb-back{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--v7-text3);cursor:pointer;padding:5px 8px;border-radius:6px;transition:all .15s;border:none;background:none;font-family:inherit;flex-shrink:0}
        .tb-back:hover{background:var(--v7-bg3);color:var(--v7-text2)}
        .tb-theme{width:28px;height:28px;border-radius:6px;background:var(--v7-bg3);border:1px solid var(--v7-border);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;color:var(--v7-text3);flex-shrink:0}
        .tb-theme:hover{border-color:var(--v7-border2);color:var(--v7-text2)}

        /* roteiro textarea */
        .rot-ta{flex:1;width:100%;background:transparent;border:none;outline:none;color:var(--v7-text);font-family:'Geist',system-ui,sans-serif;font-size:14px;font-weight:300;padding:16px 18px;resize:none;line-height:1.8;caret-color:#E8512A}
        .rot-ta::placeholder{color:var(--v7-text4);line-height:1.8;font-weight:300}
        .cc-ta{flex:1;width:100%;background:transparent;border:none;outline:none;color:var(--v7-text);font-family:'Geist',system-ui,sans-serif;font-size:12.5px;font-weight:300;padding:12px 13px;resize:none;line-height:1.75;caret-color:#E8512A}
        .cc-ta::placeholder{color:var(--v7-text4);line-height:1.75}

        /* voz select */
        .voz-sel{width:100%;background:var(--v7-bg3);border:1px solid var(--v7-border);border-radius:7px;padding:9px 30px 9px 11px;color:var(--v7-text);font-family:'Geist',system-ui,sans-serif;font-size:13px;outline:none;cursor:pointer;appearance:none;transition:border-color .2s}
        .voz-sel:focus{border-color:rgba(232,81,42,.3)}
      `}</style>

      {/* CSS custom properties via inline style on root */}
      <div
        className="v7-root"
        style={{
          "--v7-bg":      D.bg,
          "--v7-bg2":     D.bg2,
          "--v7-bg3":     D.bg3,
          "--v7-bg4":     D.bg4,
          "--v7-bg5":     D.bg5,
          "--v7-border":  D.border,
          "--v7-border2": D.border2,
          "--v7-border3": D.border3,
          "--v7-text":    D.text,
          "--v7-text2":   D.text2,
          "--v7-text3":   D.text3,
          "--v7-text4":   D.text4,
          "--v7-shadow":  D.shadow,
          background:     D.bg,
          color:          D.text,
        } as React.CSSProperties}
      >

        {/* ═══════════════ TOPBAR ═══════════════ */}
        <div style={{ height:46, background:D.bg, borderBottom:`1px solid ${D.border}`, display:"flex", alignItems:"center", padding:"0 12px", gap:6, flexShrink:0, zIndex:100 }}>
          <button className="tb-back" onClick={()=>router.push("/dashboard")}>
            <svg className="ico" width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M8 2L3 6.5l5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Voltar
          </button>

          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:7, padding:"0 10px 0 6px", borderRight:`1px solid ${D.border}`, flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{ display:"block", flexShrink:0 }}>
              <rect width="64" height="64" rx="8" style={{ fill: theme==="dark" ? "#111111" : "#E8E8EA" }}/>
              <rect x="12" y="10" width="40" height="11" rx="4" style={{ fill: theme==="dark" ? "#E8E8E8" : "#1A1A1A" }}/>
              <rect x="41" y="10" width="11" height="24" rx="4" style={{ fill: theme==="dark" ? "#E8E8E8" : "#1A1A1A" }}/>
              <rect x="12" y="43" width="40" height="11" rx="4" style={{ fill:"#E8512A" }}/>
              <rect x="12" y="30" width="11" height="24" rx="4" style={{ fill:"#E8512A" }}/>
            </svg>
            <span style={{ fontSize:13, fontWeight:700, color:D.text, letterSpacing:"-.025em" }}>Suarik</span>
          </div>

          <div style={{ width:1, height:14, background:D.border, flexShrink:0 }}/>

          {/* Center title */}
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:12, fontWeight:500, color:D.text2 }}>Estúdio de Script</span>
          </div>

          {/* Right controls */}
          <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
            {/* Format chip */}
            <div className="tb-chip">
              <svg className="ico" width="10" height="10" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1"/></svg>
              <select value={aspect} onChange={e=>setAspect(+e.target.value)}
                style={{ background:"transparent", border:"none", outline:"none", color:D.text2, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                {ASPECTS.map((a,i)=><option key={i} value={i}>{a}</option>)}
              </select>
            </div>
            {/* Niche chip */}
            <div className="tb-chip">
              <svg className="ico" width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1L4 5H1l2.5 2L2.5 10 6 8l3.5 2-1-3L11 5H8L6 1z" fill="currentColor" opacity=".6"/></svg>
              <select value={niche} onChange={e=>setNiche(e.target.value)}
                style={{ background:"transparent", border:"none", outline:"none", color:D.text2, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                {NICHES.map(g=>(<optgroup key={g.group} label={`── ${g.group}`}>{g.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>))}
              </select>
            </div>

            <div style={{ width:1, height:14, background:D.border, flexShrink:0 }}/>

            {/* Credits */}
            <div style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 9px", background:D.bg3, border:`1px solid ${D.border}`, borderRadius:6, flexShrink:0, cursor:"pointer" }}
              onClick={()=>setPaywallOpen(true)}>
              <svg className="ico" width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1L4.5 4.5H1.5l2.5 2L3 10l3-2 3 2-1-3.5 2.5-2H7.5L6 1z" fill="#E8512A" opacity=".85"/></svg>
              <span style={{ fontSize:11, fontWeight:600, color:D.text }}>{userCredits === null ? "···" : userCredits.toLocaleString("pt-BR")}</span>
              <span style={{ fontSize:10, color:D.text3 }}>créditos</span>
            </div>

            {/* Theme toggle */}
            <button className="tb-theme" onClick={toggleTheme}>
              {theme === "dark" ? (
                <svg className="ico" width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1 1M11.8 11.8l1 1M3.2 12.8l1-1M11.8 4.2l1-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg className="ico" width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M12 12.5A6.5 6.5 0 016.5 3a6.5 6.5 0 000 10A6.5 6.5 0 0012 12.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ═══════════════ EDITOR GRID ═══════════════ */}
        <div style={{ display:"grid", gridTemplateColumns:"188px 1fr 268px", flex:1, overflow:"hidden" }}>

          {/* ══ LEFT: Scene list ══ */}
          <div style={{ borderRight:`1px solid ${D.border}`, display:"flex", flexDirection:"column", overflow:"hidden", background:D.bg }}>
            {/* Header */}
            <div style={{ padding:"10px 10px 7px", borderBottom:`1px solid ${D.border}`, flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2 }}>
                <span style={{ fontSize:9, fontWeight:700, letterSpacing:".12em", textTransform:"uppercase", color:D.text4 }}>Estrutura</span>
                <span style={{ fontSize:9, color:D.text3, fontVariantNumeric:"tabular-nums" }}>
                  {scriptScenes.length > 0 ? `${scriptScenes.length} cena${scriptScenes.length>1?"s":""}` : "–"}
                </span>
              </div>
            </div>

            {/* Scene list */}
            <div style={{ flex:1, overflowY:"auto", padding:"4px 6px", minHeight:0 }}>
              {scriptScenes.length === 0 ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:90, gap:7, opacity:.3, padding:12, pointerEvents:"none" }}>
                  <svg className="ico" width="20" height="20" viewBox="0 0 22 22" fill="none">
                    <rect x="2" y="4" width="18" height="14" rx="2" stroke={D.text3} strokeWidth="1.1"/>
                    <path d="M2 8h18" stroke={D.text3} strokeWidth="1"/>
                    <path d="M7 12h5M7 15h3" stroke={D.text3} strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize:10, color:D.text3, textAlign:"center", lineHeight:1.5 }}>Cole um roteiro<br/>para ver as cenas</span>
                </div>
              ) : scriptScenes.slice(0,10).map((s, i) => {
                const em = EMOTS[i % EMOTS.length];
                const durS = Math.max(3, Math.round(s.trim().split(/\s+/).length / 2.2));
                return (
                  <div key={i} className={`si${selectedScene===i?" on":""}`} onClick={()=>setSelectedScene(i)}>
                    <div style={{ width:3, flexShrink:0, borderRadius:"2px 0 0 2px", background:em.hex }}/>
                    <div style={{ flex:1, padding:"7px 8px", minWidth:0 }}>
                      <div style={{ fontSize:8, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:em.hex, marginBottom:3 }}>{em.name}</div>
                      <div style={{ fontSize:"10.5px", color:D.text3, lineHeight:1.4, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
                        {s.trim().substring(0, 80)}{s.length>80?"…":""}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:5 }}>
                        <span style={{ fontSize:9, color:D.text4, fontVariantNumeric:"tabular-nums" }}>{durS}s</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Models */}
            <div style={{ borderTop:`1px solid ${D.border}`, padding:"7px 8px", flexShrink:0 }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:".12em", textTransform:"uppercase", color:D.text4, marginBottom:6, padding:"0 1px" }}>Modelos</div>
              {TEMPLATES.map((t, i) => (
                <div key={t.label} className={`mi${i===0?" on":""}`}>
                  <div style={{ width:5, height:5, borderRadius:"50%", flexShrink:0, background: i===0 ? "#E8512A" : D.text4 }}/>
                  <span className="mi-lbl" style={{ fontSize:11, color:D.text3, transition:"color .15s" }}>{t.icon} {t.label}</span>
                </div>
              ))}
            </div>

            {/* Foot credits */}
            <div style={{ borderTop:`1px solid ${D.border}`, padding:"7px 9px", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:D.text3 }}>
                <svg className="ico" width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1L4.5 4.5H1.5l2.5 2L3 10l3-2 3 2-1-3.5 2.5-2H7.5L6 1z" fill="#E8512A" opacity=".8"/></svg>
                <strong style={{ color:D.text2, fontWeight:600 }}>{userCredits?.toLocaleString("pt-BR") ?? "···"}</strong>&nbsp;créditos
              </div>
            </div>
          </div>

          {/* ══ CENTER ══ */}
          <div style={{ display:"flex", flexDirection:"column", overflow:"hidden", background:D.bg }}>
            {/* Center header: status + mode toggle */}
            <div style={{ padding:"8px 14px", borderBottom:`1px solid ${D.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:statusInfo.color, boxShadow:statusInfo.shadow, flexShrink:0, transition:"background .3s,box-shadow .3s" }}/>
                <span style={{ fontSize:10, color:D.text3, transition:"color .2s" }}>{statusInfo.txt}</span>
              </div>
              {/* Mode toggle */}
              <div style={{ display:"flex", gap:1, background:D.bg4, padding:2, borderRadius:8, border:`1px solid ${D.border2}` }}>
                <button className={`mode-btn${editorMode==="simple"?" on":""}`} onClick={()=>setEditorMode("simple")}>
                  <svg className="ico" width="11" height="11" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.1"/><path d="M3 4.5h7M3 6.5h5M3 8.5h6" stroke="currentColor" strokeWidth=".9" strokeLinecap="round"/></svg>
                  Só Roteiro
                </button>
                <button className={`mode-btn${editorMode==="compose"?" on":""}`} onClick={()=>setEditorMode("compose")}>
                  <svg className="ico" width="11" height="11" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.1"/><path d="M1 5h11M5 1v11" stroke="currentColor" strokeWidth=".9"/></svg>
                  Compor Projeto
                </button>
              </div>
            </div>

            {/* ── MODO SIMPLES ── */}
            {editorMode === "simple" && (
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                {/* Grid lines bg */}
                <div style={{ position:"relative", flex:1, display:"flex", flexDirection:"column" }}>
                  <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0, backgroundImage:`linear-gradient(${D.border} 1px,transparent 1px)`, backgroundSize:"100% 28.8px", backgroundPosition:"0 16px", opacity:.25 }}/>
                  <textarea
                    className="rot-ta"
                    style={{ position:"relative", zIndex:1 }}
                    value={copy}
                    onChange={e=>setCopy(e.target.value)}
                    disabled={isGenerating}
                    placeholder={"Cole sua VSL, roteiro ou copy aqui…\n\nDica: parágrafos separados por linha em branco viram cenas automaticamente. Cada parágrafo com mais de 8 palavras vira uma cena com emoção mapeada."}
                  />
                </div>

                {/* Foot */}
                <div style={{ padding:"8px 14px", borderTop:`1px solid ${D.border}`, display:"flex", alignItems:"center", gap:8, flexShrink:0, background:D.bg, zIndex:3 }}>
                  <span style={{ fontSize:11, color:D.text4, fontVariantNumeric:"tabular-nums" }}>{copy.length} / 10.000</span>
                  {scriptScenes.length > 0 && (
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <div style={{ width:5, height:5, borderRadius:"50%", background:"#3ECF8E", boxShadow:"0 0 6px #3ECF8E", flexShrink:0, animation:"dot-pulse 2s ease-in-out infinite" }}/>
                      <span style={{ fontSize:11, color:D.text2 }}>{scriptScenes.length} cena{scriptScenes.length>1?"s":""} detectada{scriptScenes.length>1?"s":""}</span>
                    </div>
                  )}
                  {error && <span style={{ fontSize:11, color:"#E24B4A", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>⚠ {error}</span>}
                  <button className="gen-btn" disabled={genDisabled} onClick={genHandler}>
                    <svg className="ico" width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1L5.5 4.5H2l2.5 2-1 3.5L7 7.5l3.5 2.5-1-3.5 2.5-2H8.5L7 1z" fill="currentColor" opacity=".9"/></svg>
                    {isGenerating ? "Gerando…" : genLabel}
                  </button>
                </div>
              </div>
            )}

            {/* ── MODO COMPOSIÇÃO: 3 colunas ── */}
            {editorMode === "compose" && (
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", overflow:"hidden", borderTop:`1px solid ${D.border}` }}>

                  {/* Col 1: Roteiro */}
                  <div style={{ display:"flex", flexDirection:"column", borderRight:`1px solid ${D.border}`, overflow:"hidden", background: hasRot ? "rgba(232,81,42,.015)" : D.bg }}>
                    <div style={{ padding:"11px 13px 9px", borderBottom:`1px solid ${D.border}`, flexShrink:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                        <div style={{ width:18, height:18, borderRadius:"50%", background: hasRot ? "#E8512A" : D.bg4, border:`1px solid ${hasRot?"#E8512A":D.border2}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color: hasRot?"#fff":D.text4, flexShrink:0, transition:"all .2s" }}>
                          {hasRot ? "✓" : "1"}
                        </div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:D.text, letterSpacing:"-.01em" }}>Roteiro</div>
                          <div style={{ fontSize:10, color:D.text3 }}>copy, VSL ou descrição</div>
                        </div>
                        {hasRot && <span style={{ marginLeft:"auto", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"rgba(62,207,142,.07)", color:"#3ECF8E", textTransform:"uppercase", letterSpacing:".05em" }}>Pronto</span>}
                      </div>
                    </div>
                    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                      <textarea
                        className="cc-ta"
                        value={copy}
                        onChange={e=>setCopy(e.target.value)}
                        placeholder={"Cole seu roteiro aqui…\n\nParágrafos separados por linha em branco viram cenas."}
                        style={{ flex:1 }}
                      />
                      <div style={{ padding:"7px 12px", borderTop:`1px solid ${D.border}`, display:"flex", alignItems:"center", gap:6, flexShrink:0, fontSize:10, color:D.text4 }}>
                        <span>{copy.length} / 10k</span>
                        {hasRot && <span style={{ color:"#3ECF8E" }}>{scriptScenes.length} cenas</span>}
                      </div>
                    </div>
                  </div>

                  {/* Col 2: Vídeo A-roll */}
                  <div style={{ display:"flex", flexDirection:"column", borderRight:`1px solid ${D.border}`, overflow:"hidden", background: hasVid ? "rgba(74,158,255,.015)" : D.bg }}>
                    <div style={{ padding:"11px 13px 9px", borderBottom:`1px solid ${D.border}`, flexShrink:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:18, height:18, borderRadius:"50%", background: hasVid ? "#4A9EFF" : D.bg4, border:`1px solid ${hasVid?"#4A9EFF":D.border2}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color: hasVid?"#fff":D.text4, flexShrink:0, transition:"all .2s" }}>
                          {hasVid ? "✓" : "2"}
                        </div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:D.text, letterSpacing:"-.01em" }}>Vídeo A-roll</div>
                          <div style={{ fontSize:10, color:D.text3 }}>MP4 · MOV · até 500MB</div>
                        </div>
                        {hasVid && <span style={{ marginLeft:"auto", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"rgba(62,207,142,.07)", color:"#3ECF8E", textTransform:"uppercase", letterSpacing:".05em" }}>Pronto</span>}
                      </div>
                    </div>
                    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                      {!videoFile ? (
                        <div
                          className={`cc-upload${isDragOver?" drag":""}`}
                          onDragOver={e=>{e.preventDefault();setIsDragOver(true);}}
                          onDragLeave={()=>setIsDragOver(false)}
                          onDrop={e=>{e.preventDefault();setIsDragOver(false);const f=e.dataTransfer.files[0];if(f&&f.type.startsWith("video/"))setVideoFile(f);}}
                          onClick={()=>{const i=document.createElement("input");i.type="file";i.accept="video/*,.mp4,.mov,.mkv,.webm";i.onchange=(ev)=>{const f=(ev.target as HTMLInputElement).files?.[0];if(f)setVideoFile(f);};i.click();}}
                          style={{ flex:1, justifyContent:"center", gap:10 }}
                        >
                          {/* Mini player mock */}
                          <div style={{ width:"100%", maxWidth:160, aspectRatio:"16/9", borderRadius:7, background:D.bg4, border:`1px solid ${D.border2}`, position:"relative", overflow:"hidden", flexShrink:0 }}>
                            <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,#0A1020,#060810)" }}/>
                            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(74,158,255,.15)", border:"1px solid rgba(74,158,255,.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                                <svg className="ico" width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M4 2l7 4-7 4V2z" fill="#4A9EFF" opacity=".8"/></svg>
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign:"center" }}>
                            <div style={{ fontSize:12, fontWeight:600, color:D.text2 }}>Arraste o MP4 aqui</div>
                            <div style={{ fontSize:10, color:D.text3, marginTop:4, lineHeight:1.5 }}>A IA extrai o roteiro<br/>automaticamente do vídeo</div>
                          </div>
                          <div style={{ fontSize:9, color:D.text4, padding:"4px 10px", background:D.bg3, borderRadius:20, border:`1px solid ${D.border}` }}>ou clique para selecionar</div>
                        </div>
                      ) : (
                        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, padding:16 }}>
                          <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(74,158,255,.1)", border:"1px solid rgba(74,158,255,.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <svg className="ico" width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="1" y="3" width="14" height="16" rx="2" stroke="#4A9EFF" strokeWidth="1.2"/><path d="M15 8l5-3v12l-5-3V8z" stroke="#4A9EFF" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                          </div>
                          <div style={{ fontSize:12, fontWeight:600, color:D.text, textAlign:"center", wordBreak:"break-all" }}>{videoFile.name}</div>
                          <div style={{ fontSize:10, color:D.text3, textAlign:"center" }}>{(videoFile.size/1024/1024).toFixed(1)} MB</div>
                          {/* Language selector */}
                          <div style={{ display:"flex", gap:3 }}>
                            {(["auto","pt","en","es"] as const).map(lang=>(
                              <button key={lang} onClick={()=>setVideoLang(lang)}
                                style={{ padding:"2px 7px", borderRadius:5, fontSize:9, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"all .15s", background: videoLang===lang?"rgba(232,81,42,.12)":"transparent", border:`1px solid ${videoLang===lang?"rgba(232,81,42,.4)":D.border}`, color: videoLang===lang?"#E8512A":D.text3 }}>
                                {lang==="auto"?"Auto":lang.toUpperCase()}
                              </button>
                            ))}
                          </div>
                          <button onClick={()=>setVideoFile(null)}
                            style={{ fontSize:10, color:D.text4, padding:"3px 8px", borderRadius:5, border:`1px solid ${D.border}`, background:"none", fontFamily:"inherit", cursor:"pointer", transition:"all .15s" }}>
                            Remover
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Col 3: Voz/Áudio */}
                  <div style={{ display:"flex", flexDirection:"column", overflow:"hidden", background: hasAud ? "rgba(62,207,142,.015)" : D.bg }}>
                    <div style={{ padding:"11px 13px 9px", borderBottom:`1px solid ${D.border}`, flexShrink:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:18, height:18, borderRadius:"50%", background: hasAud ? "#3ECF8E" : D.bg4, border:`1px solid ${hasAud?"#3ECF8E":D.border2}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color: hasAud?"#fff":D.text4, flexShrink:0, transition:"all .2s" }}>
                          {hasAud ? "✓" : "3"}
                        </div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:D.text, letterSpacing:"-.01em" }}>Voz / Áudio</div>
                          <div style={{ fontSize:10, color:D.text3 }}>TTS gerado ou upload</div>
                        </div>
                        {hasAud && <span style={{ marginLeft:"auto", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"rgba(62,207,142,.07)", color:"#3ECF8E", textTransform:"uppercase", letterSpacing:".05em" }}>Pronto</span>}
                      </div>
                    </div>
                    {/* Sub-mode tabs */}
                    <div style={{ display:"flex", gap:1, padding:"8px 10px", borderBottom:`1px solid ${D.border}`, flexShrink:0 }}>
                      {(["tts","upload"] as const).map(m=>(
                        <button key={m} onClick={()=>setAudMode(m)}
                          style={{ flex:1, padding:"4px 8px", borderRadius:6, fontSize:10, fontWeight:500, cursor:"pointer", fontFamily:"inherit", transition:"all .15s", background: audMode===m ? D.bg : "none", color: audMode===m ? D.text : D.text3, border: audMode===m ? `1px solid ${D.border2}` : "1px solid transparent", boxShadow: audMode===m ? `0 1px 2px ${D.shadow}` : "none" }}>
                          {m==="tts"?"Gerar TTS":"Upload"}
                        </button>
                      ))}
                    </div>
                    {/* TTS panel */}
                    {audMode === "tts" && !hasAud && (
                      <div style={{ flex:1, padding:10, display:"flex", flexDirection:"column", gap:8, overflowY:"auto" }}>
                        <div style={{ position:"relative" }}>
                          <select className="voz-sel" value={homeTtsVoice} onChange={e=>setHomeTtsVoice(e.target.value)} style={{ fontSize:11 }}>
                            {TTS_VOICES.map(v=><option key={v.id} value={v.id}>{v.lang} — {v.label} {v.gender==="M"?"♂":"♀"}</option>)}
                          </select>
                          <svg className="ico" style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", color:D.text4 }} width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        </div>
                        {/* Waveform preview */}
                        <div style={{ background:D.bg3, border:`1px solid ${D.border}`, borderRadius:7, padding:10, display:"flex", flexDirection:"column", gap:7 }}>
                          <div style={{ fontSize:9, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:D.text4 }}>Preview de saída</div>
                          <div style={{ display:"flex", alignItems:"center", gap:2, height:24 }}>
                            {[0,.1,.2,.05,.15,.25,.08,.18,.3,.12,.22,.35].map((d,i)=>(
                              <div key={i} style={{ width:2, background:"#3ECF8E", borderRadius:1, animation:`wv 1.2s ease-in-out infinite`, animationDelay:`${d}s`, height:4 }}/>
                            ))}
                            <span style={{ fontSize:9, color:D.text4, marginLeft:5 }}>~{estimatedDurationFmt} estimado</span>
                          </div>
                        </div>
                        {homeTtsError && <div style={{ fontSize:10, color:"#E24B4A" }}>{homeTtsError}</div>}
                        <button
                          onClick={handleHomeTts}
                          disabled={homeTtsLoading||!copy.trim()}
                          style={{ width:"100%", padding:"8px", background:D.bg3, border:`1px solid ${D.border}`, borderRadius:7, fontSize:11, fontWeight:600, color:D.text2, cursor:"pointer", fontFamily:"inherit", transition:"all .2s", display:"flex", alignItems:"center", justifyContent:"center", gap:5, opacity: (homeTtsLoading||!copy.trim())?0.5:1 }}>
                          {homeTtsLoading ? (
                            <><span style={{ width:11, height:11, borderRadius:"50%", border:"1.5px solid rgba(255,255,255,.2)", borderTopColor:D.text, animation:"ring-spin .7s linear infinite", flexShrink:0, display:"block" }}/>Gerando...</>
                          ) : (
                            <><svg className="ico" width="11" height="11" viewBox="0 0 13 13" fill="none"><rect x="3.5" y="1" width="6" height="8" rx="3" stroke="currentColor" strokeWidth="1.1"/><path d="M1.5 7c0 2.5 2 4.5 5 4.5s5-2 5-4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>Gerar voz com TTS</>
                          )}
                        </button>
                      </div>
                    )}
                    {/* TTS filled */}
                    {audMode === "tts" && hasAud && (
                      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, padding:16 }}>
                        <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(62,207,142,.1)", border:"1px solid rgba(62,207,142,.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <svg className="ico" width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="5" y="2" width="12" height="14" rx="6" stroke="#3ECF8E" strokeWidth="1.3"/><path d="M3 11c0 4.4 3.6 8 8 8s8-3.6 8-8" stroke="#3ECF8E" strokeWidth="1.3" strokeLinecap="round"/></svg>
                        </div>
                        <div style={{ fontSize:12, fontWeight:600, color:D.text, textAlign:"center" }}>Voz gerada</div>
                        <audio controls src={homeTtsUrl!} style={{ width:"100%", height:28, opacity:.85 }}/>
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={handleHomeTts} style={{ fontSize:10, color:D.text3, padding:"3px 8px", borderRadius:5, border:`1px solid ${D.border}`, background:"none", fontFamily:"inherit", cursor:"pointer" }}>Regerar</button>
                          <button onClick={()=>setHomeTtsUrl(null)} style={{ fontSize:10, color:D.text4, padding:"3px 8px", borderRadius:5, border:`1px solid ${D.border}`, background:"none", fontFamily:"inherit", cursor:"pointer" }}>Remover</button>
                        </div>
                      </div>
                    )}
                    {/* Upload panel */}
                    {audMode === "upload" && (
                      <div className="cc-upload" style={{ flex:1 }}>
                        <div style={{ width:44, height:44, borderRadius:"50%", background:D.bg4, border:`1.5px dashed ${D.border2}`, display:"flex", alignItems:"center", justifyContent:"center", color:D.text3 }}>
                          <svg className="ico" width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 14V4M6 8l4-4 4 4M2 18h16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <div style={{ fontSize:12, fontWeight:600, color:D.text2 }}>Upload de áudio</div>
                        <div style={{ fontSize:10, color:D.text3 }}>MP3 · WAV · M4A</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Compose footer */}
                <div style={{ padding:"10px 14px", borderTop:`1px solid ${D.border}`, display:"flex", alignItems:"center", gap:10, background:D.bg, flexShrink:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5, flex:1, flexWrap:"nowrap", overflow:"hidden" }}>
                    {[
                      { key:"rot", label:"Roteiro", done:hasRot },
                      { key:"vid", label:"Vídeo",   done:hasVid },
                      { key:"aud", label:"Voz",     done:hasAud },
                    ].map((item, i) => (
                      <span key={item.key} style={{ display:"flex" }}>
                        {i > 0 && <span style={{ fontSize:11, color:D.text4, marginRight:5 }}>+</span>}
                        <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, fontWeight:600, padding:"3px 9px", borderRadius:20, border:`1px solid ${item.done?"#3ECF8E":D.border}`, color:item.done?"#3ECF8E":D.text4, background:item.done?"rgba(62,207,142,.07)":"transparent", transition:"all .25s", whiteSpace:"nowrap" }}>
                          {item.label}
                        </span>
                      </span>
                    ))}
                  </div>
                  <button className="gen-btn" disabled={genDisabled || (!hasRot && !hasVid && !hasAud)} onClick={genHandler}>
                    <svg className="ico" width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1L5.5 4.5H2l2.5 2-1 3.5L7 7.5l3.5 2.5-1-3.5 2.5-2H8.5L7 1z" fill="currentColor" opacity=".9"/></svg>
                    {!hasRot && !hasVid && !hasAud ? "Adicione um elemento" :
                      hasVid ? "Enriquecer com IA" :
                      "Gerar Sequência"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ══ RIGHT: Hooks + Análise ══ */}
          <div style={{ display:"flex", flexDirection:"column", overflow:"hidden", background:D.bg2, borderLeft:`1px solid ${D.border}` }}>
            {/* Right header */}
            <div style={{ padding:"9px 12px", borderBottom:`1px solid ${D.border}`, display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
              <svg className="ico" width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M6.5 1L5 4.5H2l2.5 2-1 3.5L6.5 8l3.5 2-1-3.5 2.5-2H8L6.5 1z" fill="#E8512A" opacity=".85"/></svg>
              <span style={{ fontSize:12, fontWeight:600, color:D.text }}>
                {rightSubTab==="hooks" ? "Hooks Virais" : "Análise IA"}
              </span>
            </div>

            {/* Sub tabs */}
            <div style={{ display:"flex", borderBottom:`1px solid ${D.border}`, flexShrink:0 }}>
              <button className={`sub-tab${rightSubTab==="hooks"?" on":""}`} onClick={()=>setRightSubTab("hooks")}>Hooks</button>
              <button className={`sub-tab${rightSubTab==="analise"?" on":""}`} onClick={()=>setRightSubTab("analise")}>Análise IA</button>
            </div>

            {/* ── Hooks panel ── */}
            {rightSubTab === "hooks" && (
              <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>
                <HomeRightPanel
                  activeTag={activeTag}
                  setActiveTag={setActiveTag}
                  onRaioX={handleHomeRaioX}
                />
              </div>
            )}

            {/* ── Análise IA panel ── */}
            {rightSubTab === "analise" && (
              <div style={{ flex:1, overflowY:"auto", padding:9 }}>
                {!copy ? (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:9, opacity:.35, textAlign:"center", padding:20 }}>
                    <svg className="ico" width="24" height="24" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="10" stroke={D.text3} strokeWidth="1.2" strokeDasharray="3 2"/><path d="M8 13h10M13 8v10" stroke={D.text3} strokeWidth="1.2" strokeLinecap="round"/></svg>
                    <span style={{ fontSize:11, color:D.text3, lineHeight:1.6 }}>Cole o roteiro e clique em<br/><strong style={{ color:D.text2 }}>Gerar Sequência</strong></span>
                  </div>
                ) : (
                  <>
                    {/* Engagement score */}
                    <div className="ac">
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
                        <span style={{ fontSize:8, fontWeight:700, padding:"2px 7px", borderRadius:8, letterSpacing:".07em", textTransform:"uppercase", background:"rgba(232,81,42,.1)", color:"#E8512A" }}>Retenção</span>
                        <span style={{ fontSize:11, fontWeight:600, color:D.text, flex:1 }}>Score de Engajamento</span>
                        <span style={{ fontSize:9, color:D.text4, fontVariantNumeric:"tabular-nums" }}>{estimatedDurationFmt}</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
                        <span style={{ fontSize:24, fontWeight:900, color:"#E8512A", lineHeight:1 }}>{engagementScore}</span>
                        <span style={{ fontSize:10, color:D.text3 }}>/ 100</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ fontSize:8, fontWeight:700, color:D.text4, letterSpacing:".1em", textTransform:"uppercase", minWidth:32 }}>Match</span>
                        <div style={{ flex:1, height:2, background:D.bg5, borderRadius:1, overflow:"hidden" }}>
                          <div style={{ height:"100%", borderRadius:1, background:"#E8512A", width:`${engagementScore}%`, transition:"width .5s cubic-bezier(.16,1,.3,1)" }}/>
                        </div>
                        <span style={{ fontSize:9, fontWeight:700, color:"#E8512A", minWidth:26, textAlign:"right" }}>{engagementScore}%</span>
                      </div>
                    </div>

                    {/* Power words */}
                    {detectedPowerWords.length > 0 && (
                      <div className="ac">
                        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
                          <span style={{ fontSize:8, fontWeight:700, padding:"2px 7px", borderRadius:8, letterSpacing:".07em", textTransform:"uppercase", background:"rgba(245,166,35,.08)", color:"#F5A623" }}>Power</span>
                          <span style={{ fontSize:11, fontWeight:600, color:D.text }}>Palavras de Poder</span>
                        </div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                          {detectedPowerWords.slice(0,8).map(w=>(
                            <span key={w} style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:6, background:"rgba(245,166,35,.07)", border:"1px solid rgba(245,166,35,.2)", color:"#F5A623" }}>{w}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* B-rolls */}
                    {brollSuggestions.length > 0 && (
                      <div className="ac">
                        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
                          <span style={{ fontSize:8, fontWeight:700, padding:"2px 7px", borderRadius:8, letterSpacing:".07em", textTransform:"uppercase", background:"rgba(74,158,255,.07)", color:"#4A9EFF" }}>B-roll</span>
                          <span style={{ fontSize:11, fontWeight:600, color:D.text }}>Sugestões</span>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          {brollSuggestions.slice(0,4).map(({word, img})=>(
                            <div key={word} style={{ display:"flex", alignItems:"center", gap:7 }}>
                              <div style={{ width:42, height:28, borderRadius:4, border:`1px solid ${D.border}`, overflow:"hidden", flexShrink:0 }}>
                                <img src={img} alt={word} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                              </div>
                              <span style={{ fontSize:"10.5px", color:D.text2 }}>{word}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scene breakdown */}
                    {scriptScenes.slice(0,4).map((s, i) => {
                      const em = EMOTS[i % EMOTS.length];
                      const dur = Math.max(3, Math.round(s.trim().split(/\s+/).length / 2.2));
                      return (
                        <div key={i} className="ac" style={{ animationDelay:`${i*0.07}s` }}>
                          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
                            <span style={{ fontSize:8, fontWeight:700, padding:"2px 7px", borderRadius:8, letterSpacing:".07em", textTransform:"uppercase", background:`${em.hex}16`, color:em.hex }}>{em.name}</span>
                            <span style={{ fontSize:11, fontWeight:600, color:D.text, flex:1, letterSpacing:"-.01em", lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {s.trim().substring(0,40)}{s.length>40?"…":""}
                            </span>
                            <span style={{ fontSize:9, color:D.text4, fontVariantNumeric:"tabular-nums", flexShrink:0 }}>{dur}s</span>
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                            <div style={{ display:"grid", gridTemplateColumns:"38px 1fr", gap:4 }}>
                              <span style={{ fontSize:8, fontWeight:700, color:D.text4, letterSpacing:".1em", textTransform:"uppercase", paddingTop:2 }}>Texto</span>
                              <span style={{ fontSize:"10.5px", color:D.text2, lineHeight:1.45 }}>{s.trim().substring(0,60)}{s.length>60?"…":""}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════ ENRICHING OVERLAY ═══════════════ */}
        {isEnriching && (
          <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(4,4,4,.93)", backdropFilter:"blur(16px)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
            <div style={{ position:"relative", width:80, height:80, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:6 }}>
              <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:"1.5px solid transparent", borderTopColor:"#E8512A", animation:"ring-spin 1.1s linear infinite" }}/>
              <div style={{ position:"absolute", inset:5, borderRadius:"50%", border:"1px solid transparent", borderBottomColor:"rgba(232,81,42,.3)", animation:"ring-spin 1.8s linear infinite reverse" }}/>
              <div style={{ width:64, height:64, borderRadius:14, background:D.bg3, border:`1px solid ${D.border2}`, display:"flex", alignItems:"center", justifyContent:"center", animation:"ld-pulse 2s ease-in-out infinite" }}>
                <Film size={28} style={{ color:"#E8512A" }}/>
              </div>
            </div>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:".14em", textTransform:"uppercase", color:"#E8512A", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ flex:1, maxWidth:32, height:1, background:"rgba(232,81,42,.2)" }}/>
              Enriquecendo com IA
              <div style={{ flex:1, maxWidth:32, height:1, background:"rgba(232,81,42,.2)" }}/>
            </div>
            <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:11, overflow:"hidden", width:"100%", maxWidth:360 }}>
              {ENRICH_STEPS.map((msg, i) => {
                const done = i < enrichStep, active = i === enrichStep;
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:9, padding:"10px 13px", borderBottom: i<ENRICH_STEPS.length-1?`1px solid ${D.border}`:"none", background: active?"rgba(232,81,42,.04)":done?"rgba(62,207,142,.03)":"transparent", transition:"background .3s", opacity: i>enrichStep?0.4:1 }}>
                    <div style={{ width:16, height:16, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background: done?"rgba(62,207,142,.14)":active?"rgba(232,81,42,.16)":D.bg4, color: done?"#3ECF8E":active?"#E8512A":D.text4 }}>
                      {done ? <svg className="ico" width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                        : active ? <svg className="ico" width="8" height="8" viewBox="0 0 10 10" fill="none" style={{ animation:"ring-spin 1s linear infinite", transformOrigin:"center" }}><circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.1" strokeDasharray="3 2.5"/></svg>
                        : <svg className="ico" width="6" height="6" viewBox="0 0 6 6"><circle cx="3" cy="3" r="2" fill="currentColor"/></svg>}
                    </div>
                    <span style={{ fontSize:11, color: active?D.text:done?D.text3:D.text4 }}>{msg}</span>
                    {i===1 && active && uploadProgress>0 && (
                      <span style={{ fontSize:9, color:uploadProgress>=100?"#3ECF8E":"#E8512A", marginLeft:"auto", fontVariantNumeric:"tabular-nums" }}>{uploadProgress}%</span>
                    )}
                  </div>
                );
              })}
            </div>
            {videoFile && (
              <div style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 12px", background:"rgba(255,255,255,.03)", border:`1px solid ${D.border}`, borderRadius:8 }}>
                <Film size={13} style={{ color:D.text3, flexShrink:0 }}/>
                <span style={{ fontSize:11, color:D.text2, maxWidth:240, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{videoFile.name}</span>
                <span style={{ fontSize:10, color:D.text3, flexShrink:0 }}>{(videoFile.size/1024/1024).toFixed(1)} MB</span>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ GENERATING OVERLAY ═══════════════ */}
        {isGenerating && (
          <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(4,4,4,.93)", backdropFilter:"blur(16px)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
            <GeneratingView/>
          </div>
        )}

      </div>

      {/* Modals */}
      {isUploadModalOpen && <UploadModal onClose={()=>setUploadOpen(false)} onFile={(f)=>{ setVideoFile(f); setEditorMode("compose"); }}/>}
      {paywallOpen && <UpsellModal onClose={()=>setPaywallOpen(false)}/>}
      <WinningAdsDrawer
        open={winningAdsOpen}
        onClose={()=>setWinningAdsOpen(false)}
        onRaioX={(ad) => {
          setCopy(ad.hookText);
          setEditorMode("simple");
          setWinningAdsOpen(false);
          setSelectedAd(null);
          toast.success("Hook copiado para o roteiro ✓");
        }}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
