"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, Zap, Film, Gauge, Lock, Settings, User } from "lucide-react";

async function storeFileInIDB(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("enricherDB", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => {
      const tx = req.result.transaction("files", "readwrite");
      tx.objectStore("files").put(file, "pending");
      tx.oncomplete = () => { req.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

export default function EnricherPage() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<"16:9"|"9:16"|"1:1">("9:16");
  const [analyzing, setAnalyzing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("video/")) {
      setFile(f);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleAnalyze = async () => {
    if (!file || analyzing) return;
    setAnalyzing(true);
    try {
      await storeFileInIDB(file);
      sessionStorage.setItem("vb_enricher_format", selectedFormat);
      sessionStorage.setItem("vb_enricher_pending", "1");
      router.push("/storyboard");
    } catch {
      setAnalyzing(false);
    }
  };

  const recent = [
    { name: "CITY_SCENE_V1.mp4" },
    { name: "INTERVIEW_A_ROLL.mp4" },
  ];

  return (
    <div className="flex h-screen bg-[#131313] text-[#E5E2E1] overflow-hidden">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 z-50 flex justify-between items-center w-full px-6 h-16 bg-[#131313] border-b border-white/[0.04]">
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
            {["Projetos", "Assets", "Arquivo"].map(item => (
              <button key={item} className="text-[#E5E2E1]/60 font-medium hover:text-[#F0563A] transition-colors text-sm">
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#2a2a2a] px-3 py-1.5 rounded-xl">
            <Zap size={14} style={{ color: "#00daf3" }} />
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#E5E2E1]">
              Fuel: <span style={{ color: "#00daf3" }}>1,240</span>
            </span>
          </div>
          <button className="text-[#E5E2E1]/60 hover:text-[#F0563A] transition-colors"><Settings size={18} /></button>
          <button className="text-[#E5E2E1]/60 hover:text-[#F0563A] transition-colors"><User size={18} /></button>
        </div>
      </header>

      <div className="flex w-full pt-16">
        {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="flex flex-col h-[calc(100vh-64px)] border-r border-[#1C1B1B] bg-[#1C1B1B] w-64 shrink-0 sticky top-16">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#2a2a2a] flex items-center justify-center"
                style={{ border: "1px solid rgba(240,86,58,0.2)" }}>
                <Film size={18} style={{ color: "#F0563A" }} />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "#F0563A" }}>Enricher</p>
                <p className="text-[10px] text-[#E5E2E1]/50 font-mono uppercase tracking-widest">AI Overlay Suite</p>
              </div>
            </div>

            <button
              className="w-full font-bold text-xs py-3 rounded-lg mb-8 active:scale-95 transition-transform text-white"
              style={{ background: "linear-gradient(135deg,#F0563A,#c44527)" }}>
              Nova Sequência
            </button>

            <nav className="flex flex-col gap-1">
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
                  <span className="text-base">{item.icon}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider">{item.label}</span>
                </div>
              ))}
            </nav>
          </div>

          {/* Recent Library */}
          <div className="mt-auto p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#E5E2E1]/30 mb-4">Recentes</p>
            <div className="space-y-4">
              {recent.map(r => (
                <div key={r.name} className="flex items-center gap-3 group cursor-pointer">
                  <div className="w-12 h-8 bg-[#2a2a2a] rounded border border-white/5 flex items-center justify-center">
                    <Film size={12} className="text-[#E5E2E1]/40 group-hover:text-[#F0563A] transition-colors" />
                  </div>
                  <span className="font-mono text-[9px] text-[#E5E2E1]/60 truncate">{r.name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ─── Main Canvas ─────────────────────────────────────────────────── */}
        <main className="relative flex-1 flex flex-col items-center justify-center p-12 overflow-y-auto">
          {/* Background glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full"
              style={{ background: "rgba(99,5,239,0.06)", filter: "blur(120px)" }} />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full"
              style={{ background: "rgba(240,86,58,0.04)", filter: "blur(100px)" }} />
          </div>

          <div className="relative z-10 w-full max-w-4xl">
            {/* Glass container */}
            <div className="rounded-xl p-12 flex flex-col items-center text-center"
              style={{ background: "rgba(42,42,42,0.4)", backdropFilter: "blur(40px)", border: "1px solid rgba(92,64,55,0.1)" }}>

              {/* AI Status badge */}
              <div className="flex items-center gap-2 mb-10 px-4 py-2 rounded-full border"
                style={{ background: "rgba(99,5,239,0.1)", borderColor: "rgba(207,189,255,0.2)" }}>
                <span className="text-sm">✨</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#cfbdff" }}>
                  AI Enhancement Ready
                </span>
              </div>

              {!file ? (
                /* Drop Zone */
                <div
                  className="w-full rounded-xl flex flex-col items-center justify-center py-20 cursor-pointer transition-all duration-300"
                  style={{
                    border: `2px dashed ${dragging ? "rgba(240,86,58,0.5)" : "rgba(92,64,55,0.3)"}`,
                    background: dragging ? "rgba(240,86,58,0.03)" : "transparent",
                  }}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                >
                  <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

                  <div className="mb-8 relative">
                    <div className="absolute -inset-4 rounded-full opacity-20"
                      style={{ background: "linear-gradient(135deg,#F0563A,#ff7a4d)", filter: "blur(20px)" }} />
                    <div className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
                      style={{ background: "linear-gradient(135deg,#F0563A,#c44527)" }}>
                      <Upload size={32} className="text-white" />
                    </div>
                  </div>

                  <h2 className="text-3xl font-extrabold tracking-tight mb-2">Arraste seu A-Roll MP4 aqui</h2>
                  <p className="text-[#E5E2E1]/50 text-sm mb-10 max-w-md">
                    H.264 10-bit ou ProRes recomendado. A análise IA começa imediatamente após o upload.
                  </p>

                  <div className="flex gap-4">
                    <button className="px-6 py-3 rounded-lg font-semibold text-xs transition-colors"
                      style={{ background: "#353534", color: "#E5E2E1" }}>
                      Procurar Arquivo
                    </button>
                    <button className="px-6 py-3 rounded-lg font-semibold text-xs transition-colors border"
                      style={{ borderColor: "rgba(92,64,55,0.3)", color: "rgba(229,226,225,0.7)" }}>
                      Biblioteca Cloud
                    </button>
                  </div>
                </div>
              ) : (
                /* File selected — format selection */
                <div className="w-full space-y-8">
                  <div className="flex items-center gap-4 p-4 rounded-xl border"
                    style={{ background: "rgba(240,86,58,0.08)", borderColor: "rgba(240,86,58,0.2)" }}>
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg,#F0563A,#c44527)" }}>
                      <Film size={20} className="text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">{file.name}</p>
                      <p className="text-[#E5E2E1]/50 text-xs font-mono">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button className="ml-auto text-[#E5E2E1]/40 hover:text-[#F0563A] transition-colors text-xs font-mono uppercase tracking-wider"
                      onClick={() => setFile(null)}>Trocar</button>
                  </div>

                  {/* Format selection */}
                  <div className="text-left">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#E5E2E1]/40 mb-4">Formato de Saída</p>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { ratio: "16:9" as const, label: "Cinematic", w: "w-12", h: "h-7" },
                        { ratio: "9:16" as const, label: "Social / Reels", w: "w-7", h: "h-12" },
                        { ratio: "1:1"  as const, label: "Square", w: "w-9", h: "h-9" },
                      ].map((fmt) => {
                        const isSelected = selectedFormat === fmt.ratio;
                        return (
                          <button key={fmt.ratio}
                            onClick={() => setSelectedFormat(fmt.ratio)}
                            className="flex flex-col items-center justify-center p-6 rounded-xl transition-all border"
                            style={{
                              background: isSelected ? "rgba(240,86,58,0.08)" : "rgba(42,42,42,0.4)",
                              borderColor: isSelected ? "rgba(240,86,58,0.4)" : "rgba(92,64,55,0.2)",
                            }}>
                            <div className={`${fmt.w} ${fmt.h} rounded-sm mb-3 border`}
                              style={{
                                background: isSelected ? "rgba(240,86,58,0.2)" : "rgba(229,226,225,0.08)",
                                borderColor: isSelected ? "rgba(240,86,58,0.5)" : "rgba(229,226,225,0.2)",
                              }} />
                            <span className="font-mono text-sm font-bold" style={{ color: isSelected ? "#F0563A" : "#E5E2E1" }}>
                              {fmt.ratio}
                            </span>
                            <span className="text-[10px] text-[#E5E2E1]/50 mt-1">{fmt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="w-full py-5 rounded-xl font-black text-sm uppercase tracking-wider transition-all active:scale-95 text-white disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#F0563A,#c44527)", boxShadow: "0 0 24px rgba(240,86,58,0.3)" }}>
                    {analyzing ? "⏳ Preparando análise..." : "⚡ Iniciar Análise Neural"}
                  </button>
                </div>
              )}

              {/* Footer icons */}
              {!file && (
                <div className="mt-12 grid grid-cols-3 gap-12 w-full max-w-2xl">
                  {[
                    { icon: <Gauge size={24} />, label: "Fast Ingest" },
                    { icon: <span className="text-2xl">CC</span>, label: "Auto-Transcribe" },
                    { icon: <Film size={24} />, label: "B-Roll Suggest" },
                  ].map(item => (
                    <div key={item.label} className="flex flex-col items-center gap-2">
                      <div className="text-[#E5E2E1]/30">{item.icon}</div>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#E5E2E1]/40">{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer context */}
            {!file && (
              <div className="mt-8 flex justify-between items-center px-4">
                <div className="flex gap-8">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#E5E2E1]/40 mb-1">Target</p>
                    <p className="text-xs font-mono">ENRICHER_WORKFLOW_02</p>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#E5E2E1]/40 mb-1">Est. Duration</p>
                    <p className="text-xs font-mono" style={{ color: "#00daf3" }}>~2:45 MIN</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[#E5E2E1]/30">
                  <Lock size={14} />
                  <span className="text-[10px] font-mono uppercase tracking-widest">Upload Criptografado</span>
                </div>
              </div>
            )}
          </div>

          {/* AI Toast */}
          <div className="fixed bottom-8 right-8 z-50 p-4 rounded-xl border flex items-center gap-4 max-w-sm"
            style={{ background: "rgba(53,53,52,0.8)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 0 40px -10px rgba(99,5,239,0.3)" }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "#6305ef" }}>
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h4 className="text-xs font-bold">Pro Tip</h4>
              <p className="text-[11px] text-[#E5E2E1]/60">Use áudio limpo para 40% mais precisão na transcrição.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
