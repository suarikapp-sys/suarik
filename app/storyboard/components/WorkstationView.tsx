"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Search, HelpCircle, Coins, LogIn,
  FileText, Mic, Sparkles, ChevronDown,
  Lock, X, Zap, Check, Brain, Film,
  Music2, Download, FileCode2, Play, Pause,
  Home, BookOpen, Wand2, CloudUpload, Upload,
  SkipBack, SkipForward, Volume2, VolumeX, RefreshCw,
  ArrowLeft, ChevronUp, GripVertical, Flame,
  Eye, EyeOff, TrendingUp, Settings,
} from "lucide-react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { trackEvent } from "@/components/PostHogProvider";
import { TTS_VOICES } from "@/app/lib/ttsVoices";
import type {
  VideoOption, BackgroundTrack, Scene, DirectResponseScene,
  GenerateResponse, TimelineClip, SubtitleWord, SFXMarker, WhisperWord, WinningAd,
} from "../types";
import {
  buildSFXMarkers, getSceneThumb, fmtTime, buildTimelineClips,
  buildSubtitleWords, lookupConcept, classifyIntent,
  analyzeCopyForDirectResponse, buildTimelineClipsFromDRS,
  buildSubtitleWordsFromDRS, generateSRT,
} from "../utils";
import {
  CLIP_COLS, GALLERY_CARDS, BROLL_IMAGES, POWER_WORDS,
} from "../constants";
import { UpsellModal } from "@/components/UpsellModal";
import { WinningAdsDrawer } from "./WinningAdsDrawer";

// B-roll pool used by buildDrsFromWhisper for initial video placeholders
const MOCK_BROLL_POOL = [
  "https://assets.mixkit.co/videos/18296/18296-360.mp4",
  "https://assets.mixkit.co/videos/24354/24354-360.mp4",
  "https://assets.mixkit.co/videos/47583/47583-360.mp4",
  "https://assets.mixkit.co/videos/33376/33376-360.mp4",
  "https://assets.mixkit.co/videos/25575/25575-360.mp4",
  "https://assets.mixkit.co/videos/5601/5601-360.mp4",
];
// ─── buildDrsFromWhisper ──────────────────────────────────────────────────────
// Converte palavras reais do Whisper (com timestamps) em cenas DRS.
// Agrupa palavras em frases de ~5s cada, atribui emoções e B-rolls cíclicos.
export function buildDrsFromWhisper(
  words: { word: string; start: number; end: number }[],
  totalDur: number,
): DirectResponseScene[] {
  if (!words.length) return [];
  const EMOTIONS = ["Dor","Revelação","Oportunidade","Urgência","Choque","CTA","Esperança","Mistério"];
  const TARGET_DUR = 5; // ~5 seconds per scene
  const scenes: DirectResponseScene[] = [];
  let sceneWords: typeof words = [];
  let sceneStart = words[0].start;

  for (let i = 0; i < words.length; i++) {
    sceneWords.push(words[i]);
    const elapsed = words[i].end - sceneStart;
    const isLast  = i === words.length - 1;
    // Cut scene every ~5s or at the last word
    if (elapsed >= TARGET_DUR || isLast) {
      const text = sceneWords.map(w => w.word).join(" ");
      const dur  = words[i].end - sceneStart;
      const idx  = scenes.length;
      scenes.push({
        id:           `whisper-${idx}`,
        textSnippet:  text,
        duration:     Math.max(dur, 1),
        emotion:      EMOTIONS[idx % EMOTIONS.length],
        searchQueries:[text.slice(0, 40), text.slice(0, 30), text.slice(0, 20)],
        suggestedSfx: null,
        videoUrl:     MOCK_BROLL_POOL[idx % MOCK_BROLL_POOL.length],
        thumbUrl:     null,
        videoOptions: [
          { url: MOCK_BROLL_POOL[idx % MOCK_BROLL_POOL.length],       thumb: "", query: text.slice(0,30) },
          { url: MOCK_BROLL_POOL[(idx+1) % MOCK_BROLL_POOL.length],   thumb: "", query: text.slice(0,30) },
        ],
      });
      sceneWords = [];
      if (!isLast) sceneStart = words[i + 1].start;
    }
  }

  // Se a última cena termina antes do fim do vídeo, estica a duração
  if (scenes.length > 0) {
    const lastScene = scenes[scenes.length - 1];
    const scenesEnd = scenes.reduce((sum, s) => sum + s.duration, 0);
    if (scenesEnd < totalDur - 1) {
      lastScene.duration += (totalDur - scenesEnd);
    }
  }

  return scenes;
}

// ─── WAV encoder helper ───────────────────────────────────────────────────────
function writeWavString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function audioBufferToWav(audioBuffer: AudioBuffer, targetRate = 16000): Blob {
  const origRate = audioBuffer.sampleRate;
  // Mix to mono
  let samples: Float32Array;
  if (audioBuffer.numberOfChannels === 1) {
    samples = audioBuffer.getChannelData(0);
  } else {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;
    samples = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) samples[i] = (left[i] + right[i]) * 0.5;
  }
  // Downsample
  if (origRate !== targetRate) {
    const ratio = origRate / targetRate;
    const newLen = Math.ceil(samples.length / ratio);
    const ds = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) ds[i] = samples[Math.floor(i * ratio)];
    samples = ds;
  }
  // Encode as 16-bit PCM WAV
  const pcmLen = samples.length * 2;
  const wavLen = 44 + pcmLen;
  const buf = new ArrayBuffer(wavLen);
  const v = new DataView(buf);
  writeWavString(v, 0, "RIFF");
  v.setUint32(4, wavLen - 8, true);
  writeWavString(v, 8, "WAVE");
  writeWavString(v, 12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, targetRate, true);
  v.setUint32(28, targetRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  writeWavString(v, 36, "data");
  v.setUint32(40, pcmLen, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    off += 2;
  }
  return new Blob([buf], { type: "audio/wav" });
}

