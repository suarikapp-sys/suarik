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
import { PaywallModal } from "./components/PaywallModal";
import { WinningAdsDrawer } from "./components/WinningAdsDrawer";
import {
  NICHES, TEMPLATES, ASPECTS, BROLL_IMAGES, POWER_WORDS, LOADING_MSGS,
} from "./constants";

export default function SuarikHome() {
  const router = useRouter();
  const { toasts, remove: removeToast, toast } = useToast();

  // ── User profile (loaded async from Supabase) ─────────────────────────────
  const [userInitials,  setUserInitials]  = useState("·");
  const [userDisplay,   setUserDisplay]   = useState("...");
  const [userPlan,      setUserPlan]      = useState("Free");
  const [userCredits,   setUserCredits]   = useState<number|null>(null);

  // ── Refresh credit balance from server after any paid action ─────────────
  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      if (res.ok) {
        const d = await res.json() as { credits?: number };
        if (typeof d.credits === "number") setUserCredits(d.credits);
      }
    } catch { /* non-critical — stale display is better than crashing */ }
  }, []);

  // ── Pending cross-tool payloads (read once at mount, before auth resolves) ──
  const [pendingTtsUrl,    setPendingTtsUrl]    = useState<string|null>(null);
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string|null>(null);

  const [copy,             setCopy]          = useState("");
  const [niche,            setNiche]         = useState("dr_nutra_pain");
  const [aspect,           setAspect]        = useState(0);
  const [isCopyOpen,       setCopyOpen]      = useState(false);
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
  const [inputTab,         setInputTab]      = useState<"roteiro"|"video"|"tts">("roteiro");
  const [videoFile,        setVideoFile]     = useState<File|null>(null);
  // TTS home state
  const [homeTtsVoice,     setHomeTtsVoice]  = useState("English_expressive_narrator");
  const [homeTtsLoading,   setHomeTtsLoading]= useState(false);
  const [homeTtsUrl,       setHomeTtsUrl]    = useState<string|null>(null);
  const [homeTtsError,     setHomeTtsError]  = useState<string|null>(null);
  const [isDragOver,       setIsDragOver]    = useState(false);
  const [isEnriching,           setIsEnriching]           = useState(false);
  const [enrichStep,            setEnrichStep]            = useState(0); // 0-3
  const [videoLang,             setVideoLang]             = useState<"auto"|"pt"|"en"|"es">("auto");
  const [pendingEnrichTrigger,  setPendingEnrichTrigger]  = useState(false);

  // ── Load user data from Supabase on mount ─────────────────────────────────
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
      setUserCredits(prof?.credits ?? 0); // always set — never stays null

      // ── Open upload modal flag (legacy — just switch to video tab) ──────
      const openUploadFlag = sessionStorage.getItem("vb_open_upload_modal");
      if (openUploadFlag) {
        sessionStorage.removeItem("vb_open_upload_modal");
        setInputTab("video");
      }

      // ── Enricher pending file (from /enricher page) ───────────────────────
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
            // Clear file from IDB
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
            setInputTab("video");
            setPendingEnrichTrigger(true);
          }
        } catch { /* silent */ }
      }

      // ── Restore last workstation session ONLY when explicitly requested ──────
      // (from /projects "Abrir no Editor", /timeline redirect, or other tools)
      // Do NOT auto-restore just because savedResult exists — user may want fresh start.
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
        } catch { /* ignore corrupt session data */ }
      }

      // ── Pending audio from Audio Studio / Voice Clone ──────────────────────
      const pendingAudioRaw = sessionStorage.getItem("vb_pending_audio");
      if (pendingAudioRaw) {
        sessionStorage.removeItem("vb_pending_audio");
        try {
          const pa = JSON.parse(pendingAudioRaw) as { url: string; label?: string };
          if (pa?.url) {
            setHomeTtsUrl(pa.url);
            setPendingTtsUrl(pa.url); // also pass to WorkstationView if session is restored
          }
        } catch { /* ignore */ }
      }

      // ── Pending video from DreamAct / LipSync / DreamFace ─────────────────
      const pendingVideoUrl = sessionStorage.getItem("vb_pending_video");
      const legacyAvatarUrl = sessionStorage.getItem("vb_pending_avatar_url");
      const avatarUrl = pendingVideoUrl ?? legacyAvatarUrl;
      if (pendingVideoUrl) sessionStorage.removeItem("vb_pending_video");
      if (legacyAvatarUrl) sessionStorage.removeItem("vb_pending_avatar_url");
      if (avatarUrl) {
        setPendingAvatarUrl(avatarUrl);
        setInputTab("video");
        // If no saved session, create a minimal one so WorkstationView opens
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      // ── Single API call: generate-timeline is the source of truth ────────
      // /api/generate (legacy) removed — it was making a redundant LLM call
      // for the same copy. generate-timeline returns DRS scenes + B-roll + music.
      // Promise.all with a 3s timer guarantees the loading animation plays fully.
      const [drs] = await Promise.all([
        fetch("/api/generate-timeline", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({copy}),
        }).then(async res=>{
          if(!res.ok){
            return { scenes: analyzeCopyForDirectResponse(copy), backgroundMusicUrl: undefined, backgroundTracks: undefined };
          }
          const d = await res.json();
          if(d?.scenes && Array.isArray(d.scenes) && d.scenes.length>0)
            return {
              scenes:             d.scenes as DirectResponseScene[],
              backgroundMusicUrl: d.backgroundMusicUrl as string|undefined,
              backgroundTracks:   d.backgroundTracks   as BackgroundTrack[]|undefined,
            };
          if(Array.isArray(d) && d.length>0)
            return { scenes: d as DirectResponseScene[], backgroundMusicUrl: undefined, backgroundTracks: undefined };
          return { scenes: analyzeCopyForDirectResponse(copy), backgroundMusicUrl: undefined, backgroundTracks: undefined };
        }),
        new Promise<void>(r=>setTimeout(r,3000)), // minimum 3s loading screen
      ]);

      // Build a minimal GenerateResponse from DRS data (WorkstationView needs it)
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
        body: JSON.stringify({
          tool:  "storyboard",
          title: copy.trim().slice(0, 80) || "Storyboard sem título",
          meta:  { scenes: drs.scenes.length, niche, aspect },
        }),
      }).catch(() => {});
    } catch(e:unknown){
      setError(e instanceof Error?e.message:"Erro ao gerar.");
      toast.error(e instanceof Error?e.message:"Erro ao gerar storyboard.");
    } finally{
      setIsGenerating(false);
      refreshCredits();
    }
  };

  const handleBack = () => { setIsGenerated(false); setResult(null); setIsEnriching(false); setEnrichStep(0); };

  // ── Enrichment flow — upload REAL + Whisper REAL + mock B-rolls ───────────
  const ENRICH_STEPS = [
    "🔗 Solicitando passe de segurança...",
    "☁️ Enviando vídeo para a nuvem...",
    "🎧 Extraindo áudio + transcrevendo com Whisper IA...",
    "🎬 GPT-4o analisando cenas + buscando B-rolls HD...",
  ];
  const [r2PublicUrl, setR2PublicUrl] = useState<string|null>(null);
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [whisperWords, setWhisperWords] = useState<WhisperWord[]>([]);

  const handleEnrich = async () => {
    if (!videoFile || isEnriching) return;
    setIsEnriching(true);
    setEnrichStep(0); // "🔗 Solicitando passe de segurança..."
    setError("");

    try {
      // ── 1. Probe video duration ──────────────────────────────────────────
      const videoDuration = await new Promise<number>((resolve) => {
        const probe = document.createElement("video");
        const probeUrl = URL.createObjectURL(videoFile);
        probe.preload = "metadata";
        probe.src = probeUrl;
        probe.onloadedmetadata = () => {
          const dur = isFinite(probe.duration) && probe.duration > 0
            ? probe.duration : 60;
          URL.revokeObjectURL(probeUrl);
          resolve(dur);
        };
        probe.onerror = () => {
          URL.revokeObjectURL(probeUrl);
          resolve(60); // fallback
        };
      });

      // ── 2 & 3. Upload DIRETO ao R2 (presigned URL, sem proxy) ────────────
      setEnrichStep(1); // "☁️ Enviando vídeo para a nuvem..."
      setUploadProgress(0);

      // Get presigned URL from our backend
      const presignRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: videoFile.name,
          contentType: videoFile.type || "video/mp4",
        }),
      });
      if (!presignRes.ok) {
        const errBody = await presignRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Falha ao solicitar URL de upload (${presignRes.status})`);
      }
      const { uploadUrl, publicUrl } = await presignRes.json();

      // Upload direto ao R2 via presigned URL (CORS configurado no bucket)
      // Sem proxy — sem limite de tamanho do servidor, qualquer formato de vídeo
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl); // direto ao R2
        xhr.setRequestHeader("Content-Type", videoFile.type || "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) { setUploadProgress(100); resolve(); }
          else reject(new Error(`Upload falhou (HTTP ${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Erro de rede no upload. Tente novamente."));
        xhr.send(videoFile);
      });

      // ── Upload concluído! Salva a URL pública do R2 ──────────────────────
      setR2PublicUrl(publicUrl);

      // ── 4. Extract audio + Whisper Transcription ──────────────────────
      setEnrichStep(2); // "🎧 Transcrevendo áudio com Whisper IA..."
      setUploadProgress(0);

      let whisperText = "";
      let whisperWords: { word: string; start: number; end: number }[] = [];

      try {
        // Strategy: extract audio as WAV in browser (instant via Web Audio API)
        // then upload the small WAV to R2, and send R2 URL to Whisper.
        // WAV at 16kHz mono = ~2MB/min — tiny compared to 70MB+ video files.

        const wavBlob = await extractAudioAsWav(videoFile);

        // Upload WAV to R2 (small file, fast)
        const wavPresignRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: videoFile.name.replace(/\.[^.]+$/, ".wav"),
            contentType: "audio/wav",
          }),
        });

        let audioPublicUrl: string | null = null;

        if (wavPresignRes.ok) {
          const { uploadUrl: wavUploadUrl, publicUrl: wavPublicUrl } = await wavPresignRes.json();
          // Upload WAV direto ao R2 (CORS configurado no bucket)
          const wavUpRes = await fetch(wavUploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "audio/wav" },
            body: wavBlob,
          });
          if (wavUpRes.ok || wavUpRes.status === 200) {
            audioPublicUrl = wavPublicUrl;
          } else {
          }
        }

        // Send to Whisper via R2 URL (server downloads small WAV)
        if (audioPublicUrl) {
          const txRes = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicUrl: audioPublicUrl, language: videoLang === "auto" ? undefined : videoLang }),
          });
          if (txRes.ok) {
            const txData = await txRes.json();
            whisperText  = txData.text  || "";
            whisperWords = txData.words || [];
            setWhisperWords(whisperWords);
          } else {
            const errData = await txRes.json().catch(() => ({}));
          }
        }
      } catch (audioErr) {
        // Fallback: try sending original video R2 URL (works for small videos)
        try {
          const txRes = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicUrl }),
          });
          if (txRes.ok) {
            const txData = await txRes.json();
            whisperText  = txData.text  || "";
            whisperWords = txData.words || [];
            setWhisperWords(whisperWords);
          }
        } catch { /* silent */ }
      }

      // ── 5. GPT-4o + Pexels + Freesound — B-rolls REAIS ──────────────────
      setEnrichStep(3); // "🎬 GPT-4o analisando cenas + buscando B-rolls HD..."

      let finalDrs: DirectResponseScene[];
      let backgroundMusicUrl: string | undefined;
      let enrichBgTracks: BackgroundTrack[] = [];

      if (whisperText) {
        // ── Transcrição disponível → GPT-4o analisa + Pexels busca B-rolls ──
        try {
          const enrichRes = await fetch("/api/enrich-scenes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: whisperText,
              words: whisperWords,
              videoDuration,
            }),
          });
          if (enrichRes.ok) {
            const enrichData = await enrichRes.json();
            finalDrs = enrichData.scenes || [];
            backgroundMusicUrl = enrichData.backgroundMusicUrl;
            if (enrichData.backgroundTracks?.length) enrichBgTracks = enrichData.backgroundTracks;
          } else {
            finalDrs = whisperWords.length > 0
              ? buildDrsFromWhisper(whisperWords, videoDuration)
              : analyzeCopyForDirectResponse(whisperText);
          }
        } catch (enrichErr) {
          finalDrs = whisperWords.length > 0
            ? buildDrsFromWhisper(whisperWords, videoDuration)
            : analyzeCopyForDirectResponse(whisperText);
        }
      } else {
        // ── Sem transcrição — use whisper-based fallback or show warning ──
        finalDrs = buildDrsFromWhisper([], videoDuration); // empty = no real subtitles
        // Show the user a warning that transcription failed
        setError("⚠️ Não foi possível transcrever o áudio do vídeo. As legendas podem não corresponder ao conteúdo real. Tente novamente ou use um vídeo menor.");
      }

      const finalResult: GenerateResponse = {
        project_vibe: "ugc_alto_impacto",
        music_style:  "Suspense Emocional",
        scenes: [],
        background_tracks: enrichBgTracks.length ? enrichBgTracks : [
          ...(backgroundMusicUrl ? [{ url: backgroundMusicUrl, title: "Trilha Principal (IA)", is_premium_vault: true }] : []),
          { url: "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3", title: "Epic Orchestral Cinematic", is_premium_vault: true },
          { url: "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3", title: "Dark Tension Loop", is_premium_vault: true },
        ].slice(0, 3),
      };
      sessionStorage.setItem("vb_project_result", JSON.stringify(finalResult));
      sessionStorage.setItem("vb_project_copy", videoFile?.name ?? "Vídeo enriquecido");
      sessionStorage.setItem("vb_project_drScenes", JSON.stringify(finalDrs));
      setResult(finalResult);
      setDrScenes(finalDrs);
      if(homeTtsUrl) setPendingTtsUrl(homeTtsUrl);
      if (backgroundMusicUrl) setBgMusicUrl(backgroundMusicUrl);
      setIsEnriching(false);
      setEnrichStep(0);
      setIsGenerated(true);
      toast.success("Vídeo enriquecido com IA! 🎬");
      trackEvent("video_enriched", { scenes: finalDrs.length });
      fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "storyboard",
          title: videoFile?.name ?? "Vídeo enriquecido",
          meta: { enriched: true },
        }),
      }).catch(() => {});

    } catch (err: unknown) {
      setIsEnriching(false);
      setEnrichStep(0);
      // Limpa dados parciais do sessionStorage para evitar "projeto fantasma"
      ["vb_project_result","vb_project_copy","vb_project_drScenes","vb_project_title"].forEach(k => sessionStorage.removeItem(k));
      const msg = err instanceof Error ? err.message : "Erro inesperado no upload.";
      setError(msg);
      toast.error(msg);
    } finally {
      refreshCredits();
    }
  };

  // ── Auto-trigger enrichment when file arrives from /enricher page ──────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pendingEnrichTrigger && videoFile) {
      setPendingEnrichTrigger(false);
      handleEnrich();
    }
  }, [pendingEnrichTrigger, videoFile]);

  // ─── Script Analysis (computed from copy) — must be before any early return ──
  const scriptScenes = useMemo(() =>
    copy.trim().split(/\n\n+/).filter(p => p.trim().length > 10),
    [copy]
  );

  const wordCount = useMemo(() =>
    copy.trim() ? copy.trim().split(/\s+/).length : 0,
    [copy]
  );

  const estimatedDurationSec = useMemo(() =>
    Math.round(wordCount / 2.8),
    [wordCount]
  );

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
      if (BROLL_IMAGES[clean] && !seen.has(clean)) {
        seen.add(clean);
        found.push({word: clean, img: BROLL_IMAGES[clean]});
      }
    });
    return found;
  }, [copy]);

  const engagementScore = useMemo(() => {
    if (!copy || wordCount === 0) return 0;
    const powerCount = detectedPowerWords.length;
    const brollCount = brollSuggestions.length;
    const sceneCount = scriptScenes.length;
    const score = Math.min(100, Math.round(
      (powerCount / Math.max(1, wordCount / 30)) * 40 +
      (brollCount / Math.max(1, sceneCount)) * 35 +
      Math.min(25, sceneCount * 8)
    ));
    return score;
  }, [copy, wordCount, detectedPowerWords, brollSuggestions, scriptScenes]);

  // Full-screen workstation mode
  if (isGenerated && result) {
    return <WorkstationView result={result} copy={copy} drScenes={drScenes} initialBgMusicUrl={bgMusicUrl} videoFile={videoFile} whisperWords={whisperWords} initialTtsUrl={pendingTtsUrl} initialAvatarUrl={pendingAvatarUrl} onBack={handleBack} onCreditChange={refreshCredits}/>;
  }

  // Has content ready to process?
  const hasContent = !!(videoFile || copy.trim());

  return (
    <>
    <style>{`
      @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @keyframes grainShift{0%{transform:translate(0,0)}10%{transform:translate(-2%,-2%)}20%{transform:translate(1%,1%)}30%{transform:translate(-1%,2%)}40%{transform:translate(2%,-1%)}50%{transform:translate(-2%,1%)}60%{transform:translate(1%,-2%)}70%{transform:translate(-1%,-1%)}80%{transform:translate(2%,2%)}90%{transform:translate(-2%,0%)}100%{transform:translate(0,0)}}
      @keyframes glowPulse{0%,100%{box-shadow:0 0 20px rgba(240,86,58,0.25),0 4px 15px rgba(240,86,58,0.3)}50%{box-shadow:0 0 35px rgba(240,86,58,0.45),0 4px 25px rgba(240,86,58,0.4),0 0 80px rgba(240,86,58,0.12)}}
      @keyframes heroIn{from{opacity:0;transform:translateY(20px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes videoScroll{0%{transform:translateY(0)}100%{transform:translateY(-33.333%)}}
      .hook-card{transition:all 0.25s cubic-bezier(0.4,0,0.2,1)}
      .hook-card:hover{border-color:rgba(240,86,58,0.4)!important;transform:translateY(-2px)}
    `}</style>

    {/* ═══ SIDEBAR FIXA ═══ */}
    <aside className="fixed top-0 left-0 h-screen w-64 flex flex-col z-50" style={{background:"#09090b",borderRight:"1px solid rgba(255,255,255,0.06)"}}>
      {/* ── Logo ── */}
      <button onClick={()=>router.push("/dashboard")} className="flex items-center gap-2.5 px-5 pt-6 pb-4 hover:opacity-80 transition-opacity w-full" style={{background:"transparent",border:"none",cursor:"pointer"}}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm" style={{background:"#F0563A",boxShadow:"0 0 20px rgba(240,86,58,0.35)"}}>S</div>
        <span className="text-xl text-white" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2.5px"}}>SUARIK</span>
      </button>

      {/* ── Workspace Selector ── */}
      <button className="mx-4 mb-5 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/[0.04]"
        style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">Workstation</p>
          <p className="text-[13px] text-zinc-300 font-medium truncate">Meu Estúdio</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-600 shrink-0"/>
      </button>

      {/* ── Navigation ── */}
      <nav className="flex flex-col gap-1 px-3">
        <button onClick={()=>handleBack()} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all"
          style={{background:"rgba(240,86,58,0.1)",border:"1px solid rgba(240,86,58,0.15)"}}>
          <Plus className="w-4 h-4" style={{color:"#F0563A"}}/>
          Novo Criativo
        </button>
        <button onClick={()=>handleBack()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all">
          <BookOpen className="w-4 h-4"/>
          Biblioteca de Hooks
        </button>
        <button onClick={()=>router.push("/settings")}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all">
          <Settings className="w-4 h-4"/>
          Configurações
        </button>
      </nav>

      {/* ── Spacer ── */}
      <div className="flex-1"/>

      {/* ── User & Credits Footer ── */}
      <div className="mx-3 mb-4 px-3 py-3 rounded-xl" style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.05)"}}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{background:"linear-gradient(135deg,#F0563A,#FF7A5C)"}}>
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-zinc-300 truncate">{userDisplay}</p>
            <p className="text-[10px] text-zinc-600 font-medium">Plano {userPlan}</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{background:"rgba(255,255,255,0.03)"}}>
          <span className="text-[10px]">{userCredits === null ? "⏳" : userCredits > 0 ? "🟢" : "🔴"}</span>
          <span className="text-[11px] font-semibold text-zinc-400">
            {userCredits === null ? "Carregando..." : `${userCredits.toLocaleString("pt-BR")} Créditos`}
          </span>
        </div>
      </div>
    </aside>

    {/* ═══ MAIN CANVAS (offset by sidebar) ═══ */}
    <div className="min-h-screen relative overflow-y-auto ml-64" style={{background:"#09090b",color:"#F5F3F0",fontFamily:"'DM Sans',sans-serif"}}>
      {/* Grain overlay */}
      <div className="fixed inset-0 pointer-events-none z-[9990] opacity-30" style={{backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,animation:"grainShift 0.5s steps(4) infinite"}}/>

      {/* ═══ MAIN CONTENT ═══ */}
      {isEnriching ? (
        /* ── Enriching Full-Screen ── */
        <div className="flex flex-col items-center justify-center gap-8 px-8 min-h-[80vh]" style={{animation:"heroIn 0.5s ease both"}}>
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full animate-spin" style={{border:"3px solid transparent",borderTopColor:"#F0563A",borderRightColor:"rgba(240,86,58,0.3)"}}/>
            <div className="absolute inset-2 rounded-full animate-spin" style={{border:"2px solid transparent",borderTopColor:"#FF7A5C",animationDirection:"reverse",animationDuration:"1.4s"}}/>
            <div className="absolute inset-0 flex items-center justify-center">
              <Film className="w-8 h-8" style={{color:"#F0563A"}}/>
            </div>
          </div>
          <div className="w-full max-w-sm space-y-2.5">
            {ENRICH_STEPS.map((msg, i) => {
              const done = i < enrichStep, active = i === enrichStep, pending = i > enrichStep;
              return (
                <div key={i} className="flex flex-col gap-0 px-4 py-3 rounded-xl transition-all duration-500"
                  style={{
                    background: active?"rgba(240,86,58,0.08)":done?"rgba(52,211,153,0.05)":"rgba(255,255,255,0.02)",
                    border:`1px solid ${active?"rgba(240,86,58,0.35)":done?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.04)"}`,
                    opacity: pending?0.3:1,
                  }}>
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                      {done ? <Check className="w-4 h-4 text-emerald-400"/>
                        : active ? <div className="w-4 h-4 rounded-full border-2 border-orange-400/20 border-t-orange-400 animate-spin"/>
                        : <div className="w-2 h-2 rounded-full bg-white/8"/>}
                    </div>
                    <span className={`text-[13px] font-medium ${active?"text-orange-300":done?"text-emerald-400":"text-zinc-600"}`}>{msg}</span>
                  </div>
                  {i===1 && active && uploadProgress>0 && (
                    <>
                      <div className="w-full mt-2.5 h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
                        <div className="h-full rounded-full transition-all duration-300" style={{width:`${uploadProgress}%`,background:uploadProgress>=100?"linear-gradient(90deg,#22c55e,#10b981)":"linear-gradient(90deg,#FF7A5C,#F0563A)"}}/>
                      </div>
                      <span className="text-[10px] font-mono mt-1" style={{color:uploadProgress>=100?"#22c55e":"#FF7A5C"}}>{uploadProgress>=100?"✓ Upload concluído":`${uploadProgress}%`}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {videoFile && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
              <Film className="w-3.5 h-3.5 text-zinc-500 shrink-0"/>
              <span className="text-[11px] text-zinc-400 truncate max-w-[240px]">{videoFile.name}</span>
              <span className="text-[10px] text-zinc-500 shrink-0">{(videoFile.size/1024/1024).toFixed(1)} MB</span>
            </div>
          )}
          <p className="text-[12px] text-zinc-600">A IA está enriquecendo seu vídeo com B-rolls, legendas e SFX sincronizados…</p>
        </div>
      ) : isGenerating ? (
        <div className="min-h-[80vh] flex items-center justify-center"><GeneratingView/></div>
      ) : (
        /* ═══ OBSIDIAN SCRIPT EDITOR ═══ */
        <div className="flex flex-col h-screen overflow-hidden" style={{background:"#0d0d0f"}}>
          {/* ── Top header ── */}
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b" style={{borderColor:"rgba(255,255,255,0.05)",background:"rgba(9,9,11,0.95)"}}>
            <div className="flex items-center gap-3">
              <button onClick={()=>router.back()} className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-200 transition-colors flex items-center gap-1">
                ← Voltar
              </button>
              <div className="w-px h-4 bg-white/8"/>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                <FileCode2 className="w-3.5 h-3.5"/>
                Estúdio de Script
              </div>
              <div className="w-px h-4 bg-white/5"/>
              {/* Tab nav */}
              <div className="flex gap-0.5">
                {[
                  {tab:"roteiro", label:"Roteiro"},
                  {tab:"video", label:"Enviar Vídeo"},
                  {tab:"tts", label:"🎙 Voz"},
                ].map(({tab, label}) => (
                  <button key={tab} onClick={()=>setInputTab(tab as "roteiro"|"video"|"tts")}
                    className="px-3 py-1 text-[11px] font-semibold rounded-md transition-all"
                    style={{background:inputTab===tab?"rgba(240,86,58,0.15)":"transparent",color:inputTab===tab?"#FF7A5C":"rgba(255,255,255,0.5)",borderBottom:inputTab===tab?"2px solid #F0563A":"none"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Right: word count + options */}
            <div className="flex items-center gap-4">
              {copy && <span className="text-[10px] text-zinc-600">{wordCount} palavras · ~{estimatedDurationFmt}</span>}
              <select value={aspect} onChange={e=>setAspect(+e.target.value)} disabled={isGenerating}
                className="text-[10px] text-zinc-400 px-2 py-1 rounded appearance-none cursor-pointer focus:outline-none"
                style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
                {ASPECTS.map((a,i)=><option key={i} value={i}>{a}</option>)}
              </select>
              <select value={niche} onChange={e=>setNiche(e.target.value)} disabled={isGenerating}
                className="text-[10px] text-zinc-400 px-2 py-1 rounded appearance-none cursor-pointer focus:outline-none"
                style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
                {NICHES.map(g=>(<optgroup key={g.group} label={`── ${g.group}`}>{g.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>))}
              </select>
            </div>
          </div>

          {/* ── Body: 3 columns ── */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Scene outline + templates */}
            <div className="w-48 shrink-0 flex flex-col border-r" style={{borderColor:"rgba(255,255,255,0.05)",background:"rgba(9,9,11,0.6)"}}>
              <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">Estrutura</div>
              <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                {scriptScenes.map((s, i) => (
                  <button key={i}
                    className="w-full text-left px-2 py-2 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all truncate border border-transparent hover:border-zinc-700">
                    <span className="text-[9px] font-mono text-zinc-700 mr-1.5">{String(i+1).padStart(2,"0")}</span>
                    {s.slice(0,40)}{s.length>40?"…":""}
                  </button>
                ))}
                {scriptScenes.length === 0 && <div className="text-[10px] text-zinc-700 p-2">Cole um roteiro para ver cenas</div>}
              </div>
              {/* Templates */}
              <div className="px-3 py-2 border-t" style={{borderColor:"rgba(255,255,255,0.05)"}}>
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Modelos</div>
                <div className="space-y-1">
                  {TEMPLATES.map(t => (
                    <button key={t.label} onClick={()=>setCopy(t.copy)}
                      className="w-full text-left px-2 py-1.5 rounded-md text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all flex items-center gap-1.5 truncate">
                      <span className="shrink-0">{t.icon}</span><span className="truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Center: Script editor (tabs) */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {inputTab === "roteiro" && (
                <div className="flex-1 relative overflow-hidden flex flex-col">
                  <textarea
                    value={copy}
                    onChange={e=>setCopy(e.target.value)}
                    disabled={isGenerating}
                    placeholder="Cole sua VSL, roteiro ou copy aqui…&#10;&#10;Dica: escreva em parágrafos para criar cenas automaticamente."
                    className="flex-1 resize-none focus:outline-none text-sm text-zinc-300 placeholder-zinc-700 px-10 py-8 leading-relaxed disabled:opacity-40"
                    style={{
                      background:"transparent",
                      fontFamily:"'JetBrains Mono','Fira Code','Courier New',monospace",
                      fontSize:"13px",
                      lineHeight:"1.8",
                      caretColor:"#F0563A",
                    }}
                  />
                  {/* Detected keywords strip */}
                  {copy && detectedPowerWords.length > 0 && (
                    <div className="shrink-0 px-6 py-2 border-t flex flex-wrap gap-1.5 overflow-x-auto" style={{borderColor:"rgba(255,255,255,0.05)"}}>
                      {detectedPowerWords.slice(0,8).map(kw => (
                        <span key={kw} className="px-2 py-0.5 rounded-full text-[9px] font-bold text-orange-400 border border-orange-400/20 bg-orange-400/5 shrink-0">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {inputTab === "video" && (
                <div className="flex-1 flex items-center justify-center">
                  <div
                    onDragOver={e=>{e.preventDefault();setIsDragOver(true);}}
                    onDragLeave={()=>setIsDragOver(false)}
                    onDrop={e=>{e.preventDefault();setIsDragOver(false);const f=e.dataTransfer.files[0];if(f&&f.type.startsWith("video/"))setVideoFile(f);}}
                    onClick={()=>{const i=document.createElement("input");i.type="file";i.accept="video/*,.mp4,.mov,.mkv,.webm";i.onchange=(ev)=>{const f=(ev.target as HTMLInputElement).files?.[0];if(f)setVideoFile(f);};i.click();}}
                    className="flex flex-col items-center justify-center gap-4 rounded-2xl cursor-pointer transition-all"
                    style={{
                      width:"min(500px, 100% - 40px)",
                      padding: videoFile ? "2rem 2rem" : "3.5rem 2rem",
                      border:`2px dashed ${isDragOver?"#F0563A":videoFile?"rgba(52,211,153,0.5)":"rgba(255,255,255,0.12)"}`,
                      background:isDragOver?"rgba(240,86,58,0.08)":videoFile?"rgba(52,211,153,0.05)":"rgba(9,9,11,0.4)",
                      backdropFilter:"blur(12px)",
                      boxShadow:isDragOver?"0 0 60px rgba(240,86,58,0.15)":"0 4px 16px rgba(0,0,0,0.2)",
                    }}>
                    {videoFile ? (
                      <>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.25)"}}>
                          <Check className="w-7 h-7 text-emerald-400"/>
                        </div>
                        <div className="text-center">
                          <p className="text-base font-black text-emerald-400 truncate max-w-[300px]">{videoFile.name}</p>
                          <p className="text-[11px] text-zinc-400 mt-1">{(videoFile.size/1024/1024).toFixed(1)} MB · pronto para enriquecer</p>
                        </div>
                        {/* Language selector */}
                        <div onClick={e=>e.stopPropagation()} className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500">Idioma do vídeo:</span>
                          {(["auto","pt","en","es"] as const).map(lang => (
                            <button key={lang} onClick={()=>setVideoLang(lang)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                              style={{
                                background: videoLang===lang ? "rgba(240,86,58,0.15)" : "rgba(255,255,255,0.04)",
                                border: `1px solid ${videoLang===lang ? "rgba(240,86,58,0.4)" : "rgba(255,255,255,0.08)"}`,
                                color: videoLang===lang ? "#FF7A5C" : "#71717a",
                              }}>
                              {lang === "auto" ? "Auto" : lang.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <button onClick={e=>{e.stopPropagation();setVideoFile(null);}} className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 mt-1">
                          <X className="w-3.5 h-3.5"/>Remover arquivo
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all" style={{background:isDragOver?"rgba(240,86,58,0.15)":"rgba(255,255,255,0.04)",border:isDragOver?"1px solid rgba(240,86,58,0.4)":"1px solid rgba(255,255,255,0.08)"}}>
                          <CloudUpload className={`w-8 h-8 transition-colors ${isDragOver?"text-orange-400":"text-zinc-500"}`}/>
                        </div>
                        <div className="text-center">
                          <p className="text-base font-bold text-zinc-200">Sobe um MP4 do seu A-roll</p>
                          <p className="text-[12px] text-zinc-600 mt-1.5">.mp4 · .mov · até 500MB</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {inputTab === "tts" && (
                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="max-w-sm rounded-2xl p-4" style={{background:"rgba(167,139,250,0.05)",border:"1px solid rgba(167,139,250,0.15)"}}>
                    <p className="text-[11px] font-black uppercase tracking-widest mb-3" style={{color:"#a78bfa"}}>🎙 Gerar Voz Sintética</p>
                    {!copy.trim() && (
                      <p className="text-[11px] text-zinc-500 mb-3">Cole seu roteiro acima para gerar a voz.</p>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-[10px] text-zinc-500 shrink-0">Voz:</label>
                      <select value={homeTtsVoice} onChange={e=>setHomeTtsVoice(e.target.value)}
                        className="flex-1 text-[11px] text-zinc-300 px-2.5 py-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none"
                        style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
                        {TTS_VOICES.map(v => (
                          <option key={v.id} value={v.id}>{v.lang} — {v.label} {v.gender === "M" ? "♂" : "♀"}</option>
                        ))}
                      </select>
                    </div>
                    {homeTtsError && <p className="text-[10px] text-red-400 mb-2">{homeTtsError}</p>}
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={handleHomeTts}
                        disabled={homeTtsLoading||!copy.trim()}
                        className="flex-1 py-2.5 rounded-xl text-[12px] font-black transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                        style={{background:"rgba(167,139,250,0.15)",border:"1px solid rgba(167,139,250,0.3)",color:"#a78bfa"}}>
                        {homeTtsLoading
                          ? <><span className="w-3.5 h-3.5 rounded-full border border-violet-400 border-t-transparent animate-spin"/>Gerando...</>
                          : homeTtsUrl ? "🔄 Regerar Voz" : "🎙 Gerar Voz Agora"}
                      </button>
                      {homeTtsUrl && !homeTtsLoading && (
                        <a href={homeTtsUrl} download="voz_sintetica.mp3"
                          className="px-3 py-2.5 rounded-xl text-[11px] font-bold text-zinc-400 hover:text-white transition-all flex items-center gap-1.5"
                          style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
                          <Download className="w-3.5 h-3.5"/>MP3
                        </a>
                      )}
                    </div>
                    {homeTtsUrl && !homeTtsLoading && (
                      <div className="px-3 py-2 rounded-lg flex items-center gap-2"
                        style={{background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.12)"}}>
                        <span className="text-[10px] text-violet-400 font-bold">✓ Voz gerada</span>
                        <audio controls src={homeTtsUrl} className="flex-1 h-6" style={{opacity:0.7}}/>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: AI Analysis Panel */}
            <div className="w-56 shrink-0 flex flex-col border-l" style={{borderColor:"rgba(255,255,255,0.05)",background:"rgba(9,9,11,0.6)"}}>
              <div className="px-4 py-3 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                  <Brain className="w-3 h-3"/>Análise IA
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
                {copy ? (
                  <>
                    {/* Engagement score */}
                    <div>
                      <div className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Retenção</div>
                      <div className="flex items-end gap-2 mb-1.5">
                        <span className="text-2xl font-black" style={{color:"#F0563A"}}>{engagementScore}</span>
                        <span className="text-[10px] text-zinc-600 mb-0.5">/ 100</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
                        <div className="h-full rounded-full transition-all duration-500" style={{width:`${engagementScore}%`,background:"linear-gradient(90deg,#F0563A,#FF7A5C)"}}/>
                      </div>
                    </div>

                    {/* Power words detected */}
                    {detectedPowerWords.length > 0 && (
                      <div>
                        <div className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Palavras de Poder</div>
                        <div className="flex flex-wrap gap-1">
                          {detectedPowerWords.slice(0,6).map(w=>(
                            <span key={w} className="px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-400 bg-amber-400/8 border border-amber-400/15">{w}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested B-rolls */}
                    {brollSuggestions.length > 0 && (
                      <div>
                        <div className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">B-Rolls</div>
                        <div className="space-y-1.5">
                          {brollSuggestions.slice(0,3).map(({word, img})=>(
                            <div key={word} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)"}}>
                              <img src={img} className="w-8 h-8 rounded object-cover shrink-0" alt={word}/>
                              <span className="text-[10px] text-zinc-400 truncate">{word}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Estimated duration */}
                    <div>
                      <div className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Duração</div>
                      <div className="text-lg font-black text-zinc-300">{estimatedDurationFmt}</div>
                      <div className="text-[9px] text-zinc-600">{wordCount} palavras</div>
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] text-zinc-700 text-center py-8">Cole seu roteiro para ver análises</div>
                )}
              </div>
            </div>

            {/* Right: Hooks Virais Gallery */}
            <HomeRightPanel
              activeTag={activeTag}
              setActiveTag={setActiveTag}
              onRaioX={handleHomeRaioX}
            />
          </div>

          {/* ── Bottom generate bar ── */}
          <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t" style={{borderColor:"rgba(255,255,255,0.05)"}}>
            <div className="flex items-center gap-3">
              {error && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-red-400 flex items-center gap-1 max-w-[240px] truncate"><X className="w-3.5 h-3.5 shrink-0"/>{error}</span>
                  <button
                    onClick={() => { setError(null); videoFile ? handleEnrich() : handleGenerate(); }}
                    className="text-[10px] font-bold text-orange-400 hover:text-orange-300 underline underline-offset-2 shrink-0">
                    Tentar novamente
                  </button>
                </div>
              )}
              {!error && <span className="text-[10px] text-zinc-600">{hasContent ? "Pronto para gerar" : "Cole um roteiro ou envie um vídeo"}</span>}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={videoFile ? handleEnrich : handleGenerate}
                disabled={videoFile ? isEnriching : (!copy.trim() || isGenerating)}
                className="px-8 py-2.5 rounded-xl text-[13px] font-black text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 flex items-center gap-2"
                style={{
                  background: hasContent ? "#F0563A" : "rgba(255,255,255,0.06)",
                  animation: hasContent ? "glowPulse 3s ease-in-out infinite" : "none",
                }}>
                <Sparkles className="w-4 h-4"/>
                {videoFile
                  ? (isEnriching
                      ? <span className="flex items-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"/>Processando…</span>
                      : "Enriquecer com IA"
                    )
                  : (isGenerating
                      ? <span className="flex items-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"/>Gerando…</span>
                      : "Gerar Sequência"
                    )
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {isUploadModalOpen && <UploadModal onClose={()=>setUploadOpen(false)} onFile={(f)=>{ setVideoFile(f); setInputTab("video"); }}/>}
    {paywallOpen       && <PaywallModal onClose={()=>setPaywallOpen(false)}/>}
    <WinningAdsDrawer
      open={winningAdsOpen}
      onClose={()=>setWinningAdsOpen(false)}
      onRaioX={(ad) => {
        setCopy(ad.hookText);
        setInputTab("roteiro");
        setWinningAdsOpen(false);
        setSelectedAd(null);
        toast.success("Hook copiado para o roteiro ✓");
      }}
    />
    <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
