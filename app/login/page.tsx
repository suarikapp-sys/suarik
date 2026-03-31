"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "reset";

export default function LoginPage() {
  const router  = useRouter();
  const supabase = createClient();

  const [mode, setMode]         = useState<Mode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      router.push("/");
      router.refresh();

    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) { setError(error.message); setLoading(false); return; }
      setSuccess("Verifique seu e-mail para confirmar o cadastro.");

    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) { setError(error.message); setLoading(false); return; }
      setSuccess("Link de recuperação enviado para seu e-mail.");
    }

    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setLoading(false); }
  };

  return (
    <div className="flex h-screen font-sans overflow-hidden">

      {/* ── FORMULÁRIO ─────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 bg-[#0A0A0A] flex flex-col items-center justify-center px-8 py-12 relative">

        {/* Logo */}
        <div className="absolute top-8 left-8 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-sm"
            style={{ background: "#F0563A", boxShadow: "0 0 18px rgba(240,86,58,0.35)" }}>S</div>
          <span className="text-lg font-black text-white" style={{ letterSpacing: "-0.04em" }}>Suarik</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1.5">
              {mode === "login" ? "Bem-vindo de volta" : mode === "signup" ? "Criar sua conta" : "Recuperar senha"}
            </h1>
            <p className="text-sm text-gray-500">
              {mode === "login" ? "Entre para continuar escalando." : mode === "signup" ? "Comece grátis. Sem cartão." : "Enviaremos um link para seu e-mail."}
            </p>
          </div>

          {/* Google */}
          {mode !== "reset" && (
            <>
              <button onClick={handleGoogle} disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-all mb-6 disabled:opacity-50">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-gray-500/30 border-t-gray-400 rounded-full animate-spin" />Conectando...</>
                  : <><GoogleIcon />Continuar com Google</>}
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-gray-600 uppercase tracking-widest">ou</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-medium mb-1.5">E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="voce@exemplo.com" required
                className="w-full bg-[#141414] border border-white/5 text-gray-200 placeholder-gray-700 text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:border-orange-500/50 transition-colors"
                style={{ "--tw-ring-color": "rgba(240,86,58,0.4)" } as React.CSSProperties}
              />
            </div>

            {mode !== "reset" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-medium">Senha</label>
                  {mode === "login" && (
                    <button type="button" onClick={() => setMode("reset")}
                      className="text-[10px] text-orange-500 hover:text-orange-400 transition-colors">
                      Esqueci a senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required
                    className="w-full bg-[#141414] border border-white/5 text-gray-200 placeholder-gray-700 text-sm px-4 py-2.5 pr-10 rounded-xl focus:outline-none focus:ring-1 transition-colors"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>
            )}
            {success && (
              <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">{success}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all mt-2 text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#F0563A,#c44527)", boxShadow: "0 4px 20px rgba(240,86,58,0.3)" }}>
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Aguarde…</>
                : <>{mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"} <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">
            {mode === "login" ? (
              <>Não tem conta?{" "}
                <button onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
                  className="text-orange-500 hover:text-orange-400 transition-colors font-medium">Criar conta grátis</button></>
            ) : (
              <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className="text-orange-500 hover:text-orange-400 transition-colors font-medium">← Voltar ao login</button>
            )}
          </p>
        </div>

        <p className="absolute bottom-6 text-[10px] text-gray-700">© 2025 Kraft Mídia · Todos os direitos reservados</p>
      </div>

      {/* ── LADO VISUAL ────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center" style={{ background: "#050505" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full opacity-20"
            style={{ background: "radial-gradient(ellipse at center,#F0563A,transparent)", filter: "blur(120px)" }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full opacity-15"
            style={{ background: "radial-gradient(ellipse at center,#7c3aed,transparent)", filter: "blur(100px)" }} />
        </div>

        <div className="relative z-10 max-w-md px-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 border"
            style={{ background: "rgba(240,86,58,0.08)", borderColor: "rgba(240,86,58,0.2)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-orange-300 uppercase tracking-widest font-semibold">IA de Edição Ativa</span>
          </div>

          <h2 className="text-3xl font-black text-white leading-tight mb-4" style={{ letterSpacing: "-0.04em" }}>
            A IA que transforma sua{" "}
            <span style={{ background: "linear-gradient(90deg,#F0563A,#ff8c6b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              copy em retenção.
            </span>
          </h2>

          <p className="text-gray-500 text-sm leading-relaxed mb-10">
            Pare de caçar B-roll e comece a escalar. Cole o roteiro — a IA mapeia cada gatilho, escolhe os clips e monta a Direção de Arte em segundos.
          </p>

          <div className="flex items-center justify-center gap-8">
            {[{ value: "10x", label: "Mais rápido" }, { value: "94%", label: "Retenção" }, { value: "∞", label: "Nichos" }].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black text-white" style={{ letterSpacing: "-0.03em" }}>{s.value}</div>
                <div className="text-[10px] text-gray-600 uppercase tracking-widest mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-5 text-left rounded-2xl"
            style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[10px] text-gray-600 ml-2 font-mono">mapa-edicao.json</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <p><span className="text-orange-400">"scene_1"</span><span className="text-gray-600">: </span><span className="text-emerald-400">"HOOK · Curiosidade"</span></p>
              <p><span className="text-orange-400">"vault_category"</span><span className="text-gray-600">: </span><span className="text-amber-300">"hook_dr_choque"</span></p>
              <p><span className="text-orange-400">"broll_match"</span><span className="text-gray-600">: </span><span className="text-blue-400">"98%"</span></p>
              <p><span className="text-orange-400">"auto_sync"</span><span className="text-gray-600">: </span><span className="text-emerald-400">true</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
