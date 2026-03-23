"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, FileText, Video, Clock, Search,
  LayoutGrid, MoreHorizontal, ChevronRight, Zap,
  X, ChevronDown, Brain,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerateResponse {
  project_vibe: string;
  music_style: string;
  scenes: unknown[];
  background_tracks: unknown[];
  [key: string]: unknown;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const recentProjects = [
  { id: 1, title: "VSL - Suplemento Alfa",    date: "2 horas atrás", status: "Pronto",      type: "Texto" },
  { id: 2, title: "Corte Expert - Finanças",   date: "Ontem",         status: "Mapeando...", type: "Vídeo" },
  { id: 3, title: "Ad Meta - Unclaimed Funds", date: "3 dias atrás",  status: "Exportado",   type: "Vídeo" },
];

const NICHES = [
  { group: "Direct Response", options: [
    { value: "dr_bizopp",        label: "Renda Extra / BizOpp" },
    { value: "dr_nutra_weight",  label: "Emagrecimento / Nutra" },
    { value: "dr_nutra_pain",    label: "Dores Articulares" },
    { value: "dr_nutra_vision",  label: "Visão / Olhos" },
    { value: "dr_nutra_brain",   label: "Memória / Cognição" },
    { value: "dr_blood_sugar",   label: "Glicemia / Diabetes" },
    { value: "dr_survival",      label: "Sobrevivência / Segurança" },
    { value: "dr_manifestation", label: "Espiritualidade / Lei Atração" },
  ]},
  { group: "Finanças & Jurídico", options: [
    { value: "dr_financas_indenizacoes", label: "Indenizações / Acordos" },
    { value: "dr_financas_renda_extra",  label: "Finanças / Investimentos" },
  ]},
  { group: "Tradicional & Agência", options: [
    { value: "trad_real_estate", label: "Imobiliário / Loteamento" },
    { value: "trad_corporate",   label: "Corporativo / B2B" },
    { value: "trad_fitness",     label: "Fitness / Saúde" },
    { value: "trad_education",   label: "Educação / Infoproduto" },
    { value: "trad_local_biz",   label: "Negócios Locais / Restaurante" },
  ]},
];

const SELECT_CLS =
  "w-full bg-[#111] border border-white/5 text-gray-300 text-sm rounded-xl pl-4 pr-9 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 cursor-pointer appearance-none transition-colors";

// ─── StartScreen ──────────────────────────────────────────────────────────────

export default function StartScreen() {
  const router = useRouter();

  // Modal state
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [modalCopy,   setModalCopy]     = useState("");
  const [modalNiche,  setModalNiche]    = useState("dr_bizopp");
  const [isAnalyzing, setIsAnalyzing]   = useState(false);
  const [modalError,  setModalError]    = useState<string | null>(null);

  // ── Mapear Ganchos: fetch API → sessionStorage → /editor ────────────────────
  const handleMapear = async () => {
    if (!modalCopy.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setModalError(null);

    try {
      const res  = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          copy:        modalCopy,
          videoFormat: "vsl_long",
          videoTheme:  modalNiche,
        }),
      });
      const data = await res.json() as GenerateResponse;
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Erro desconhecido.");

      // Passa dados para o editor via sessionStorage
      sessionStorage.setItem("vb_project_result", JSON.stringify(data));
      sessionStorage.setItem("vb_project_copy",   modalCopy);

      router.push("/editor");
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Erro ao conectar com a IA.");
      setIsAnalyzing(false);
    }
  };

  const openModal  = () => { setIsModalOpen(true);  setModalError(null); };
  const closeModal = () => { if (!isAnalyzing) setIsModalOpen(false); };

  return (
    <>
      <div className="flex h-screen bg-[#0A0A0A] text-gray-200 font-sans">

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div className="w-64 border-r border-gray-800 flex flex-col p-6 bg-[#0F0F0F] shrink-0">
          <div className="flex items-center space-x-2 mb-10 px-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white italic text-sm shadow-[0_0_12px_rgba(37,99,235,0.35)]">V</div>
            <span className="font-bold text-lg tracking-tight">VisualBrain</span>
          </div>

          <nav className="flex-1 space-y-1">
            <button className="w-full flex items-center space-x-3 px-3 py-2 bg-blue-600/10 text-blue-500 rounded-lg font-medium text-sm">
              <LayoutGrid size={18} /><span>Projetos</span>
            </button>
            <button className="w-full flex items-center space-x-3 px-3 py-2 text-gray-500 hover:bg-gray-800 rounded-lg transition-colors text-sm">
              <Zap size={18} /><span>Templates</span>
            </button>
            <button className="w-full flex items-center space-x-3 px-3 py-2 text-gray-500 hover:bg-gray-800 rounded-lg transition-colors text-sm">
              <Clock size={18} /><span>Recentes</span>
            </button>
          </nav>

          <div className="mt-auto p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Plano Pro · Kraft Mídia</p>
            <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full w-3/4" />
            </div>
            <p className="text-[10px] mt-2 text-gray-400">75% do limite de transcrição usado</p>
          </div>
        </div>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#111] to-[#0A0A0A]">

          {/* Header */}
          <header className="p-10 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Olá, Editor 🚀</h1>
              <p className="text-gray-500">O que vamos criar hoje para escalar suas vendas?</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-600" size={16} />
                <input
                  placeholder="Buscar projeto..."
                  className="bg-gray-900 border border-gray-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-600 w-64 text-gray-300"
                />
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 border-2 border-gray-800 cursor-pointer"
                onClick={() => router.push("/login")} />
            </div>
          </header>

          {/* Quick Actions */}
          <div className="px-10 grid grid-cols-3 gap-6 mb-12">

            {/* Novo Roteiro VSL → abre modal */}
            <button
              onClick={openModal}
              className="group relative p-6 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/50 rounded-2xl transition-all text-left overflow-hidden"
            >
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-600/10 rounded-full blur-2xl group-hover:bg-blue-600/20 transition-all" />
              <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Novo Roteiro VSL</h3>
              <p className="text-sm text-gray-500">Cole seu texto e mapeie ativos visuais de alta conversão.</p>
              <ChevronRight className="absolute bottom-6 right-6 text-gray-700 group-hover:text-blue-500 transition-colors" />
            </button>

            {/* Cortes Inteligentes (em breve) */}
            <button className="group relative p-6 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-green-500/50 rounded-2xl transition-all text-left overflow-hidden opacity-60 cursor-not-allowed">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-600/10 rounded-full blur-2xl group-hover:bg-green-600/20 transition-all" />
              <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center text-green-500 mb-4">
                <Video size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Cortes Inteligentes</h3>
              <p className="text-sm text-gray-500">Suba o vídeo bruto do expert e deixe a IA mapear os B-rolls.</p>
              <span className="absolute top-4 right-4 text-[9px] bg-gray-800 border border-gray-700 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-widest">Em breve</span>
            </button>

            {/* Projeto personalizado → abre modal */}
            <button
              onClick={openModal}
              className="group p-6 border-2 border-dashed border-gray-800 hover:border-gray-600 rounded-2xl transition-all flex flex-col items-center justify-center text-center"
            >
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-500 mb-4 group-hover:bg-gray-700 transition-colors">
                <Plus size={24} />
              </div>
              <h3 className="text-gray-400 font-medium">Projeto Personalizado</h3>
            </button>
          </div>

          {/* Recent Projects */}
          <div className="px-10 pb-20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Projetos Recentes</h2>
              <button className="text-sm text-blue-500 hover:underline">Ver todos</button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => router.push("/editor")}
                  className="group bg-[#161616] hover:bg-[#1C1C1C] border border-gray-800 p-4 rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      project.type === "Texto" ? "bg-blue-900/30 text-blue-500" : "bg-green-900/30 text-green-500"
                    }`}>
                      {project.type === "Texto" ? <FileText size={20} /> : <Video size={20} />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white group-hover:text-blue-400 transition-colors">{project.title}</h4>
                      <p className="text-xs text-gray-500">{project.date} · {project.type}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-8">
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${
                      project.status === "Pronto"
                        ? "border-green-800 text-green-500 bg-green-900/10"
                        : project.status === "Mapeando..."
                          ? "border-yellow-800 text-yellow-500 bg-yellow-900/10 animate-pulse"
                          : "border-gray-700 text-gray-500"
                    }`}>
                      {project.status}
                    </span>
                    <button className="text-gray-600 hover:text-white" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: Novo Projeto ───────────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        >
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={closeModal} />

          {/* Modal card */}
          <div className="relative z-10 w-full max-w-xl bg-[#0f0f0f] border border-white/5 rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
                  <Brain className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="font-semibold text-gray-100 text-sm">Novo Roteiro VSL</span>
              </div>
              <button
                onClick={closeModal}
                disabled={isAnalyzing}
                className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-30"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">

              {/* Textarea */}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">
                  Copy / Roteiro
                </label>
                <textarea
                  value={modalCopy}
                  onChange={(e) => setModalCopy(e.target.value)}
                  disabled={isAnalyzing}
                  placeholder={`Cole sua Copy / Roteiro aqui...\n\nEx: "Você sabia que 87% das pessoas perdem dinheiro sem perceber? Hoje eu vou te mostrar o método que uso para..."`}
                  className="w-full h-44 bg-[#141414] border border-white/5 text-gray-200 placeholder-gray-700 text-sm leading-relaxed px-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 resize-none transition-colors disabled:opacity-50"
                />
                {modalCopy.length > 0 && (
                  <p className="text-right text-[10px] text-gray-700 mt-1">{modalCopy.length} caracteres</p>
                )}
              </div>

              {/* Niche selector */}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">
                  Nicho do Projeto
                </label>
                <div className="relative">
                  <select
                    value={modalNiche}
                    onChange={(e) => setModalNiche(e.target.value)}
                    disabled={isAnalyzing}
                    className={`${SELECT_CLS} disabled:opacity-50`}
                  >
                    {NICHES.map((group) => (
                      <optgroup key={group.group} label={`── ${group.group}`}>
                        {group.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5">
                  Ajuda a IA a escolher o vocabulário visual e o tom de áudio certos para o seu nicho.
                </p>
              </div>

              {/* Error */}
              {modalError && (
                <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 rounded-xl px-4 py-3">
                  <span className="text-xs text-red-400">{modalError}</span>
                </div>
              )}

              {/* CTA */}
              <button
                onClick={handleMapear}
                disabled={!modalCopy.trim() || isAnalyzing}
                className={`w-full flex flex-col items-center justify-center gap-0.5 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  modalCopy.trim() && !isAnalyzing
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-900/40 hover:shadow-blue-500/30"
                    : "bg-white/5 text-gray-600 cursor-not-allowed border border-white/5"
                }`}
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2.5">
                    <div className="w-4 h-4 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" />
                    Analisando psicologia da copy…
                  </span>
                ) : (
                  <>
                    <span>🧠 Mapear Ganchos (Gerar Projeto)</span>
                    <span className="text-[10px] font-normal opacity-70">Powered by GPT-4o · Pexels · Freesound</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
