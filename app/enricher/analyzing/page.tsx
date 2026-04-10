"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Settings, User } from "lucide-react";

const LOG_LINES = [
  { ts: "14:02:11", msg: "HEVC stream detected. Initializing neural pathways...", color: "#F0563A" },
  { ts: "14:02:12", msg: "Frame 0014: Subject tracking established. Vector mapping 4x.", color: "#F0563A" },
  { ts: "14:02:13", msg: 'AI Denoising: Surface detected "Concrete_Wet". Applying filter.', color: "#F0563A" },
  { ts: "14:02:14", msg: "Optimization: GPU load distributed. 6.2 TFLOPS utilized.", color: "#00daf3" },
  { ts: "14:02:15", msg: "Neural extraction: Metadata key-value pairs stored.", color: "#F0563A" },
  { ts: "14:02:16", msg: "Anomaly check: Noise floor within acceptable cinematic limits.", color: "#F0563A" },
  { ts: "14:02:17", msg: "Scene segmentation: 12 keyframes identified.", color: "#cfbdff" },
  { ts: "14:02:18", msg: "B-Roll matching engine: 47 candidates queued.", color: "#F0563A" },
];

export default function AnalyzingPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [visibleLogs, setVisibleLogs] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => router.push("/config"), 800);
          return 100;
        }
        return p + 1;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    const logInterval = setInterval(() => {
      setVisibleLogs(v => Math.min(v + 1, LOG_LINES.length));
    }, 700);
    return () => clearInterval(logInterval);
  }, []);

  const tags = ["Cinematic", "Rainy Night", "Urban", "Anamorphic", "High Dynamic", "Cyberpunk"];

  return (
    <div className="flex h-screen bg-[#131313] text-[#E5E2E1] overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full flex justify-between items-center px-6 h-16 bg-[#131313] border-b border-white/[0.04]">
        <div className="flex items-center gap-8">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm font-semibold text-[#E5E2E1]/50 hover:text-[#E5E2E1] transition-colors">
            ← Voltar
          </button>
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-sm"
              style={{ background: "#F0563A", boxShadow: "0 0 16px rgba(240,86,58,0.4)" }}>S</div>
            <span className="text-lg font-black text-white tracking-tighter">SUARIK</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <button className="text-[#F0563A] font-bold border-b-2 pb-1 text-sm" style={{ borderColor: "#F0563A" }}>Projetos</button>
            {["Assets", "Arquivo"].map(item => (
              <button key={item} className="text-[#E5E2E1]/60 hover:text-[#F0563A] transition-colors text-sm">{item}</button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-[#E5E2E1]/60 hover:text-[#F0563A] transition-colors"><Settings size={18} /></button>
          <button className="text-[#E5E2E1]/60 hover:text-[#F0563A] transition-colors"><User size={18} /></button>
        </div>
      </header>

      <div className="flex w-full pt-16">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col h-[calc(100vh-64px)] w-64 bg-[#1C1B1B] border-r border-[#1C1B1B] sticky top-16">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#2a2a2a] flex items-center justify-center"
                style={{ border: "1px solid rgba(240,86,58,0.2)" }}>
                <Film size={18} style={{ color: "#F0563A" }} />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "#F0563A" }}>Project Alpha</p>
                <p className="text-[10px] text-[#E5E2E1]/50">4K 60fps</p>
              </div>
            </div>
            <button className="w-full py-3 px-4 rounded-lg font-bold text-sm mb-8 transition-transform active:scale-95 text-white"
              style={{ background: "linear-gradient(135deg,#F0563A,#c44527)" }}>
              Nova Sequência
            </button>
            <nav className="space-y-1">
              {[
                { icon: "⏱", label: "Timeline" },
                { icon: "✨", label: "AI Tools", active: true },
                { icon: "🗄", label: "Metadados" },
                { icon: "📤", label: "Exportar" },
              ].map(item => (
                <div key={item.label}
                  className="flex items-center gap-3 py-3 px-4 rounded-lg cursor-pointer transition-all"
                  style={{
                    background: item.active ? "#2A2A2A" : "transparent",
                    color: item.active ? "#F0563A" : "rgba(229,226,225,0.5)",
                  }}>
                  <span>{item.icon}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider">{item.label}</span>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Canvas */}
        <main className="flex-1 overflow-hidden bg-[#131313] relative flex flex-col">
          {/* Header */}
          <div className="p-8 flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-black tracking-tighter flex items-center gap-3 uppercase">
                Análise Neural
                <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "#F0563A" }} />
              </h2>
              <p className="font-mono text-xs tracking-widest text-[#E5E2E1]/40 mt-1 uppercase">
                Engaging AI Super-Sampling Core 2.4
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-4xl font-black" style={{ color: "#F0563A" }}>
                {progress}<span className="text-lg opacity-50">%</span>
              </p>
              <div className="w-48 h-1.5 mt-2 rounded-full overflow-hidden" style={{ background: "#2a2a2a" }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: "linear-gradient(90deg,#F0563A,#ff7a4d)" }} />
              </div>
            </div>
          </div>

          {/* Preview + Analysis Log */}
          <div className="flex-1 px-8 pb-8 flex flex-col gap-6 min-h-0">
            {/* Video Preview */}
            <div className="flex-1 rounded-xl bg-[#0e0e0e] relative overflow-hidden flex items-center justify-center min-h-0"
              style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
              {/* Cinematic overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#131313]/60 z-10" />

              {/* Scan line */}
              <div className="absolute z-20 left-0 right-0 h-0.5 transition-all duration-500"
                style={{
                  top: `${(progress % 100)}%`,
                  background: "linear-gradient(90deg,transparent,#F0563A,transparent)",
                  boxShadow: "0 0 15px #F0563A",
                }} />

              {/* Bounding boxes */}
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div className="absolute border bg-white/5"
                  style={{ top: "25%", left: "33%", width: "8rem", height: "12rem", borderColor: "rgba(240,86,58,0.4)" }}>
                  <span className="absolute -top-5 left-0 font-mono text-[8px] uppercase" style={{ color: "rgba(240,86,58,0.8)" }}>
                    Subject_01: Human
                  </span>
                </div>
                <div className="absolute border bg-white/5"
                  style={{ bottom: "25%", right: "25%", width: "16rem", height: "8rem", borderColor: "rgba(207,189,255,0.4)" }}>
                  <span className="absolute -top-5 left-0 font-mono text-[8px] uppercase" style={{ color: "rgba(207,189,255,0.8)" }}>
                    Environment_04: Volumetrics
                  </span>
                </div>
              </div>

              {/* Bottom overlay */}
              <div className="absolute bottom-6 left-6 right-6 p-4 rounded-lg flex justify-between items-center z-20"
                style={{ background: "rgba(42,42,42,0.8)", backdropFilter: "blur(20px)", border: "1px solid rgba(229,226,225,0.05)" }}>
                <div className="flex gap-8">
                  <div>
                    <span className="font-mono text-[10px] text-[#E5E2E1]/40 uppercase block">Frame Index</span>
                    <span className="font-mono text-sm">00:14:22:18</span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-[#E5E2E1]/40 uppercase block">Confidence</span>
                    <span className="font-mono text-sm" style={{ color: "#00daf3" }}>98.4%</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {[1, 0.4, 0.2].map((o, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: `rgba(240,86,58,${o})` }} />
                  ))}
                </div>
              </div>

              {/* Placeholder background */}
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#0a0a0a,#1a1a1a)" }}>
                <div className="text-center opacity-20">
                  <Film size={48} className="mx-auto mb-2" />
                  <p className="font-mono text-xs uppercase tracking-widest">Processando frames...</p>
                </div>
              </div>
            </div>

            {/* Analysis Log */}
            <div className="h-36 rounded-xl p-4 overflow-hidden flex flex-col"
              style={{ background: "rgba(42,42,42,0.8)", backdropFilter: "blur(20px)", border: "1px solid rgba(229,226,225,0.05)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-[#E5E2E1]/40 uppercase tracking-widest">Analysis Log</span>
                <span className="font-mono text-[8px] uppercase animate-pulse" style={{ color: "#F0563A" }}>Live Stream</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5">
                {LOG_LINES.slice(0, visibleLogs).map((line, i) => (
                  <p key={i} className="font-mono text-[10px]" style={{ color: "rgba(229,226,225,0.6)" }}>
                    <span style={{ color: line.color }}>[{line.ts}]</span> {line.msg}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="hidden lg:flex flex-col w-80 bg-[#1C1B1B] border-l border-[#1C1B1B] p-6 gap-8 overflow-y-auto">
          {/* Neural Extraction */}
          <section>
            <h3 className="font-mono text-[10px] text-[#E5E2E1]/40 uppercase tracking-widest mb-6">Extração Neural</h3>
            <div className="space-y-3">
              {[
                { label: "Frame Rate", value: "60fps" },
                { label: "Resolução", value: "4K" },
                { label: "Bitrate", value: "420 MB/s", highlight: true },
              ].map(item => (
                <div key={item.label} className="p-4 rounded-lg flex justify-between items-center"
                  style={{ background: "#201f1f" }}>
                  <span className="text-xs text-[#E5E2E1]/60">{item.label}</span>
                  <span className="font-mono text-sm font-bold"
                    style={{ color: item.highlight ? "#F0563A" : "#E5E2E1" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Semantic Tags */}
          <section>
            <h3 className="font-mono text-[10px] text-[#E5E2E1]/40 uppercase tracking-widest mb-4">Semantic Tags</h3>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, i) => (
                <span key={tag} className="px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider"
                  style={{
                    background: i === 0 ? "rgba(207,189,255,0.1)" : "rgba(42,42,42,0.8)",
                    border: `1px solid ${i === 0 ? "rgba(207,189,255,0.3)" : i === 4 ? "rgba(0,218,243,0.3)" : "rgba(255,255,255,0.05)"}`,
                    color: i === 0 ? "#cfbdff" : i === 4 ? "#00daf3" : "rgba(229,226,225,0.6)",
                  }}>
                  {tag}
                </span>
              ))}
            </div>
          </section>

          {/* AI Suggestion */}
          <section className="mt-auto">
            <div className="p-4 rounded-xl mb-4 border"
              style={{ background: "rgba(99,5,239,0.08)", borderColor: "rgba(207,189,255,0.2)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">✨</span>
                <span className="font-mono text-[10px] uppercase font-bold" style={{ color: "#cfbdff" }}>AI Suggestion</span>
              </div>
              <p className="text-xs text-[#E5E2E1]/80 leading-relaxed">
                Considere aumentar 'Motion Sharpness' para partículas de chuva no background.
              </p>
            </div>
            <button
              onClick={() => router.push("/enricher")}
              className="w-full py-4 rounded-lg font-mono text-[10px] uppercase tracking-[0.2em] transition-colors"
              style={{ background: "#2a2a2a", border: "1px solid rgba(229,226,225,0.1)" }}>
              Abortar Análise
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
