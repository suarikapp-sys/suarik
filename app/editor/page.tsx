"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  Play, Pause, SkipBack, SkipForward, Download,
  Layout, Wand2, Music2, Sparkles, Volume2, ExternalLink,
  Clock, ChevronDown, AlertCircle, Zap, Film,
  Monitor, AudioLines, Star, Music, Clapperboard,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoOption {
  url: string;
  source?: string;
}

interface Scene {
  segment: string;
  text_chunk: string;
  visual_idea: string;
  broll_search_keywords: string;
  sound_effect: string;
  text_animation: string;
  vault_category?: string;
  video_url?: string;
  video_options?: VideoOption[];
  pexels_search_url?: string;
  sfx_url?: string;
  sfx_options?: string[];
  freesound_search_url?: string;
  estimated_duration_seconds?: number;
}

interface BackgroundTrack {
  url: string;
  title: string;
  is_premium_vault: boolean;
}

interface GenerateResponse {
  project_vibe: string;
  music_style: string;
  scenes: Scene[];
  background_tracks: BackgroundTrack[];
  pixabay_search_url?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ext(url: string, fallback = "mp4") {
  const m = url.split("?")[0].match(/\.(\w{2,4})$/);
  return m ? m[1] : fallback;
}

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

function formatTime(secs: number | undefined): string {
  if (!secs) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Selectors ────────────────────────────────────────────────────────────────

const SELECT_CLS =
  "w-full bg-[#111] border border-white/5 text-gray-300 text-xs rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 cursor-pointer appearance-none transition-colors";

function Selectors({
  videoFormat, setVideoFormat, videoTheme, setVideoTheme, compact = false,
}: {
  videoFormat: string; setVideoFormat: (v: string) => void;
  videoTheme: string;  setVideoTheme: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex gap-2 ${compact ? "items-center flex-wrap" : "flex-col"}`}>
      <div className={`relative ${compact ? "flex-1 min-w-[140px]" : "w-full"}`}>
        {!compact && <label className="block text-[10px] text-gray-600 uppercase tracking-widest font-medium mb-1.5">Formato</label>}
        <select value={videoFormat} onChange={(e) => setVideoFormat(e.target.value)} className={SELECT_CLS}>
          <option value="creative_ad">⚡ Ad Rápido</option>
          <option value="vsl_long">📺 VSL / Documentário</option>
          <option value="social_organic">📱 Reels</option>
          <option value="corporate_brand">🏢 Institucional</option>
          <option value="cinematic">🎬 Cinematográfico</option>
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600 pointer-events-none" />
      </div>
      <div className={`relative ${compact ? "flex-1 min-w-[150px]" : "w-full"}`}>
        {!compact && <label className="block text-[10px] text-gray-600 uppercase tracking-widest font-medium mb-1.5">Nicho / Tema</label>}
        <select value={videoTheme} onChange={(e) => setVideoTheme(e.target.value)} className={SELECT_CLS}>
          <optgroup label="── Direct Response">
            <option value="dr_bizopp">Renda Extra / BizOpp</option>
            <option value="dr_nutra_weight">Emagrecimento</option>
            <option value="dr_nutra_pain">Dores Articulares</option>
            <option value="dr_nutra_vision">Visão</option>
            <option value="dr_nutra_brain">Memória / Cognição</option>
            <option value="dr_nutra_mens">Saúde Masculina</option>
            <option value="dr_blood_sugar">Glicemia / Diabetes</option>
            <option value="dr_survival">Sobrevivência</option>
            <option value="dr_manifestation">Espiritualidade</option>
          </optgroup>
          <optgroup label="── Tradicional & Agência">
            <option value="trad_real_estate">Imobiliário</option>
            <option value="trad_corporate">Corporativo / B2B</option>
            <option value="trad_local_biz">Negócios Locais</option>
            <option value="trad_fitness">Fitness / Saúde</option>
            <option value="trad_education">Educação / Infoproduto</option>
          </optgroup>
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600 pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Vault Badge ──────────────────────────────────────────────────────────────

function VaultBadge({ category }: { category?: string }) {
  if (!category) return null;
  const isHook = category.includes("hook");
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide border ${
      isHook ? "bg-red-950/80 border-red-500/50 text-red-300" : "bg-black/70 border-amber-500/30 text-amber-300/90"
    }`}>
      {isHook ? "⚡ Gancho Matador" : "💎 Acervo Kraft"}
    </span>
  );
}

// ─── Premiere XML Builder (FCP 7 / xmeml) ────────────────────────────────────
// Regras Adobe:
//  1. Todo <clipitem> e <file> tem <rate> com <ntsc>FALSE</ntsc> + <duration> genérica
//  2. start/end = posição na timeline; in/out = recorte do ficheiro fonte
//  3. pathurl usa file://localhost/ → Premiere abre como Offline Media (Link Media)

function buildPremiereXML(res: GenerateResponse): string {
  const FPS      = 30;
  const FILE_DUR = 18000;
  const toFrames = (secs: number) => Math.round(secs * FPS);
  const RATE     = `<rate><timebase>${FPS}</timebase><ntsc>FALSE</ntsc></rate>`;

  function toOfflinePath(url: string): { name: string; pathurl: string } {
    const decoded = decodeURIComponent(url.split("?")[0]);
    const name    = decoded.split("/").pop() || "media.mp4";
    return { name, pathurl: `file://localhost/MidiaCopiloto/Downloads/${name}` };
  }

  let videoTrack   = "";
  let audioTrack   = "";
  let offsetFrames = 0;

  for (let i = 0; i < res.scenes.length; i++) {
    const scene    = res.scenes[i];
    const dur      = toFrames(scene.estimated_duration_seconds ?? 5);
    const start    = offsetFrames;
    const end      = start + dur;
    const videoUrl = scene.video_options?.[0]?.url ?? scene.video_url ?? "";
    const sfxUrl   = scene.sfx_options?.[0] ?? scene.sfx_url ?? "";
    const label    = `Cena ${i + 1} · ${scene.segment ?? ""}`;

    if (videoUrl) {
      const { name, pathurl } = toOfflinePath(videoUrl);
      videoTrack += `
          <clipitem id="clip_${i + 1}">
            <name>${label}</name>
            ${RATE}
            <duration>${FILE_DUR}</duration>
            <in>0</in>
            <out>${dur}</out>
            <start>${start}</start>
            <end>${end}</end>
            <file id="file_v${i + 1}">
              <name>${name}</name>
              <pathurl>${pathurl}</pathurl>
              ${RATE}
              <duration>${FILE_DUR}</duration>
              <media><video><duration>${FILE_DUR}</duration></video></media>
            </file>
          </clipitem>`;
    }

    if (sfxUrl) {
      const { name, pathurl } = toOfflinePath(sfxUrl);
      audioTrack += `
          <clipitem id="sfx_${i + 1}">
            <name>SFX · ${scene.sound_effect ?? `Cena ${i + 1}`}</name>
            ${RATE}
            <duration>${FILE_DUR}</duration>
            <in>0</in>
            <out>${dur}</out>
            <start>${start}</start>
            <end>${end}</end>
            <file id="file_sfx${i + 1}">
              <name>${name}</name>
              <pathurl>${pathurl}</pathurl>
              ${RATE}
              <duration>${FILE_DUR}</duration>
              <media><audio><duration>${FILE_DUR}</duration></audio></media>
            </file>
          </clipitem>`;
    }

    offsetFrames = end;
  }

  const musicTrack = res.background_tracks?.[0];
  const musicXml   = musicTrack?.url ? (() => {
    const { name, pathurl } = toOfflinePath(musicTrack.url);
    return `
      <audio>
        <track>
          <clipitem id="music_1">
            <name>${musicTrack.title ?? "Trilha Sonora"}</name>
            ${RATE}
            <duration>${FILE_DUR}</duration>
            <in>0</in>
            <out>${offsetFrames}</out>
            <start>0</start>
            <end>${offsetFrames}</end>
            <file id="file_music">
              <name>${name}</name>
              <pathurl>${pathurl}</pathurl>
              ${RATE}
              <duration>${FILE_DUR}</duration>
              <media><audio><duration>${FILE_DUR}</duration></audio></media>
            </file>
          </clipitem>
        </track>
      </audio>`;
  })() : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>Midia Copiloto - Timeline</name>
    ${RATE}
    <duration>${offsetFrames}</duration>
    <media>
      <video>
        <track>${videoTrack}
        </track>
      </video>
      <audio>
        <track>${audioTrack}
        </track>
      </audio>${musicXml}
    </media>
  </sequence>
</xmeml>`;
}

// ─── Waveform decoration (deterministic per track index) ─────────────────────

const WAVE_PATTERN = [2, 5, 8, 4, 10, 6, 8, 3, 5, 7, 4, 9, 3, 6, 8, 2, 5, 9, 4, 7];

// ─── Segment colour palette ───────────────────────────────────────────────────

function segColor(seg: string) {
  const s = seg.toLowerCase();
  if (s.includes("hook")) return { dot: "bg-red-500",   label: "text-red-400",   border: "border-red-500/40",   bg: "bg-red-900/20",   pill: "bg-red-600"   };
  if (s.includes("cta"))  return { dot: "bg-green-500", label: "text-green-400", border: "border-green-500/40", bg: "bg-green-900/20", pill: "bg-green-600" };
  return                         { dot: "bg-blue-500",  label: "text-blue-400",  border: "border-blue-500/40",  bg: "bg-blue-900/10",  pill: "bg-blue-600"  };
}

// ─── Editor Page ──────────────────────────────────────────────────────────────

export default function EditorPage() {
  const router = useRouter();

  const [copy, setCopy]               = useState("");
  const [videoFormat, setVideoFormat] = useState("vsl_long");
  const [videoTheme, setVideoTheme]   = useState("dr_bizopp");
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<GenerateResponse | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [zipping, setZipping]         = useState(false);
  const [activeScene, setActiveScene] = useState<number>(0);
  const [isPlaying, setIsPlaying]     = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Recebe resultado pré-gerado da StartScreen via sessionStorage ─────────
  useEffect(() => {
    try {
      const storedResult = sessionStorage.getItem("vb_project_result");
      const storedCopy   = sessionStorage.getItem("vb_project_copy");
      if (storedResult) {
        setResult(JSON.parse(storedResult) as GenerateResponse);
        if (storedCopy) setCopy(storedCopy);
        sessionStorage.removeItem("vb_project_result");
        sessionStorage.removeItem("vb_project_copy");
      }
    } catch {
      // sessionStorage indisponível ou JSON inválido — ignora
    }
  }, []);

  // ── API ─────────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!copy.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveScene(0);
    try {
      const res  = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copy, videoFormat, videoTheme }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setResult(data as GenerateResponse);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao conectar com a IA.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!result || zipping) return;
    setZipping(true);
    const zip = new JSZip();
    const track1Url = result.background_tracks?.[0]?.url;
    if (track1Url) {
      const musicBlob = await fetchBlob(track1Url);
      if (musicBlob) zip.folder("Trilha")!.file(`trilha.${ext(track1Url, "mp3")}`, musicBlob);
    }
    for (let i = 0; i < result.scenes.length; i++) {
      const scene  = result.scenes[i];
      const folder = zip.folder(`Cena_${i + 1}`)!;
      const videoUrl = scene.video_options?.[0]?.url ?? scene.video_url;
      if (videoUrl) { const blob = await fetchBlob(videoUrl); if (blob) folder.file(`broll.${ext(videoUrl, "mp4")}`, blob); }
      const sfxUrl = scene.sfx_options?.[0] ?? scene.sfx_url;
      if (sfxUrl) { const blob = await fetchBlob(sfxUrl); if (blob) folder.file(`sfx.${ext(sfxUrl, "mp3")}`, blob); }
    }
    zip.file("timeline-kraft.xml", buildPremiereXML(result));
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "copiloto-edicao-pacote.zip");
    setZipping(false);
  };

  const handlePlayGeral = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      videoRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current?.play().catch(() => {});
      videoRef.current?.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // ── Derived state ───────────────────────────────────────────────────────────

  const hasResult   = result !== null;
  const isDashboard = hasResult || loading || !!error;
  const charCount   = copy.length;

  // ══════════════════════════════════════════════════════════════════════════
  // INPUT MODE — tela centrada com textarea
  // ══════════════════════════════════════════════════════════════════════════

  if (!isDashboard) {
    return (
      <div className="min-h-screen bg-[#050505] text-gray-200 flex flex-col font-sans">
        <header className="shrink-0 border-b border-white/5 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={() => router.push("/")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                <Clapperboard className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-100 tracking-tight">VisualBrain</span>
            </button>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-500 uppercase tracking-widest">Novo Roteiro</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500">IA Pronta</span>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
          <div className="w-full max-w-2xl space-y-8">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center mb-5">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.15)]">
                  <Sparkles className="w-6 h-6 text-blue-400" />
                </div>
              </div>
              <h1 className="text-4xl font-light tracking-tight text-gray-100">
                Estrategista de <span className="text-gray-600 font-extralight">Retenção</span>
              </h1>
              <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                Cole o roteiro. A IA decupa cada cena, mapeia gatilhos emocionais e monta a sua Direção de Arte completa.
              </p>
            </div>

            <div className="relative">
              <textarea
                value={copy}
                onChange={(e) => setCopy(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleGenerate(); }}
                placeholder={`Cole aqui a copy do seu vídeo…\n\nExemplo:\n"Você passa horas editando e o vídeo não performa?\nNão é falta de talento — é falta de estrutura.\nHoje vou te mostrar o método que uso para criar vídeos\nque retêm atenção do início ao fim…"`}
                className="w-full min-h-[220px] bg-[#0d0d0d] text-gray-100 placeholder-gray-700 text-sm leading-relaxed px-5 py-4 rounded-2xl border border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 resize-none transition-colors duration-200"
              />
              {charCount > 0 && (
                <span className="absolute bottom-3.5 right-4 text-xs text-gray-700 tabular-nums pointer-events-none">{charCount} chars</span>
              )}
            </div>

            <div className="space-y-3">
              <Selectors videoFormat={videoFormat} setVideoFormat={setVideoFormat} videoTheme={videoTheme} setVideoTheme={setVideoTheme} />
              <p className="text-xs text-gray-700">
                Use <span className="font-mono text-gray-600">[HOOK]</span>{" "}
                <span className="font-mono text-gray-600">[BODY]</span>{" "}
                <span className="font-mono text-gray-600">[CTA]</span>{" "}
                para maior precisão — ou deixe a IA segmentar automaticamente.
              </p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!copy.trim() || loading}
              className={`w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                copy.trim() && !loading
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40"
                  : "bg-white/5 text-gray-600 cursor-not-allowed border border-white/5"
              }`}
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" /> Analisando roteiro…</>
                : <><Wand2 className="w-4 h-4" /> Gerar Mapa de Edição <span className="text-xs font-normal text-blue-300/60 ml-1">⌘ Enter</span></>
              }
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DASHBOARD MODE — VisualBrain Pro 3 colunas
  // ══════════════════════════════════════════════════════════════════════════

  const scenes         = result?.scenes ?? [];
  const currentScene   = scenes[activeScene] ?? null;
  const currentTrack   = result?.background_tracks?.[0] ?? null;
  const allTracks      = result?.background_tracks ?? [];
  const currentVideos: VideoOption[] = currentScene
    ? (currentScene.video_options?.length
        ? currentScene.video_options
        : currentScene.video_url ? [{ url: currentScene.video_url }] : [])
    : [];

  const totalDur = scenes.reduce((s, sc) => s + (sc.estimated_duration_seconds ?? 5), 0);

  // Timecode acumulado por cena
  let cumSecs = 0;
  const timelineMarkers = scenes.map((sc, i) => {
    const pct = totalDur > 0 ? (cumSecs / totalDur) * 100 : (i / Math.max(scenes.length, 1)) * 100;
    cumSecs += sc.estimated_duration_seconds ?? 5;
    return { index: i, pct, scene: sc };
  });

  // Match % para B-Roll cards (ranking por posição)
  const MATCH_SCORES = [98, 94, 89, 85, 82, 78];

  // Contagem de mídias para CTA dinâmico
  const mediaCount = scenes.reduce((acc, sc) => {
    if (sc.video_options?.length || sc.video_url) acc++;
    if (sc.sfx_options?.length || sc.sfx_url)    acc++;
    return acc;
  }, 0) + (currentTrack?.url ? 1 : 0);

  return (
    <div className="flex h-screen bg-[#050505] text-gray-300 font-sans overflow-hidden">

      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      <div className="w-16 border-r border-white/5 flex flex-col items-center py-8 gap-10 bg-[#080808] shrink-0">
        <button
          onClick={() => router.push("/")}
          className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white italic text-sm shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:bg-blue-500 transition-colors"
          title="Início"
        >
          V
        </button>
        <div className="flex flex-col gap-6">
          <button
            onClick={() => { setResult(null); setError(null); }}
            title="Novo Roteiro"
            className="p-2 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-600/10 transition-colors"
          >
            <Wand2 className="w-5 h-5" />
          </button>
          <div className="p-2 rounded-lg text-blue-500 bg-blue-600/10">
            <Monitor className="w-5 h-5" />
          </div>
          <div className="p-2 rounded-lg text-gray-600 hover:text-gray-400 cursor-pointer transition-colors">
            <AudioLines className="w-5 h-5" />
          </div>
          <div className="p-2 rounded-lg text-gray-600 hover:text-gray-400 cursor-pointer transition-colors">
            <Layout className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-auto text-[7px] text-gray-700 text-center leading-tight font-mono uppercase tracking-widest">
          Kraft<br />Mídia
        </div>
      </div>

      {/* ── COLUNA 1: AI Script Analysis ───────────────────────────────────── */}
      <div className="w-72 border-r border-white/5 flex flex-col bg-[#0a0a0a] shrink-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">AI Script Analysis</h2>
          {loading ? (
            <span className="flex items-center gap-1 bg-yellow-900/30 text-yellow-400 text-[9px] px-2 py-0.5 rounded-full border border-yellow-600/20">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" /> Gerando…
            </span>
          ) : hasResult ? (
            <span className="flex items-center gap-1 bg-emerald-900/20 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full border border-emerald-600/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {scenes.length} cenas
            </span>
          ) : null}
        </div>

        {result?.project_vibe && (
          <div className="px-5 py-2.5 border-b border-white/5 bg-[#080808] shrink-0">
            <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-0.5">Vibe do Projeto</p>
            <p className="text-xs text-gray-400 leading-snug italic">{result.project_vibe}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="space-y-2 animate-pulse pt-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-white/5" />)}
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-xs text-red-400">Erro ao gerar</p>
              <p className="text-[10px] text-gray-600 leading-relaxed">{error}</p>
            </div>
          )}
          {scenes.map((scene, i) => {
            const c        = segColor(scene.segment);
            const isActive = activeScene === i;
            return (
              <button
                key={i}
                onClick={() => setActiveScene(i)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 ${
                  isActive
                    ? `${c.border} ${c.bg}`
                    : "border-transparent bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/5"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                  <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${isActive ? c.label : "text-gray-600"}`}>
                    Cena {i + 1} · {scene.segment}
                  </span>
                  {scene.estimated_duration_seconds !== undefined && (
                    <span className="ml-auto text-[9px] text-gray-700 flex items-center gap-0.5 flex-shrink-0">
                      <Clock className="w-2.5 h-2.5" />{scene.estimated_duration_seconds}s
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 italic">{scene.text_chunk}</p>
                {scene.vault_category && <div className="mt-2"><VaultBadge category={scene.vault_category} /></div>}
              </button>
            );
          })}
        </div>

        <div className="shrink-0 p-4 border-t border-white/5">
          <button
            onClick={handleGenerate}
            disabled={!copy.trim() || loading}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              copy.trim() && !loading
                ? "bg-blue-600/80 hover:bg-blue-600 text-white"
                : "bg-white/5 text-gray-600 cursor-not-allowed"
            }`}
          >
            {loading
              ? <><div className="w-3 h-3 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" /> Gerando…</>
              : <><Wand2 className="w-3 h-3" /> Gerar Novamente</>
            }
          </button>
        </div>
      </div>

      {/* ── COLUNA 2: Central Player + Timeline ────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#0d0d0d] to-[#050505] min-w-0 overflow-hidden">

        {/* Selectors bar */}
        <div className="shrink-0 border-b border-white/5 px-4 py-2.5 flex items-center gap-3 bg-[#080808]">
          <Selectors videoFormat={videoFormat} setVideoFormat={setVideoFormat} videoTheme={videoTheme} setVideoTheme={setVideoTheme} compact />
          {result?.music_style && (
            <div className="ml-auto text-[10px] text-gray-600 flex items-center gap-1">
              <Music2 className="w-3 h-3" />
              <span className="text-gray-500">{result.music_style}</span>
            </div>
          )}
        </div>

        {/* Video player */}
        <div className="flex-1 flex items-center justify-center p-8 min-h-0">
          <div className="w-full max-w-4xl">
            <div className="aspect-video bg-black rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/5 relative overflow-hidden group">
              {currentVideos.length > 0 ? (
                <>
                  <video
                    ref={videoRef}
                    key={currentVideos[0].url}
                    src={currentVideos[0].url}
                    controls={false}
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {currentVideos[0].source === "Premium Vault" && (
                    <div className="absolute top-3 left-3">
                      <VaultBadge category={currentScene?.vault_category} />
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-700">
                  {loading
                    ? <div className="w-8 h-8 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
                    : <><Film className="w-8 h-8" /><p className="text-xs">Selecione uma cena para ver o preview</p></>
                  }
                </div>
              )}

              {/* Play overlay */}
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 cursor-pointer"
                onClick={handlePlayGeral}
              >
                <div className="w-16 h-16 bg-blue-600/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl">
                  {isPlaying
                    ? <Pause className="w-7 h-7 text-white fill-white" />
                    : <Play  className="w-7 h-7 text-white fill-white ml-1" />
                  }
                </div>
              </div>

              {/* AI Scanning badge */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                <Zap size={12} className="text-yellow-400" />
                <span className="text-[10px] font-bold tracking-tighter text-gray-300">AI SCANNING ACTIVE</span>
              </div>
            </div>

            {/* Scene info below player */}
            {currentScene && (
              <div className="mt-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${segColor(currentScene.segment).label}`}>
                      Cena {activeScene + 1} · {currentScene.segment}
                    </span>
                    {currentScene.vault_category && <VaultBadge category={currentScene.vault_category} />}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 italic">{currentScene.visual_idea}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 text-[10px] text-gray-600">
                  <Film className="w-3 h-3" />
                  <span className="font-mono truncate max-w-[140px]">{currentScene.broll_search_keywords}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Audio bar */}
        {currentTrack && (
          <div className="shrink-0 border-t border-white/5 bg-[#080808] px-4 py-2.5 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Music2 className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-300 truncate">{currentTrack.title}</span>
                {currentTrack.is_premium_vault && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/70 border border-amber-500/30 text-amber-300/90 flex-shrink-0">
                    💎 Vault
                  </span>
                )}
                {result?.pixabay_search_url && !currentTrack.is_premium_vault && (
                  <a href={result.pixabay_search_url} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] text-blue-500/70 hover:text-blue-400 flex items-center gap-0.5">
                    <ExternalLink className="w-2.5 h-2.5" /> Pixabay
                  </a>
                )}
              </div>
              <audio ref={audioRef} controls src={currentTrack.url} className="w-full h-7" style={{ colorScheme: "dark" }}
                onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
            </div>
            <a href={currentTrack.url} download target="_blank" rel="noopener noreferrer"
              className="shrink-0 p-1.5 rounded-lg border border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors">
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Timeline */}
        <div className="shrink-0 h-44 bg-[#080808] border-t border-white/5 px-4 py-3 flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveScene(Math.max(0, activeScene - 1))} className="text-gray-600 hover:text-gray-300 transition-colors">
                <SkipBack className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={handlePlayGeral}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isPlaying ? "bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]" : "bg-white/5 hover:bg-white/10"
                }`}
              >
                {isPlaying
                  ? <Pause className="w-4.5 h-4.5 text-white fill-white" />
                  : <Play  className="w-4.5 h-4.5 text-gray-300 fill-current ml-0.5" />
                }
              </button>
              <button onClick={() => setActiveScene(Math.min(scenes.length - 1, activeScene + 1))} className="text-gray-600 hover:text-gray-300 transition-colors">
                <SkipForward className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="text-2xl font-mono font-bold text-white tracking-tighter italic">
              {formatTime(scenes.slice(0, activeScene + 1).reduce((s, sc) => s + (sc.estimated_duration_seconds ?? 5), 0))}
              <span className="text-blue-600">:</span>
              <span className="text-sm font-mono text-gray-600 ml-1">/ {formatTime(totalDur)}</span>
            </div>
          </div>

          <div className="relative flex-1 min-h-0">
            <div className="absolute inset-0 rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden">
              {/* Scene blocks */}
              {scenes.map((sc, i) => {
                const w    = totalDur > 0 ? ((sc.estimated_duration_seconds ?? 5) / totalDur) * 100 : (100 / Math.max(scenes.length, 1));
                const left = totalDur > 0 ? (scenes.slice(0, i).reduce((s, x) => s + (x.estimated_duration_seconds ?? 5), 0) / totalDur) * 100 : (i / Math.max(scenes.length, 1)) * 100;
                const c    = segColor(sc.segment);
                return (
                  <div key={i} onClick={() => setActiveScene(i)}
                    style={{ left: `${left}%`, width: `${w}%` }}
                    className={`absolute top-0 bottom-0 cursor-pointer transition-opacity border-r border-[#050505] ${activeScene === i ? "opacity-100" : "opacity-35 hover:opacity-60"}`}>
                    <div className={`h-full ${c.bg} flex items-end pb-1.5 px-1.5`}>
                      <span className={`text-[8px] font-black truncate ${c.label}`}>{i + 1}</span>
                    </div>
                  </div>
                );
              })}
              {/* Playhead */}
              {scenes.length > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.8)] z-10 pointer-events-none transition-all duration-300"
                  style={{
                    left: `${totalDur > 0
                      ? (scenes.slice(0, activeScene + 1).reduce((s, sc) => s + (sc.estimated_duration_seconds ?? 5), 0) / totalDur) * 100
                      : ((activeScene + 1) / Math.max(scenes.length, 1)) * 100}%`,
                  }}
                >
                  <div className="w-3 h-3 bg-red-600 rounded-full -ml-[5px] -mt-0.5 shadow-lg" />
                </div>
              )}
            </div>

            {/* Markers above timeline */}
            <div className="absolute -top-6 left-0 right-0 pointer-events-none overflow-hidden">
              {timelineMarkers.map(({ index, pct, scene: sc }) => (
                <div key={index} style={{ left: `${pct}%` }}
                  className="absolute flex flex-col items-center pointer-events-auto cursor-pointer"
                  onClick={() => setActiveScene(index)}>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black whitespace-nowrap ${
                    activeScene === index ? `${segColor(sc.segment).pill} text-white` : "text-gray-700"
                  }`}>
                    {sc.segment.split("|")[0].trim()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── COLUNA 3: Magic Assets ──────────────────────────────────────────── */}
      <div className="w-[420px] border-l border-white/5 flex flex-col bg-[#080808] shrink-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-500 italic">Magic Assets</h2>
          <Star className="w-4 h-4 text-gray-700" />
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── B-Roll Section ─────────────────────────────────────────────── */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Film size={13} className="text-gray-500" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Premium B-Roll Match</h3>
              </div>
              <span className="text-[9px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded italic border border-blue-500/20">AI CURATED</span>
            </div>

            {loading && (
              <div className="flex gap-3 overflow-hidden">
                {[...Array(2)].map((_, i) => <div key={i} className="flex-none w-56 aspect-video rounded-xl bg-white/5 animate-pulse" />)}
              </div>
            )}

            {!loading && currentVideos.length === 0 && (
              <div className="flex items-center justify-center h-24 text-gray-700 text-xs">
                Nenhum B-Roll para esta cena
              </div>
            )}

            {!loading && currentVideos.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollSnapType: "x mandatory" }}>
                {currentVideos.map((video, i) => {
                  const isVault = video.source === "Premium Vault";
                  const isHook  = isVault && (currentScene?.vault_category ?? "").includes("hook");
                  const match   = MATCH_SCORES[i] ?? 75;
                  return (
                    <div
                      key={i}
                      style={{ scrollSnapAlign: "start" }}
                      className={`flex-none w-56 group relative rounded-xl overflow-hidden border transition-all cursor-grab active:cursor-grabbing ${
                        isHook  ? "border-red-500/30 hover:border-red-500/60"
                        : isVault ? "border-amber-500/20 hover:border-amber-500/50"
                        : "border-white/5 hover:border-blue-500/40"
                      }`}
                    >
                      <div className="aspect-video bg-[#111] overflow-hidden">
                        <video
                          src={video.url}
                          muted loop playsInline
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                          onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLVideoElement; el.pause(); el.currentTime = 0; }}
                        />
                      </div>

                      {/* Match badge */}
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded text-[9px] font-bold text-blue-400">
                        {match}% MATCH
                      </div>

                      {/* Vault badge */}
                      {isVault && (
                        <div className="absolute top-2 left-2">
                          <VaultBadge category={currentScene?.vault_category} />
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${
                            isHook ? "text-red-300" : isVault ? "text-amber-300" : "text-blue-400"
                          }`}>
                            {isHook ? "Gancho" : isVault ? "Vault" : (video.source ?? "Pexels")}
                          </span>
                          <a
                            href={video.url} download target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-blue-600 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download size={12} className="text-white" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SFX row */}
            {currentScene && (currentScene.sfx_options?.length || currentScene.sfx_url) && (
              <div className="mt-4">
                <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold mb-2">SFX · Efeito Sonoro</p>
                <p className="text-[10px] text-gray-600 italic mb-2">&ldquo;{currentScene.sound_effect}&rdquo;</p>
                <div className="space-y-1.5">
                  {(currentScene.sfx_options?.length ? currentScene.sfx_options : currentScene.sfx_url ? [currentScene.sfx_url] : []).map((url, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Volume2 className="w-3 h-3 text-amber-400/60 flex-shrink-0" />
                      <audio controls src={url} className="flex-1 h-6" style={{ colorScheme: "dark" }} />
                      <a href={url} download target="_blank" rel="noopener noreferrer"
                        className="p-1 rounded border border-white/5 text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors">
                        <Download className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  ))}
                  {currentScene.freesound_search_url && (
                    <a href={currentScene.freesound_search_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[9px] text-gray-700 hover:text-gray-400 transition-colors mt-1">
                      <ExternalLink className="w-2.5 h-2.5" /> Ver no Freesound
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Audio / Soundtrack Section ─────────────────────────────────── */}
          <div className="p-5 border-t border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Music size={13} className="text-gray-500" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Direct Response Soundtracks</h3>
            </div>

            {loading && (
              <div className="flex gap-3 overflow-hidden">
                {[...Array(2)].map((_, i) => <div key={i} className="flex-none w-48 h-32 rounded-xl bg-white/5 animate-pulse" />)}
              </div>
            )}

            {!loading && allTracks.length === 0 && (
              <div className="flex items-center justify-center h-20 text-gray-700 text-xs">
                Nenhuma trilha disponível
              </div>
            )}

            {!loading && allTracks.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollSnapType: "x mandatory" }}>
                {allTracks.map((track, i) => (
                  <div
                    key={i}
                    style={{ scrollSnapAlign: "start" }}
                    className={`flex-none w-52 bg-[#0f0f0f] p-4 rounded-xl border transition-all group cursor-pointer ${
                      track.is_premium_vault
                        ? "border-amber-500/20 hover:border-amber-500/40"
                        : "border-white/5 hover:border-blue-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${track.is_premium_vault ? "bg-amber-500/10" : "bg-blue-600/10"}`}>
                        <Play size={14} className={`${track.is_premium_vault ? "text-amber-400" : "text-blue-400"} fill-current`} />
                      </div>
                      <a href={track.url} download target="_blank" rel="noopener noreferrer"
                        className="p-1 rounded border border-white/5 text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors">
                        <Download size={12} />
                      </a>
                    </div>
                    <h4 className={`text-xs font-bold text-white mb-1 group-hover:text-blue-400 transition-colors truncate`}>
                      {track.title}
                    </h4>
                    <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-3">
                      {track.is_premium_vault ? "💎 Vault" : result?.music_style ?? "Trilha"}
                    </p>
                    {/* Waveform decoration */}
                    <div className="flex items-end gap-0.5 h-6">
                      {WAVE_PATTERN.map((h, wi) => (
                        <div
                          key={wi}
                          className={`flex-1 rounded-full ${track.is_premium_vault ? "bg-amber-500/25" : "bg-blue-600/25"}`}
                          style={{ height: `${h * 10}%` }}
                        />
                      ))}
                    </div>
                    <audio controls src={track.url} className="w-full h-6 mt-2" style={{ colorScheme: "dark" }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER: CTAs estratégicos ───────────────────────────────────── */}
        <div className="shrink-0 p-4 bg-[#0a0a0a] border-t border-white/5 space-y-2">

          {/* PRIMARY — Baixar Mídias (gradiente + glow) */}
          <button
            onClick={handleDownloadZip}
            disabled={!hasResult || zipping}
            className={`w-full flex flex-col items-center justify-center gap-0.5 py-3.5 rounded-xl text-sm font-black transition-all duration-200 ${
              hasResult && !zipping
                ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-900/40 hover:shadow-blue-500/30"
                : "bg-white/5 text-gray-600 cursor-not-allowed border border-white/5"
            }`}
          >
            {zipping ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" />
                Empacotando mídias…
              </span>
            ) : (
              <>
                <span>📦 {mediaCount > 0 ? `Baixar ${mediaCount} Mídia${mediaCount !== 1 ? "s" : ""}` : "Baixar Mídias do Projeto"}</span>
                <span className="text-[10px] font-normal opacity-70">Arquivos Originais · Alta Qualidade</span>
              </>
            )}
          </button>

          {/* SECONDARY — Exportar para Premiere (ghost) */}
          <button
            onClick={handleDownloadZip}
            disabled={!hasResult || zipping}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
              hasResult && !zipping
                ? "border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/5 hover:border-white/20"
                : "border-white/5 text-gray-700 cursor-not-allowed"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            🎬 Exportar Projeto (.xml)
          </button>

        </div>
      </div>
    </div>
  );
}
