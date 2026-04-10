"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Settings, User, Pause } from "lucide-react";

const LOG_LINES = [
  { ts: "09:22:45", msg: "SYNCING NEURAL WEIGHTS...", color: "#F0563A" },
  { ts: "09:22:46", msg: "DETECTING SPATIAL MESH: OK", color: "rgba(229,226,225,0.6)" },
  { ts: "09:22:48", msg: "CALCULATING DEPTH MAP (v2.4)", color: "rgba(229,226,225,0.6)" },
  { ts: "09:22:49", msg: "AI SUGGESTION: ADD FOG ENHANCEMENT", color: "#cfbdff" },
  { ts: "09:22:50", msg: "EXTRACTING LUMA DATA FROM CHANNEL 1", color: "rgba(229,226,225,0.6)" },
  { ts: "09:22:52", msg: "OPTIMIZING FRAME_BUFFER_A", color: "rgba(229,226,225,0.6)" },
  { ts: "09:22:53", msg: "COLOR HARMONIZATION: QUEUED", color: "#00daf3" },
  { ts: "09:22:55", msg: "B-ROLL OVERLAY RENDERING: 12/47 CLIPS", color: "#F0563A" },
];

const STEPS = [
  { label: "Auto-Tagging Assets", icon: "✓", done: true },
  { label: "8K Upscaling", icon: "⟳", done: true },
  { label: "Harmonização de Cores", icon: "⏳", done: false },
];

