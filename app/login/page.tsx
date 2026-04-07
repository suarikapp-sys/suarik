"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "reset";

export default function LoginPage() {
  const router   = useRouter();
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
      router.push("/dashboard");
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
    <>
      {/* ── Keyframes ────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes charging {
          0% { left: -100%; }
          20% { left: 100%; }
          100% { left: 100%; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes bar-flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .btn-charging::before {
          content: "";
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          animation: charging 3s infinite;
        }
        .pulse-dot { animation: pulse-dot 2s infinite ease-in-out; }
        .bar-flicker { animation: bar-flicker 2.4s infinite ease-in-out; }
      `}</style>

      <div className="min-h-screen overflow-hidden bg-black text-white font-sans select-none">

        {/* ── Atmospheric background ───────────────────────────────────────── */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div style={{ background: "radial-gradient(circle at 50% 50%, #0d0d0d 0%, #000000 100%)", position: "absolute", inset: 0 }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 55% at 15% 25%, rgba(240,86,58,0.14), transparent)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 50% at 85% 75%, rgba(99,5,239,0.08), transparent)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 30% 40% at 50% 50%, rgba(240,86,58,0.04), transparent)" }} />
          {/* Noise grain */}
          <div className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "200px 200px" }} />
        </div>

        {/* ── Terminal logs (top right, desktop) ───────────────────────────── */}
        <div className="fixed top-8 right-8 z-20 hidden lg:block">
          <div style={{ background: "rgba(10,10,10,0.7)", backdropFilter: "blur(25px)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: "1px solid rgba(240,86,58,0.25)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}
            className="p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F0563A] pulse-dot" />
              <span className="text-[9px] tracking-[0.2em] text-white/40 uppercase font-mono">System Logs</span>
            </div>
            <div className="space-y-1 font-mono text-[10px] text-[rgba(240,86,58,0.6)]">
              <p>&gt; Neural Core: <span className="text-[#F0563A]">Active</span></p>
              <p>&gt; Syncing Assets: <span className="text-[#F0563A]">100%</span></p>
              <p>&gt; Workspace: <span className="text-[#F0563A]">Initialized</span></p>
              <p>&gt; Kernel: <span className="text-[#F0563A]">Kinetic_4.2</span></p>
            </div>
          </div>
        </div>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <main className="relative z-10 min-h-screen flex items-center justify-center p-6">

          {/* Branding top-left */}
          <div className="absolute top-10 left-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm"
                style={{ background: "#F0563A", boxShadow: "0 0 20px rgba(240,86,58,0.4)" }}>S</div>
              <h1 className="text-2xl font-black text-white" style={{ letterSpacing: "-0.04em" }}>SUARIK</h1>
            </div>
            <p className="text-[10px] tracking-[0.25em] text-white/25 uppercase mt-1 ml-10">AI Cinematic Engine</p>
          </div>

          {/* ── Glass card ───────────────────────────────────────────────── */}
          <div className="w-full max-w-[440px]"
            style={{ background: "rgba(10,10,10,0.65)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", border: "1px solid rgba(255,255,255,0.05)", borderLeft: "1px solid rgba(240,86,58,0.3)", borderRadius: "1rem", boxShadow: "0 25px 60px rgba(0,0,0,0.6)", padding: "2.5rem 3rem" }}>

            <div className="space-y-8">

              {/* Tabs */}
              {mode !== "reset" && (
                <div className="flex items-center gap-6 border-b border-white/5">
                  {(["login", "signup"] as Mode[]).map(m => (
                    <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                      className="pb-4 text-[11px] font-bold tracking-[0.2em] uppercase transition-all duration-200"
                      style={{
                        color: mode === m ? "#F0563A" : "rgba(255,255,255,0.2)",
                        borderBottom: mode === m ? "2px solid #F0563A" : "2px solid transparent",
                      }}>
                      {m === "login" ? "Login" : "Criar Conta"}
                    </button>
                  ))}
                </div>
              )}

              {/* Heading */}
              <div>
                {mode === "reset" ? (
                  <>
                    <h2 className="text-3xl font-black text-white" style={{ letterSpacing: "-0.04em" }}>Recuperar senha.</h2>
                    <p className="text-white/35 text-sm mt-1">Enviaremos um link para seu e-mail.</p>
                  </>
                ) : mode === "login" ? (
                  <>
                    <h2 className="text-3xl font-black text-white" style={{ letterSpacing: "-0.04em" }}>Bem-vindo de volta.</h2>
                    <p className="text-white/35 text-sm mt-1">Autorize acesso ao estúdio neural.</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl font-black text-white" style={{ letterSpacing: "-0.04em" }}>Criar sua conta.</h2>
                    <p className="text-white/35 text-sm mt-1">Comece grátis. Sem cartão de crédito.</p>
                  </>
                )}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-mono">
                    {mode === "login" ? "Identity Tag" : "E-mail"}
                  </label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder={mode === "login" ? "voce@suarik.com" : "voce@exemplo.com"}
                    required
                    className="w-full py-3.5 px-4 rounded-xl text-sm text-white placeholder-white/15 outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                    onFocus={e => { e.currentTarget.style.border = "1px solid rgba(240,86,58,0.4)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                    onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  />
                </div>

                {/* Password */}
                {mode !== "reset" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-mono">Access Key</label>
                      {mode === "login" && (
                        <button type="button" onClick={() => { setMode("reset"); setError(""); setSuccess(""); }}
                          className="text-[9px] uppercase tracking-[0.15em] text-[#F0563A]/60 hover:text-[#F0563A] transition-colors font-mono">
                          Recovery
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••" required
                        className="w-full py-3.5 px-4 pr-10 rounded-xl text-sm text-white placeholder-white/15 outline-none transition-all"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                        onFocus={e => { e.currentTarget.style.border = "1px solid rgba(240,86,58,0.4)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                        onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      />
                      <button type="button" onClick={() => setShowPass(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors text-xs font-mono">
                        {showPass ? "HIDE" : "SHOW"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {error && (
                  <p className="text-xs text-red-400 bg-red-500/8 border border-red-500/20 px-3 py-2 rounded-lg font-mono">{error}</p>
                )}
                {success && (
                  <p className="text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 px-3 py-2 rounded-lg font-mono">{success}</p>
                )}

                {/* Submit */}
                <button type="submit" disabled={loading}
                  className="btn-charging relative w-full overflow-hidden py-4 rounded-xl text-sm font-black uppercase tracking-tighter text-white transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 mt-2"
                  style={{ background: "linear-gradient(135deg, #F0563A 0%, #c44527 100%)", boxShadow: "0 0 24px rgba(240,86,58,0.25)" }}>
                  {loading
                    ? <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Aguardando...
                      </span>
                    : mode === "login" ? "Entrar no Estúdio"
                    : mode === "signup" ? "Criar Conta"
                    : "Enviar Link"}
                </button>
              </form>

              {/* OAuth */}
              {mode !== "reset" && (
                <>
                  <div className="relative flex items-center">
                    <div className="flex-grow border-t border-white/5" />
                    <span className="mx-4 text-[9px] text-white/20 tracking-[0.2em] uppercase font-mono">CONTINUE WITH</span>
                    <div className="flex-grow border-t border-white/5" />
                  </div>

                  <button onClick={handleGoogle} disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl transition-all group"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}>
                    <GoogleIcon />
                    <span className="text-[11px] font-bold tracking-[0.15em] text-white/40 group-hover:text-white transition-colors uppercase font-mono">Google</span>
                  </button>
                </>
              )}

              {/* Back link */}
              {mode === "reset" && (
                <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                  className="text-xs text-[#F0563A]/60 hover:text-[#F0563A] transition-colors font-mono">
                  ← Voltar ao login
                </button>
              )}
            </div>
          </div>
        </main>

        {/* ── System status bar (bottom) ───────────────────────────────────── */}
        <div className="fixed bottom-0 left-0 w-full px-8 py-3 flex flex-col md:flex-row justify-between items-center z-20 border-t border-white/5"
          style={{ background: "rgba(10,10,10,0.8)", backdropFilter: "blur(20px)" }}>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 8px rgba(52,211,153,0.6)" }} />
              <span className="text-[10px] tracking-[0.2em] text-white/50 font-mono uppercase">Engine: Online</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-white/10" />
            <span className="hidden md:block text-[10px] tracking-[0.15em] text-white/25 font-mono uppercase">v2.4.0 · KINETIC</span>
          </div>
          <div className="flex items-center gap-6 mt-2 md:mt-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-[0.2em] text-white/25 font-mono uppercase">Latency</span>
              <div className="flex items-end gap-0.5 h-3">
                {[40, 60, 30, 80, 55].map((h, i) => (
                  <div key={i} className="w-1 rounded-sm bar-flicker"
                    style={{ height: `${h}%`, background: i === 3 ? "#F0563A" : "rgba(240,86,58,0.3)", animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              <span className="text-[10px] text-[#F0563A]/80 font-mono">24MS</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-white/10" />
            <p className="hidden md:block text-[10px] text-white/20 font-mono uppercase tracking-widest">© 2025 Kraft Mídia</p>
          </div>
        </div>
      </div>
    </>
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
