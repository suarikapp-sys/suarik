"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "reset";

export default function LoginPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [mode,    setMode]    = useState<Mode>("login");
  const [email,   setEmail]   = useState("");
  const [password,setPassword]= useState("");
  const [showPass,setShowPass]= useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [successOverlay, setSuccessOverlay] = useState(false);

  const switchMode = (m: Mode) => { setMode(m); setError(""); setSuccess(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");

    if (mode === "login") {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
      setSuccessOverlay(true);
      setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1800);
    } else if (mode === "signup") {
      const { error: err } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (err) { setError(err.message); setLoading(false); return; }
      setSuccess("Verifique seu e-mail para confirmar o cadastro.");
    } else {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
      });
      if (err) { setError(err.message); setLoading(false); return; }
      setSuccess("Link de recuperação enviado para seu e-mail.");
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (err) { setError(err.message); setLoading(false); }
  };

  return (
    <>
      {/* Instrument Serif font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
        rel="stylesheet"
      />

      <style>{`
        @keyframes lo-drift {
          0%   { transform: translate(0,0); }
          100% { transform: translate(30px,20px); }
        }
        @keyframes lp-float {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-10px); }
        }
        @keyframes lp-wv {
          0%,100% { height:3px; opacity:.55; }
          50%     { opacity:1; }
        }
        @keyframes btn-spin {
          to { transform:rotate(360deg); }
        }
        @keyframes sov-ring {
          0%   { inset:0;     opacity:1; }
          100% { inset:-16px; opacity:0; }
        }
        @keyframes shimmer-slide {
          0%   { left:-100%; }
          100% { left:100%; }
        }
        @keyframes sov-fadein {
          from { opacity:0; }
          to   { opacity:1; }
        }

        /* ── root reset for login page ── */
        .lp-root *, .lp-root *::before, .lp-root *::after {
          box-sizing: border-box; margin: 0; padding: 0;
        }
        .lp-root {
          height: 100vh; overflow: hidden;
          display: grid; grid-template-columns: 1fr 1fr;
          font-family: 'Geist', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          color: #EAEAEA;
        }

        /* ── left orbs ── */
        .lo-1 {
          position:absolute; width:500px; height:500px; border-radius:50%;
          filter:blur(90px);
          background:radial-gradient(circle,rgba(232,81,42,.14),transparent);
          top:-100px; left:-100px;
          animation: lo-drift 14s ease-in-out infinite alternate;
        }
        .lo-2 {
          position:absolute; width:350px; height:350px; border-radius:50%;
          filter:blur(90px);
          background:radial-gradient(circle,rgba(74,158,255,.07),transparent);
          bottom:-60px; right:-60px;
          animation: lo-drift 18s ease-in-out infinite alternate-reverse;
        }

        /* ── product card float ── */
        .lp-card  { animation: lp-float 6s ease-in-out infinite; }
        .lp-badge { animation: lp-float 8s 1s ease-in-out infinite; }

        /* ── waveform bars ── */
        .wvb { width:2.5px; border-radius:1.5px; background:#3ECF8E; }
        .wvb-1  { animation:lp-wv 1.4s ease-in-out infinite 0s;    }
        .wvb-2  { animation:lp-wv 1.4s ease-in-out infinite .08s;  }
        .wvb-3  { animation:lp-wv 1.4s ease-in-out infinite .16s;  }
        .wvb-4  { animation:lp-wv 1.4s ease-in-out infinite .04s;  }
        .wvb-5  { animation:lp-wv 1.4s ease-in-out infinite .12s;  }
        .wvb-6  { animation:lp-wv 1.4s ease-in-out infinite .20s;  }
        .wvb-7  { animation:lp-wv 1.4s ease-in-out infinite .06s;  }
        .wvb-8  { animation:lp-wv 1.4s ease-in-out infinite .14s;  }
        .wvb-9  { animation:lp-wv 1.4s ease-in-out infinite .10s;  }
        .wvb-10 { animation:lp-wv 1.4s ease-in-out infinite .18s;  }

        /* ── google button ── */
        .btn-google {
          width:100%; display:flex; align-items:center; justify-content:center; gap:10px;
          padding:13px; border-radius:8px;
          background:#09090B; border:1px solid #1A1A1A;
          color:#EAEAEA; font-size:14px; font-weight:600;
          cursor:pointer; font-family:inherit; letter-spacing:-.01em;
          margin-bottom:20px; position:relative; overflow:hidden;
          transition: all .2s;
        }
        .btn-google::before {
          content:''; position:absolute; top:0; left:-100%;
          width:100%; height:100%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.04),transparent);
          transition:left .4s;
        }
        .btn-google:hover::before { left:100%; }
        .btn-google:hover {
          border-color:#222; background:#0F0F0F;
          transform:translateY(-1px); box-shadow:0 6px 20px rgba(0,0,0,.4);
        }
        .btn-google:disabled { opacity:.5; cursor:not-allowed; pointer-events:none; }

        /* ── field input ── */
        .field-input {
          width:100%; background:#0F0F0F; border:1px solid #131313;
          border-radius:8px; padding:11px 14px;
          color:#EAEAEA; font-family:'Geist',system-ui,sans-serif;
          font-size:13px; outline:none; transition:all .2s;
          caret-color:#E8512A;
        }
        .field-input::placeholder { color:#252525; }
        .field-input:focus {
          border-color:rgba(232,81,42,.35); background:#09090B;
          box-shadow:0 0 0 3px rgba(232,81,42,.05);
        }
        .field-input.has-eye { padding-right:40px; }

        /* ── submit button ── */
        .btn-submit {
          width:100%; padding:13px; border:none; border-radius:8px;
          font-size:14px; font-weight:700; font-family:inherit;
          letter-spacing:-.01em; cursor:pointer;
          display:flex; align-items:center; justify-content:center; gap:7px;
          position:relative; overflow:hidden; transition:all .25s;
        }
        .btn-submit::before {
          content:''; position:absolute; top:0; left:-100%;
          width:100%; height:100%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);
          transition:left .4s;
        }
        .btn-submit:hover::before { left:100%; }
        .btn-submit:hover:not(:disabled) {
          background:#FF6B3D !important;
          transform:translateY(-1px);
          box-shadow:0 10px 28px rgba(232,81,42,.35);
        }
        .btn-submit:disabled { cursor:not-allowed; }

        /* ── eye btn hover ── */
        .eye-btn { color:#252525; transition:color .15s; }
        .eye-btn:hover { color:#444; }

        /* ── forgot / back btn hover ── */
        .link-btn { color:#444; transition:color .2s; }
        .link-btn:hover { color:#7A7A7A; }

        /* ── success overlay ── */
        .sov-ring {
          position:absolute; inset:0; border-radius:50%;
          border:2px solid #3ECF8E;
          animation: sov-ring 1s ease-out forwards;
        }
        .sov-overlay {
          animation: sov-fadein .4s ease forwards;
        }

        /* ── scrollbar hide on right panel ── */
        .right-panel::-webkit-scrollbar { width:0; }
      `}</style>

      <div className="lp-root">

        {/* ════════════════ LEFT: visual ════════════════ */}
        <div style={{
          position:"relative", overflow:"hidden",
          background:"#060606", display:"flex", flexDirection:"column",
        }}>
          {/* Atmospheric orbs */}
          <div style={{ position:"absolute", inset:0, zIndex:0 }}>
            <div className="lo-1" />
            <div className="lo-2" />
          </div>

          {/* Grid overlay */}
          <div style={{
            position:"absolute", inset:0, zIndex:0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px)," +
              "linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)",
            backgroundSize:"52px 52px",
            WebkitMaskImage:"radial-gradient(ellipse at 40% 50%,black 20%,transparent 70%)",
            maskImage:"radial-gradient(ellipse at 40% 50%,black 20%,transparent 70%)",
          }} />

          {/* Content */}
          <div style={{
            position:"relative", zIndex:1, flex:1,
            display:"flex", flexDirection:"column", padding:40,
          }}>

            {/* Logo */}
            <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:"auto" }}>
              <svg width="20" height="20" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{ display:"block", flexShrink:0 }}>
                <rect width="64" height="64" rx="10" style={{ fill:"#111111" }}/>
                <rect x="12" y="10" width="40" height="11" rx="4" style={{ fill:"#E8E8E8" }}/>
                <rect x="41" y="10" width="11" height="24" rx="4" style={{ fill:"#E8E8E8" }}/>
                <rect x="12" y="43" width="40" height="11" rx="4" style={{ fill:"#E8512A" }}/>
                <rect x="12" y="30" width="11" height="24" rx="4" style={{ fill:"#E8512A" }}/>
              </svg>
              <span style={{ fontSize:15, fontWeight:700, color:"#EAEAEA", letterSpacing:"-.03em" }}>
                Suarik
              </span>
            </div>

            {/* Hero */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", paddingBottom:40 }}>
              <h1 style={{
                fontFamily:"'Instrument Serif',serif",
                fontSize:"clamp(36px,4vw,56px)",
                lineHeight:.93, letterSpacing:"-.02em",
                marginBottom:16, color:"#EAEAEA",
              }}>
                Edite na<br/>velocidade do<br/>
                <em style={{ fontStyle:"italic", color:"#E8512A" }}>pensamento.</em>
              </h1>
              <p style={{ fontSize:14, color:"#7A7A7A", lineHeight:1.65, fontWeight:300, maxWidth:340 }}>
                Do roteiro ao vídeo final em horas. B-roll, voz, LipSync e avatar — tudo numa IA.
              </p>

              {/* Mini product card */}
              <div style={{ marginTop:32, position:"relative" }}>
                <div className="lp-card" style={{
                  background:"#141414",
                  border:"1px solid rgba(255,255,255,.08)",
                  borderRadius:12, overflow:"hidden",
                  boxShadow:"0 24px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04)",
                }}>
                  {/* macOS titlebar */}
                  <div style={{
                    height:26, background:"#1A1A1A",
                    borderBottom:"1px solid rgba(255,255,255,.07)",
                    display:"flex", alignItems:"center", padding:"0 10px", gap:4,
                  }}>
                    {[["#E24B4A"],["#F5A623"],["#3ECF8E"]].map(([c], i) => (
                      <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:c }} />
                    ))}
                    <span style={{ fontSize:8, color:"#666", marginLeft:5, letterSpacing:".04em" }}>
                      Storyboard DR
                    </span>
                    <span style={{
                      fontSize:7, fontWeight:700, padding:"2px 6px", borderRadius:8,
                      background:"rgba(232,81,42,.12)", color:"#E8512A",
                      marginLeft:"auto", letterSpacing:".06em", textTransform:"uppercase",
                    }}>
                      IA ativa
                    </span>
                  </div>

                  {/* Body */}
                  <div style={{ padding:12 }}>
                    {/* Scene tags */}
                    <div style={{ display:"flex", gap:3, marginBottom:8 }}>
                      {[
                        { l:"Choque",    bg:"rgba(232,81,42,.14)",  bd:"rgba(232,81,42,.35)",  c:"rgba(232,81,42,.95)"  },
                        { l:"Urgência",  bg:"rgba(245,166,35,.12)", bd:"rgba(245,166,35,.3)",  c:"rgba(245,166,35,.9)"  },
                        { l:"Esperança", bg:"rgba(62,207,142,.12)", bd:"rgba(62,207,142,.3)",  c:"rgba(62,207,142,.9)"  },
                      ].map(s => (
                        <div key={s.l} style={{
                          flex:1, height:22, borderRadius:4,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:7, fontWeight:700, letterSpacing:".06em",
                          textTransform:"uppercase",
                          background:s.bg, border:`1px solid ${s.bd}`, color:s.c,
                        }}>
                          {s.l}
                        </div>
                      ))}
                    </div>

                    {/* Waveform */}
                    <div style={{ display:"flex", alignItems:"center", gap:1.5, height:18, marginBottom:8 }}>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <div key={n} className={`wvb wvb-${n}`} />
                      ))}
                    </div>

                    {/* Generate btn mock */}
                    <div style={{
                      height:26, background:"#E8512A", borderRadius:5,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:9, fontWeight:700, color:"#fff", gap:4,
                      boxShadow:"0 4px 12px rgba(232,81,42,.3)",
                    }}>
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                        <path d="M5 1L3.5 4H1l2.5 2L2.5 9 5 7l2.5 2-1-3L9 4H6.5L5 1z" fill="currentColor" opacity=".9"/>
                      </svg>
                      Gerar Sequência Completa →
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="lp-badge" style={{
                  position:"absolute", bottom:-10, right:-20,
                  background:"#1A1A1A", border:"1px solid rgba(255,255,255,.1)",
                  borderRadius:8, padding:"8px 12px",
                  boxShadow:"0 12px 32px rgba(0,0,0,.5)",
                }}>
                  <div style={{ fontSize:9, fontWeight:700, color:"#3ECF8E", marginBottom:3, letterSpacing:".04em", textTransform:"uppercase" }}>
                    VSL gerada
                  </div>
                  <div style={{ fontSize:14, fontWeight:800, color:"#EAEAEA", letterSpacing:"-.03em" }}>3h 48m</div>
                  <div style={{ fontSize:9, color:"#666" }}>antes: 2 dias</div>
                </div>
              </div>
            </div>

            {/* Testimonial */}
            <div style={{ borderTop:"1px solid rgba(255,255,255,.04)", paddingTop:20 }}>
              <p style={{
                fontFamily:"'Instrument Serif',serif",
                fontSize:14, fontStyle:"italic",
                color:"#7A7A7A", lineHeight:1.6, marginBottom:12,
              }}>
                &ldquo;Uma VSL que levava 2 dias agora leva{" "}
                <strong style={{ fontStyle:"normal", color:"#EAEAEA" }}>4 horas.</strong>{" "}
                Mudou meu negócio.&rdquo;
              </p>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{
                  width:28, height:28, borderRadius:"50%",
                  background:"#1A0A05", color:"#E8512A",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:10, fontWeight:700, flexShrink:0,
                }}>
                  MR
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#7A7A7A" }}>Marcos R.</div>
                  <div style={{ fontSize:11, color:"#444" }}>Editor DR · São Paulo</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════ RIGHT: form ════════════════ */}
        <div className="right-panel" style={{
          background:"#09090B", borderLeft:"1px solid #131313",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center",
          padding:48, overflowY:"auto",
        }}>
          <div style={{ width:"100%", maxWidth:380 }}>

            {/* ── Form header ── */}
            <div style={{ marginBottom:32 }}>
              {mode === "reset" ? (
                <>
                  <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:28, letterSpacing:"-.02em", color:"#EAEAEA", marginBottom:6, lineHeight:1 }}>
                    Recuperar senha
                  </div>
                  <div style={{ fontSize:13, color:"#7A7A7A", fontWeight:300 }}>
                    Enviaremos um link para seu e-mail.
                  </div>
                </>
              ) : mode === "login" ? (
                <>
                  <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:28, letterSpacing:"-.02em", color:"#EAEAEA", marginBottom:6, lineHeight:1 }}>
                    Entrar
                  </div>
                  <div style={{ fontSize:13, color:"#7A7A7A", fontWeight:300 }}>
                    Não tem conta?{" "}
                    <button onClick={() => switchMode("signup")}
                      style={{ color:"#E8512A", background:"none", border:"none", cursor:"pointer", fontSize:13, fontFamily:"inherit", padding:0, transition:"color .2s" }}>
                      Criar conta grátis →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:28, letterSpacing:"-.02em", color:"#EAEAEA", marginBottom:6, lineHeight:1 }}>
                    Criar conta
                  </div>
                  <div style={{ fontSize:13, color:"#7A7A7A", fontWeight:300 }}>
                    Já tem conta?{" "}
                    <button onClick={() => switchMode("login")}
                      style={{ color:"#E8512A", background:"none", border:"none", cursor:"pointer", fontSize:13, fontFamily:"inherit", padding:0, transition:"color .2s" }}>
                      Entrar →
                    </button>
                  </div>
                </>
              )}
            </div>

            <form onSubmit={handleSubmit}>

              {/* ── Google button ── */}
              {mode !== "reset" && (
                <>
                  <button type="button" onClick={handleGoogle} disabled={loading} className="btn-google">
                    <GoogleIcon />
                    {mode === "login" ? "Continuar com Google" : "Cadastrar com Google"}
                  </button>

                  {/* Divider */}
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                    <div style={{ flex:1, height:1, background:"#131313" }} />
                    <span style={{ fontSize:11, color:"#252525", whiteSpace:"nowrap", letterSpacing:".04em" }}>
                      ou entre com email
                    </span>
                    <div style={{ flex:1, height:1, background:"#131313" }} />
                  </div>
                </>
              )}

              {/* ── Email ── */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontSize:12, fontWeight:500, color:"#7A7A7A", marginBottom:6 }}>
                  Email
                </label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" required
                  className="field-input"
                />
              </div>

              {/* ── Password ── */}
              {mode !== "reset" && (
                <div style={{ marginBottom:0 }}>
                  <label style={{ display:"block", fontSize:12, fontWeight:500, color:"#7A7A7A", marginBottom:6 }}>
                    Senha
                  </label>
                  <div style={{ position:"relative" }}>
                    <input
                      type={showPass ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" required
                      className="field-input has-eye"
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      className="eye-btn"
                      style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", padding:0, cursor:"pointer", display:"flex" }}>
                      {showPass ? (
                        <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                          <path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.2"/>
                          <line x1="2" y1="2" x2="16" y2="16" stroke="currentColor" strokeWidth="1.2"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                          <path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.2"/>
                          <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Forgot password ── */}
              {mode === "login" && (
                <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8, marginBottom:14 }}>
                  <button type="button" onClick={() => switchMode("reset")}
                    className="link-btn"
                    style={{ fontSize:11, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
                    Esqueci minha senha
                  </button>
                </div>
              )}
              {mode === "signup" && <div style={{ marginBottom:14 }} />}

              {/* ── Error / Success feedback ── */}
              {error && (
                <div style={{ fontSize:12, color:"#E24B4A", background:"rgba(226,75,74,.07)", border:"1px solid rgba(226,75,74,.2)", borderRadius:6, padding:"8px 12px", marginBottom:14, fontFamily:"monospace" }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ fontSize:12, color:"#3ECF8E", background:"rgba(62,207,142,.07)", border:"1px solid rgba(62,207,142,.18)", borderRadius:6, padding:"8px 12px", marginBottom:14, fontFamily:"monospace" }}>
                  {success}
                </div>
              )}

              {/* ── Submit button ── */}
              <button type="submit" disabled={loading} className="btn-submit"
                style={{ background: loading ? "#0F0F0F" : "#E8512A", color: loading ? "#444" : "#fff" }}>
                {loading ? (
                  <>
                    <span style={{ width:16, height:16, borderRadius:"50%", border:"2px solid rgba(255,255,255,.2)", borderTopColor:"#fff", animation:"btn-spin .7s linear infinite", flexShrink:0 }} />
                    {mode === "login" ? "Entrando..." : mode === "signup" ? "Criando conta..." : "Enviando..."}
                  </>
                ) : (
                  <>
                    {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta grátis" : "Enviar Link"}
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  </>
                )}
              </button>

              {/* ── Back to login (reset mode) ── */}
              {mode === "reset" && (
                <button type="button" onClick={() => switchMode("login")}
                  className="link-btn"
                  style={{ display:"block", marginTop:16, fontSize:12, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
                  ← Voltar ao login
                </button>
              )}
            </form>

            {/* ── Terms ── */}
            {mode !== "reset" && (
              <div style={{ fontSize:11, color:"#252525", textAlign:"center", marginTop:16, lineHeight:1.6 }}>
                Ao entrar, você concorda com os<br/>
                <span style={{ color:"#444" }}>Termos de Uso</span>
                {" "}e{" "}
                <span style={{ color:"#444" }}>Política de Privacidade</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════ SUCCESS OVERLAY ════════════════ */}
      {successOverlay && (
        <div className="sov-overlay" style={{
          position:"fixed", inset:0, zIndex:100,
          background:"rgba(6,6,6,.96)", backdropFilter:"blur(20px)",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:14,
        }}>
          <div style={{ position:"relative", width:72, height:72, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div className="sov-ring" />
            <div style={{
              width:64, height:64, borderRadius:"50%",
              background:"rgba(62,207,142,.07)",
              border:"2px solid rgba(62,207,142,.18)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                <path d="M6 14l5.5 5.5L22 8" stroke="#3ECF8E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:24, color:"#EAEAEA" }}>
            Bem-vindo de volta.
          </div>
          <div style={{ fontSize:13, color:"#7A7A7A" }}>
            Redirecionando para o dashboard...
          </div>
        </div>
      )}
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