export default function ProcessingPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [visibleLogs, setVisibleLogs] = useState(1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setDone(true);
          return 100;
        }
        return p + 2;
      });
    }, 60);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const logInterval = setInterval(() => {
      setVisibleLogs(v => Math.min(v + 1, LOG_LINES.length));
    }, 800);
    return () => clearInterval(logInterval);
  }, []);

  const tags = ["#cinematic", "#outdoor", "#subject_identified", "#moody_forest", "#slow_motion", "#low_light_optimized"];

  return (
    <div className="bg-[#131313] text-[#E5E2E1] overflow-hidden" style={{ height: "100vh" }}>
      {/* Header */}
      <header className="flex justify-between items-center w-full px-6 h-16 bg-[#131313] z-50 fixed top-0 left-0 border-b border-white/[0.04]">
        <div className="flex items-center gap-8">
          <button onClick={() => router.back()}
            className="text-[#E5E2E1]/50 hover:text-[#E5E2E1] text-sm font-semibold transition-colors flex items-center gap-1.5"
            style={{ background: "transparent", border: "none", cursor: "pointer" }}>
            ← Voltar
          </button>
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-sm"
              style={{ background: "#F0563A", boxShadow: "0 0 16px rgba(240,86,58,0.4)" }}>S</div>
            <span className="text-lg font-black text-white tracking-tighter">SUARIK</span>
          </div>
          <nav className="hidden md:flex gap-6 items-center">
            {["Projetos", "Assets", "Timeline", "Exportar"].map((item, i) => (
              <button key={item}
                className="font-medium hover:text-[#E5E2E1] transition-colors text-sm"
                style={{ color: i === 0 ? "#F0563A" : "rgba(229,226,225,0.6)" }}>
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-[#E5E2E1]/60 hover:text-[#E5E2E1]"><Settings size={18} /></button>
          <button className="text-[#E5E2E1]/60 hover:text-[#E5E2E1]"><User size={18} /></button>
        </div>
      </header>

      <div className="flex pt-16 h-full">
        {/* Sidebar */}
        <aside className="flex flex-col h-full py-4 bg-[#1C1B1B] w-64 border-r border-[#1C1B1B] shrink-0">
          <div className="px-6 mb-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: "#F0563A" }} />
              <span className="font-bold text-[#E5E2E1]">Project Alpha</span>
            </div>
            <span className="font-mono text-xs tracking-wider text-[#E5E2E1]/40 uppercase">4K 60fps</span>
          </div>
          <nav className="flex flex-col gap-1">
            {[
              { icon: "📁", label: "Library" },
              { icon: "✨", label: "AI Magic", active: true },
              { icon: "🎨", label: "Effects" },
              { icon: "🎵", label: "Áudio" },
              { icon: "🕐", label: "Histórico" },
            ].map(item => (
              <div key={item.label}
                className="flex items-center gap-4 px-6 py-3 cursor-pointer transition-all"
                style={{
                  background: item.active ? "#2A2A2A" : "transparent",
                  color: item.active ? "#F0563A" : "rgba(229,226,225,0.5)",
                  borderRight: item.active ? "2px solid #F0563A" : "none",
                }}>
                <span className="text-base">{item.icon}</span>
                <span className="font-mono text-sm tracking-wider uppercase">{item.label}</span>
              </div>
            ))}
          </nav>
          <div className="mt-auto px-6 py-4 flex flex-col gap-4">
            <button className="font-bold py-2 rounded-md transition-opacity hover:opacity-90 text-white"
              style={{ background: "linear-gradient(135deg,#F0563A,#c44527)" }}>
              Nova Sequência
            </button>
            <div className="flex flex-col gap-2 pt-4 border-t border-white/5">
              {["Ajuda", "Storage"].map(item => (
                <button key={item} className="flex items-center gap-3 text-xs font-mono tracking-wider text-[#E5E2E1]/40 uppercase hover:text-[#E5E2E1]">
                  {item}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Canvas */}
        <main className="flex-grow relative bg-[#131313] overflow-hidden flex flex-col">
          {/* Processing Viewport */}
          <div className="flex-grow flex items-center justify-center p-8">
            <div className="relative w-full max-w-5xl aspect-video rounded-xl overflow-hidden shadow-2xl bg-[#0e0e0e]">
              {/* Background */}
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#0a0a0a,#141414)" }}>
                <div className="text-center opacity-10">
                  <Film size={64} className="mx-auto mb-2" />
                </div>
              </div>

              {/* Tech overlay */}
              <div className="absolute inset-0 z-10 pointer-events-none">
                {/* Scan line */}
                <div className="absolute left-0 right-0 h-0.5 transition-all"
                  style={{
                    top: `${(progress % 100)}%`,
                    background: "linear-gradient(90deg,transparent,#F0563A,transparent)",
                    boxShadow: "0 0 15px #F0563A",
                  }} />

                {/* Top-left info */}
                <div className="absolute top-6 left-6 flex flex-col gap-1">
                  <div className="px-3 py-1 rounded text-[10px] font-mono border"
                    style={{ background: "rgba(240,86,58,0.1)", backdropFilter: "blur(8px)", borderColor: "rgba(240,86,58,0.2)", color: "#F0563A" }}>
                    FRAME_ID: 1024_A_SYNC
                  </div>
                  <div className="px-3 py-1 rounded text-[10px] font-mono"
                    style={{ background: "rgba(53,53,52,0.6)", backdropFilter: "blur(8px)", color: "rgba(229,226,225,0.6)" }}>
                    COORDINATES: 45.23 // -12.09
                  </div>
                </div>

                {/* Reticle */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-64 rounded-full flex items-center justify-center"
                    style={{ border: "1px solid rgba(240,86,58,0.1)" }}>
                    <div className="w-48 h-48 rounded-full"
                      style={{ border: "1px dashed rgba(240,86,58,0.2)" }} />
                  </div>
                </div>

                {/* Bounding box */}
                <div className="absolute rounded"
                  style={{ top: "35%", left: "42%", width: "12rem", height: "16rem", border: "2px solid #ff571a", boxShadow: "0 0 20px rgba(255,87,26,0.4)" }}>
                  <span className="absolute top-0 right-0 translate-x-full px-2 py-0.5 text-[10px] font-mono whitespace-nowrap text-white"
                    style={{ background: "#ff571a" }}>
                    SUBJECT_01: HUMAN (98.4%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-36 px-12 flex flex-col justify-center"
            style={{ background: "linear-gradient(to top,rgba(28,27,27,0.8),transparent)" }}>
            <div className="max-w-5xl mx-auto w-full">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <span className="font-bold text-lg flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#F0563A" }} />
                    Análise Neural Ativa
                  </span>
                  <span className="font-mono text-xs tracking-wider text-[#E5E2E1]/50 uppercase mt-1 block">
                    Deep Scan Layer 04/12
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-2xl font-bold" style={{ color: "#F0563A" }}>
                    {Math.round(progress)}%
                  </span>
                  <p className="font-mono text-[10px] text-[#E5E2E1]/40 uppercase tracking-widest">
                    Est. Time: {Math.max(0, Math.round((100 - progress) * 0.8))}s
                  </p>
                </div>
              </div>

              <div className="w-full h-1.5 rounded-full overflow-hidden relative" style={{ background: "#353534" }}>
                <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: "linear-gradient(90deg,#ff571a,#F0563A)", boxShadow: "0 0 10px rgba(240,86,58,0.5)" }} />
              </div>

              <div className="flex gap-8 mt-4">
                {STEPS.map(step => (
                  <div key={step.label} className="flex items-center gap-2" style={{ opacity: step.done ? 1 : 0.4 }}>
                    <span className="text-sm" style={{ color: step.done ? "#F0563A" : "#E5E2E1" }}>
                      {step.icon === "✓" ? "✓" : step.icon === "⟳" ? "↺" : "⏳"}
                    </span>
                    <span className="font-mono text-[10px] tracking-widest uppercase">{step.label}</span>
                  </div>
                ))}
              </div>

              {done && (
                <button
                  onClick={() => router.push("/storyboard")}
                  className="mt-6 w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all active:scale-95 text-white flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#F0563A,#c44527)", boxShadow: "0 0 24px rgba(240,86,58,0.4)", animation: "pulse 1.5s infinite" }}>
                  ⚡ Entrar no Editor →
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-80 bg-[#1C1B1B] p-6 flex flex-col gap-8 shrink-0 overflow-y-auto border-l border-[#1C1B1B]">
          {/* Neural Extraction */}
          <div>
            <h3 className="font-black text-sm tracking-tighter uppercase mb-4">Extração Neural</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Frame Rate", value: "59.94 FPS" },
                { label: "Resolução",  value: "7680×4320" },
                { label: "Bitrate",    value: "420 MB/S" },
                { label: "Cor",        value: "10-BIT LOG" },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-lg border"
                  style={{ background: "#0e0e0e", borderColor: "rgba(92,64,55,0.1)" }}>
                  <p className="font-mono text-[10px] text-[#E5E2E1]/50 uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="font-mono text-sm font-bold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm tracking-tighter uppercase">Semantic Tags</h3>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded"
                style={{ color: "#cfbdff", background: "rgba(99,5,239,0.2)" }}>AI_GEN</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span key={tag} className="px-3 py-1.5 rounded-full text-[11px] font-mono border transition-colors hover:border-[#F0563A]/40 cursor-pointer"
                  style={{ background: "rgba(42,42,42,0.8)", backdropFilter: "blur(8px)", borderColor: "rgba(255,255,255,0.05)", color: "#E5E2E1" }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Log */}
          <div className="flex-grow flex flex-col">
            <h3 className="font-black text-sm tracking-tighter uppercase mb-4">Analysis Log</h3>
            <div className="flex-grow bg-[#0e0e0e] rounded-lg p-4 font-mono text-[10px] leading-relaxed text-[#E5E2E1]/60 overflow-hidden relative min-h-32">
              {LOG_LINES.slice(0, visibleLogs).map((line, i) => (
                <p key={i} className="mb-1.5" style={{ color: line.color }}>
                  [{line.ts}] {line.msg}
                </p>
              ))}
              <p className="animate-pulse text-[#E5E2E1]">_ PROCESSING STREAM...</p>
              <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                style={{ background: "linear-gradient(to top,#0e0e0e,transparent)" }} />
            </div>
          </div>

          {/* Pause */}
          <button
            onClick={() => router.push("/config")}
            className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-sm transition-all"
            style={{ background: "#2a2a2a", border: "1px solid rgba(229,226,225,0.1)" }}>
            <Pause size={16} />
            Pausar Análise
          </button>
        </aside>
      </div>
    </div>
  );
}