// ─── extractAudioAsWav ────────────────────────────────────────────────────────
// Uses Web Audio API to decode video → extract audio → encode as WAV.
// This is INSTANT (no playback needed). Output: ~2MB per minute at 16kHz mono.
// Works with any video size — browser decodes the audio track directly.
async function extractAudioAsWav(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return audioBufferToWav(audioBuffer, 16000); // 16kHz mono WAV
  } finally {
    ctx.close();
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function WorkstationView({ result, copy: initialCopy, drScenes: initialDrScenes, initialBgMusicUrl, videoFile, whisperWords: rawWhisperWords, initialTtsUrl, initialAvatarUrl, onBack, onCreditChange }: {
  result: GenerateResponse;
  copy: string;
  drScenes: DirectResponseScene[];
  initialBgMusicUrl?: string;
  videoFile?: File | null;
  whisperWords?: WhisperWord[];
  initialTtsUrl?: string | null;
  initialAvatarUrl?: string | null;
  onBack: () => void;
  onCreditChange?: () => void;
}) {
  // ── Refs ──
  const videoRef         = useRef<HTMLVideoElement>(null);   // B-roll overlay
  const avatarVideoRef   = useRef<HTMLVideoElement>(null);   // UGC / avatar base layer
  const bgAudioRef       = useRef<HTMLAudioElement>(null);   // background suspense track
  const timelineRef      = useRef<HTMLDivElement>(null);     // canvas (fixed pixel width)
  const timelineScrollRef= useRef<HTMLDivElement>(null);     // scrollable outer wrapper
  const musicRefs   = [useRef<HTMLAudioElement>(null), useRef<HTMLAudioElement>(null), useRef<HTMLAudioElement>(null), useRef<HTMLAudioElement>(null), useRef<HTMLAudioElement>(null)];
  const rafRef        = useRef<number>(0);
  const globalTimeRef = useRef(0);
  const lastTsRef     = useRef(0);
  const playingRef    = useRef(false);
  const seekOnLoadRef = useRef<number | null>(null);
  const prevClipId    = useRef("");

  // ── State ──
  // localDrScenes is the SOURCE OF TRUTH for timeline layout, durations, and subtitles.
  // localScenes (legacy) is kept for B-Roll media management (video_options, suggestAnother).
  const [localDrScenes,  setLocalDrScenes]  = useState<DirectResponseScene[]>(()=>initialDrScenes.length?initialDrScenes:[]);
  const [localScenes,    setLocalScenes]    = useState<Scene[]>(()=>result.scenes??[]);

  // ── Undo / Redo history for localDrScenes ────────────────────────────────
  const [drHistory,     setDrHistory]     = useState<DirectResponseScene[][]>(
    () => initialDrScenes.length ? [initialDrScenes] : []
  );
  const [drHistoryIdx,  setDrHistoryIdx]  = useState(
    () => initialDrScenes.length ? 0 : -1
  );

  // Seed history when parent passes a freshly generated / enriched set of scenes
  useEffect(() => {
    if (initialDrScenes.length) {
      setDrHistory([initialDrScenes]);
      setDrHistoryIdx(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDrScenes]);

  /** Call this instead of setLocalDrScenes for any user-initiated change */
  const updateScenes = useCallback((next: DirectResponseScene[]) => {
    setLocalDrScenes(next);
    setDrHistory(h => {
      const trimmed = h.slice(0, drHistoryIdx + 1); // drop redo branch
      return [...trimmed, next].slice(-50); // keep last 50 snapshots
    });
    setDrHistoryIdx(i => Math.min(i + 1, 49));
  }, [drHistoryIdx]);

  const canUndo = drHistoryIdx > 0;
  const canRedo = drHistoryIdx < drHistory.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return;
    const idx = drHistoryIdx - 1;
    setLocalDrScenes(drHistory[idx]);
    setDrHistoryIdx(idx);
  }, [canUndo, drHistoryIdx, drHistory]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const idx = drHistoryIdx + 1;
    setLocalDrScenes(drHistory[idx]);
    setDrHistoryIdx(idx);
  }, [canRedo, drHistoryIdx, drHistory]);
  const [loadingClipIds, setLoadingClipIds] = useState<Set<string>>(new Set());
  const [playing,        setPlaying]        = useState(false);
  const [currentTime,    setCurrentTime]    = useState(0);
  const [playheadPct,    setPlayheadPct]    = useState(0);
  const [isDragging,     setIsDragging]     = useState(false);
  const [selectedMusic,  setSelectedMusic]  = useState(0);
  const [playingMusic,   setPlayingMusic]   = useState<number|null>(null);
  const [exportOpen,     setExportOpen]     = useState(false);
  const [paywallOpen,    setPaywallOpen]    = useState(false);
  const [editCopy,       setEditCopy]       = useState(initialCopy);
  const [dragSrcUrl,     setDragSrcUrl]     = useState<string|null>(null);
  const [hoveredAltKey,  setHoveredAltKey]  = useState<string|null>(null); // key = scene+idx for alt hover preview
  const [dragOverClipId, setDragOverClipId] = useState<string|null>(null);
  const [bgVolume,       setBgVolume]       = useState(videoFile ? 0.08 : 0.35);
  const [showAdLib,      setShowAdLib]      = useState(false);
  const [toast,          setToast]          = useState<string|null>(null);
  const [voiceEnabled,   setVoiceEnabled]   = useState(false);
  const voiceEnabledRef  = useRef(false);
  const prevVoiceScene   = useRef(-1);
  const [bgMusicUrl,     setBgMusicUrl]     = useState(
    initialBgMusicUrl ??
    "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3"
  );
  // ── Track visibility / mute / volume controls (NLE-style) ──────────────
  const [trackBrollVisible, setTrackBrollVisible] = useState(true);
  const [trackAVVisible,    setTrackAVVisible]    = useState(true);
  const [trackAVMuted,      setTrackAVMuted]      = useState(false);
  const [trackSfxMuted,     setTrackSfxMuted]     = useState(false);
  const [avatarVolume,      setAvatarVolume]      = useState(1.0);
  // ── Timeline zoom ─────────────────────────────────────────────────────
  const [timelineZoom,      setTimelineZoom]      = useState(1);
  // ── Snap toggle ───────────────────────────────────────────────────────
  const [snapOn,            setSnapOn]            = useState(true);
  // ── Active timeline tool ──────────────────────────────────────────────
  const [timelineTool,      setTimelineTool]      = useState<"select"|"cut"|"slip">("select");
  // ── Clip drag-to-reorder (within V2 track) ───────────────────────────
  const [dragClipSceneIdx,  setDragClipSceneIdx]  = useState<number|null>(null);
  // ── Clip overrides: free-drag position/duration on timeline ──────────
  const [clipOverrides, setClipOverrides] = useState<Record<string,{startSec:number;durSec:number}>>({});
  // ── Clip transforms: scale/x/y for preview (CapCut-style) ────────────
  const [clipTransforms, setClipTransforms] = useState<Record<string,{scale:number;x:number;y:number}>>({});
  // ── Left panel tab: "roteiro" | "inspector" ──────────────────────────
  const [leftTab, setLeftTab] = useState<"roteiro"|"inspector">("roteiro");
  // ── Right panel tab: "broll" | "inspector" | "audio" ─────────────────
  const [rightTab, setRightTab] = useState<"broll"|"inspector"|"audio">("broll");
  // ── Selected layer: "avatar" | "subtitle" | clipId | null ────────────
  const [selectedLayer, setSelectedLayer] = useState<string|null>(null);
  // ── Per-layer transforms ──────────────────────────────────────────────
  const [avatarTransform, setAvatarTransform] = useState({scale:100,x:0,y:0});
  // ── Clip drag state ───────────────────────────────────────────────────
  const [clipDrag, setClipDrag] = useState<{
    clipId:string; mode:"move"|"trim-left"|"trim-right";
    startX:number; origStartSec:number; origDurSec:number;
  }|null>(null);
  // ── Subtitle style config ─────────────────────────────────────────────
  const [subtitleConfig, setSubtitleConfig] = useState<{
    style:"bold"|"minimal"|"neon"|"shadow";
    position:"bottom"|"center"|"top";
    fontSize:number;
    colorRules:{pattern:string;color:string}[];
  }>({style:"bold",position:"bottom",fontSize:100,colorRules:[
    {pattern:"\\$[\\d,.]+[kKmMbB]?",color:"#00FF7A"},
    {pattern:"\\d+[kKmM]\\+?\\s*(?:dollars?|reais|usd|brl)?",color:"#00FF7A"},
  ]});

  const getWordRuleColor = (word:string):string|null => {
    for(const rule of subtitleConfig.colorRules){
      try{ if(new RegExp(rule.pattern,"i").test(word)) return rule.color; }catch{ /* invalid regex */ }
    }
    return null;
  };
  // ── SFX marker offsets + drag ─────────────────────────────────────────
  const [sfxOffsets, setSfxOffsets] = useState<Record<string,number>>({});
  const [sfxDrag, setSfxDrag] = useState<{id:string;startX:number;origOffset:number}|null>(null);
  // ── Preview direct drag (CapCut-style: drag layer in player) ─────────
  const [previewDrag, setPreviewDrag] = useState<{
    startX:number; startY:number;
    origX:number;  origY:number;
  }|null>(null);
  const previewDraggedRef = useRef(false); // true if mouse actually moved during drag
  const previewRef = useRef<HTMLDivElement>(null);
  const [videoAspect,       setVideoAspect]       = useState<"landscape"|"portrait">("landscape");
  const [videoErrors,       setVideoErrors]       = useState<Record<string,boolean>>({});
  // ── Uploaded UGC Avatar video object URL ─────────────────────────────────
  const [uploadedVideoUrl,  setUploadedVideoUrl]  = useState<string|null>(null);
  // ── TTS synthetic voice ───────────────────────────────────────────────────
  const [ttsAudioUrl,       setTtsAudioUrl]       = useState<string|null>(initialTtsUrl ?? null);
  // Sync when parent passes a new TTS URL after WorkstationView is already mounted
  useEffect(()=>{ if(initialTtsUrl) setTtsAudioUrl(initialTtsUrl); },[initialTtsUrl]);
  const [ttsLoading,        setTtsLoading]        = useState(false);
  const [ttsError,          setTtsError]          = useState<string|null>(null);
  const [ttsVoice,          setTtsVoice]          = useState("English_expressive_narrator");
  const [ttsSpeed,          setTtsSpeed]          = useState(1.0);
  const [previewUrl,        setPreviewUrl]        = useState<string|null>(null);
  const [previewLoading,    setPreviewLoading]    = useState(false);
  const [previewError,      setPreviewError]      = useState<string|null>(null);
  const ttsAudioRef    = useRef<HTMLAudioElement>(null);
  const ttsAudioUrlRef = useRef<string|null>(null); // ref copy so callbacks don't need ttsAudioUrl in deps
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  const tracks   = result.background_tracks ?? [];

  // ── Create object URL from uploaded videoFile ─────────────────────────────
  useEffect(()=>{
    if(!videoFile) return;
    const url = URL.createObjectURL(videoFile);
    setUploadedVideoUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[videoFile]);

  // ── Load avatar from pending URL (DreamAct / LipSync result) ─────────────
  useEffect(()=>{
    if(initialAvatarUrl) setUploadedVideoUrl(initialAvatarUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ── Sync avatarVideoRef muted + volume state ─────────────────────────────
  useEffect(()=>{
    if(!avatarVideoRef.current) return;
    avatarVideoRef.current.muted  = trackAVMuted;
    avatarVideoRef.current.volume = avatarVolume;
  },[trackAVMuted, avatarVolume]);

  // ── TTS: sync audio with player ──────────────────────────────────────────
  useEffect(()=>{
    const a = ttsAudioRef.current;
    if(!a || !ttsAudioUrl) return;
    a.src = ttsAudioUrl;
    ttsAudioUrlRef.current = ttsAudioUrl;
  },[ttsAudioUrl]);

  useEffect(()=>{
    const a = ttsAudioRef.current;
    if(!a || !ttsAudioUrl) return;
    if(playing){
      // Sync TTS position to current playhead BEFORE playing (prevents desync after seek)
      if(isFinite(a.duration) && a.duration > 0)
        a.currentTime = Math.min(globalTimeRef.current, a.duration);
      a.play().catch(()=>null);
    } else {
      a.pause();
    }
  },[playing, ttsAudioUrl]);

  useEffect(()=>{
    const a = ttsAudioRef.current;
    if(!a || !ttsAudioUrl) return;
    a.muted = trackAVMuted;
  },[trackAVMuted, ttsAudioUrl]);

  // ── TTS: preview voice ────────────────────────────────────────────────────
  const previewUrlRef = useRef<string|null>(null);
  const previewAbortRef = useRef<AbortController|null>(null);
  const handlePreviewVoice = useCallback(async () => {
    // Cancel any in-flight request
    previewAbortRef.current?.abort();
    previewAbortRef.current = new AbortController();
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "This is a voice preview sample. How does this sound?",
          voiceId: ttsVoice,
          speed: 1.0
        }),
        signal: previewAbortRef.current.signal,
      });
      if (!res.ok) {
        const d = await res.json().catch(()=>({error:"Erro desconhecido"}));
        throw new Error(d.error ?? "Erro ao gerar preview");
      }
      const blob = await res.blob();
      // Revoke previous URL before creating a new one
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      if (previewAudioRef.current) {
        previewAudioRef.current.src = url;
        previewAudioRef.current.play().catch(()=>{});
      }
    } catch(e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      setPreviewError(e instanceof Error ? e.message : "Erro ao gerar preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [ttsVoice]);
  // Revoke preview URL on unmount
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewAbortRef.current?.abort();
  }, []);

  // ── TTS: generate voice ───────────────────────────────────────────────────
  const handleGenerateTTS = useCallback(async (text: string) => {
    setTtsLoading(true);
    setTtsError(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: ttsVoice, speed: ttsSpeed }),
      });
      if (!res.ok) {
        const d = await res.json().catch(()=>({error:"Erro desconhecido"}));
        throw new Error(d.error ?? "Erro ao gerar voz");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      // Revoke old URL
      setTtsAudioUrl(prev => { if(prev) URL.revokeObjectURL(prev); return url; });
      trackEvent("tts_generated", { voice: ttsVoice, source: "storyboard" });
    } catch(e: unknown) {
      setTtsError(e instanceof Error ? e.message : "Erro ao gerar voz");
    } finally {
      setTtsLoading(false);
      onCreditChange?.();
    }
  },[ttsVoice, ttsSpeed, onCreditChange]);

  // ── Real video duration (from avatar video) overrides DRS estimates ────────
  const [realVideoDur, setRealVideoDur] = useState<number|null>(null);

  const drsDur = useMemo(()=>
    Math.max(
      localDrScenes.length
        ? localDrScenes.reduce((s, drs) => s + drs.duration, 0)
        : localScenes.reduce((s,sc)=>s+(sc.estimated_duration_seconds??5),0),
      1),
    [localDrScenes, localScenes]
  );

  // When a real UGC video is uploaded, its duration is the source of truth
  const totalDur = (uploadedVideoUrl && realVideoDur && realVideoDur > 0)
    ? realVideoDur
    : drsDur;

  // ── Timeline auto-scroll — keeps playhead ~30% from left edge ────────────
  const lastAutoScrollSec = useRef(-999);
  useEffect(()=>{
    if(!playing||!timelineScrollRef.current) return;
    if(Math.abs(currentTime - lastAutoScrollSec.current) < 1.5) return;
    lastAutoScrollSec.current = currentTime;
    const el = timelineScrollRef.current;
    const canvasW = el.scrollWidth;
    const pct = currentTime / Math.max(totalDur, 1);
    const targetLeft = Math.max(0, pct * canvasW - el.clientWidth * 0.3);
    el.scrollTo({ left: targetLeft, behavior: "smooth" });
  },[playing, currentTime, totalDur]);

  // ── DRS-powered timeline — searchQueries drive clips, not PT-BR keywords ──
  const timelineClips = useMemo(()=>
    localDrScenes.length
      ? buildTimelineClipsFromDRS(localDrScenes)
      : buildTimelineClips(localScenes),
    [localDrScenes, localScenes]
  );

  // ── Reset timeline scroll to start when clips first load ─────────────────
  useEffect(()=>{
    if(timelineScrollRef.current && timelineClips.length > 0) {
      timelineScrollRef.current.scrollTo({ left: 0 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[timelineClips.length]);

  // Apply user overrides (drag/trim) on top of computed positions
  const effectiveClips = useMemo(()=>
    timelineClips.map(c=>{
      const ov=clipOverrides[c.id];
      return ov ? {...c,startSec:ov.startSec,durSec:ov.durSec} : c;
    }),
    [timelineClips,clipOverrides]
  );

  // Clip currently under the playhead — null during gaps (no B-roll)
  const currentClip = useMemo(()=>
    effectiveClips.find(c=>currentTime>=c.startSec&&currentTime<c.startSec+c.durSec)??null,
    [effectiveClips,currentTime]
  );

  // Active scene index: which DRS/legacy scene contains the current time
  const activeScene = useMemo(()=>{
    if(currentClip) return currentClip.sceneIdx;
    // During a gap: find the scene whose time window contains currentTime
    const src = localDrScenes.length ? localDrScenes : localScenes;
    let t = 0;
    for(let i=0; i<src.length; i++){
      const dur = localDrScenes.length
        ? (src[i] as DirectResponseScene).duration
        : (src[i] as Scene).estimated_duration_seconds??5;
      if(currentTime >= t && currentTime < t+dur) return i;
      t += dur;
    }
    return Math.max(0, src.length-1);
  },[currentClip, currentTime, localDrScenes, localScenes]);

  const videoUrl    = currentClip?.url??"";

  // Cumulative scene starts — driven by DRS durations when available
  const sceneStarts = useMemo(()=>{
    const s:number[]=[];let a=0;
    const src = localDrScenes.length ? localDrScenes : localScenes;
    for(const sc of src){
      s.push(a);
      a += localDrScenes.length ? (sc as DirectResponseScene).duration : (sc as Scene).estimated_duration_seconds??5;
    }
    return s;
  },[localDrScenes, localScenes]);

  // ── RAF Tick — drives playhead ONLY when no real video (copy-only mode) ──
  // When uploadedVideoUrl exists, handleAvatarTimeUpdate is the sole clock.
  const tickRef = useRef<(ts:number)=>void>(()=>{});
  useEffect(()=>{
    tickRef.current=(ts:number)=>{
      if(!playingRef.current) return;
      // Skip RAF tick when real video drives the clock
      if(uploadedVideoUrl) { rafRef.current=requestAnimationFrame(tickRef.current); return; }
      if(lastTsRef.current===0) lastTsRef.current=ts;
      const delta=Math.min((ts-lastTsRef.current)/1000,0.1);
      lastTsRef.current=ts;
      const newT=Math.min(globalTimeRef.current+delta,totalDur);
      globalTimeRef.current=newT;
      setCurrentTime(newT);
      setPlayheadPct((newT/totalDur)*100);
      if(newT>=totalDur){setPlaying(false);return;}
      rafRef.current=requestAnimationFrame(tickRef.current);
    };
  },[totalDur,uploadedVideoUrl]);

  useEffect(()=>{playingRef.current=playing;},[playing]);

  useEffect(()=>{
    if(playing){lastTsRef.current=0;rafRef.current=requestAnimationFrame(tickRef.current);}
    else{cancelAnimationFrame(rafRef.current);lastTsRef.current=0;}
    return()=>cancelAnimationFrame(rafRef.current);
  },[playing]);

  // ── Auto-play video when clip changes ────────────────────────────────────
  useEffect(()=>{
    if(!currentClip||currentClip.id===prevClipId.current) return;
    prevClipId.current=currentClip.id;
    const local=globalTimeRef.current-currentClip.startSec;
    seekOnLoadRef.current=local>0.3?local:null;
    if(playingRef.current&&videoRef.current&&currentClip.url)
      videoRef.current.play().catch(()=>null);
  },[currentClip]);

  const handleLoadedMetadata=useCallback(()=>{
    if(seekOnLoadRef.current!==null&&videoRef.current){
      videoRef.current.currentTime=seekOnLoadRef.current;
      seekOnLoadRef.current=null;
    }
    if(playingRef.current&&videoRef.current)
      videoRef.current.play().catch(()=>null);
  },[]);

  // ── Avatar video onLoadedMetadata — detects aspect ratio ─────────────────
  const handleAvatarMetadata = useCallback(()=>{
    const v = avatarVideoRef.current;
    if(!v) return;
    setVideoAspect(v.videoHeight > v.videoWidth ? "portrait" : "landscape");
    if(isFinite(v.duration) && v.duration > 0) setRealVideoDur(v.duration);
  },[]);

  // ── Avatar video onTimeUpdate — AUTHORITATIVE clock when real video exists ─
  // This fires ~4x/sec from the <video> element's native time.
  // It is THE source of truth — the RAF tick is disabled when avatar is loaded.
  const handleAvatarTimeUpdate=useCallback(()=>{
    const v=avatarVideoRef.current;
    if(!v) return;
    const t=v.currentTime;
    const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : totalDur;
    if(t>=dur-0.1 && playingRef.current){ setPlaying(false); v.pause(); return; }
    globalTimeRef.current=t;
    setCurrentTime(t);
    setPlayheadPct((t/Math.max(dur,1))*100);
    // Drift correction: re-sync TTS if it drifts more than 500ms from real video
    const ttsEl = ttsAudioRef.current;
    if(ttsEl && ttsAudioUrlRef.current && playingRef.current && isFinite(ttsEl.duration) && ttsEl.duration > 0) {
      const drift = Math.abs(ttsEl.currentTime - t);
      if(drift > 0.5) ttsEl.currentTime = Math.min(t, ttsEl.duration);
    }
  },[totalDur]);

  // ── Background audio volume sync ─────────────────────────────────────────
  useEffect(()=>{
    if(bgAudioRef.current) bgAudioRef.current.volume=bgVolume;
  },[bgVolume]);

  // ── Voz de Apoio — Web Speech API (pt-BR nativo do browser) ─────────────
  // Keeps voiceEnabledRef in sync for use inside RAF/callbacks
  useEffect(()=>{ voiceEnabledRef.current=voiceEnabled; },[voiceEnabled]);

  // Cancels any ongoing speech safely
  const cancelVoice = useCallback(()=>{
    if(typeof window!=="undefined" && window.speechSynthesis)
      window.speechSynthesis.cancel();
  },[]);

  // Speaks a text snippet with pt-BR voice at VSL pacing (rate 0.88)
  const speakText = useCallback((text:string)=>{
    if(typeof window==="undefined"||!window.speechSynthesis) return;
    cancelVoice();
    if(!voiceEnabledRef.current) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang  = "pt-BR";
    utter.rate  = 0.88;   // slightly slower than natural — dramatic VSL feel
    utter.pitch = 1.0;
    // Prefer an explicit pt-BR voice if the browser has one
    const getVoice = ()=>{
      const all = window.speechSynthesis.getVoices();
      return all.find(v=>v.lang==="pt-BR")
          ?? all.find(v=>v.lang.startsWith("pt"))
          ?? null;
    };
    const setVoiceAndSpeak = ()=>{
      const v = getVoice();
      if(v) utter.voice = v;
      window.speechSynthesis.speak(utter);
    };
    // getVoices() may be async on first call (Chrome quirk)
    if(window.speechSynthesis.getVoices().length>0){
      setVoiceAndSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = ()=>{ setVoiceAndSpeak(); };
    }
  },[cancelVoice]);

  // When the active scene changes during playback → speak the new snippet
  useEffect(()=>{
    if(!playing) return;
    if(activeScene===prevVoiceScene.current) return;
    prevVoiceScene.current=activeScene;
    if(voiceEnabled){
      const text = localDrScenes[activeScene]?.textSnippet
        ?? localScenes[activeScene]?.text_chunk
        ?? localScenes[activeScene]?.segment ?? "";
      speakText(text);
    }
  },[activeScene, playing, voiceEnabled, speakText, localDrScenes, localScenes]);

  // Stop speech when component unmounts
  useEffect(()=>cancelVoice,[cancelVoice]);

  // ── Play / Pause ─────────────────────────────────────────────────────────
  const togglePlay=useCallback(()=>{
    if(playing){
      setPlaying(false);
      videoRef.current?.pause();
      avatarVideoRef.current?.pause();
      bgAudioRef.current?.pause();
      cancelVoice();
    } else {
      if(globalTimeRef.current>=totalDur){
        globalTimeRef.current=0;setCurrentTime(0);setPlayheadPct(0);
        if(bgAudioRef.current) bgAudioRef.current.currentTime=0;
        if(avatarVideoRef.current) avatarVideoRef.current.currentTime=0;
        if(ttsAudioRef.current) ttsAudioRef.current.currentTime=0;
        prevVoiceScene.current=-1;
      }
      setPlaying(true);
      videoRef.current?.play().catch(()=>null);
      avatarVideoRef.current?.play().catch(()=>null);
      // Seek bg audio to match playhead position, then play
      if(bgAudioRef.current){
        bgAudioRef.current.currentTime=globalTimeRef.current % (bgAudioRef.current.duration||999);
        bgAudioRef.current.play().catch(()=>null);
      }
      // Start voice on the current scene
      if(voiceEnabledRef.current){
        prevVoiceScene.current=activeScene;
        const text = localDrScenes[activeScene]?.textSnippet
          ?? localScenes[activeScene]?.text_chunk
          ?? localScenes[activeScene]?.segment ?? "";
        speakText(text);
      }
    }
  },[playing,totalDur,cancelVoice,speakText,activeScene,localDrScenes,localScenes]);

  // ── Seek to global time ──────────────────────────────────────────────────
  const seekToTime=useCallback((globalSec:number)=>{
    const clamped=Math.max(0,Math.min(totalDur,globalSec));
    globalTimeRef.current=clamped;
    setCurrentTime(clamped);
    setPlayheadPct((clamped/totalDur)*100);
    // Sync bg audio
    if(bgAudioRef.current&&isFinite(bgAudioRef.current.duration))
      bgAudioRef.current.currentTime=clamped % bgAudioRef.current.duration;
    // Sync TTS voice to seek position
    if(ttsAudioRef.current && ttsAudioUrlRef.current && isFinite(ttsAudioRef.current.duration) && ttsAudioRef.current.duration > 0)
      ttsAudioRef.current.currentTime=Math.min(clamped, ttsAudioRef.current.duration);
    // Sync avatar video to exact global position
    if(avatarVideoRef.current) avatarVideoRef.current.currentTime=clamped;
    // Sync B-roll clip video to local offset
    const clip=effectiveClips.find(c=>clamped>=c.startSec&&clamped<c.startSec+c.durSec);
    if(clip&&videoRef.current){
      const local=clamped-clip.startSec;
      if(clip.id===prevClipId.current){videoRef.current.currentTime=Math.max(0,local);}
      else{seekOnLoadRef.current=local>0.3?local:null;}
    }
  },[totalDur,effectiveClips]);

  // ── Timeline drag — accounts for 80px track header + scroll offset ──────
  const TRACK_HEADER_W = 80; // w-20 = 5rem = 80px
  const timelineBodyPosFromEvent = (clientX: number) => {
    if(!timelineRef.current) return 0;
    const r = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineScrollRef.current?.scrollLeft ?? 0;
    const bodyX = (clientX - r.left + scrollLeft) - TRACK_HEADER_W;
    const bodyW = r.width - TRACK_HEADER_W;
    return Math.max(0, Math.min(1, bodyX / bodyW)) * totalDur;
  };
  const handleTimelineMouseDown=(e:React.MouseEvent<HTMLDivElement>)=>{
    setIsDragging(true);
    seekToTime(timelineBodyPosFromEvent(e.clientX));
  };
  const handleTimelineWheel=useCallback((e:React.WheelEvent)=>{
    if(!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setTimelineZoom(z=>Math.max(0.25, Math.min(8, z * (e.deltaY<0?1.25:0.8))));
  },[]);
  useEffect(()=>{
    if(!isDragging) return;
    const mv=(e:MouseEvent)=>seekToTime(timelineBodyPosFromEvent(e.clientX));
    const up=()=>setIsDragging(false);
    window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);
    return()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isDragging,seekToTime,totalDur]);

  // ── Clip free-drag on timeline (move + trim) ──────────────────────────────
  useEffect(()=>{
    if(!clipDrag) return;
    const pxPerSec=28*timelineZoom;
    const mv=(e:MouseEvent)=>{
      const deltaSec=(e.clientX-clipDrag.startX)/pxPerSec;
      setClipOverrides(prev=>{
        const newStart=clipDrag.mode==="move"
          ? Math.max(0,clipDrag.origStartSec+deltaSec)
          : clipDrag.mode==="trim-left"
          ? Math.max(0,Math.min(clipDrag.origStartSec+clipDrag.origDurSec-0.5,clipDrag.origStartSec+deltaSec))
          : prev[clipDrag.clipId]?.startSec??clipDrag.origStartSec;
        const newDur=clipDrag.mode==="trim-right"
          ? Math.max(0.5,clipDrag.origDurSec+deltaSec)
          : clipDrag.mode==="trim-left"
          ? Math.max(0.5,clipDrag.origDurSec-deltaSec)
          : prev[clipDrag.clipId]?.durSec??clipDrag.origDurSec;
        return{...prev,[clipDrag.clipId]:{startSec:newStart,durSec:newDur}};
      });
    };
    const up=()=>setClipDrag(null);
    window.addEventListener("mousemove",mv);
    window.addEventListener("mouseup",up);
    return()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};
  },[clipDrag,timelineZoom]);

  // ── SFX drag ──────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!sfxDrag) return;
    const pxPerSec=28*timelineZoom;
    const mv=(e:MouseEvent)=>{
      const delta=(e.clientX-sfxDrag.startX)/pxPerSec;
      setSfxOffsets(prev=>({...prev,[sfxDrag.id]:sfxDrag.origOffset+delta}));
    };
    const up=()=>setSfxDrag(null);
    window.addEventListener("mousemove",mv);
    window.addEventListener("mouseup",up);
    return()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};
  },[sfxDrag,timelineZoom]);

  // ── Preview direct drag (CapCut) ────────────────────────────────────────────
  useEffect(()=>{
    if(!previewDrag) return;
    previewDraggedRef.current = false;
    const mv=(e:MouseEvent)=>{
      const el=previewRef.current;
      if(!el)return;
      const {width,height}=el.getBoundingClientRect();
      const dx=(e.clientX-previewDrag.startX)/width*100;
      const dy=(e.clientY-previewDrag.startY)/height*100;
      if(Math.abs(dx)>0.5||Math.abs(dy)>0.5) previewDraggedRef.current=true;
      if(selectedLayer==="avatar"){
        setAvatarTransform(prev=>({...prev,x:previewDrag.origX+dx,y:previewDrag.origY+dy}));
      } else if(selectedLayer && selectedLayer!=="subtitle"){
        setClipTransforms(prev=>({...prev,[selectedLayer]:{
          ...(prev[selectedLayer]??{scale:100,x:0,y:0}),
          x:previewDrag.origX+dx,y:previewDrag.origY+dy,
        }}));
      }
    };
    const up=()=>setPreviewDrag(null);
    window.addEventListener("mousemove",mv);
    window.addEventListener("mouseup",up);
    return()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};
  },[previewDrag,selectedLayer]);

  // ── Keyboard Shortcuts (NLE-standard) ───────────────────────────────────────
  useEffect(()=>{
    const handleKeyDown=(e:KeyboardEvent)=>{
      // Don't capture when typing in textarea/input
      const tag=(e.target as HTMLElement)?.tagName;
      if(tag==="TEXTAREA"||tag==="INPUT"||tag==="SELECT") return;

      switch(e.code){
        case "Space":        // Play / Pause
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":    // Seek backward 5s (Shift = 1s)
          e.preventDefault();
          seekToTime(globalTimeRef.current - (e.shiftKey ? 1 : 5));
          break;
        case "ArrowRight":   // Seek forward 5s (Shift = 1s)
          e.preventDefault();
          seekToTime(globalTimeRef.current + (e.shiftKey ? 1 : 5));
          break;
        case "KeyJ":         // Seek backward 10s
          seekToTime(globalTimeRef.current - 10);
          break;
        case "KeyK":         // Play / Pause (YouTube-style)
          togglePlay();
          break;
        case "KeyL":         // Seek forward 10s
          seekToTime(globalTimeRef.current + 10);
          break;
        case "Home":         // Go to start
          e.preventDefault();
          seekToTime(0);
          break;
        case "End":          // Go to end
          e.preventDefault();
          seekToTime(totalDur);
          break;
        case "KeyM":         // Mute/unmute avatar
          setTrackAVMuted(m=>!m);
          break;
        case "KeyB":         // Toggle B-roll visibility
          if(!e.metaKey&&!e.ctrlKey) setTrackBrollVisible(v=>!v);
          break;
        case "Escape":       // Deselect layer
          setSelectedLayer(null);
          break;
        case "KeyZ":         // Undo (Cmd/Ctrl+Z) / Redo (Cmd/Ctrl+Shift+Z)
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (e.shiftKey) redo(); else undo();
          }
          break;
      }
    };
    window.addEventListener("keydown",handleKeyDown);
    return()=>window.removeEventListener("keydown",handleKeyDown);
  },[togglePlay,seekToTime,totalDur,undo,redo]);

  // ── Suggest Another ──────────────────────────────────────────────────────
  const suggestAnother=useCallback(async(clipId:string)=>{
    const clip=effectiveClips.find(c=>c.id===clipId);
    if(!clip) return;
    setLoadingClipIds(prev=>new Set(prev).add(clipId));
    try{
      // ── DRS mode: rotate through videoOptions ─────────────────────────
      if(localDrScenes.length>0){
        const drs=localDrScenes[clip.sceneIdx];
        const opts=drs?.videoOptions??[];
        if(opts.length>1){
          const cur=opts.findIndex(o=>o.url===clip.url);
          const next=opts[(cur+1)%opts.length];
          await new Promise(r=>setTimeout(r,500));
          setLocalDrScenes(prev=>{
            const u=[...prev];
            const d=u[clip.sceneIdx];
            u[clip.sceneIdx]={
              ...d,
              videoUrl:next.url,
              thumbUrl:next.thumb,
              videoOptions:[next,...(d.videoOptions??[]).filter(o=>o.url!==next.url)],
            };
            return u;
          });
        } else {
          // Fetch new Pexels video using the scene's primary searchQuery
          const q=drs?.searchQueries?.[0]??"cinematic broll";
          const page=Math.floor(Math.random()*5)+1;
          const res=await fetch(`/api/suggest-media?q=${encodeURIComponent(q)}&page=${page}`);
          if(res.ok){
            const data=await res.json();
            const newVids:(typeof opts)=(data.videos??[]).map((v:{url:string;thumb?:string})=>({
              url:v.url, thumb:v.thumb??lookupConcept(q), query:q,
            }));
            if(newVids.length>0)
              setLocalDrScenes(prev=>{
                const u=[...prev];
                u[clip.sceneIdx]={...u[clip.sceneIdx],videoUrl:newVids[0].url,thumbUrl:newVids[0].thumb,videoOptions:newVids};
                return u;
              });
          }
        }
        return;
      }
      // ── Legacy Scene mode ─────────────────────────────────────────────
      const sc=localScenes[clip.sceneIdx];
      const opts=sc?.video_options??[];
      if(opts.length>1){
        const cur=opts.findIndex(o=>o.url===clip.url);
        const next=opts[(cur+1)%opts.length];
        await new Promise(r=>setTimeout(r,500));
        setLocalScenes(prev=>{
          const u=[...prev];
          u[clip.sceneIdx]={...u[clip.sceneIdx],video_url:next.url,
            video_options:[next,...opts.filter(o=>o.url!==next.url)]};
          return u;
        });
      } else {
        const q=sc?.broll_search_queries?.[0]??sc?.broll_search_keywords??sc?.vault_category??sc?.segment??"cinematic";
        const page=Math.floor(Math.random()*5)+1;
        const res=await fetch(`/api/suggest-media?q=${encodeURIComponent(q)}&page=${page}`);
        if(res.ok){
          const data=await res.json();
          const newVids:VideoOption[]=(data.videos??[]).map((v:{url:string})=>({url:v.url}));
          if(newVids.length>0)
            setLocalScenes(prev=>{
              const u=[...prev];
              u[clip.sceneIdx]={...u[clip.sceneIdx],video_url:newVids[0].url,video_options:newVids};
              return u;
            });
        }
      }
    } finally{
      setLoadingClipIds(prev=>{const s=new Set(prev);s.delete(clipId);return s;});
    }
  },[effectiveClips,localDrScenes,localScenes]);

  // ── Drag & Drop from sidebar → V1 block ─────────────────────────────────
  const handleDropOnClip=useCallback((clipId:string,url:string,thumb?:string)=>{
    const clip=effectiveClips.find(c=>c.id===clipId);
    if(!clip) return;
    if(localDrScenes.length>0){
      // DRS mode: update videoUrl + videoOptions
      setLocalDrScenes(prev=>{
        const u=[...prev];
        const d=u[clip.sceneIdx];
        const newOpt={url,thumb:thumb??lookupConcept(d.searchQueries?.[0]??""),query:d.searchQueries?.[0]??""};
        u[clip.sceneIdx]={...d,videoUrl:url,thumbUrl:thumb??d.thumbUrl,
          videoOptions:[newOpt,...(d.videoOptions??[]).filter(o=>o.url!==url)]};
        return u;
      });
    } else {
      setLocalScenes(prev=>{
        const u=[...prev];
        const sc=u[clip.sceneIdx];
        u[clip.sceneIdx]={...sc,video_url:url,
          video_options:[{url},...(sc.video_options??[]).filter(o=>o.url!==url)]};
        return u;
      });
    }
    setDragSrcUrl(null);setDragOverClipId(null);
  },[effectiveClips,localDrScenes]);

  // ── Current subtitle — from DRS when available ───────────────────────────
  const currentSubtitle=useMemo(()=>{
    if(localDrScenes.length) return localDrScenes[activeScene]?.textSnippet??"";
    const sc=localScenes[activeScene];
    return sc?.text_chunk??sc?.segment??"";
  },[localDrScenes,localScenes,activeScene]);

  // ── Sidebar alternatives ─────────────────────────────────────────────────
  const alternatives=useMemo(()=>{
    // DRS mode: alternatives come from Pexels videoOptions (real thumbnails)
    if(localDrScenes.length>0){
      const drs=localDrScenes[activeScene];
      if(!drs) return [];
      // Skip first option (already the main video) — show options 1 & 2 as alternatives
      return (drs.videoOptions??[]).slice(1).map(o=>({
        url:   o.url,
        thumb: o.thumb,
        source:"Pexels",
      }));
    }
    // Legacy mode
    const sc=localScenes[activeScene];
    if(!sc) return [];
    const cur=sc.video_url??sc.video_options?.[0]?.url;
    return (sc.video_options??[]).filter(o=>o.url!==cur);
  },[localDrScenes,localScenes,activeScene]);

  // ── Karaoke Subtitle Words — Whisper real timestamps when available ──────
  const subtitleWords = useMemo(()=>{
    // Priority 1: real Whisper word-level timestamps
    if (rawWhisperWords && rawWhisperWords.length > 0) {
      return rawWhisperWords.map((w): SubtitleWord => {
        const clean = w.word.toLowerCase().replace(/[^a-záéíóúãõçêâîôû]/g, "");
        return {
          word:      w.word,
          startSec:  w.start,
          endSec:    w.end,
          isKeyword: !!BROLL_IMAGES[clean] || POWER_WORDS.has(clean),
          cleanWord: clean,
        };
      });
    }
    // Priority 2: DRS estimated timing
    if (localDrScenes.length) return buildSubtitleWordsFromDRS(localDrScenes);
    // Priority 3: legacy Scene timing
    return buildSubtitleWords(localScenes);
  },[rawWhisperWords,localDrScenes,localScenes]);

  // Active word: the word whose time window contains currentTime
  const activeWordIdx = useMemo(()=>{
    if(!subtitleWords.length) return -1;
    // Binary-search-style: find last word that has started
    let lo=0,hi=subtitleWords.length-1,found=-1;
    while(lo<=hi){
      const mid=Math.floor((lo+hi)/2);
      if(subtitleWords[mid].startSec<=currentTime){found=mid;lo=mid+1;}
      else hi=mid-1;
    }
    // Only highlight if still within the word's window
    return found>=0&&currentTime<subtitleWords[found].endSec ? found : -1;
  },[subtitleWords,currentTime]);

  // ── SFX Scoring Layer ────────────────────────────────────────────────────
  const sfxMarkers = useMemo(()=>buildSFXMarkers(localScenes),[localScenes]);

  // Web-Audio preview — generates a synthetic tone per sfx kind
  const playSFXPreview = useCallback((marker: SFXMarker)=>{
    try {
      type WACtx = typeof AudioContext;
      const ACtx: WACtx = (window.AudioContext
        || (window as Window & { webkitAudioContext?: WACtx }).webkitAudioContext) as WACtx;
      const ctx = new ACtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const t = ctx.currentTime;
      if (marker.kind === "zap") {
        // Downward sweep — whoosh / impact feel
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1400, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.22);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.start(t); osc.stop(t + 0.22);
      } else {
        // Bell / chime — two-note ring
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(1320, t + 0.06);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.start(t); osc.stop(t + 0.45);
      }
    } catch { /* AudioContext not available */ }
  },[]);

  // ── Music ────────────────────────────────────────────────────────────────
  const toggleMusic=(idx:number)=>{
    if(playingMusic===idx){musicRefs[idx]?.current?.pause();setPlayingMusic(null);}
    else{
      musicRefs.forEach((r,i)=>{if(i!==idx)r.current?.pause();});
      musicRefs[idx]?.current?.play().catch(()=>null);
      setPlayingMusic(idx);
      setSelectedMusic(idx);
      // Troca a trilha de fundo ao tocar
      const url=musicOptions[idx]?.url;
      if(url) setBgMusicUrl(url);
    }
  };
  const downloadSRT=()=>{
    // Convert DRS to Scene-compatible format for SRT generation
    const srtScenes: Scene[] = localDrScenes.length
      ? localDrScenes.map(drs=>({ segment:drs.emotion, text_chunk:drs.textSnippet, estimated_duration_seconds:drs.duration }))
      : localScenes;
    saveAs(new Blob([generateSRT(srtScenes)],{type:"text/plain;charset=utf-8"}),"suarik-legendas.srt");
  };
  const downloadMusic=()=>{const t=tracks[selectedMusic];if(t?.url)window.open(t.url,"_blank");};

  // ── Pack de Mídias (ZIP download) ───────────────────────────────────────────
  const downloadMediaPack = async () => {
    fireToast("📦 Preparando Pack de Mídias…");
    const zip = new JSZip();
    const brollFolder = zip.folder("brolls")!;
    const trilhaFolder = zip.folder("trilha")!;
    const errors: string[] = [];

    // Collect B-roll clips with URLs
    const clipsWithUrl = effectiveClips.filter((c): c is TimelineClip & { url: string } => !!c.url);

    // Fetch all B-roll clips
    await Promise.all(
      clipsWithUrl.map(async (clip, i) => {
        const idx = String(i + 1).padStart(2, "0");
        const filename = `cena-${idx}_broll.mp4`;
        try {
          const resp = await fetch(clip.url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          brollFolder.file(filename, blob);
        } catch (err) {
          errors.push(`brolls/${filename} — ${clip.url} (${err instanceof Error ? err.message : "erro desconhecido"})`);
        }
      })
    );

    // Fetch background music
    if (bgMusicUrl) {
      try {
        const resp = await fetch(bgMusicUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        trilhaFolder.file("trilha.mp3", blob);
      } catch (err) {
        errors.push(`trilha/trilha.mp3 — ${bgMusicUrl} (${err instanceof Error ? err.message : "erro desconhecido"})`);
      }
    }

    // Generate SRT
    const srtScenes: Scene[] = localDrScenes.length
      ? localDrScenes.map(drs => ({ segment: drs.emotion, text_chunk: drs.textSnippet, estimated_duration_seconds: drs.duration }))
      : localScenes;
    zip.file("legendas.srt", generateSRT(srtScenes));

    // Add readme with errors if any files failed
    if (errors.length > 0) {
      const readmeLines = [
        "LEIAME — Pack de Mídias",
        "========================",
        "",
        "Os seguintes arquivos não puderam ser baixados:",
        "",
        ...errors.map(e => `  • ${e}`),
        "",
        "Isso pode ter ocorrido por restrições de CORS ou links expirados.",
        "Tente baixar esses arquivos manualmente usando os links acima.",
      ];
      zip.file("LEIAME.txt", readmeLines.join("\n"));
    }

    // Generate and download the ZIP
    fireToast("📦 Compactando arquivos…");
    try {
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "suarik-pack-de-midias.zip");
      fireToast(errors.length > 0
        ? `📦 Pack baixado (${errors.length} arquivo(s) com erro — veja LEIAME.txt)`
        : "📦 Pack de Mídias baixado com sucesso!");
    } catch {
      fireToast("❌ Erro ao gerar o ZIP. Tente novamente.");
    }
  };

  // ── FCPXML export (Premiere Pro / CapCut compatible) ─────────────────────────
  const downloadXML = () => {
    const fps = 25;
    const timebase = `${fps}/1s`;

    // Build asset + clip entries from the effective timeline clips
    const assets: string[] = [];
    const clipEls: string[] = [];
    const seenUrls = new Map<string, string>(); // url → assetId

    let assetIdx = 2; // r1 = format
    effectiveClips.forEach(clip => {
      if (!clip.url) return;
      let assetId = seenUrls.get(clip.url);
      if (!assetId) {
        assetId = `r${assetIdx++}`;
        seenUrls.set(clip.url, assetId);
        const durFrames = Math.round(clip.durSec * fps);
        assets.push(
          `    <asset id="${assetId}" name="${clip.label.replace(/"/g,"'")}" src="${clip.url}" start="0s" duration="${durFrames}/${fps}s" hasVideo="1" hasAudio="0"/>`
        );
      }
      const offsetFrames = Math.round(clip.startSec * fps);
      const durFrames    = Math.round(clip.durSec * fps);
      clipEls.push(
        `            <clip name="${clip.label.replace(/"/g,"'")}" ref="${assetId}" offset="${offsetFrames}/${fps}s" duration="${durFrames}/${fps}s" start="0s"/>`
      );
    });

    // Total duration
    const totalFrames = Math.round(totalDur * fps);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat1080p${fps}" frameDuration="1/${fps}s" width="1920" height="1080" colorSpace="1-1-1 (Rec. 709)"/>
${assets.join("\n")}
  </resources>
  <library location="file:///suarik-export/">
    <event name="Suarik Export">
      <project name="Suarik — ${new Date().toLocaleDateString("pt-BR")}">
        <sequence format="r1" duration="${totalFrames}/${fps}s" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${clipEls.join("\n")}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;

    saveAs(new Blob([xml], { type: "application/xml;charset=utf-8" }), "suarik-timeline.fcpxml");
    fireToast("📦 FCPXML exportado — importa no Premiere via Arquivo → Importar");
  };

  // ── EDL export (CMX 3600 — compatível com DaVinci Resolve, Avid, Premiere) ──
  const downloadEDL = () => {
    const fps = 25;
    const pad2 = (n: number) => String(Math.floor(n)).padStart(2, "0");
    const toTC = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const f = Math.round((sec % 1) * fps);
      return `${pad2(h)}:${pad2(m)}:${pad2(s)}:${pad2(f)}`;
    };
    const lines: string[] = [
      `TITLE: Suarik Export — ${new Date().toLocaleDateString("pt-BR")}`,
      "FCM: NON-DROP FRAME",
      "",
    ];
    let editNum = 1;
    effectiveClips.forEach(clip => {
      if (!clip.url) return;
      const srcIn   = toTC(0);
      const srcOut  = toTC(clip.durSec);
      const recIn   = toTC(clip.startSec);
      const recOut  = toTC(clip.startSec + clip.durSec);
      const name    = clip.label.replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 32).padEnd(8);
      lines.push(`${String(editNum).padStart(3, "0")}  ${name}  V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}`);
      lines.push(`* FROM CLIP NAME: ${clip.label}`);
      lines.push(`* SOURCE URL: ${clip.url}`);
      lines.push("");
      editNum++;
    });
    saveAs(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }), "suarik-timeline.edl");
    fireToast("🎬 EDL exportado — compatível com DaVinci Resolve, Avid e Premiere");
  };

  // ── DaVinci Resolve XML (.drp-compatible XML) ─────────────────────────────
  const downloadDaVinci = () => {
    const fps = 25;
    let trackItems = "";
    effectiveClips.forEach((clip, i) => {
      if (!clip.url) return;
      const startF = Math.round(clip.startSec * fps);
      const endF   = Math.round((clip.startSec + clip.durSec) * fps);
      const durF   = endF - startF;
      trackItems += `
      <trackitem id="${i + 1}" masterclipid="mc${i + 1}" enabled="TRUE" start="${startF}" end="${endF}" in="0" out="${durF}">
        <name>${clip.label.replace(/[<>]/g, "")}</name>
        <file id="f${i + 1}">
          <name>${clip.label.replace(/[<>]/g, "")}</name>
          <pathurl>${clip.url}</pathurl>
          <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
          <duration>${durF}</duration>
          <mediatype>video</mediatype>
        </file>
        <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
      </trackitem>`;
    });
    const totalF = Math.round(totalDur * fps);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence>
    <name>Suarik — ${new Date().toLocaleDateString("pt-BR")}</name>
    <duration>${totalF}</duration>
    <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
    <media>
      <video>
        <track>${trackItems}
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;
    saveAs(new Blob([xml], { type: "application/xml;charset=utf-8" }), "suarik-timeline-resolve.xml");
    fireToast("🎬 XML exportado — importa no DaVinci via Arquivo → Importar Timeline");
  };

  const musicOptions:BackgroundTrack[]= tracks.length >= 3
    ? tracks.slice(0,5)
    : [
        ...tracks,
        ...Array.from({length:Math.max(0,3-tracks.length)},(_,i)=>({
          title:["Dark Tension Loop","Cinematic Suspense","Epic Orchestral"][i]??"Trilha",
          url:"",is_premium_vault:false,
        })),
      ];

  // ── Toast helper ─────────────────────────────────────────────────────────
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const fireToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const handleRaioX = useCallback((ad: WinningAd) => {
    fireToast(`🧬 A IA está analisando "${ad.title}"…`);
  }, [fireToast]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
    {/* ── Hidden background audio — emotion-driven music track ── */}
    {/* key forces remount when URL changes so the new track loads immediately */}
    <audio
      key={bgMusicUrl}
      ref={bgAudioRef}
      src={bgMusicUrl}
      loop preload="auto" style={{display:"none"}}
    />
    {/* ── TTS synthetic voice audio ── */}
    <audio ref={ttsAudioRef} preload="auto" style={{display:"none"}} />

    <style>{`
      @keyframes wsIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      @keyframes karaGlow{0%,100%{opacity:1}50%{opacity:0.75}}
      .ws-in{animation:wsIn .35s ease both}
      .v1clip:hover .v1clip-overlay{opacity:1!important}
      .v1clip-overlay{opacity:0;transition:opacity .15s ease}
      .ws-in ::-webkit-scrollbar{width:3px;height:3px}
      .ws-in ::-webkit-scrollbar-track{background:transparent}
      .ws-in ::-webkit-scrollbar-thumb{background:#1A1A1A;border-radius:2px}
      .ws-in ::-webkit-scrollbar-thumb:hover{background:#222}
    `}</style>
    <div className="ws-in"
      style={{background:"#060606",color:"#F5F3F0",fontFamily:"'Geist',sans-serif",display:"grid",gridTemplateRows:"42px 1fr 196px 28px",height:"100vh",overflow:"hidden"}}>

      {/* ══ TOPBAR (42px) ══════════════════════════════════════════════════ */}
      <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"0 12px",background:"#09090B",borderBottom:"1px solid #131313",flexShrink:0,overflow:"hidden",zIndex:20}}>
        {/* Left cluster: Back · Logo · Project */}
        <button onClick={onBack}
          style={{padding:"5px",borderRadius:"6px",color:"#7A7A7A",background:"transparent",border:"1px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",flexShrink:0,transition:"all .12s"}}
          onMouseEnter={e=>{e.currentTarget.style.background="#0F0F0F";e.currentTarget.style.color="#EAEAEA";}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#7A7A7A";}}
          title="Voltar ao início">
          <ArrowLeft style={{width:"14px",height:"14px"}}/>
        </button>
        <div style={{display:"flex",alignItems:"center",gap:"7px",paddingRight:"10px",borderRight:"1px solid #131313",flexShrink:0}}>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"15px",color:"#E8512A",letterSpacing:"1px"}}>SUARIK</span>
        </div>
        <span style={{fontSize:"12px",color:"#7A7A7A",flexShrink:0,maxWidth:"180px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {result.music_style||"Storyboard"}
        </span>
        <div style={{width:"1px",height:"14px",background:"#131313",flexShrink:0,marginLeft:"2px"}}/>
        {/* Status dot */}
        <div style={{display:"flex",alignItems:"center",gap:"5px",flexShrink:0}}>
          <div style={{width:"6px",height:"6px",borderRadius:"50%",background:"#3ECF8E",boxShadow:"0 0 6px #3ECF8E"}}/>
          <span style={{fontSize:"11px",color:"#444"}}>IA ativa</span>
        </div>

        {/* Center cluster: TC */}
        <div style={{flex:1,display:"flex",justifyContent:"center",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"11px",color:"#E8512A",fontWeight:600,letterSpacing:"0.04em",background:"rgba(232,81,42,0.07)",border:"1px solid rgba(232,81,42,0.16)",padding:"3px 9px",borderRadius:"12px",textTransform:"uppercase",display:"flex",alignItems:"center",gap:"5px"}}>
            <svg width="8" height="8" viewBox="0 0 10 10" fill="#E8512A" opacity="0.8"><polygon points="5,0 6.2,3.8 10,3.8 7,6.1 8.1,10 5,7.7 1.9,10 3,6.1 0,3.8 3.8,3.8"/></svg>
            Cena {activeScene+1} / {localDrScenes.length||localScenes.length}
          </span>
          <span style={{fontSize:"13px",fontWeight:600,color:"#EAEAEA",fontVariantNumeric:"tabular-nums",letterSpacing:"0.04em"}}>
            {fmtTime(currentTime)}
            <span style={{color:"#252525",margin:"0 4px"}}>/</span>
            <span style={{color:"#444",fontWeight:400}}>{fmtTime(totalDur)}</span>
          </span>
        </div>

        {/* Right cluster: Credits · v3 · Export · Premiere */}
        <div style={{display:"flex",alignItems:"center",gap:"4px",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:"4px",padding:"3px 8px",borderRadius:"6px",background:"#0F0F0F",border:"1px solid #131313"}}>
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" fill="#E8512A" opacity=".18"/><circle cx="7" cy="7" r="3" fill="#E8512A"/></svg>
            <span style={{fontSize:"11px",fontWeight:600,color:"#EAEAEA",fontVariantNumeric:"tabular-nums"}}>{(result as {credits_used?:number}).credits_used ?? "—"}</span>
            <span style={{fontSize:"10px",color:"#444"}}>/ 15k</span>
          </div>
          <button
            onMouseEnter={e=>{e.currentTarget.style.background="#0F0F0F";e.currentTarget.style.color="#EAEAEA";}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#7A7A7A";}}
            style={{padding:"5px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:500,color:"#7A7A7A",background:"transparent",border:"1px solid #1A1A1A",cursor:"pointer",transition:"all .12s"}}>
            v3
          </button>
          <div style={{position:"relative"}}>
            <button onClick={()=>setExportOpen(v=>!v)}
              onMouseEnter={e=>{e.currentTarget.style.background="#0F0F0F";e.currentTarget.style.color="#EAEAEA";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#7A7A7A";}}
              style={{display:"flex",alignItems:"center",gap:"4px",padding:"5px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:500,color:"#7A7A7A",background:"transparent",border:"1px solid #1A1A1A",cursor:"pointer",transition:"all .12s"}}>
              <Download style={{width:"11px",height:"11px"}}/>Exportar
              <ChevronUp style={{width:"10px",height:"10px",transform:exportOpen?"":"rotate(180deg)",transition:"transform .2s"}}/>
            </button>
            {exportOpen&&(
              <div style={{position:"absolute",top:"calc(100% + 4px)",right:0,width:"220px",background:"#0F0F0F",border:"1px solid #131313",borderRadius:"8px",overflow:"hidden",zIndex:50,boxShadow:"0 12px 28px rgba(0,0,0,0.6)"}}>
                {([
                  {label:"Premiere Pro / CapCut (.fcpxml)",icon:"🎬",paywall:false,action:downloadXML},
                  {label:"DaVinci Resolve (.xml)",icon:"🎞",paywall:false,action:downloadDaVinci},
                  {label:"EDL Universal (.edl)",icon:"📋",paywall:false,action:downloadEDL},
                  {label:"Legendas (.srt)",icon:"💬",paywall:false,action:downloadSRT},
                  {label:"Trilha de Fundo (.mp3)",icon:"🎵",paywall:false,action:downloadMusic},
                  {label:"Pack de Mídias",icon:"📦",paywall:false,action:downloadMediaPack},
                ] as {label:string;icon:string;paywall:boolean;action?:()=>void}[]).map(opt=>(
                  <button key={opt.label} onClick={()=>{setExportOpen(false);if(opt.paywall)setPaywallOpen(true);else opt.action?.();}}
                    onMouseEnter={e=>{e.currentTarget.style.background="#141414";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}
                    style={{width:"100%",display:"flex",alignItems:"center",gap:"10px",padding:"8px 12px",fontSize:"11px",textAlign:"left" as const,background:"transparent",border:"none",borderBottom:"1px solid #131313",color:"#EAEAEA",cursor:"pointer",transition:"background .12s"}}>
                    <span>{opt.icon}</span><span style={{flex:1}}>{opt.label}</span>
                    {opt.paywall&&<Lock style={{width:"10px",height:"10px",color:"#F5A623"}}/>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={downloadXML}
            onMouseEnter={e=>{e.currentTarget.style.background="#FF6B3D";}}
            onMouseLeave={e=>{e.currentTarget.style.background="#E8512A";}}
            style={{display:"flex",alignItems:"center",gap:"5px",padding:"5px 11px",borderRadius:"6px",fontSize:"11px",fontWeight:600,color:"#fff",background:"#E8512A",border:"1px solid #E8512A",cursor:"pointer",flexShrink:0,transition:"background .12s"}}>
            <FileCode2 style={{width:"11px",height:"11px"}}/>Premiere XML
          </button>
        </div>{/* end right cluster */}
      </div>{/* end topbar */}

      {/* ══ MAIN: 3 colunas ═════════════════════════════════════════════════ */}
      <div style={{display:"flex",overflow:"hidden",minHeight:0}}>

      {/* ══ COL 1: Roteiro (24%) ══════════════════════════════════════════ */}
      {/* ══ COL 1: Roteiro / Inspector ════════════════════════════════════ */}
      <div className="w-[24%] shrink-0 flex flex-col border-r overflow-hidden"
        style={{background:"#0a0a0a",borderColor:"rgba(255,255,255,0.05)"}}>

        {/* Header: tabs (botão voltar movido para o topbar) */}
        <div className="shrink-0 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <div className="flex items-center gap-2 px-3 pt-3 pb-0">
            {/* Tabs */}
            <div className="flex flex-1 gap-1">
              <button
                onClick={()=>setLeftTab("roteiro")}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${leftTab==="roteiro"?"text-white":"text-gray-500 hover:text-gray-300"}`}
                style={leftTab==="roteiro"?{background:"rgba(232,89,60,0.15)",border:"1px solid rgba(232,89,60,0.3)",color:"#FF7A5C"}:{border:"1px solid transparent"}}>
                Roteiro
              </button>
              <button
                onClick={()=>setLeftTab("inspector")}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all relative ${leftTab==="inspector"?"text-white":"text-gray-500 hover:text-gray-300"}`}
                style={leftTab==="inspector"?{background:"rgba(56,189,248,0.12)",border:"1px solid rgba(56,189,248,0.3)",color:"#38bdf8"}:{border:"1px solid transparent"}}>
                Inspector
                {selectedLayer&&leftTab!=="inspector"&&(
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sky-400"/>
                )}
              </button>
            </div>
          </div>
          <div className="px-4 pb-2 pt-1">
            <p className="text-[9px] text-gray-600">{localDrScenes.length||localScenes.length} cenas · {Math.round(totalDur)}s</p>
          </div>
        </div>

        {/* ── Conteúdo: Roteiro ── */}
        {leftTab==="roteiro"&&(<>
          <textarea value={editCopy} onChange={e=>setEditCopy(e.target.value)}
            className="flex-1 w-full bg-transparent text-[13px] text-gray-400 leading-relaxed px-4 py-4 resize-none focus:outline-none placeholder-gray-700"
            placeholder="Cole ou edite o roteiro aqui…" style={{fontFamily:"inherit"}}/>
          <div className="border-t shrink-0" style={{borderColor:"rgba(255,255,255,0.05)"}}>
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-bold">Cenas</p>
              {localDrScenes.length>0&&(
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{color:"#FF7A5C",background:"rgba(232,89,60,0.1)",border:"1px solid rgba(232,89,60,0.2)"}}>
                  IA · {localDrScenes.length} blocos
                </span>
              )}
            </div>
            <div className="overflow-y-auto max-h-[200px] px-2 pb-3 space-y-0.5">
              {localDrScenes.length>0
                ? localDrScenes.map((drs,i)=>{
                    const col=CLIP_COLS[i%CLIP_COLS.length];
                    return (
                    <button key={i} onClick={()=>seekToTime(sceneStarts[i]+0.01)}
                      className={`w-full flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${activeScene===i?"bg-orange-500/10 border border-orange-500/25":"hover:bg-white/4 border border-transparent"}`}>
                      <span className="text-[9px] font-black mt-0.5 shrink-0" style={{color:activeScene===i?"#FF7A5C":col}}>{String(i+1).padStart(2,"0")}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                            style={{background:`${col}22`,color:col,border:`1px solid ${col}44`}}>
                            {drs.emotion}
                          </span>
                          <span className="text-[8px] text-gray-500">{drs.duration.toFixed(1)}s</span>
                        </div>
                        <p className={`text-[11px] font-medium truncate ${activeScene===i?"text-orange-300":"text-gray-400"}`}>
                          {drs.textSnippet.slice(0,50)}{drs.textSnippet.length>50?"…":""}
                        </p>
                        <p className="text-[8px] text-gray-500 mt-0.5 truncate">🔍 {drs.searchQueries[0]}</p>
                      </div>
                    </button>
                  );})
                : localScenes.map((sc,i)=>(
                  <button key={i} onClick={()=>seekToTime(sceneStarts[i]+0.01)}
                    className={`w-full flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${activeScene===i?"bg-orange-500/10 border border-orange-500/25":"hover:bg-white/4 border border-transparent"}`}>
                    <span className="text-[9px] font-black mt-0.5 shrink-0" style={{color:activeScene===i?"#FF7A5C":CLIP_COLS[i%CLIP_COLS.length]}}>{String(i+1).padStart(2,"0")}</span>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-semibold truncate ${activeScene===i?"text-orange-300":"text-gray-400"}`}>{sc.segment}</p>
                      <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-1">{sc.text_chunk?.slice(0,55)??""}…</p>
                    </div>
                  </button>
                ))
              }
            </div>
            {/* + Adicionar cena */}
            <div className="px-2 pb-3 pt-1">
              <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold transition-all hover:bg-white/5"
                style={{border:"1px dashed rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.25)",background:"none",cursor:"pointer"}}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                Adicionar cena
              </button>
            </div>
          </div>
        </>)}

        {/* ── Conteúdo: Inspector ── */}
        {leftTab==="inspector"&&(()=>{
          // ── Quem está selecionado? ────────────────────────────────────
          const layerType =
            selectedLayer==="avatar"   ? "avatar"   :
            selectedLayer==="subtitle" ? "subtitle" :
            selectedLayer && effectiveClips.find(c=>c.id===selectedLayer) ? "broll" :
            null;
          const selClip = layerType==="broll" ? effectiveClips.find(c=>c.id===selectedLayer)! : null;

          // ── Transforms por layer ──────────────────────────────────────
          const brollT = selClip ? (clipTransforms[selClip.id]??{scale:100,x:0,y:0}) : {scale:100,x:0,y:0};
          const setBrollT = (p:Partial<{scale:number;x:number;y:number}>)=>{ if(!selClip)return; setClipTransforms(prev=>({...prev,[selClip.id]:{...brollT,...p}})); };
          const avT = avatarTransform;
          const setAvT = (p:Partial<typeof avT>)=>setAvatarTransform(prev=>({...prev,...p}));
          const sc = subtitleConfig;
          const setSc = (p:Partial<typeof sc>)=>setSubtitleConfig(prev=>({...prev,...p}));

          // ── Slider helper ─────────────────────────────────────────────
          const SR=({label,value,min,max,step,unit,color,onChange,onReset}:{label:string;value:number;min:number;max:number;step:number;unit:string;color:string;onChange:(v:number)=>void;onReset:()=>void})=>(
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">{label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-bold tabular-nums" style={{color}}>{value}{unit}</span>
                  <button onClick={onReset} className="text-gray-700 hover:text-gray-400 transition-colors text-[10px]">↺</button>
                </div>
              </div>
              <input type="range" min={min} max={max} step={step} value={value}
                className="w-full h-1" style={{accentColor:color}} onChange={e=>onChange(Number(e.target.value))}/>
              <div className="flex justify-between mt-0.5">
                <span className="text-[7px] text-gray-700">{min}{unit}</span>
                <span className="text-[7px] text-gray-700">{max}{unit}</span>
              </div>
            </div>
          );

          // ── Empty state ───────────────────────────────────────────────
          if(!layerType) return(
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5 text-center">
              <div className="grid grid-cols-3 gap-2 w-full">
                {[
                  {label:"AVATAR",layer:"avatar",color:"rgba(148,163,184,0.8)"},
                  {label:"SUB",layer:"subtitle",color:"rgba(234,179,8,0.8)"},
                  {label:"B-ROLL",layer:null,color:"rgba(232,89,60,0.8)"},
                ].map(({label,layer,color})=>(
                  <button key={label}
                    onClick={()=>{if(layer){setSelectedLayer(layer);}}}
                    className="py-3 rounded-xl flex flex-col items-center gap-1.5 transition-all hover:bg-white/4"
                    style={{border:"1px dashed rgba(255,255,255,0.08)",opacity:layer?1:0.4,cursor:layer?"pointer":"default"}}>
                    <span className="text-[8px] font-black tracking-widest" style={{color}}>{label}</span>
                    <span className="text-[7px] text-gray-700">{layer?"clique":"na timeline"}</span>
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-gray-700 leading-relaxed">Clique em uma camada<br/>na timeline para editar</p>
            </div>
          );

          return(
            <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.06) transparent"}}>
              <div className="px-4 pt-4 pb-5">

                {/* ── Header da layer selecionada ── */}
                <div className="flex items-center gap-2 mb-5 pb-3 border-b" style={{borderColor:"rgba(255,255,255,0.06)"}}>
                  <div className="w-1.5 h-6 rounded-full shrink-0" style={{
                    background: layerType==="avatar"?"#94a3b8": layerType==="subtitle"?"#eab308":"#e8593c"
                  }}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-white">
                      {layerType==="avatar"?"Avatar / A-Roll": layerType==="subtitle"?"Legendas": selClip?.label}
                    </p>
                    <p className="text-[8px] text-gray-600">
                      {layerType==="avatar"?"Vídeo base · escala e posição":
                       layerType==="subtitle"?"Estilo, posição e tamanho":
                       `${selClip!.startSec.toFixed(2)}s → ${(selClip!.startSec+selClip!.durSec).toFixed(2)}s`}
                    </p>
                  </div>
                  <button onClick={()=>setSelectedLayer(null)} className="text-gray-700 hover:text-gray-300 transition-colors text-[11px]">✕</button>
                </div>

                {/* ════ AVATAR ════ */}
                {layerType==="avatar"&&(<>
                  <SR label="Escala" value={avT.scale} min={10} max={500} step={5} unit="%" color="#94a3b8"
                    onChange={v=>setAvT({scale:v})} onReset={()=>setAvT({scale:100})}/>
                  <SR label="Posição X" value={avT.x} min={-100} max={100} step={1} unit="%" color="#94a3b8"
                    onChange={v=>setAvT({x:v})} onReset={()=>setAvT({x:0})}/>
                  <SR label="Posição Y" value={avT.y} min={-100} max={100} step={1} unit="%" color="#94a3b8"
                    onChange={v=>setAvT({y:v})} onReset={()=>setAvT({y:0})}/>
                  <button onClick={()=>setAvatarTransform({scale:100,x:0,y:0})}
                    className="w-full py-1.5 rounded-xl text-[9px] font-bold text-gray-600 hover:text-white transition-all mt-1"
                    style={{border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.02)"}}>
                    Resetar
                  </button>

                  {/* ── TTS — Voz Sintética ── */}
                  <div className="mt-4 pt-3" style={{borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                    <p className="text-[8px] font-black uppercase tracking-widest mb-2" style={{color:"#a78bfa"}}>
                      🎙 Voz Sintética (TTS)
                    </p>

                    {/* Voz */}
                    <p className="text-[8px] text-gray-500 uppercase tracking-wider mb-1">Voz</p>
                    <div className="flex gap-2 mb-2">
                      <select value={ttsVoice} onChange={e=>setTtsVoice(e.target.value)}
                        className="flex-1 text-[10px] text-zinc-300 px-2 py-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none"
                        style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}}>
                        {TTS_VOICES.map(v => (
                          <option key={v.id} value={v.id}>{v.lang} — {v.label} {v.gender === "M" ? "♂" : "♀"}</option>
                        ))}
                      </select>
                      <button
                        onClick={handlePreviewVoice}
                        disabled={previewLoading}
                        suppressHydrationWarning
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 disabled:opacity-40"
                        style={{background:"rgba(167,139,250,0.15)",border:"1px solid rgba(167,139,250,0.3)",color:"#a78bfa"}}>
                        {previewLoading ? "⏳" : "🔊"}
                      </button>
                    </div>
                    {previewError && <p className="text-[9px] text-red-400 mb-2" suppressHydrationWarning>{previewError}</p>}
                    {previewUrl && <audio ref={previewAudioRef} className="w-full mb-2 h-6" suppressHydrationWarning style={{opacity:0.7}} controls />}

                    {/* Velocidade */}
                    <SR label="Velocidade" value={Math.round(ttsSpeed*100)} min={50} max={200} step={5} unit="%" color="#a78bfa"
                      onChange={v=>setTtsSpeed(v/100)} onReset={()=>setTtsSpeed(1.0)}/>

                    {/* Erro */}
                    {ttsError&&(
                      <p className="text-[9px] text-red-400 mt-1 mb-1">{ttsError}</p>
                    )}

                    {/* Botão gerar */}
                    <button
                      onClick={()=>handleGenerateTTS(editCopy)}
                      disabled={ttsLoading||!editCopy.trim()}
                      className="w-full py-2 rounded-xl text-[10px] font-black transition-all mt-1 flex items-center justify-center gap-1.5 disabled:opacity-40"
                      style={{background:"rgba(167,139,250,0.15)",border:"1px solid rgba(167,139,250,0.3)",color:"#a78bfa"}}>
                      {ttsLoading
                        ? <><span className="w-3 h-3 rounded-full border border-violet-400 border-t-transparent animate-spin inline-block"/>Gerando voz...</>
                        : ttsAudioUrl ? "🔄 Regerar Voz" : "🎙 Gerar Voz"}
                    </button>

                    {/* Player inline */}
                    {ttsAudioUrl&&!ttsLoading&&(
                      <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg"
                        style={{background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.15)"}}>
                        <span className="text-[9px] text-violet-400 font-bold">✓ Voz gerada</span>
                        <a href={ttsAudioUrl} download="voz_tts.mp3"
                          className="ml-auto text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors underline">
                          baixar
                        </a>
                      </div>
                    )}
                  </div>
                </>)}

                {/* ════ LEGENDAS ════ */}
                {layerType==="subtitle"&&(<>
                  <div className="mb-4">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-2">Estilo</p>
                    <div className="grid grid-cols-2 gap-1">
                      {(["bold","minimal","neon","shadow"] as const).map(s=>(
                        <button key={s} onClick={()=>setSc({style:s})}
                          className="py-2 rounded-lg text-[9px] font-bold transition-all"
                          style={sc.style===s
                            ?{background:"rgba(234,179,8,0.15)",border:"1px solid rgba(234,179,8,0.4)",color:"#eab308"}
                            :{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",color:"#6b7280"}}>
                          {s==="bold"?"Bold":s==="minimal"?"Minimal":s==="neon"?"Neon":"Shadow"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-2">Posição na tela</p>
                    <div className="flex gap-1">
                      {([["top","Topo"],["center","Centro"],["bottom","Base"]] as const).map(([pos,lbl])=>(
                        <button key={pos} onClick={()=>setSc({position:pos})}
                          className="flex-1 py-2 rounded-lg text-[9px] font-bold transition-all"
                          style={sc.position===pos
                            ?{background:"rgba(234,179,8,0.15)",border:"1px solid rgba(234,179,8,0.4)",color:"#eab308"}
                            :{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",color:"#6b7280"}}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <SR label="Tamanho" value={sc.fontSize} min={50} max={200} step={5} unit="%" color="#eab308"
                    onChange={v=>setSc({fontSize:v})} onReset={()=>setSc({fontSize:100})}/>

                  {/* ── Color Rules ── */}
                  <div className="mt-4">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-2">Destaque de Palavras</p>
                    <div className="space-y-1.5 mb-2">
                      {sc.colorRules.map((rule,i)=>(
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                          <input type="color" value={rule.color}
                            onChange={e=>{const r=[...sc.colorRules];r[i]={...r[i],color:e.target.value};setSc({colorRules:r});}}
                            className="w-5 h-5 rounded cursor-pointer border-0 shrink-0" style={{padding:0,background:"none"}}/>
                          <input value={rule.pattern}
                            onChange={e=>{const r=[...sc.colorRules];r[i]={...r[i],pattern:e.target.value};setSc({colorRules:r});}}
                            placeholder="regex ou palavra"
                            className="flex-1 bg-transparent text-[9px] text-gray-300 font-mono focus:outline-none min-w-0"/>
                          <button onClick={()=>setSc({colorRules:sc.colorRules.filter((_,j)=>j!==i)})}
                            className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                            <X className="w-2.5 h-2.5"/>
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>setSc({colorRules:[...sc.colorRules,{pattern:"",color:"#FFFF00"}]})}
                      className="w-full py-1.5 rounded-lg text-[9px] font-bold transition-all"
                      style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",color:"#6b7280"}}>
                      + Adicionar regra
                    </button>
                  </div>
                </>)}

                {/* ════ B-ROLL ════ */}
                {layerType==="broll"&&(<>
                  <SR label="Escala" value={brollT.scale} min={10} max={500} step={5} unit="%" color="#e8593c"
                    onChange={v=>setBrollT({scale:v})} onReset={()=>setBrollT({scale:100})}/>
                  <SR label="Posição X" value={brollT.x} min={-100} max={100} step={1} unit="%" color="#e8593c"
                    onChange={v=>setBrollT({x:v})} onReset={()=>setBrollT({x:0})}/>
                  <SR label="Posição Y" value={brollT.y} min={-100} max={100} step={1} unit="%" color="#e8593c"
                    onChange={v=>setBrollT({y:v})} onReset={()=>setBrollT({y:0})}/>
                  <button
                    onClick={()=>setClipTransforms(prev=>{const n={...prev};if(selClip)delete n[selClip.id];return n;})}
                    className="w-full py-1.5 rounded-xl text-[9px] font-bold text-gray-600 hover:text-white transition-all mt-1"
                    style={{border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.02)"}}>
                    Resetar
                  </button>
                </>)}

              </div>
            </div>
          );
        })()}
      </div>

      {/* ══ COL 2: Player + Timeline (flex-1) ════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar — Pro Status */}
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0" style={{borderColor:"rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.3)"}}>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-all ${playing?"bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]":"bg-gray-600"}`}/>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{color:playing?"#ef4444":"#6b7280"}}>{playing?"REC":"IDLE"}</span>
            </div>
            <div className="w-px h-3.5 bg-white/8"/>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Cena {activeScene+1}/{localDrScenes.length||localScenes.length}</span>
            {currentClip&&<span className="text-[8px] text-gray-500 border border-white/8 px-1.5 py-0.5 rounded truncate max-w-[120px]">{currentClip.label}</span>}
            {selectedLayer&&(
              <>
                <div className="w-px h-3.5 bg-white/8"/>
                <span className="text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{
                    background:selectedLayer==="avatar"?"rgba(148,163,184,0.1)":selectedLayer==="subtitle"?"rgba(234,179,8,0.1)":"rgba(232,89,60,0.1)",
                    color:selectedLayer==="avatar"?"#94a3b8":selectedLayer==="subtitle"?"#eab308":"#e8593c",
                    border:`1px solid ${selectedLayer==="avatar"?"rgba(148,163,184,0.25)":selectedLayer==="subtitle"?"rgba(234,179,8,0.25)":"rgba(232,89,60,0.25)"}`,
                  }}>
                  ✦ {selectedLayer==="avatar"?"Avatar":selectedLayer==="subtitle"?"Legenda":"B-Roll"} selecionado
                </span>
                <button onClick={()=>setSelectedLayer(null)}
                  className="text-[8px] text-gray-700 hover:text-gray-400 transition-colors">
                  ESC
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-orange-400 font-bold tabular-nums tracking-tight">{fmtTime(currentTime)}<span className="text-gray-600 mx-0.5">/</span>{fmtTime(totalDur)}</span>
          </div>
        </div>

        {/* ── Video Player (NLE Monitor) ── */}
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div ref={previewRef}
            className={`relative rounded-xl overflow-hidden group mx-auto ${videoAspect==="portrait" ? "w-auto" : "w-full"}`}
            style={{
              aspectRatio: videoAspect==="portrait" ? "9/16" : "16/7.2",
              maxWidth:    videoAspect==="portrait" ? "260px" : "100%",
              background:"#000",
              border: selectedLayer
                ? `1px solid ${selectedLayer==="avatar"?"rgba(148,163,184,0.5)":selectedLayer==="subtitle"?"rgba(234,179,8,0.5)":"rgba(232,89,60,0.5)"}`
                : "1px solid rgba(255,255,255,0.07)",
              boxShadow: selectedLayer
                ? `0 0 0 2px ${selectedLayer==="avatar"?"rgba(148,163,184,0.12)":selectedLayer==="subtitle"?"rgba(234,179,8,0.1)":"rgba(232,89,60,0.1)"}`
                : "0 0 40px rgba(232,89,60,0.05)",
              cursor: selectedLayer && selectedLayer!=="subtitle" ? (previewDrag?"grabbing":"grab") : "pointer",
            }}
            onMouseDown={e=>{
              // If a moveable layer is selected, start preview drag instead of toggling play
              if(selectedLayer && selectedLayer!=="subtitle"){
                e.preventDefault();
                const origX = selectedLayer==="avatar"
                  ? avatarTransform.x
                  : (clipTransforms[selectedLayer]?.x??0);
                const origY = selectedLayer==="avatar"
                  ? avatarTransform.y
                  : (clipTransforms[selectedLayer]?.y??0);
                setPreviewDrag({startX:e.clientX,startY:e.clientY,origX,origY});
              }
            }}
            onClick={e=>{
              if(previewDraggedRef.current){ previewDraggedRef.current=false; return; }
              togglePlay();
            }}>

            {/* ═══ LAYER 0: Black fallback when AV hidden ═══ */}
            {!trackAVVisible && !uploadedVideoUrl && (
              <div className="absolute inset-0 bg-black"/>
            )}

            {/* ═══ LAYER 1: Avatar / A-Roll — the base (continuous) ═══ */}
            {uploadedVideoUrl ? (
              /* Real UGC video — onTimeUpdate drives the global timeline clock */
              <video
                ref={avatarVideoRef}
                src={uploadedVideoUrl}
                playsInline
                muted={trackAVMuted}
                onLoadedMetadata={handleAvatarMetadata}
                onTimeUpdate={handleAvatarTimeUpdate}
                className="absolute inset-0 w-full h-full transition-opacity duration-200"
                style={{
                  opacity: trackAVVisible ? 1 : 0,
                  objectFit: videoAspect==="portrait" ? "contain" : "cover",
                  background: "#000",
                  transformOrigin:"center center",
                  transform:`scale(${avatarTransform.scale/100}) translate(${avatarTransform.x}%,${avatarTransform.y}%)`,
                }}
              />
            ) : (
              /* No upload: show placeholder or thumb when no B-roll is active */
              !currentClip && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                  style={{background:"linear-gradient(135deg,#0e0e0e,#060606)"}}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{background:"rgba(100,116,139,0.1)",border:"1px solid rgba(100,116,139,0.2)"}}>
                    <Film className="w-5 h-5 text-gray-500"/>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium">Avatar / Locutor</p>
                </div>
              )
            )}

            {/* ═══ LAYER 2: B-Roll overlay — only when clip active + visible ═══ */}
            {trackBrollVisible && (
              videoUrl && !videoErrors[(currentClip?.id??"") + videoUrl] ? (
                // key = clipId + url — remounts element cleanly on swap, no glitch
                <video ref={videoRef} key={(currentClip?.id??"") + videoUrl} src={videoUrl}
                  loop muted playsInline preload="auto" crossOrigin="anonymous"
                  onLoadedMetadata={handleLoadedMetadata}
                  onError={()=>setVideoErrors(prev=>({...prev,[(currentClip?.id??"") + videoUrl]:true}))}
                  className="absolute inset-0 w-full h-full transition-opacity duration-300"
                  style={{
                    opacity: currentClip ? 1 : 0,
                    objectFit: videoAspect==="portrait" ? "contain" : "cover",
                    transformOrigin:"center center",
                    transform:(()=>{
                      const t=currentClip?clipTransforms[currentClip.id]:null;
                      if(!t)return undefined;
                      return `scale(${(t.scale??100)/100}) translate(${t.x??0}%,${t.y??0}%)`;
                    })(),
                  }}/>
              ) : currentClip?.thumb ? (
                /* Thumb-only B-roll — static image overlay during active clip */
                <div className={`absolute inset-0 transition-opacity duration-300 ${currentClip ? "opacity-100" : "opacity-0"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentClip.thumb} alt={currentClip.triggerWord??currentClip.label}
                    className="w-full h-full object-cover"
                    style={{filter:"brightness(0.72) saturate(1.15)"}}/>
                  <div className="absolute inset-0 pointer-events-none"
                    style={{background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.08) 2px,rgba(0,0,0,0.08) 4px)"}}/>
                  {currentClip.triggerWord&&(
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{background:"rgba(0,0,0,0.7)",border:"1px solid rgba(232,89,60,0.4)",backdropFilter:"blur(4px)"}}>
                      <span className="text-[9px] font-black uppercase tracking-wider" style={{color:"#FF7A5C"}}>
                        ⚡ {currentClip.triggerWord}
                      </span>
                    </div>
                  )}
                </div>
              ) : currentClip ? (
                /* Clip exists but no thumb/video — colored gradient placeholder */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 transition-opacity duration-300"
                  style={{background:`linear-gradient(135deg,${currentClip.color}18,#060606)`,opacity: currentClip ? 1 : 0}}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{background:`${currentClip.color}22`,border:`1px solid ${currentClip.color}44`}}>
                    <Film className="w-5 h-5" style={{color:currentClip.color}}/>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium">Sem mídia — passe o mouse no bloco e clique em 🔄</p>
                </div>
              ) : null
            )}

            {/* ═══ LAYER 3: "B-Roll OFF" badge when V2 is hidden ═══ */}
            {!trackBrollVisible && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full pointer-events-none"
                style={{background:"rgba(0,0,0,0.7)",border:"1px solid rgba(239,68,68,0.4)"}}>
                <EyeOff className="w-3 h-3" style={{color:"#f87171"}}/>
                <span className="text-[9px] font-black" style={{color:"#f87171"}}>B-Roll oculto</span>
              </div>
            )}

            {/* ── Subtitle Block — CapCut style: 4-word sliding window ── */}
            {subtitleWords.length>0&&activeWordIdx>=0&&(()=>{
              // ── Build a 4-word window centered on the active word ──
              // This works with BOTH Whisper real timestamps AND estimated DRS timing
              // because activeWordIdx is already found via binary search on currentTime.
              const CHUNK = 4;
              const allWords = subtitleWords.map((sw,i)=>({sw,gIdx:i}));

              // Split ALL words into fixed 4-word chunks
              const chunks: typeof allWords[] = [];
              for(let i=0; i<allWords.length; i+=CHUNK) chunks.push(allWords.slice(i,i+CHUNK));

              // Find chunk containing the active word
              const activeChunkIdx = chunks.findIndex(ch => ch.some(({gIdx})=>gIdx===activeWordIdx));
              const displayChunk = chunks[Math.max(0, activeChunkIdx)] ?? chunks[0];
              if(!displayChunk?.length) return null;

              const emotion = localDrScenes[activeScene]?.emotion ?? "";
              const accentColor =
                emotion==="CTA"||emotion==="Urgência"   ? "#FF3B3B"
                : emotion==="Revelação"||emotion==="Mistério" ? "#00FFCC"
                : emotion==="Oportunidade"||emotion==="Esperança" ? "#00FF88"
                : emotion==="Choque"||emotion==="Dor"   ? "#FF8C00"
                : "#FFFF00";

              // ── Apply subtitleConfig ─────────────────────────────────────
              const fs = subtitleConfig.fontSize / 100;
              const posClass =
                subtitleConfig.position==="top"    ? "top-8"    :
                subtitleConfig.position==="center" ? "top-1/2 -translate-y-1/2" :
                                                     "bottom-10";
              const boldStroke = "2px 2px 0 #000,-2px 2px 0 #000,2px -2px 0 #000,-2px -2px 0 #000,3px 0 0 #000,-3px 0 0 #000,0 3px 0 #000,0 -3px 0 #000";
              const getWordStyle = (isAct:boolean, isKw:boolean, wordColor:string):{[k:string]:string|number} => {
                const base = {
                  display:"inline-block" as const,
                  fontFamily:"'DM Sans','Arial Black',sans-serif",
                  fontWeight:900,
                  lineHeight:1.1,
                  letterSpacing:"-0.02em",
                  transition:"transform 0.06s ease,color 0.06s ease,text-shadow 0.06s ease",
                  transformOrigin:"center bottom",
                };
                const sz = isAct ? `clamp(${1.4*fs}rem,${4*fs}vw,${2.2*fs}rem)` : `clamp(${1.2*fs}rem,${3.5*fs}vw,${1.9*fs}rem)`;
                if(subtitleConfig.style==="minimal") return {...base, fontSize:sz, color:"#FFFFFF", textShadow:"1px 1px 3px rgba(0,0,0,0.9)", fontWeight:700, transform:isAct?"scale(1.06)":"scale(1)"};
                if(subtitleConfig.style==="shadow") return {...base, fontSize:sz, color:isKw?wordColor:"#FFFFFF", textShadow:"3px 4px 8px rgba(0,0,0,1),0 0 20px rgba(0,0,0,0.8)", transform:isAct?"scale(1.1) translateY(-2px)":"scale(1)"};
                if(subtitleConfig.style==="neon") return {...base, fontSize:sz, color:isKw?wordColor:isAct?"#fff":"rgba(255,255,255,0.85)", textShadow:isKw?`0 0 12px ${wordColor},0 0 30px ${wordColor},0 0 60px ${wordColor}66`:`0 0 10px rgba(255,255,255,0.5),0 0 20px rgba(255,255,255,0.2)`, transform:isAct?"scale(1.1) translateY(-2px)":"scale(1)", background:isAct&&!isKw?"rgba(255,255,255,0.08)":"transparent", borderRadius:"4px", padding:isAct?"0 3px":"0"};
                // bold (default)
                return {...base, fontSize:sz, color:isKw?wordColor:"#FFFFFF", textShadow:isKw?`${boldStroke},0 0 24px ${wordColor},0 0 48px ${wordColor}55`:boldStroke, transform:isAct?"scale(1.12) translateY(-2px)":"scale(1)", background:isAct&&!isKw?"rgba(255,255,0,0.18)":"transparent", borderRadius:isAct?"4px":"0", padding:isAct?"0 3px":"0"};
              };

              const isSubSel = selectedLayer==="subtitle";
              return (
                <div
                  className={`absolute left-0 right-0 flex justify-center px-6 ${posClass}`}
                  style={{pointerEvents:"auto",cursor:"pointer"}}
                  onClick={e=>{e.stopPropagation();setSelectedLayer(v=>v==="subtitle"?null:"subtitle");setLeftTab("inspector");}}>
                  <div className={`flex flex-wrap justify-center items-end rounded-lg transition-all ${isSubSel?"outline outline-2 outline-yellow-400/60 outline-offset-4":""}`}
                    style={{gap:"0 0.3em",maxWidth:"88%",padding:"2px 6px"}}>
                    {displayChunk.map(({sw,gIdx})=>{
                      const isAct     = gIdx===activeWordIdx;
                      const ruleColor = getWordRuleColor(sw.word);
                      const isKw      = (sw.isKeyword && isAct) || !!ruleColor;
                      const wordColor = ruleColor ?? accentColor;
                      return(
                        <span key={gIdx} style={getWordStyle(isAct,isKw,wordColor)}>{sw.word}</span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Selected layer indicator (top-left corner) ── */}
            {selectedLayer&&(
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg pointer-events-none z-30 select-none"
                style={{
                  background:"rgba(0,0,0,0.75)",
                  backdropFilter:"blur(6px)",
                  border:`1px solid ${selectedLayer==="avatar"?"rgba(148,163,184,0.4)":selectedLayer==="subtitle"?"rgba(234,179,8,0.4)":"rgba(232,89,60,0.4)"}`,
                }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{
                  background:selectedLayer==="avatar"?"#94a3b8":selectedLayer==="subtitle"?"#eab308":"#e8593c"
                }}/>
                <span className="text-[8px] font-black uppercase tracking-widest"
                  style={{color:selectedLayer==="avatar"?"#94a3b8":selectedLayer==="subtitle"?"#eab308":"#e8593c"}}>
                  {selectedLayer==="avatar"?"Avatar":selectedLayer==="subtitle"?"Legenda":"B-Roll"}
                </span>
                {selectedLayer!=="subtitle"&&(
                  <span className="text-[7px] text-gray-600 ml-0.5">· arraste para mover</span>
                )}
              </div>
            )}

            {/* Play overlay — hidden when a layer is selected (drag mode) */}
            {!selectedLayer&&(
              <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${playing?"opacity-0 group-hover:opacity-100":"opacity-100"}`}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{background:"rgba(232,89,60,0.12)",border:"1px solid rgba(232,89,60,0.35)",backdropFilter:"blur(4px)",boxShadow:"0 0 24px rgba(232,89,60,0.25)"}}>
                  {playing?<Pause className="w-5 h-5 text-orange-300" fill="currentColor"/>:<Play className="w-5 h-5 text-orange-300 ml-0.5" fill="currentColor"/>}
                </div>
              </div>
            )}

            {/* Transport HUD */}
            <div className="absolute bottom-0 left-0 right-0 px-4 py-2 flex items-center gap-3"
              style={{background:"linear-gradient(to top,rgba(0,0,0,0.9),transparent)"}}>
              <button onClick={e=>{e.stopPropagation();seekToTime(sceneStarts[Math.max(0,activeScene-1)]);}} title="Cena anterior (J)"><SkipBack className="w-4 h-4 text-white/50 hover:text-white transition-colors"/></button>
              <button onClick={e=>{e.stopPropagation();togglePlay();}} title="Play / Pause (Space)">
                {playing?<Pause className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor"/>:<Play className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor"/>}
              </button>
              <button onClick={e=>{e.stopPropagation();const sc=localDrScenes.length||localScenes.length;seekToTime(sceneStarts[Math.min(sc-1,activeScene+1)]);}} title="Próxima cena (L)"><SkipForward className="w-4 h-4 text-white/50 hover:text-white transition-colors"/></button>
              <span className="text-[7px] font-mono text-white/20 ml-1 hidden lg:inline" title="Atalhos: Space=Play ←→=Seek J/K/L=Nav M=Mute B=B-Roll">⌨</span>
              <div className="flex items-center gap-3 ml-auto" onClick={e=>e.stopPropagation()}>
                {/* Voz de Apoio toggle */}
                <button
                  onClick={()=>{
                    const next=!voiceEnabled;
                    setVoiceEnabled(next);
                    if(!next) cancelVoice();
                    else if(playing){
                      prevVoiceScene.current=activeScene;
                      speakText(localDrScenes[activeScene]?.textSnippet??currentSubtitle);
                    }
                  }}
                  title={voiceEnabled?"Voz de apoio: ON (clique para desligar)":"Voz de apoio: OFF (clique para ligar)"}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
                  style={{
                    background: voiceEnabled ? "rgba(232,89,60,0.12)" : "rgba(255,255,255,0.04)",
                    border:     `1px solid ${voiceEnabled ? "rgba(232,89,60,0.4)" : "rgba(255,255,255,0.1)"}`,
                    boxShadow:  voiceEnabled ? "0 0 10px rgba(232,89,60,0.2)" : "none",
                  }}>
                  <Mic className="w-3 h-3" style={{color: voiceEnabled ? "#FF7A5C" : "rgba(255,255,255,0.3)"}}/>
                  <span className="text-[8px] font-bold" style={{color: voiceEnabled ? "#FF7A5C" : "rgba(255,255,255,0.3)"}}>
                    {voiceEnabled ? "VOZ ON" : "VOZ"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Export bar row ── */}
        <div className="flex-1 min-h-0 flex flex-col px-3 pb-3 gap-2 justify-end">

          {/* Export bar */}
          <div className="flex items-center justify-between shrink-0 gap-2">
            <span className="text-[10px] text-gray-500">{timelineClips.length} clipes · {localDrScenes.length||localScenes.length} cenas · {result.music_style}</span>
            <div className="flex items-center gap-2">
              {/* Undo / Redo */}
              <button onClick={undo} disabled={!canUndo} title="Desfazer (⌘Z)"
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all border"
                style={{background:"rgba(255,255,255,0.03)",borderColor:"rgba(255,255,255,0.08)",color:canUndo?"#9ca3af":"#333",cursor:canUndo?"pointer":"not-allowed"}}>
                ↩
              </button>
              <button onClick={redo} disabled={!canRedo} title="Refazer (⌘⇧Z)"
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all border"
                style={{background:"rgba(255,255,255,0.03)",borderColor:"rgba(255,255,255,0.08)",color:canRedo?"#9ca3af":"#333",cursor:canRedo?"pointer":"not-allowed"}}>
                ↪
              </button>
              <div className="relative">
                <button onClick={()=>setExportOpen(v=>!v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all hover:bg-white/5"
                  style={{background:"rgba(255,255,255,0.03)",borderColor:"rgba(255,255,255,0.08)",color:"#9ca3af"}}>
                  <Download className="w-3.5 h-3.5"/>Exportar<ChevronUp className={`w-3 h-3 transition-transform ${exportOpen?"":"rotate-180"}`}/>
                </button>
                {exportOpen&&(
                  <div className="absolute bottom-full mb-2 right-0 w-52 rounded-xl overflow-hidden z-30"
                    style={{background:"#111",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 -20px 40px rgba(0,0,0,0.6)"}}>
                    {[
                      {label:"Premiere Pro / CapCut (.fcpxml)", icon:"🎬",paywall:false,action:downloadXML},
                      {label:"DaVinci Resolve (.xml)",          icon:"🎞",paywall:false,action:downloadDaVinci},
                      {label:"EDL Universal (.edl)",            icon:"📋",paywall:false,action:downloadEDL},
                      {label:"Legendas (.srt)",                 icon:"💬",paywall:false,action:downloadSRT},
                      {label:"Trilha de Fundo (.mp3)",          icon:"🎵",paywall:false,action:downloadMusic},
                      {label:"Pack de Mídias",                  icon:"📦",paywall:false,action:downloadMediaPack},
                    ].map(opt=>(
                      <button key={opt.label}
                        onClick={()=>{setExportOpen(false);if(opt.paywall)setPaywallOpen(true);else opt.action?.();}}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/6 transition-colors border-b last:border-0"
                        style={{borderColor:"rgba(255,255,255,0.05)"}}>
                        <span>{opt.icon}</span>
                        <span className="flex-1 text-gray-300">{opt.label}</span>
                        {opt.paywall&&<Lock className="w-3 h-3 text-amber-500"/>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={()=>setShowAdLib(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:bg-white/5"
                style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"#9ca3af"}}>
                <TrendingUp className="w-3.5 h-3.5"/>Biblioteca
              </button>
              <button onClick={downloadXML}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-80"
                style={{background:"linear-gradient(135deg,rgba(240,86,58,0.15),rgba(99,5,239,0.1))",border:"1px solid rgba(240,86,58,0.3)",color:"#F0563A"}}>
                <FileCode2 className="w-3.5 h-3.5"/>Premiere XML
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ COL 3: Mídias Sugeridas + Trilha (26%) ══════════════════════ */}
      <div className="w-[26%] shrink-0 flex flex-col border-l overflow-hidden"
        style={{background:"#0a0a0a",borderColor:"rgba(255,255,255,0.05)"}}>

        {/* ── Right Panel Tab Bar ── */}
        <div className="flex items-center gap-0 px-2 border-b shrink-0" style={{borderColor:"#131313",background:"#09090B",height:"36px"}}>
          {([
            {id:"broll",label:"B-Roll"},
            {id:"inspector",label:"Inspector"},
            {id:"audio",label:"Áudio"},
          ] as {id:"broll"|"inspector"|"audio";label:string}[]).map(tab=>{
            const active = rightTab===tab.id;
            return (
              <button key={tab.id} onClick={()=>setRightTab(tab.id)}
                className="relative px-3 h-full text-[11px] font-medium transition-colors"
                style={{
                  color: active ? "#EAEAEA" : "#7A7A7A",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}>
                {tab.label}
                {active && (
                  <div className="absolute bottom-0 left-2 right-2 h-px" style={{background:"#E8512A"}}/>
                )}
              </button>
            );
          })}
          <div className="flex-1"/>
          {rightTab==="broll" && (
            <span className="text-[9px] text-orange-400 font-bold flex items-center gap-1 pr-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"/>
              Cena {activeScene+1}/{localDrScenes.length||localScenes.length}
            </span>
          )}
        </div>

        {rightTab==="inspector" && (()=>{
          const layerType =
            selectedLayer==="avatar"   ? "avatar"   :
            selectedLayer==="subtitle" ? "subtitle" :
            selectedLayer && effectiveClips.find(c=>c.id===selectedLayer) ? "broll" :
            null;
          const selClip = layerType==="broll" ? effectiveClips.find(c=>c.id===selectedLayer)! : null;
          const avT = avatarTransform;
          const brollT = selClip ? (clipTransforms[selClip.id]??{scale:100,x:0,y:0}) : {scale:100,x:0,y:0};
          const sc = subtitleConfig;

          if(!layerType){
            return (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center gap-2" style={{color:"#7A7A7A"}}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{opacity:0.3}}>
                  <path d="M12 2l9 4.5v11L12 22l-9-4.5v-11L12 2z" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M12 2v20M3 6.5l18 11M21 6.5l-18 11" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
                </svg>
                <p className="text-[11px] font-medium">Inspector</p>
                <p className="text-[10px] leading-relaxed max-w-[200px]" style={{color:"#444"}}>
                  Selecione um clip, avatar ou legenda na timeline para ajustar propriedades.
                </p>
                <div className="grid grid-cols-3 gap-1.5 w-full mt-3">
                  {[
                    {label:"Avatar",layer:"avatar" as const,color:"#5A9ACA"},
                    {label:"Legenda",layer:"subtitle" as const,color:"#489880"},
                    {label:"B-Roll",layer:null,color:"#E8512A"},
                  ].map(({label,layer,color})=>(
                    <button key={label}
                      onClick={()=>{if(layer)setSelectedLayer(layer);}}
                      className="py-2.5 rounded-lg flex flex-col items-center gap-1 transition-all hover:bg-white/4"
                      style={{border:"1px dashed #131313",opacity:layer?1:0.4,cursor:layer?"pointer":"default"}}>
                      <div className="w-2 h-2 rounded-full" style={{background:color}}/>
                      <span className="text-[9px] font-medium" style={{color:"#7A7A7A"}}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          const accent = layerType==="avatar"?"#5A9ACA":layerType==="subtitle"?"#489880":"#E8512A";
          const Row = ({k,v}:{k:string;v:React.ReactNode})=>(
            <div className="flex items-center justify-between py-1.5 border-b" style={{borderColor:"#131313"}}>
              <span className="text-[10px]" style={{color:"#7A7A7A"}}>{k}</span>
              <span className="text-[10px] font-mono tabular-nums" style={{color:"#EAEAEA"}}>{v}</span>
            </div>
          );

          return (
            <div className="flex-1 overflow-y-auto p-3">
              {/* Header */}
              <div className="flex items-center gap-2 pb-3 mb-2 border-b" style={{borderColor:"#131313"}}>
                <div className="w-1.5 h-5 rounded-full shrink-0" style={{background:accent}}/>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate" style={{color:"#EAEAEA"}}>
                    {layerType==="avatar"?"Avatar / A-Roll":layerType==="subtitle"?"Legendas":selClip?.label}
                  </p>
                  <p className="text-[9px] truncate" style={{color:"#444"}}>
                    {layerType==="avatar"?"Vídeo base":
                     layerType==="subtitle"?"Estilo e posição":
                     selClip ? `${selClip.startSec.toFixed(2)}s → ${(selClip.startSec+selClip.durSec).toFixed(2)}s`:""}
                  </p>
                </div>
                <button onClick={()=>setSelectedLayer(null)}
                  className="text-[14px] leading-none p-1 transition-colors"
                  style={{color:"#444"}} title="Desselecionar">✕</button>
              </div>

              {/* Properties */}
              <div className="rounded-lg p-3 mb-2" style={{background:"#0F0F0F",border:"1px solid #131313"}}>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] mb-1.5" style={{color:"#7A7A7A"}}>Propriedades</p>
                {layerType==="avatar" && (<>
                  <Row k="Escala" v={`${avT.scale}%`}/>
                  <Row k="Posição X" v={`${avT.x}%`}/>
                  <Row k="Posição Y" v={`${avT.y}%`}/>
                </>)}
                {layerType==="broll" && selClip && (<>
                  <Row k="Início" v={`${selClip.startSec.toFixed(2)}s`}/>
                  <Row k="Duração" v={`${selClip.durSec.toFixed(2)}s`}/>
                  <Row k="Escala" v={`${brollT.scale}%`}/>
                  <Row k="Posição" v={`${brollT.x}, ${brollT.y}`}/>
                  <Row k="Mídia" v={selClip.url||selClip.thumb?"Definida":"Placeholder"}/>
                </>)}
                {layerType==="subtitle" && (<>
                  <Row k="Estilo" v={sc.style}/>
                  <Row k="Posição" v={sc.position==="top"?"Topo":sc.position==="center"?"Centro":"Base"}/>
                  <Row k="Tamanho" v={`${sc.fontSize}%`}/>
                  <Row k="Regras de cor" v={`${sc.colorRules.length}`}/>
                </>)}
              </div>

              <button onClick={()=>setLeftTab("inspector")}
                className="w-full py-2 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                style={{background:"rgba(232,81,42,0.08)",border:"1px solid rgba(232,81,42,0.25)",color:"#E8512A"}}>
                Editar no painel esquerdo →
              </button>
            </div>
          );
        })()}

        {rightTab==="audio" && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div className="rounded-lg p-3" style={{background:"#0F0F0F",border:"1px solid #131313"}}>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] mb-2" style={{color:"#7A7A7A"}}>Trilha de Fundo</p>
              <p className="text-[11px]" style={{color:"#EAEAEA"}}>{result.music_style || "Sem trilha"}</p>
            </div>
            <div className="rounded-lg p-3" style={{background:"#0F0F0F",border:"1px solid #131313"}}>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] mb-2" style={{color:"#7A7A7A"}}>Volumes</p>
              <div className="space-y-1.5 text-[10px]" style={{color:"#7A7A7A"}}>
                <div className="flex justify-between"><span>🎙️ Avatar</span><span style={{color:"#EAEAEA",fontFamily:"monospace"}}>{Math.round(avatarVolume*100)}%</span></div>
                <div className="flex justify-between"><span>🎵 Trilha</span><span style={{color:"#EAEAEA",fontFamily:"monospace"}}>{Math.round(bgVolume*100)}%</span></div>
                <div className="flex justify-between"><span>💥 SFX</span><span style={{color:"#EAEAEA",fontFamily:"monospace"}}>80%</span></div>
              </div>
            </div>
            <p className="text-[10px] leading-relaxed text-center px-2" style={{color:"#444"}}>
              Ajuste os faders no mixer abaixo da preview.
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto" style={{display:rightTab==="broll"?"block":"none"}}>

          {/* Alternatives — draggable to V1 */}
          <div className="p-3 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
              Alternativas · arraste para a timeline
            </p>
            {alternatives.length===0?(
              <p className="text-[10px] text-gray-500 py-3 text-center leading-relaxed">
                Passe o mouse em um bloco V1<br/>e clique em 🔄 para gerar alternativas
              </p>
            ):(
              <div className="grid grid-cols-2 gap-1.5">
                {alternatives.slice(0,6).map((opt,i)=>{
                  const altKey   = `${activeScene}-${i}`;
                  const isHovered= hoveredAltKey === altKey;
                  const altThumb = opt.thumb ?? GALLERY_CARDS[(activeScene*3+i) % GALLERY_CARDS.length].src;
                  return (
                  <div key={i}
                    className="relative rounded-lg overflow-hidden cursor-grab active:cursor-grabbing group/drag"
                    style={{aspectRatio:"16/9",border:`1px solid ${isHovered?"rgba(232,89,60,0.4)":"rgba(255,255,255,0.08)"}`}}
                    draggable
                    onDragStart={()=>setDragSrcUrl(opt.url)}
                    onDragEnd={()=>setDragSrcUrl(null)}
                    onMouseEnter={()=>setHoveredAltKey(altKey)}
                    onMouseLeave={()=>setHoveredAltKey(null)}>
                    {/* Thumbnail — hidden while hovering */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={altThumb} alt={`Alt ${i+1}`}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${isHovered?"opacity-0":"opacity-70"}`}
                      loading="lazy"/>
                    {/* Video preview — plays on hover */}
                    {opt.url && (
                      <video
                        src={isHovered ? opt.url : undefined}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${isHovered?"opacity-100":"opacity-0"}`}
                        autoPlay loop muted playsInline crossOrigin="anonymous"
                        onError={e=>{(e.currentTarget as HTMLVideoElement).style.display="none";}}
                      />
                    )}
                    {/* Overlay on hover */}
                    <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity gap-0.5 ${isHovered?"opacity-100":"opacity-0"}`}
                      style={{background:"rgba(0,0,0,0.35)"}}>
                      <GripVertical className="w-4 h-4 text-white/80"/>
                      <span className="text-[8px] text-white font-bold">Arrastar</span>
                    </div>
                    <button onClick={()=>{const cl=effectiveClips.find(c=>c.sceneIdx===activeScene);if(cl)handleDropOnClip(cl.id,opt.url,opt.thumb);}}
                      className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold text-white transition-opacity ${isHovered?"opacity-100":"opacity-0"}`}
                      style={{background:"rgba(232,89,60,0.9)"}}>
                      Usar
                    </button>
                    <div className="absolute top-1 left-1 px-1 py-0.5 rounded text-[7px] font-black text-white/60" style={{background:"rgba(0,0,0,0.6)"}}>Alt {i+1}</div>
                  </div>
                )})}
              </div>
            )}
          </div>

          {/* B-Rolls / Visual Concepts per scene */}
          <div className="p-3 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
              {localDrScenes.length>0?"Conceitos Visuais · IA":"B-Rolls por Cena"}
            </p>
            <div className="space-y-2">
              {(localDrScenes.length>0?localDrScenes:localScenes).map((_row,i)=>{
                const col=CLIP_COLS[i%CLIP_COLS.length];
                const isAct=activeScene===i;
                // DRS mode: show concept thumbnail + searchQuery
                if(localDrScenes.length>0){
                  const drs=localDrScenes[i];
                  const thumb=lookupConcept(drs.searchQueries[0]);
                  return(
                  <div key={i} className={`rounded-xl overflow-hidden border transition-all ${isAct?"border-orange-500/40":"border-transparent"}`}
                    style={{background:"rgba(255,255,255,0.025)"}}>
                    <div className="flex gap-2 p-2.5">
                      <div className="w-16 h-10 rounded-lg shrink-0 overflow-hidden relative"
                        style={{border:`1px solid ${col}44`}}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumb} alt={drs.emotion} className="w-full h-full object-cover opacity-85" loading="lazy"/>
                        <div className="absolute bottom-0.5 right-0.5 text-[7px] font-black px-1 rounded" style={{background:col+"aa",color:"#fff"}}>{i+1}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[7px] font-black uppercase px-1 py-0.5 rounded"
                            style={{background:`${col}22`,color:col}}>{drs.emotion}</span>
                          <span className="text-[7px] text-gray-500">{drs.duration.toFixed(1)}s</span>
                        </div>
                        {drs.searchQueries.map((q,qi)=>(
                          <p key={qi} className="text-[8px] truncate" style={{color:qi===0?"#9ca3af":"#4b5563"}}>
                            {qi===0?"🎯":"  ·"} {q}
                          </p>
                        ))}
                        {drs.suggestedSfx&&(
                          <p className="text-[7px] mt-0.5 text-gray-500">⚡ sfx: {drs.suggestedSfx}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex border-t" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                      <button onClick={()=>{const cl=effectiveClips.find(c=>c.sceneIdx===i);if(cl)suggestAnother(cl.id);}}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] text-gray-400 hover:text-orange-400 transition-colors border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                        <RefreshCw className="w-2.5 h-2.5"/>Sugerir Vídeo
                      </button>
                      <button onClick={()=>setPaywallOpen(true)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] text-gray-400 hover:text-orange-400 transition-colors">
                        <Download className="w-2.5 h-2.5"/>Baixar
                      </button>
                    </div>
                  </div>
                  );
                }
                // Legacy Scene mode
                const sc=localScenes[i];
                const vid=sc.video_url??sc.video_options?.[0]?.url;
                return(
                  <div key={i} className={`rounded-xl overflow-hidden border transition-all ${isAct?"border-orange-500/40":"border-transparent"}`}
                    style={{background:"rgba(255,255,255,0.025)"}}>
                    <div className="flex gap-2 p-2.5">
                      <div className="w-16 h-10 rounded-lg shrink-0 overflow-hidden relative"
                        style={{background:`${col}18`,border:`1px solid ${col}33`}}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getSceneThumb(sc, i)} alt={sc.segment} className="w-full h-full object-cover opacity-85" loading="lazy"/>
                        <div className="absolute bottom-0.5 right-0.5 text-[7px] font-black px-1 rounded" style={{background:col+"aa",color:"#fff"}}>{i+1}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-gray-300 truncate">{sc.segment}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-1">{sc.broll_search_keywords??sc.vault_category??"Pexels HD"}</p>
                        <p className="text-[9px] mt-0.5" style={{color:col+"cc"}}>{sc.estimated_duration_seconds??5}s</p>
                      </div>
                    </div>
                    <div className="flex border-t" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                      <button onClick={()=>{const cl=effectiveClips.find(c=>c.sceneIdx===i);if(cl)suggestAnother(cl.id);}}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] text-gray-400 hover:text-orange-400 transition-colors border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                        <RefreshCw className="w-2.5 h-2.5"/>Sugerir
                      </button>
                      <button onClick={()=>{if(vid)window.open(vid,"_blank");else setPaywallOpen(true);}}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] text-gray-400 hover:text-orange-400 transition-colors">
                        <Download className="w-2.5 h-2.5"/>Baixar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── SFX Sugeridos ── */}
          <div className="p-3 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-bold">SFX · Pontuação</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{color:"#FF7A5C",background:"rgba(232,89,60,0.1)",border:"1px solid rgba(232,89,60,0.25)"}}>
                {sfxMarkers.length} eventos
              </span>
            </div>

            {sfxMarkers.length===0?(
              <p className="text-[10px] text-gray-500 py-3 text-center">Nenhuma keyword detectada na copy</p>
            ):(
              <div className="space-y-1 max-h-[220px] overflow-y-auto pr-0.5">
                {sfxMarkers.map(marker=>{
                  const isActive=Math.abs(currentTime-marker.timeSec)<0.5;
                  return (
                    <div key={marker.id}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all ${isActive?"border-orange-500/30":"border-transparent"}`}
                      style={{
                        border:`1px solid`,
                        borderColor:isActive?"rgba(232,89,60,0.3)":"transparent",
                        background:isActive?"rgba(232,89,60,0.06)":"rgba(255,255,255,0.025)",
                        boxShadow:isActive?`0 0 12px rgba(232,89,60,0.1)`:"none",
                      }}>

                      {/* Play preview via Web Audio */}
                      <button onClick={()=>playSFXPreview(marker)}
                        className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all hover:scale-110"
                        style={{background:"rgba(232,89,60,0.1)",border:"1px solid rgba(232,89,60,0.3)"}}>
                        <Play className="w-2 h-2 text-orange-400 ml-0.5" fill="currentColor"/>
                      </button>

                      {/* Icon bubble */}
                      <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                        style={{background:"#27272a",border:`1px solid ${marker.color}55`}}>
                        {marker.kind==="zap"
                          ?<Zap     className="w-2.5 h-2.5" style={{color:marker.color}}/>
                          :<Volume2 className="w-2.5 h-2.5" style={{color:marker.color}}/>
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold truncate" style={{color:isActive?"#FF7A5C":"#d1d5db"}}>{marker.label}</p>
                        <p className="text-[8px] text-gray-500 mt-0.5">
                          {fmtTime(marker.timeSec)}
                          {marker.keyword?<span className="text-gray-400"> · "{marker.keyword}"</span>:<span className="text-gray-500"> · transição</span>}
                        </p>
                      </div>

                      {/* Seek to */}
                      <button onClick={()=>seekToTime(marker.timeSec)}
                        className="text-[10px] font-black text-gray-500 hover:text-orange-400 transition-colors shrink-0"
                        title="Ir para este momento">→</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trilha Sonora */}
          <div className="p-3">
            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">Trilha Sonora</p>
            <div className="space-y-2">
              {musicOptions.map((track,i)=>{
                const isSel=selectedMusic===i;const isPlay=playingMusic===i;
                return(
                  <div key={i} className={`rounded-xl p-2.5 border transition-all cursor-pointer ${isSel?"border-orange-500/35":"border-transparent"}`}
                    style={{background:isSel?"rgba(232,89,60,0.07)":"rgba(255,255,255,0.025)"}} onClick={()=>{ setSelectedMusic(i); if(track.url) setBgMusicUrl(track.url); }}>
                    <div className="flex items-center gap-2">
                      <button onClick={e=>{e.stopPropagation();toggleMusic(i);}}
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                        style={{background:isPlay?"rgba(232,89,60,0.3)":"rgba(255,255,255,0.06)",border:"1px solid rgba(232,89,60,0.3)"}}>
                        {isPlay?<Pause className="w-3 h-3 text-orange-400" fill="currentColor"/>:<Play className="w-3 h-3 text-orange-400 ml-0.5" fill="currentColor"/>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-semibold truncate ${isSel?"text-orange-300":"text-gray-400"}`}>{track.title}</p>
                        <p className="text-[8px] text-gray-500">{track.is_premium_vault?"💎 Vault":"🎵 Curada por IA"}</p>
                      </div>
                      {isSel&&<Check className="w-3 h-3 text-orange-400 shrink-0"/>}
                    </div>
                    <div className="mt-1.5 flex items-end gap-px h-3 overflow-hidden rounded">
                      {Array.from({length:40}).map((_,j)=>(
                        <div key={j} className="flex-1 rounded-full"
                          style={{height:`${20+Math.abs(Math.sin((j+i*7)*0.9)*Math.cos((j+i*3)*0.7))*80}%`,background:isSel?"rgba(232,89,60,0.5)":"rgba(255,255,255,0.07)"}}/>
                      ))}
                    </div>
                    {track.url&&<audio ref={musicRefs[i]} src={track.url} loop preload="none"/>}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button onClick={downloadMusic}
                className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-bold border transition-all hover:bg-white/6"
                style={{borderColor:"rgba(255,255,255,0.07)",color:"#6b7280"}}>
                <Download className="w-2.5 h-2.5"/>Download
              </button>
              <button onClick={()=>setPaywallOpen(true)}
                className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-bold border transition-all hover:border-orange-500/40"
                style={{borderColor:"rgba(232,89,60,0.3)",color:"#FF7A5C",background:"rgba(232,89,60,0.06)"}}>
                <RefreshCw className="w-2.5 h-2.5"/>Trocar
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>{/* end MAIN: 3 colunas */}
      {/* ══ BOTTOM PANEL: AI Strip + Mixer + Timeline (196px full-width) ══ */}
      <div style={{height:"196px",display:"flex",flexDirection:"column",background:"#09090B",borderTop:"1px solid #131313",overflow:"hidden"}}>
        {/* ── AI Suggestion Strip ── */}
        <div className="px-3.5 py-1.5 shrink-0 flex items-center gap-2"
          style={{background:"rgba(155,143,248,0.08)",borderTop:"1px solid rgba(155,143,248,0.2)",borderBottom:"1px solid #131313"}}>
          <div className="flex items-center justify-center shrink-0" style={{width:"16px",height:"16px",borderRadius:"50%",background:"rgba(155,143,248,0.2)"}}>
            <span style={{fontSize:"9px",color:"#B8B0F8"}}>✦</span>
          </div>
          <span style={{fontSize:"11px",color:"#7A7A7A",flex:1,lineHeight:"1.4"}}>
            <strong style={{color:"#B8B0F8",fontWeight:500}}>Sugestão IA:</strong> adicione um B-roll de transição na cena {activeScene+1} para aumentar a retenção
          </span>
          <button style={{fontSize:"10px",color:"#B8B0F8",background:"transparent",border:"1px solid rgba(155,143,248,0.2)",borderRadius:"8px",padding:"3px 10px",cursor:"pointer",flexShrink:0,transition:"background .12s"}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(155,143,248,0.08)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            Aplicar
          </button>
          <button style={{fontSize:"12px",color:"#444",background:"none",border:"none",cursor:"pointer",flexShrink:0,lineHeight:1,padding:"2px 4px"}}>✕</button>
        </div>

        {/* ── Audio Mixer ── */}
        <div className="px-3.5 py-1.5 shrink-0 flex items-center gap-4"
          style={{background:"#09090B",borderTop:"1px solid #131313",borderBottom:"1px solid #131313"}}>
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-500 shrink-0">Mixer</span>
          {/* 🎙️ Avatar fader */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[10px] shrink-0">🎙️</span>
            <span className="text-[9px] font-bold text-gray-500 shrink-0 w-10">Avatar</span>
            <div className="relative flex-1 h-[2px] rounded-full cursor-pointer" style={{background:"#1A1A1A"}}>
              <div className="absolute left-0 top-0 h-full rounded-full pointer-events-none transition-all"
                style={{width:`${avatarVolume*100}%`,background:"linear-gradient(90deg,#FF7A5C,#E8593C)"}}/>
              <input type="range" min="0" max="1" step="0.01" value={avatarVolume}
                onChange={e=>{
                  const v=+e.target.value; setAvatarVolume(v);
                  if(avatarVideoRef.current) avatarVideoRef.current.volume=v;
                  if(v===0) setTrackAVMuted(true); else if(trackAVMuted) setTrackAVMuted(false);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
            </div>
            <span className="text-[9px] font-mono text-gray-500 w-6 text-right shrink-0">{Math.round(avatarVolume*100)}</span>
          </div>
          <div className="w-px h-4 shrink-0" style={{background:"rgba(255,255,255,0.07)"}}/>
          {/* 🎵 Trilha fader */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[10px] shrink-0">🎵</span>
            <span className="text-[9px] font-bold text-gray-500 shrink-0 w-10">Trilha</span>
            <div className="relative flex-1 h-[2px] rounded-full cursor-pointer" style={{background:"#1A1A1A"}}>
              <div className="absolute left-0 top-0 h-full rounded-full pointer-events-none transition-all"
                style={{width:`${bgVolume*100}%`,background:"linear-gradient(90deg,#FF7A5C,#E8593C)"}}/>
              <input type="range" min="0" max="1" step="0.01" value={bgVolume}
                onChange={e=>{
                  const v=+e.target.value; setBgVolume(v);
                  if(bgAudioRef.current) bgAudioRef.current.volume=v;
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
            </div>
            <span className="text-[9px] font-mono text-gray-500 w-6 text-right shrink-0">{Math.round(bgVolume*100)}</span>
          </div>
          <div className="w-px h-4 shrink-0" style={{background:"rgba(255,255,255,0.07)"}}/>
          {/* 💥 SFX fader */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[10px] shrink-0">💥</span>
            <span className="text-[9px] font-bold text-gray-500 shrink-0 w-10">SFX</span>
            <div className="relative flex-1 h-[2px] rounded-full cursor-pointer" style={{background:"#1A1A1A"}}>
              <div className="absolute left-0 top-0 h-full rounded-full pointer-events-none transition-all"
                style={{width:"80%",background:"linear-gradient(90deg,#a78bfa,#7c3aed)"}}/>
              <input type="range" min="0" max="1" step="0.01" defaultValue="0.8"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
            </div>
            <span className="text-[9px] font-mono text-gray-500 w-6 text-right shrink-0">80</span>
          </div>
        </div>

        {/* ── Timeline (extracted) ── */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col"
            style={{background:"#09090B"}}>

            {/* ── Timeline Toolbar ── */}
            <div className="flex items-center gap-1 px-2.5 border-b shrink-0"
              style={{borderColor:"#131313",background:"#0F0F0F",height:"30px"}}>

              {/* Tool buttons: Selecionar / Corte / Slip */}
              {([
                {id:"select" as const,label:"◱",title:"Selecionar (V)"},
                {id:"cut"    as const,label:"✂",title:"Corte (C)"},
                {id:"slip"   as const,label:"⇄",title:"Slip (Y)"},
              ]).map(tool=>{
                const active = timelineTool===tool.id;
                return (
                  <button key={tool.id} title={tool.title} onClick={()=>setTimelineTool(tool.id)}
                    className="flex items-center justify-center transition-colors"
                    style={{
                      width:"22px",height:"22px",borderRadius:"4px",
                      background: active ? "#1A1A1A" : "transparent",
                      border: active ? "1px solid #222" : "1px solid transparent",
                      color: active ? "#EAEAEA" : "#444",
                      fontSize:"11px",cursor:"pointer",
                    }}>
                    {tool.label}
                  </button>
                );
              })}

              <div className="w-px h-[14px] mx-1 shrink-0" style={{background:"#131313"}}/>

              {/* Snap toggle — real switch */}
              <button onClick={()=>setSnapOn(v=>!v)} title="Snap ao grid (S)"
                className="flex items-center gap-1.5 px-1.5 h-[22px] rounded transition-colors"
                style={{background:"transparent",border:"none",cursor:"pointer"}}>
                <span className="text-[10px]" style={{color:"#7A7A7A"}}>Snap</span>
                <div className="relative" style={{
                  width:"24px",height:"13px",borderRadius:"7px",
                  background: snapOn ? "#E8512A" : "#1A1A1A",
                  transition:"background .15s",
                }}>
                  <div style={{
                    position:"absolute",top:"2px",
                    [snapOn?"right":"left"]:"2px",
                    width:"9px",height:"9px",borderRadius:"50%",
                    background:"#fff",transition:"all .15s",
                  } as React.CSSProperties}/>
                </div>
              </button>

              <div className="flex-1"/>

              {/* Zoom cluster */}
              <button onClick={()=>setTimelineZoom(z=>Math.max(0.25,z*0.75))}
                title="Zoom out"
                className="flex items-center justify-center transition-colors"
                style={{width:"18px",height:"18px",borderRadius:"3px",background:"#141414",border:"1px solid #131313",color:"#7A7A7A",fontSize:"10px",cursor:"pointer"}}>
                −
              </button>
              <span className="text-[10px] tabular-nums text-center" style={{color:"#EAEAEA",minWidth:"34px"}}>
                {Math.round(timelineZoom*100)}%
              </span>
              <button onClick={()=>setTimelineZoom(z=>Math.min(8,z*1.33))}
                title="Zoom in"
                className="flex items-center justify-center transition-colors"
                style={{width:"18px",height:"18px",borderRadius:"3px",background:"#141414",border:"1px solid #131313",color:"#7A7A7A",fontSize:"10px",cursor:"pointer"}}>
                +
              </button>
              <button onClick={()=>setTimelineZoom(1)} title="Fit (0)"
                className="flex items-center justify-center transition-colors ml-1"
                style={{height:"18px",padding:"0 7px",borderRadius:"3px",background:"#141414",border:"1px solid #131313",color:"#7A7A7A",fontSize:"9px",fontWeight:600,letterSpacing:"0.04em",cursor:"pointer"}}>
                FIT
              </button>

              <div className="w-px h-[14px] mx-1 shrink-0" style={{background:"#131313"}}/>

              <span className="text-[10px] shrink-0" style={{color:"#444"}}>
                {timelineClips.length} clips · {localDrScenes.length||localScenes.length} cenas
              </span>
            </div>

            {/* Scrollable outer wrapper */}
            <div ref={timelineScrollRef}
              className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden"
              style={{scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.1) transparent"}}
              onWheel={handleTimelineWheel}>

            {/* Fixed-width canvas — grows with video duration + zoom */}
            <div ref={timelineRef}
              className="relative select-none h-full"
              style={{
                width: `${Math.max(640, totalDur * 28 * timelineZoom)}px`,
                cursor:isDragging?"col-resize":"crosshair",
              }}
              onMouseDown={handleTimelineMouseDown}>

              {/* Ruler */}
              <div className="flex h-5 border-b sticky top-0 z-10" style={{background:"#080808",borderColor:"rgba(255,255,255,0.05)"}}>
                <div className="w-[72px] shrink-0 border-r" style={{borderColor:"rgba(255,255,255,0.05)"}}/>
                <div className="flex-1 relative">
                  {Array.from({length:Math.ceil(totalDur/5)+1}).map((_,i)=>(
                    <div key={i} className="absolute flex flex-col items-center" style={{left:`${(i*5/totalDur)*100}%`}}>
                      <div className="w-px h-2 mt-0.5" style={{background:"rgba(255,255,255,0.1)"}}/>
                      <span className="text-[7px] font-mono text-gray-500">{fmtTime(i*5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ TRILHA AV — Avatar / A-Roll ══ */}
              <div className="flex border-b" style={{borderColor:"#131313"}}>
                <div className="w-[72px] shrink-0 flex items-center justify-between border-r gap-1 px-2"
                  style={{borderColor:"#131313",background:selectedLayer==="avatar"?"rgba(148,163,184,0.07)":"rgba(148,163,184,0.02)"}}>
                  <span className="text-[8px] font-black tracking-widest"
                    style={{color:selectedLayer==="avatar"?"rgba(148,163,184,1)":trackAVVisible?"rgba(148,163,184,0.6)":"rgba(148,163,184,0.2)"}}>AVATAR</span>
                  <div className="flex items-center gap-0.5">
                    <button title={trackAVVisible?"Ocultar":"Mostrar"} onClick={e=>{e.stopPropagation();setTrackAVVisible(v=>!v)}}
                      className="p-0.5 rounded transition-colors hover:bg-white/8">
                      {trackAVVisible?<Eye className="w-2.5 h-2.5 text-slate-500"/>:<EyeOff className="w-2.5 h-2.5 text-red-500/60"/>}
                    </button>
                    <button title={trackAVMuted?"Desmutar":"Mutar"} onClick={e=>{e.stopPropagation();setTrackAVMuted(m=>!m)}}
                      className="p-0.5 rounded transition-colors hover:bg-white/8">
                      {trackAVMuted?<VolumeX className="w-2.5 h-2.5 text-red-500/60"/>:<Volume2 className="w-2.5 h-2.5 text-slate-500"/>}
                    </button>
                  </div>
                </div>
                <div className="flex-1 relative h-[30px] flex items-center px-1 cursor-pointer"
                  onClick={()=>{setSelectedLayer(v=>v==="avatar"?null:"avatar");setLeftTab("inspector");}}>
                  <div className="absolute left-1 right-1 top-1 bottom-1 rounded-md overflow-hidden transition-all duration-150"
                    style={{
                      background: selectedLayer==="avatar" ? "rgba(148,163,184,0.1)" : "rgba(100,116,139,0.08)",
                      border: `1px solid rgba(148,163,184,${selectedLayer==="avatar"?0.4:0.15})`,
                      opacity: trackAVVisible ? 1 : 0.25,
                      boxShadow: selectedLayer==="avatar" ? "0 0 0 1px rgba(148,163,184,0.2)" : "none",
                    }}>
                    <div className="absolute inset-0 flex items-center gap-px px-1">
                      {Array.from({length:90}).map((_,i)=>(
                        <div key={i} className="flex-1 rounded-full"
                          style={{background:"rgba(148,163,184,0.3)",height:`${18+Math.abs(Math.sin(i*1.3)*Math.cos(i*0.4))*64}%`}}/>
                      ))}
                    </div>
                    <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                      <span className="text-[7px] font-black select-none text-slate-500/50">
                        {uploadedVideoUrl?"Avatar UGC":"Avatar / Locutor"} · {Math.round(totalDur)}s
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ TRILHA V2 — B-Roll (clips coloridos sobre o avatar, com gaps) ══ */}
              <div className="flex border-b" style={{borderColor:"#131313"}}>
                {/* Track Header — V2 */}
                <div className="w-[72px] h-[60px] shrink-0 flex flex-col items-start justify-center border-r gap-1 px-2"
                  style={{borderColor:"#131313",background:"rgba(232,89,60,0.03)"}}>
                  <span className="text-[10px] font-black tracking-wide" style={{color:trackBrollVisible?"rgba(232,89,60,1)":"rgba(232,89,60,0.25)"}}>🎬 B-ROLL</span>
                  <button title={trackBrollVisible?"Ocultar B-Rolls":"Mostrar B-Rolls"}
                    onClick={()=>setTrackBrollVisible(v=>!v)}
                    className="p-0.5 rounded transition-colors hover:bg-white/8">
                    {trackBrollVisible
                      ?<Eye className="w-3 h-3" style={{color:"rgba(232,89,60,0.7)"}}/>
                      :<EyeOff className="w-3 h-3" style={{color:"rgba(239,68,68,0.7)"}}/>}
                  </button>
                </div>
                <div className="flex-1 relative h-[60px]">
                  {/* ── Gap indicators — "Avatar respira aqui" ── */}
                  {localDrScenes.length>0 && effectiveClips.map((clip,ci)=>{
                    const gapStart = clip.startSec + clip.durSec;
                    const sceneEnd = gapStart + (localDrScenes[clip.sceneIdx]?.duration??0) - clip.durSec;
                    const nextClipStart = ci+1<effectiveClips.length ? effectiveClips[ci+1].startSec : totalDur;
                    const gapDur = Math.max(0, nextClipStart - gapStart);
                    if(gapDur < 0.5) return null;
                    const gapLeft=(gapStart/totalDur)*100;
                    const gapW=(gapDur/totalDur)*100;
                    return (
                      <div key={`gap${ci}`}
                        className="absolute top-3 bottom-3 rounded-lg flex items-center justify-center pointer-events-none"
                        style={{
                          left:`calc(${gapLeft}% + 1px)`,width:`calc(${gapW}% - 2px)`,
                          background:"rgba(100,116,139,0.05)",
                          border:"1px dashed rgba(100,116,139,0.18)",
                        }}>
                        <span className="text-[6px] font-black uppercase tracking-wider"
                          style={{color:"rgba(100,116,139,0.35)"}}>AV</span>
                      </div>
                    );
                  })}
                  {effectiveClips.map(clip=>{
                    const left=(clip.startSec/totalDur)*100;
                    const width=(clip.durSec/totalDur)*100;
                    const isAct=currentClip?.id===clip.id;
                    const isLoad=loadingClipIds.has(clip.id);
                    const isDT=dragOverClipId===clip.id;
                    const isDraggingThis=dragClipSceneIdx===clip.sceneIdx;
                    const isSel=selectedLayer===clip.id;
                    const isBeingDragged=clipDrag?.clipId===clip.id;
                    return(
                      <div key={clip.id}
                        className={`v1clip group absolute top-1 bottom-1 rounded overflow-hidden
                          ${isAct?"ring-2 ring-orange-400/90 brightness-110":""}
                          ${isSel&&!isAct?"ring-2 ring-sky-400/90":""}
                          ${isDT&&!isDraggingThis?"ring-2 ring-blue-400 brightness-125":""}
                          ${isDraggingThis?"opacity-40 scale-y-95":""}
                          ${isBeingDragged?"opacity-80":""}`}
                        style={{
                          left:`calc(${left}% + 1px)`,width:`calc(${width}% - 2px)`,
                          cursor: clipDrag ? "grabbing" : "grab",
                          background: clip.thumb
                            ? `url(${clip.thumb}) center/cover no-repeat`
                            : clip.url ? `${clip.color}28` : `${clip.color}0d`,
                          border:`1px ${clip.url||clip.thumb?"solid":"dashed"} ${clip.color}${clip.url||clip.thumb?"77":"33"}`,
                          transition: isBeingDragged ? "none" : "left 0.05s,width 0.05s",
                        }}
                        onClick={e=>{e.stopPropagation();setSelectedLayer(isSel?null:clip.id);if(!isSel)setLeftTab("inspector");seekToTime(clip.startSec+0.01);}}
                        onDragOver={e=>{e.preventDefault();setDragOverClipId(clip.id);}}
                        onDragLeave={()=>setDragOverClipId(null)}
                        onDrop={e=>{
                          e.preventDefault();
                          setDragOverClipId(null);
                          if(dragSrcUrl){
                            handleDropOnClip(clip.id,dragSrcUrl);
                          } else if(dragClipSceneIdx!==null && dragClipSceneIdx!==clip.sceneIdx){
                            setLocalDrScenes(prev=>{
                              const next=[...prev];
                              [next[dragClipSceneIdx],next[clip.sceneIdx]]=[next[clip.sceneIdx],next[dragClipSceneIdx]];
                              return next;
                            });
                            setDragClipSceneIdx(null);
                          }
                        }}>
                        {/* ── Trim handle LEFT ── */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2.5 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                          style={{cursor:"ew-resize",background:"rgba(0,0,0,0.4)"}}
                          onMouseDown={e=>{
                            e.stopPropagation();e.preventDefault();
                            setClipDrag({clipId:clip.id,mode:"trim-left",startX:e.clientX,origStartSec:clip.startSec,origDurSec:clip.durSec});
                            setSelectedLayer(clip.id);setLeftTab("inspector");
                          }}>
                          <div className="w-0.5 h-4 rounded-full" style={{background:"rgba(255,255,255,0.7)"}}/>
                        </div>
                        {/* ── Move body ── */}
                        <div className="absolute inset-x-2.5 inset-y-0 z-10"
                          style={{cursor:clipDrag?"grabbing":"grab"}}
                          onMouseDown={e=>{
                            e.stopPropagation();e.preventDefault();
                            setClipDrag({clipId:clip.id,mode:"move",startX:e.clientX,origStartSec:clip.startSec,origDurSec:clip.durSec});
                            setSelectedLayer(clip.id);setLeftTab("inspector");
                          }}/>
                        {/* ── Trim handle RIGHT ── */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2.5 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                          style={{cursor:"ew-resize",background:"rgba(0,0,0,0.4)"}}
                          onMouseDown={e=>{
                            e.stopPropagation();e.preventDefault();
                            setClipDrag({clipId:clip.id,mode:"trim-right",startX:e.clientX,origStartSec:clip.startSec,origDurSec:clip.durSec});
                            setSelectedLayer(clip.id);setLeftTab("inspector");
                          }}>
                          <div className="w-0.5 h-4 rounded-full" style={{background:"rgba(255,255,255,0.7)"}}/>
                        </div>
                        {clip.thumb&&<div className="absolute inset-0 pointer-events-none" style={{background:"linear-gradient(to top,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.18) 60%,transparent 100%)"}}/>}
                        {isLoad?(
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{background:"rgba(0,0,0,0.5)"}}>
                            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                              style={{borderColor:`${clip.color}cc`,borderTopColor:"transparent"}}/>
                          </div>
                        ):(
                          <>
                            <div className="absolute bottom-0 left-0 right-0 flex items-center px-1.5 pb-1 pointer-events-none">
                              {!clip.url&&!clip.thumb&&<div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0 mr-0.5" style={{background:clip.color+"88"}}/>}
                              <span className="text-[7px] font-bold text-white/80 truncate drop-shadow">{clip.label}</span>
                            </div>
                            <div className="v1clip-overlay absolute inset-0 flex items-center justify-center"
                              style={{background:"rgba(0,0,0,0.55)"}}>
                              <button title="Sugerir outra mídia"
                                onClick={e=>{e.stopPropagation();setSelectedLayer(clip.id);setLeftTab("inspector");suggestAnother(clip.id);}}
                                className="flex items-center gap-1.5 hover:scale-110 transition-transform bg-black/60 rounded-full px-2 py-1">
                                <RefreshCw className="w-3 h-3 text-white"/>
                                <span className="text-[8px] text-white font-bold">Trocar</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── TRILHA (Music) ── */}
              <div className="flex border-b" style={{borderColor:"#131313"}}>
                <div className="w-[72px] h-[30px] shrink-0 flex items-center justify-center border-r"
                  style={{borderColor:"#131313"}}>
                  <span className="text-[8px] font-black tracking-widest text-red-600/40">TRILHA</span>
                </div>
                <div className="flex-1 h-[30px] flex items-end overflow-hidden gap-px px-1">
                  {Array.from({length:120}).map((_,i)=>(
                    <div key={i} className="flex-1 rounded-sm" style={{background:"#ef4444",opacity:0.25,height:`${8+Math.abs(Math.sin(i*2.3+1)*Math.cos(i*0.7))*92}%`}}/>
                  ))}
                </div>
              </div>

              {/* ── SFX ── */}
              <div className="flex border-b" style={{borderColor:"#131313"}}>
                <div className="w-[72px] h-[30px] shrink-0 flex items-center justify-between border-r px-2"
                  style={{borderColor:"#131313"}}>
                  <span className="text-[8px] font-black tracking-widest text-amber-600/60">SFX</span>
                  <button title={trackSfxMuted?"Ativar":"Mutar"} onClick={()=>setTrackSfxMuted(m=>!m)}
                    className="p-0.5 rounded transition-colors hover:bg-white/8">
                    {trackSfxMuted
                      ?<VolumeX className="w-2.5 h-2.5 text-red-500/60"/>
                      :<Volume2 className="w-2.5 h-2.5 text-amber-600/40"/>}
                  </button>
                </div>
                <div className="flex-1 relative h-[30px] overflow-visible" style={{opacity:trackSfxMuted?0.2:1,transition:"opacity 0.2s"}}>
                  {sfxMarkers.length===0 && (
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className="text-[7px] text-gray-800 italic">Nenhum gatilho detectado</span>
                    </div>
                  )}
                  {sfxMarkers.map(marker=>{
                    const effTime=marker.timeSec+(sfxOffsets[marker.id]??0);
                    const left=Math.max(0,Math.min(100,(effTime/totalDur)*100));
                    const isNear=Math.abs(currentTime-effTime)<0.5;
                    const isDraggingThis=sfxDrag?.id===marker.id;
                    return (
                      <div key={marker.id}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 group/sfxpin"
                        style={{
                          left:`${left}%`,
                          cursor:sfxDrag?"grabbing":"grab",
                          transition:isDraggingThis?"none":"left 0.05s",
                        }}
                        onMouseDown={e=>{
                          e.stopPropagation();e.preventDefault();
                          setSfxDrag({id:marker.id,startX:e.clientX,origOffset:sfxOffsets[marker.id]??0});
                        }}>

                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none
                          opacity-0 group-hover/sfxpin:opacity-100 transition-opacity duration-150 z-50">
                          <div className="whitespace-nowrap text-[8px] font-bold text-white px-2 py-1 rounded-md shadow-2xl"
                            style={{background:"#18181b",border:"1px solid rgba(255,255,255,0.13)",boxShadow:"0 8px 24px rgba(0,0,0,0.7)"}}>
                            {marker.label}
                            {marker.keyword&&<span className="text-gray-500 ml-1">· "{marker.keyword}"</span>}
                          </div>
                          {/* Caret */}
                          <div className="w-2 h-2 mx-auto rotate-45 -mt-px"
                            style={{background:"#18181b",borderRight:"1px solid rgba(255,255,255,0.13)",borderBottom:"1px solid rgba(255,255,255,0.13)"}}/>
                        </div>

                        {/* Icon bubble */}
                        <button
                          onClick={e=>{e.stopPropagation();playSFXPreview(marker);seekToTime(marker.timeSec);}}
                          className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-110"
                          style={{
                            background:"#27272a",
                            border:`1px solid ${isNear?marker.color:"rgba(232,89,60,0.5)"}`,
                            boxShadow:isNear?`0 0 8px ${marker.color},0 0 18px ${marker.color}44`:"none",
                            transform:isNear?"scale(1.45)":"scale(1)",
                          }}>
                          {marker.kind==="zap"
                            ?<Zap      className="w-2.5 h-2.5" style={{color:isNear?marker.color:"#FF7A5C"}} fill={isNear?marker.color:"none"}/>
                            :<Volume2  className="w-2.5 h-2.5" style={{color:isNear?marker.color:"#FF7A5C"}}/>
                          }
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── LEGENDA (Subtitle) ── */}
              <div className="flex">
                <div className="w-[72px] h-[30px] shrink-0 flex items-center justify-center border-r cursor-pointer transition-colors"
                  style={{
                    borderColor:"#131313",
                    background: selectedLayer==="subtitle"?"rgba(234,179,8,0.08)":"transparent",
                  }}
                  onClick={()=>{setSelectedLayer(v=>v==="subtitle"?null:"subtitle");setLeftTab("inspector");}}>
                  <span className="text-[8px] font-black tracking-widest"
                    style={{color:selectedLayer==="subtitle"?"rgba(234,179,8,0.9)":"rgba(234,179,8,0.45)"}}>LEGENDA</span>
                </div>
                <div className="flex-1 relative h-[30px] cursor-pointer"
                  onClick={()=>{setSelectedLayer(v=>v==="subtitle"?null:"subtitle");setLeftTab("inspector");}}>
                  {(localDrScenes.length>0?localDrScenes:localScenes).map((_row,i)=>{
                    const dur=localDrScenes.length?(localDrScenes[i] as DirectResponseScene).duration:(localScenes[i] as Scene).estimated_duration_seconds??5;
                    const text=localDrScenes.length?(localDrScenes[i] as DirectResponseScene).textSnippet:((localScenes[i] as Scene).text_chunk??(localScenes[i] as Scene).segment??"");
                    const left=(sceneStarts[i]/totalDur)*100;
                    const width=(dur/totalDur)*100;
                    const isActive=activeScene===i;
                    const isSel=selectedLayer==="subtitle";
                    return(
                      <div key={i} className="absolute top-0.5 bottom-0.5 rounded overflow-hidden flex items-center px-1.5"
                        style={{
                          left:`calc(${left}% + 1px)`,width:`calc(${width}% - 2px)`,
                          background:isSel?"rgba(234,179,8,0.12)":isActive?"rgba(234,179,8,0.1)":"rgba(234,179,8,0.04)",
                          border:`1px solid rgba(234,179,8,${isSel?0.4:isActive?0.3:0.1})`,
                        }}>
                        <span className="text-[6px] font-medium text-yellow-500/60 truncate">{text.slice(0,40)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Playhead Needle ── */}
              <div className="absolute top-0 bottom-0 pointer-events-none z-20"
                style={{left:`calc(72px + (100% - 72px) * ${playheadPct/100})`,transform:"translateX(-50%)"}}>
                <div className="w-px h-full" style={{background:"#E8512A",boxShadow:"0 0 8px rgba(232,81,42,0.7)"}}/>
                <div className="w-3 h-3 rounded-full absolute -top-1 left-1/2 -translate-x-1/2" style={{background:"#E8512A",boxShadow:"0 0 10px rgba(232,81,42,0.9)"}}/>
              </div>
            </div>
            </div>{/* end scroll wrapper */}
          </div>
        </div>
      </div>


      {/* ══ STATUSBAR (28px) ══════════════════════════════════════════════════ */}
      <div style={{height:"28px",flexShrink:0,display:"flex",alignItems:"center",gap:"10px",padding:"0 12px",background:"#0F0F0F",borderTop:"1px solid #131313",fontSize:"10px",color:"#444",fontFamily:"'Geist',sans-serif",zIndex:10,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:"4px",flexShrink:0}}>
          <div style={{width:"5px",height:"5px",borderRadius:"50%",background:"#3ECF8E"}}/>
          <span>Projeto salvo</span>
        </div>
        <span style={{flexShrink:0}}>{fmtTime(totalDur)} total</span>
        <span style={{flexShrink:0}}>{localDrScenes.length||localScenes.length} cenas</span>
        <span style={{flexShrink:0}}>1920×1080 · 30fps</span>
        <div style={{flex:1}}/>
        <span style={{flexShrink:0,display:"flex",alignItems:"center",gap:"4px"}}>
          playhead: <span style={{fontFamily:"monospace",color:"#7A7A7A",fontVariantNumeric:"tabular-nums"}}>{fmtTime(currentTime)}</span>
        </span>
        <span style={{flexShrink:0}}>snap: <span style={{color:snapOn?"#E8512A":"#7A7A7A"}}>{snapOn?"on":"off"}</span></span>
        <span style={{flexShrink:0}}>tool: <span style={{color:"#7A7A7A"}}>{timelineTool}</span></span>
      </div>

      {paywallOpen&&<UpsellModal onClose={()=>setPaywallOpen(false)}/>}

      {/* ── Winning Ads Library Drawer ── */}
      <WinningAdsDrawer open={showAdLib} onClose={()=>setShowAdLib(false)} onRaioX={handleRaioX}/>

      {/* ── Toast Notification ── */}
      <div className="fixed bottom-6 left-1/2 z-[60] pointer-events-none"
        style={{
          transition:"opacity 0.25s ease, transform 0.25s ease",
          opacity:toast?1:0,
          transform:toast?"translateX(-50%) translateY(0)":"translateX(-50%) translateY(16px)",
        }}>
        {toast&&(
          <div className="flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-semibold text-white"
            style={{
              background:"linear-gradient(135deg,#1a0f0d,#1a0f0d)",
              border:"1px solid rgba(232,89,60,0.5)",
              boxShadow:"0 8px 40px rgba(232,89,60,0.35), 0 0 0 1px rgba(232,89,60,0.2)",
              backdropFilter:"blur(12px)",
            }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 animate-spin"
              style={{border:"2px solid transparent",borderTopColor:"#FF7A5C",borderRightColor:"rgba(255,122,92,0.3)"}}>
            </div>
            {toast}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
