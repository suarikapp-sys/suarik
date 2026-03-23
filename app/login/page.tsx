"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Chrome } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);

  // Bypass simulado — Auth real (Clerk/Supabase) será integrado na próxima fase
  const handleSimulatedLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000)); // 1s de sensação de carregamento
    router.push("/");
  };

  return (
    <div className="flex h-screen font-sans overflow-hidden">

      {/* ── LADO ESQUERDO — Formulário ──────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 bg-[#0A0A0A] flex flex-col items-center justify-center px-8 py-12 relative">

        {/* Logo */}
        <div className="absolute top-8 left-8 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white italic text-sm shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            V
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-tight">VisualBrain</span>
            <span className="text-gray-600 text-[10px] ml-1.5 font-normal">by Kraft Mídia</span>
          </div>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1.5">Bem-vindo de volta, Editor</h1>
            <p className="text-sm text-gray-500">Entre na sua conta para continuar escalando.</p>
          </div>

          {/* Google Button */}
          <button
            onClick={() => handleSimulatedLogin()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-all duration-200 mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? <><div className="w-4 h-4 border-2 border-gray-500/30 border-t-gray-400 rounded-full animate-spin" /> Autenticando...</>
              : <><Chrome className="w-4 h-4" /> Continuar com Google</>
            }
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[10px] text-gray-600 uppercase tracking-widest">ou</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Form */}
          <form onSubmit={handleSimulatedLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-medium mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                required
                className="w-full bg-[#141414] border border-white/5 text-gray-200 placeholder-gray-700 text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-medium">
                  Senha
                </label>
                <button type="button" className="text-[10px] text-blue-500 hover:text-blue-400 transition-colors">
                  Esqueci a senha
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#141414] border border-white/5 text-gray-200 placeholder-gray-700 text-sm px-4 py-2.5 pr-10 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 mt-2 ${
                loading
                  ? "bg-blue-600/50 text-blue-300 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-900/40 hover:shadow-blue-500/30"
              }`}
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" /> Autenticando…</>
              ) : (
                <>Entrar <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">
            Não tem conta?{" "}
            <button className="text-blue-500 hover:text-blue-400 transition-colors font-medium">
              Criar conta grátis
            </button>
          </p>
        </div>

        {/* Footer */}
        <p className="absolute bottom-6 text-[10px] text-gray-700">
          © 2025 Kraft Mídia · Todos os direitos reservados
        </p>
      </div>

      {/* ── LADO DIREITO — Visual / Marketing ──────────────────────────────── */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-[#050510] items-center justify-center">

        {/* Gradient mesh background */}
        <div className="absolute inset-0">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/25 blur-[100px]" />
          <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-[80px]" />
          <div className="absolute inset-0 bg-[#050510]/60" />
        </div>

        {/* Glassmorphism card */}
        <div className="relative z-10 max-w-md px-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">IA de Retenção Ativa</span>
          </div>

          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            A IA que transforma sua{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              copy em retenção.
            </span>
          </h2>

          <p className="text-gray-400 text-sm leading-relaxed mb-10">
            Pare de caçar B-roll e comece a escalar. Cole o roteiro — a IA mapeia cada gatilho, escolhe os clips certos e monta a Direção de Arte em segundos.
          </p>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-8">
            {[
              { value: "3x", label: "Mais rápido" },
              { value: "94%", label: "Retenção média" },
              { value: "∞", label: "Nichos suportados" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-black text-white">{stat.value}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Decorative glass card */}
          <div className="mt-12 bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-5 text-left">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[10px] text-gray-600 ml-2 font-mono">mapa-edicao.json</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <p><span className="text-purple-400">"scene_1"</span><span className="text-gray-600">: </span><span className="text-green-400">"HOOK · Curiosidade"</span></p>
              <p><span className="text-purple-400">"vault_category"</span><span className="text-gray-600">: </span><span className="text-amber-300">"hook_dr_choque"</span></p>
              <p><span className="text-purple-400">"broll_match"</span><span className="text-gray-600">: </span><span className="text-blue-400">"98%"</span></p>
              <p><span className="text-purple-400">"music_style"</span><span className="text-gray-600">: </span><span className="text-green-400">"vsl_tension"</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
