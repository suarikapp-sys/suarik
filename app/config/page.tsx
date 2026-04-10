"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Film, Settings, User, Zap } from "lucide-react";

const ASPECT_RATIOS = [
  { ratio: "16:9", label: "Cinematic", wClass: "w-12 h-7" },
  { ratio: "9:16", label: "Social",    wClass: "w-7 h-12" },
  { ratio: "1:1",  label: "Square",    wClass: "w-9 h-9" },
];
const FRAME_RATES = ["23.976 fps", "24 fps", "29.97 fps", "30 fps", "60 fps"];
const RESOLUTIONS = ["1080p (1920×1080)", "4K UHD (3840×2160)", "DCI 4K (4096×2160)", "8K (7680×4320)"];

export default function ConfigPage() {
  const router = useRouter();
  const [selectedRatio, setSelectedRatio] = useState("16:9");
  const [fps, setFps] = useState("24 fps");
  const [resolution, setResolution] = useState("4K UHD (3840×2160)");
  const [proxyEnabled, setProxyEnabled] = useState(true);
  const [sceneDetect, setSceneDetect] = useState(false);

  return (
    <div className="min-h-screen bg-[#131313] text-[#E5E2E1] flex flex-col">
      {/* Header */}
      <nav className="flex justify-between items-center w-full px-6 h-16 bg-[#131313] fixed top-0 z-50 border-b border-white/[0.04]">
        <div className="flex items-center gap-8">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-white transition-colors">
            ← Voltar
          </button>
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-sm"
              style={{ background: "#F0563A", boxShadow: "0 0 16px rgba(240,86,58,0.4)" }}>S</div>
            <span className="text-lg font-black text-white tracking-tighter">SUARIK</span>
          </div>
          <div className="hidden md:flex gap-6">
            <button className="text-[#F0563A] border-b-2 pb-1 font-medium text-sm" style={{ borderColor: "#F0563A" }}>Projetos</button>
            {["Assets", "Timeline", "Exportar"].map(item => (
              <button key={item} className="text-[#E5E2E1]/60 font-medium text-sm hover:text-[#E5E2E1] transition-colors">{item}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-[#E5E2E1]/60 hover:text-[#E5E2E1]"><Zap size={18} /></button>
          <button className="text-[#E5E2E1]/60 hover:text-[#E5E2E1]"><Settings size={18} /></button>
          <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center border border-white/10">
            <User size={14} />
          </div>
        </div>
      </nav>

      <main className="flex-1 mt-16 flex flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col h-[calc(100vh-64px)] py-4 bg-[#1C1B1B] w-64 shrink-0 sticky top-16">
          <div className="px-6 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#2a2a2a] rounded flex items-center justify-center"
                style={{ border: "1px solid rgba(240,86,58,0.2)" }}>
                <Film size={18} style={{ color: "#F0563A" }} />
              </div>
              <div>
                <h3 className="text-sm font-bold truncate">Project Alpha</h3>
                <p className="text-[10px] font-mono uppercase tracking-widest text-[#E5E2E1]/50">4K 60FPS</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {[
              { icon: "📁", label: "Library", active: true },
              { icon: "✨", label: "AI Magic" },
              { icon: "🎨", label: "Effects" },
              { icon: "🎵", label: "Áudio" },
              { icon: "🕐", label: "Histórico" },
            ].map(item => (
              <div key={item.label}
                className="flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all"
                style={{
                  background: item.active ? "#2A2A2A" : "transparent",
                  color: item.active ? "#F0563A" : "rgba(229,226,225,0.5)",
                  borderRight: item.active ? "2px solid #F0563A" : "none",
                }}>
                <span className="text-base">{item.icon}</span>
                <span className="text-sm font-mono uppercase tracking-wider">{item.label}</span>
              </div>
            ))}
          </nav>
          <div className="px-3 pt-4 mt-4 border-t border-white/5">
            {["Ajuda", "Storage"].map(item => (
              <div key={item} className="flex items-center gap-3 px-3 py-2 text-[#E5E2E1]/50 hover:bg-[#2A2A2A]/50 cursor-pointer rounded-lg transition-all">
                <span className="text-xs font-mono uppercase tracking-widest">{item}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Config Canvas */}
        <section className="flex-1 bg-[#131313] p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            <header className="mb-12">
              <h1 className="text-4xl font-black tracking-tighter mb-2">Configuração do Projeto</h1>
              <p className="text-[#E5E2E1]/60 font-medium">Verifique as configurações da sequência antes de entrar na timeline.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column */}
              <div className="lg:col-span-7 space-y-10">
                {/* Aspect Ratio */}
                <div>
                  <label className="font-mono text-xs text-[#E5E2E1]/60 mb-4 block uppercase tracking-widest">Formato / Proporção</label>
                  <div className="grid grid-cols-3 gap-4">
                    {ASPECT_RATIOS.map(ar => {
                      const active = selectedRatio === ar.ratio;
                      return (
                        <button key={ar.ratio} onClick={() => setSelectedRatio(ar.ratio)}
                          className="flex flex-col items-center justify-center p-6 rounded-xl transition-all border"
                          style={{
                            background: active ? "rgba(240,86,58,0.08)" : "#1c1b1b",
                            borderColor: active ? "rgba(240,86,58,0.4)" : "rgba(92,64,55,0.2)",
                          }}>
                          <div className={`${ar.wClass} rounded-sm mb-3 border`}
                            style={{
                              background: active ? "rgba(240,86,58,0.2)" : "rgba(229,226,225,0.08)",
                              borderColor: active ? "rgba(240,86,58,0.5)" : "rgba(229,226,225,0.2)",
                            }} />
                          <span className="font-mono text-sm font-bold"
                            style={{ color: active ? "#F0563A" : "rgba(229,226,225,0.6)" }}>{ar.ratio}</span>
                          <span className="text-[10px] text-[#E5E2E1]/50 mt-1">{ar.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FPS + Resolution */}
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="font-mono text-xs text-[#E5E2E1]/60 mb-4 block uppercase tracking-widest">Frame Rate (FPS)</label>
                    <select
                      value={fps} onChange={e => setFps(e.target.value)}
                      className="w-full rounded-lg text-[#E5E2E1] font-mono py-3 px-4 focus:ring-1 outline-none"
                      style={{ background: "#0e0e0e", border: "1px solid rgba(92,64,55,0.2)", caretColor: "#F0563A" }}>
                      {FRAME_RATES.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-[#E5E2E1]/60 mb-4 block uppercase tracking-widest">Resolução</label>
                    <select
                      value={resolution} onChange={e => setResolution(e.target.value)}
                      className="w-full rounded-lg text-[#E5E2E1] font-mono py-3 px-4 focus:ring-1 outline-none"
                      style={{ background: "#0e0e0e", border: "1px solid rgba(92,64,55,0.2)" }}>
                      {RESOLUTIONS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                {/* Performance options */}
                <div className="p-6 rounded-xl space-y-6" style={{ background: "#1c1b1b" }}>
                  {[
                    { label: "Proxy Generation", desc: "Cria arquivos de baixa resolução para edição mais fluida.", value: proxyEnabled, set: setProxyEnabled },
                    { label: "AI Scene Detection", desc: "Divide clipes automaticamente com base em transições visuais.", value: sceneDetect, set: setSceneDetect },
                  ].map(opt => (
                    <div key={opt.label} className="flex items-center justify-between" style={{ opacity: opt.value || opt.label === "Proxy Generation" ? 1 : 0.5 }}>
                      <div>
                        <h4 className="font-bold text-[#E5E2E1]">{opt.label}</h4>
                        <p className="text-xs text-[#E5E2E1]/50">{opt.desc}</p>
                      </div>
                      <button onClick={() => opt.set(!opt.value)}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                        style={{ background: opt.value ? "#F0563A" : "#2a2a2a" }}>
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                          style={{ transform: `translateX(${opt.value ? "24px" : "4px"})` }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column */}
              <div className="lg:col-span-5">
                <div className="sticky top-8 space-y-6">
                  {/* Preview */}
                  <div className="rounded-xl overflow-hidden aspect-video bg-[#0e0e0e] border relative"
                    style={{ borderColor: "rgba(92,64,55,0.1)" }}>
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg,#0a0a0a,#1a1a1a)" }}>
                      <div className="text-center opacity-20">
                        <Film size={40} className="mx-auto mb-2" />
                        <p className="font-mono text-xs uppercase tracking-widest">Preview</p>
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <span className="px-2 py-1 text-[10px] font-mono rounded border border-white/10"
                        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
                        PREVIEW_CAM_A_001
                      </span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="p-6 rounded-xl" style={{ background: "#1c1b1b" }}>
                    <h3 className="font-mono text-xs uppercase tracking-widest mb-4" style={{ color: "#F0563A" }}>
                      Metadados Detectados
                    </h3>
                    <div className="space-y-3">
                      {[
                        { label: "Codec",            value: "ProRes 422 HQ" },
                        { label: "Espaço de Cor",    value: "Rec.709", color: "#00daf3" },
                        { label: "Bit Depth",        value: "10-bit" },
                        { label: "Canais de Áudio",  value: "8 Mono" },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between items-center text-sm py-2 border-b"
                          style={{ borderColor: "rgba(92,64,55,0.1)" }}>
                          <span className="text-[#E5E2E1]/60">{item.label}</span>
                          <span className="font-mono font-bold" style={{ color: item.color || "#E5E2E1" }}>
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Launch */}
                  <button
                    onClick={() => router.push("/processing")}
                    className="w-full py-5 rounded-xl flex items-center justify-center gap-3 group transition-transform active:scale-95"
                    style={{ background: "linear-gradient(135deg,#F0563A,#c44527)", boxShadow: "0 0 24px rgba(240,86,58,0.3)" }}>
                    <span className="text-white font-black tracking-tighter text-xl uppercase">Launch Timeline</span>
                    <ChevronRight size={20} className="text-white group-hover:translate-x-1 transition-transform" />
                  </button>

                  <p className="text-center text-[10px] font-mono text-[#E5E2E1]/40 uppercase tracking-widest">
                    Ao clicar em Launch você aceita os parâmetros da sessão.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
