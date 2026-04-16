"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView } from "framer-motion";
import SuarikLogo from "@/components/SuarikLogo";

// ─── Design tokens ────────────────────────────────────────────────────────────
const K = {
  k:"#050505", k2:"#080808", k3:"#0D0D0D", k4:"#111",
  w:"#F0EFEC",  w2:"#9A9890",  w3:"#4A4845",  w4:"#222",
  o:"#E8512A",  o2:"#FF6534",  ob:"rgba(232,81,42,.12)", os:"rgba(232,81,42,.06)",
  g:"#3ECF8E",  gs:"rgba(62,207,142,.1)",
  b:"#4A9EFF",  p:"#9B8FF8",
} as const;

// ─── AnimateIn helper ─────────────────────────────────────────────────────────
function AnimateIn({ children, style, delay = 0, className }: { children: React.ReactNode; style?: React.CSSProperties; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-70px" });
  return (
    <motion.div ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease: "easeOut", delay }}
      style={style}>
      {children}
    </motion.div>
  );
}

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const FAQ = [
  { q: "O que exatamente o Suarik faz?", a: "O Suarik analisa sua copy ou vídeo A-roll e gera automaticamente um mapa de edição completo: B-rolls sincronizados, legendas karaokê, SFX de impacto e trilha sonora — tudo pronto para o editor montar em minutos." },
  { q: "Preciso saber editar vídeo para usar?", a: "Não. O Suarik gera o mapa de edição pronto. Você só precisa colar a copy ou fazer upload do vídeo e clicar em gerar. O resultado é um pacote pronto para qualquer editor aplicar." },
  { q: "Funciona para qualquer nicho?", a: "Sim. O Suarik é treinado para VSLs de saúde/nutra, finanças, renda extra, emagrecimento, infoprodutos e mais. A IA adapta o estilo de edição ao nicho escolhido." },
  { q: "Quanto custa?", a: "Temos planos a partir do Starter até o Agency. Acesse a página de preços para ver os detalhes completos." },
  { q: "Posso usar meus próprios vídeos de A-roll?", a: "Com certeza. Faça upload do seu MP4 e o Suarik vai transcrever, sincronizar legendas karaokê, adicionar B-rolls e SFX automaticamente em cima do seu vídeo." },
];

// ─── Hero product mockup ──────────────────────────────────────────────────────
function HeroProduct() {
  return (
    <div style={{ position: "relative", height: 520, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, x: 30, rotateY: -10 }}
        animate={{ opacity: 1, x: 0, rotateY: 0 }}
        transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
        style={{
          width: 360, background: K.k3, border: "1px solid rgba(255,255,255,.06)",
          borderRadius: 14, overflow: "hidden",
          boxShadow: "0 40px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.04)",
          position: "absolute",
          animation: "float-main 6s ease-in-out infinite",
        }}>
        {/* titlebar */}
        <div style={{ height: 28, background: K.k4, borderBottom: "1px solid rgba(255,255,255,.04)", display: "flex", alignItems: "center", padding: "0 10px", gap: 5 }}>
          {["#E24B4A", "#F5A623", "#3ECF8E"].map((c, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />)}
          <span style={{ fontSize: 9, color: K.w3, marginLeft: 6, letterSpacing: ".04em" }}>Storyboard DR</span>
          <span style={{ marginLeft: "auto", fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: K.ob, color: K.o, letterSpacing: ".06em", textTransform: "uppercase" as const }}>IA ativa</span>
        </div>
        {/* body */}
        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
            {[85, 70, 92, 60].map((w, i) => <div key={i} style={{ height: 7, borderRadius: 3, background: "rgba(255,255,255,.06)", width: `${w}%` }} />)}
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {[
              { label: "Choque",   c: "rgba(232,81,42,.8)",   bg: "rgba(232,81,42,.1)",   br: "rgba(232,81,42,.25)" },
              { label: "Urgência", c: "rgba(245,166,35,.8)",  bg: "rgba(245,166,35,.1)",  br: "rgba(245,166,35,.25)" },
              { label: "Mistério", c: "rgba(155,143,248,.8)", bg: "rgba(155,143,248,.1)", br: "rgba(155,143,248,.25)" },
              { label: "Esperança",c: "rgba(62,207,142,.8)",  bg: "rgba(62,207,142,.1)",  br: "rgba(62,207,142,.25)" },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, height: 24, borderRadius: 4, background: s.bg, border: `1px solid ${s.br}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: s.c, letterSpacing: ".06em", textTransform: "uppercase" as const }}>
                {s.label}
              </div>
            ))}
          </div>
          <div style={{ height: 30, background: K.o, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", gap: 5 }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1L4.5 4H2l2 1.5-1 3L6 7l3 2.5-1-3 2-1.5H7.5L6 1z" fill="currentColor" opacity=".9"/></svg>
            Gerar Sequência Completa →
          </div>
        </div>
      </motion.div>

      {/* Floating: Audio waveform */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.7 }}
        style={{
          position: "absolute", bottom: 30, left: -60, width: 160,
          background: K.k3, border: "1px solid rgba(255,255,255,.07)",
          borderRadius: 10, boxShadow: "0 20px 40px rgba(0,0,0,.7)",
          padding: "10px 12px",
          animation: "float-a 8s ease-in-out infinite",
        }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" as const, color: K.g, marginBottom: 6 }}>Audio Studio</div>
        <div style={{ display: "flex", alignItems: "center", gap: 1.5, height: 20 }}>
          {[6,12,18,8,20,10,16,6,14,20,8,12].map((h, i) => (
            <div key={i} style={{ width: 2.5, borderRadius: 1.5, background: K.g, animation: `hfa-bar-anim 1.4s ${(i * 0.06).toFixed(2)}s ease-in-out infinite` }} />
          ))}
        </div>
        <div style={{ fontSize: 9, color: "rgba(62,207,142,.6)", marginTop: 5, fontWeight: 600 }}>Narrador BR · gerando...</div>
      </motion.div>

      {/* Floating: LipSync */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.9 }}
        style={{
          position: "absolute", top: 20, right: -50, width: 110,
          background: K.k3, border: "1px solid rgba(255,255,255,.07)",
          borderRadius: 10, boxShadow: "0 20px 40px rgba(0,0,0,.7)",
          padding: "10px 12px", textAlign: "center" as const,
          animation: "float-b 10s ease-in-out infinite",
        }}>
        <div style={{ width: 44, height: 54, borderRadius: "50% 50% 46% 46%", background: "linear-gradient(170deg,#0A1828,#040810)", margin: "0 auto 7px", border: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="9" r="4" stroke="rgba(255,255,255,.2)" strokeWidth="1.2"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="rgba(255,255,255,.2)" strokeWidth="1.2" strokeLinecap="round"/></svg>
        </div>
        <div style={{ fontSize: 8, fontWeight: 700, color: K.o, letterSpacing: ".08em", textTransform: "uppercase" as const }}>LipSync ativo</div>
      </motion.div>

      {/* Floating: Stats */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 1.1 }}
        style={{
          position: "absolute", bottom: 80, right: -40, width: 130,
          background: K.k3, border: "1px solid rgba(255,255,255,.07)",
          borderRadius: 10, boxShadow: "0 20px 40px rgba(0,0,0,.7)",
          padding: "10px 12px",
          animation: "float-c 7s 1s ease-in-out infinite",
        }}>
        {[
          { lbl: "VSL gerada",  val: "✓",     vc: K.g },
          { lbl: "Tempo",       val: "3h 48m", vc: K.w },
          { lbl: "B-Roll",      val: "12 clips",vc: K.b },
        ].map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: i < 2 ? 6 : 0 }}>
            <span style={{ fontSize: 9, color: K.w3 }}>{r.lbl}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: r.vc }}>{r.val}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SitePage() {
  const router = useRouter();
  const [openFaq,  setOpenFaq]  = useState<number | null>(null);
  const [navOn,    setNavOn]    = useState(false);

  useEffect(() => {
    const handler = () => setNavOn(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const sec = (label: string, accent = K.o) => (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase" as const, color: accent, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 20, height: 1, background: accent, opacity: .5, display: "inline-block" }} />
      {label}
    </div>
  );

  const secH = (inner: React.ReactNode) => (
    <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(36px,4.5vw,58px)", lineHeight: .95, letterSpacing: "-.02em", color: K.w, marginBottom: 20 }}>{inner}</div>
  );

  return (
    <div style={{ background: K.k, color: K.w, fontFamily: "'Geist', system-ui, sans-serif", overflowX: "hidden", lineHeight: 1.5 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@200;300;400;500;600;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        @keyframes orb-drift{0%{transform:translate(0,0)}100%{transform:translate(40px,30px)}}
        @keyframes float-main{0%,100%{transform:rotate(-2deg) translateY(-10px)}50%{transform:rotate(-2deg) translateY(-22px)}}
        @keyframes float-a{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes float-b{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes float-c{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes hfa-bar-anim{0%,100%{height:4px;opacity:.4}50%{opacity:.9}}
        @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes tc-ring-pulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.5);opacity:0}}
        @keyframes fade-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes g-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}

        @media (max-width: 768px) {
          /* Nav */
          .site-nav { padding: 0 16px !important; }
          .site-nav-links { display: none !important; }
          .site-nav-actions .site-nav-login { display: none !important; }

          /* Hero */
          .site-hero { padding: 100px 24px 40px !important; }
          .site-hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .site-hero-product { display: none !important; }
          .site-hero-sub { max-width: 100% !important; }

          /* Pain section */
          .site-pain { padding: 0 24px !important; }
          .site-pain-grid { grid-template-columns: 1fr !important; gap: 40px !important; }

          /* Transformation */
          .site-transform { padding: 0 24px !important; }
          .site-transform-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .site-transform-arrow { flex-direction: row !important; }

          /* Tools / Ferramentas */
          .site-tools { padding: 0 24px !important; }
          .site-tools-header { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
          .site-tools-grid { grid-template-columns: 1fr !important; }
          .site-tools-featured { grid-column: span 1 !important; }

          /* Pricing / Planos */
          .site-plans { padding: 0 24px !important; }
          .site-plans-grid { grid-template-columns: 1fr !important; gap: 16px !important; }

          /* Testimonials / Cases */
          .site-cases { padding: 0 24px !important; }
          .site-cases-grid { grid-template-columns: 1fr !important; gap: 16px !important; }

          /* CTA Final */
          .site-cta-final { padding: 0 24px !important; }

          /* Footer */
          .site-footer { flex-direction: column !important; gap: 16px !important; padding: 32px 24px !important; text-align: center; align-items: center !important; }
          .site-footer-links { flex-wrap: wrap; justify-content: center; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className="site-nav" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        padding: "0 48px", height: 58,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all .4s",
        background: navOn ? "rgba(5,5,5,.88)" : "transparent",
        backdropFilter: navOn ? "blur(24px)" : "none",
        borderBottom: navOn ? "1px solid rgba(255,255,255,.04)" : "1px solid transparent",
      }}>
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <SuarikLogo size={22} showName />
        </a>
        <div className="site-nav-links" style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <a href="#ferramentas" style={{ fontSize: 12, color: K.w3, textDecoration: "none" }}>Ferramentas</a>
          <a href="#planos" style={{ fontSize: 12, color: K.w3, textDecoration: "none" }}>Planos</a>
          <a href="#cases" style={{ fontSize: 12, color: K.w3, textDecoration: "none" }}>Cases</a>
        </div>
        <div className="site-nav-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="site-nav-login" onClick={() => router.push("/login")} style={{ fontSize: 12, color: K.w3, background: "none", border: "none", cursor: "pointer" }}>Entrar</button>
          <button onClick={() => router.push("/dashboard")} style={{
            fontSize: 12, fontWeight: 600, color: "#fff", background: K.o,
            padding: "8px 18px", borderRadius: 6, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, letterSpacing: "-.01em",
          }}>
            Começar grátis
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="site-hero" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", overflow: "hidden", padding: "80px 48px 40px" }}>
        {/* Orbs */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", filter: "blur(100px)", background: "radial-gradient(circle,rgba(232,81,42,.18),transparent)", top: -100, left: -100, animation: "orb-drift 14s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", filter: "blur(100px)", background: "radial-gradient(circle,rgba(74,158,255,.1),transparent)", bottom: -80, right: 0, animation: "orb-drift 18s ease-in-out infinite alternate-reverse" }} />
        </div>
        {/* Grid */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px)", backgroundSize: "60px 60px", maskImage: "radial-gradient(ellipse at 40% 50%,black 20%,transparent 70%)" }} />

        <div className="site-hero-grid" style={{ position: "relative", zIndex: 2, maxWidth: 1200, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center", margin: "0 auto", width: "100%" }}>
          {/* Left */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Eyebrow */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .1 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 28 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: K.g, boxShadow: `0 0 10px ${K.g}`, animation: "g-pulse 2s ease-in-out infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: K.w2, letterSpacing: ".14em", textTransform: "uppercase" as const, fontWeight: 500 }}>IA para editores DR</span>
              <div style={{ width: 1, height: 10, background: K.w4 }} />
              <span style={{ fontSize: 10, color: K.o, letterSpacing: ".1em", textTransform: "uppercase" as const, fontWeight: 700, padding: "2px 8px", border: `1px solid ${K.ob}`, borderRadius: 20 }}>Beta aberto</span>
            </motion.div>

            {/* Headline */}
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .2 }}
              style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(48px,5.5vw,80px)", lineHeight: .92, letterSpacing: "-.025em", marginBottom: 28 }}>
              Edite na<br/>velocidade<br/>do{" "}
              <em style={{ fontStyle: "italic", color: K.o, position: "relative", display: "inline-block" }}>
                pensamento.
                <span style={{ position: "absolute", bottom: -2, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${K.o},${K.o2})`, opacity: .5, borderRadius: 1 }} />
              </em>
            </motion.h1>

            {/* Sub */}
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .35 }}
              className="site-hero-sub" style={{ fontSize: 16, color: K.w2, lineHeight: 1.65, fontWeight: 300, maxWidth: 420, marginBottom: 36 }}>
              Da copy ao vídeo final em horas.<br/>
              <strong style={{ color: K.w, fontWeight: 500 }}>Storyboard, B-roll, voz, LipSync e avatar</strong> — tudo numa IA calibrada para Direct Response.
            </motion.p>

            {/* CTA row */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .48 }}
              style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => router.push("/dashboard")} style={{
                display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700, color: "#fff",
                background: K.o, padding: "13px 24px", borderRadius: 8, border: "none", cursor: "pointer",
                letterSpacing: "-.02em",
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3l9 5-9 5V3z" fill="currentColor"/></svg>
                Começar grátis
              </button>
              <a href="#ferramentas" style={{ fontSize: 13, color: K.w3, textDecoration: "none", padding: "13px 0", display: "flex", alignItems: "center", gap: 5 }}>
                Ver ferramentas
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M3 6.5h7M7 3.5l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              </a>
            </motion.div>

            {/* Social proof */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .6 }}
              style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}>
              <div style={{ display: "flex" }}>
                {[["MR","#1A0A05",K.o],["CF","#051020","#7B71D8"],["JP","#041004",K.g],["AN","#0A1020",K.b]].map(([init, bg, c], i) => (
                  <div key={i} style={{ width: 24, height: 24, borderRadius: "50%", background: bg, border: `2px solid ${K.k}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: c, marginLeft: i > 0 ? -6 : 0 }}>{init}</div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: K.w3, lineHeight: 1.4 }}>
                <strong style={{ color: K.w, fontWeight: 600 }}>+340 editores DR</strong><br/>já usam na produção
              </div>
            </motion.div>
          </div>

          {/* Right: product */}
          <div className="site-hero-product"><HeroProduct /></div>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div style={{ padding: "22px 0", borderTop: "1px solid rgba(255,255,255,.04)", borderBottom: "1px solid rgba(255,255,255,.04)", overflow: "hidden", position: "relative", zIndex: 2, background: K.k }}>
        <div style={{ display: "flex", gap: 0, width: "max-content", animation: "marquee 28s linear infinite" }}>
          {[...Array(2)].flatMap((_, r) =>
            ["Storyboard DR com IA", "B-Roll por conceito semântico", "TTS · 8 idiomas · 40+ vozes", "LipSync Studio", "DreamAct · Avatar animado", "Voice Clone proprietário", "Mapa emocional por cena", "Export profissional"].map((item, i) => (
              <div key={`${r}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 28px", fontSize: 11, fontWeight: 500, color: i % 2 === 0 ? K.w2 : K.w3, letterSpacing: ".06em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: K.o, flexShrink: 0 }} />
                {item}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── DOR (Pain) ── */}
      <div style={{ padding: "100px 0", background: `linear-gradient(180deg,${K.k},${K.k2})` }}>
        <div className="site-pain site-pain-grid" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
          <AnimateIn>
            {sec("O problema")}
            {secH(<>Você passa mais tempo <em style={{ fontStyle: "italic", color: K.o }}>garimpando</em> do que editando.</>)}
            <p style={{ fontSize: 16, color: K.w2, lineHeight: 1.65, fontWeight: 300, maxWidth: 480, marginTop: 16 }}>Todo editor de DR conhece esse ciclo. E ele custa caro — em tempo, em energia, em escala.</p>
          </AnimateIn>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 8 }}>
            {[
              { n: "1", t: "Horas procurando B-roll",           b: "Você assiste 50 clipes para usar 3. Sem sistema, sem critério — só garimpo sem fim." },
              { n: "2", t: "Marcação manual cena a cena",        b: "Ler roteiro, mapear timecodes, lembrar o que combina com o quê. Repetitivo e exaustivo." },
              { n: "3", t: "2 dias por VSL, impossível escalar", b: "A agência quer 10× o volume. Você não tem mais horas no dia. O gargalo é sempre o mesmo." },
              { n: "4", t: "Avatar? LipSync? Mais uma ferramenta",b: "Cada nova demanda do cliente é outra assinatura, outro login, outro pipeline para aprender." },
            ].map((d, i) => (
              <AnimateIn key={i} delay={i * 0.08}>
                <div style={{ display: "flex", gap: 16, padding: "18px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,.04)" : "none" }}>
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, color: "rgba(232,81,42,.15)", fontStyle: "italic", flexShrink: 0, width: 36, lineHeight: 1, marginTop: 2 }}>{d.n}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: K.w, marginBottom: 4, letterSpacing: "-.01em" }}>{d.t}</div>
                    <div style={{ fontSize: 13, color: K.w3, lineHeight: 1.6 }}>{d.b}</div>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </div>

      {/* ── TRANSFORMAÇÃO ── */}
      <div style={{ padding: "100px 0", background: K.k2 }}>
        <div className="site-transform" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>
          <AnimateIn>{sec("A transformação")}</AnimateIn>
          <AnimateIn delay={0.1}>
            {secH(<>O mesmo vídeo.<br/>Uma fração do tempo.</>)}
          </AnimateIn>
          <AnimateIn delay={0.2}>
            <div className="site-transform-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "center", marginTop: 48 }}>
              {/* Before */}
              <div style={{ background: K.k3, border: "1px solid rgba(255,255,255,.05)", borderRadius: 16, padding: 28, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "rgba(226,75,74,.3)" }} />
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" as const, marginBottom: 16, color: "rgba(226,75,74,.6)" }}>Sem Suarik</div>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 52, lineHeight: 1, letterSpacing: "-.03em", marginBottom: 4, color: "rgba(255,255,255,.2)" }}>2 dias</div>
                <div style={{ fontSize: 12, color: K.w3, marginBottom: 20 }}>para entregar uma VSL</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {["Garimpo manual de B-roll", "Marcação cena a cena", "TTS em outra ferramenta", "LipSync separado", "1 criativo por semana"].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: K.w3 }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(226,75,74,.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "rgba(226,75,74,.5)", flexShrink: 0 }}>✗</div>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Arrow */}
              <div className="site-transform-arrow" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 40, color: K.o, fontStyle: "italic", lineHeight: 1 }}>→</div>
                <div style={{ fontSize: 11, color: K.o, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" as const, textAlign: "center" as const }}>10× mais<br/>rápido</div>
              </div>

              {/* After */}
              <div style={{ border: `1px solid ${K.ob}`, borderRadius: 16, padding: 28, position: "relative", overflow: "hidden", background: `linear-gradient(180deg,${K.os},${K.k3})` }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${K.o},${K.o2})` }} />
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" as const, marginBottom: 16, color: K.o }}>Com Suarik</div>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 52, lineHeight: 1, letterSpacing: "-.03em", marginBottom: 4, color: K.w }}>4 horas</div>
                <div style={{ fontSize: 12, color: K.w3, marginBottom: 20 }}>do roteiro ao vídeo final</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {["B-roll mapeado por IA", "Timeline gerada automaticamente", "TTS integrado · 8 idiomas", "LipSync e avatar no mesmo app", "10× mais criativos por semana"].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: K.w }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: K.ob, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: K.o, flexShrink: 0 }}>→</div>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimateIn>
        </div>
      </div>

      {/* ── FERRAMENTAS ── */}
      <div id="ferramentas" style={{ padding: "100px 0", background: K.k }}>
        <div className="site-tools" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>
          <div className="site-tools-header" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 48 }}>
            <div>
              <AnimateIn>{sec("O arsenal completo")}</AnimateIn>
              <AnimateIn delay={0.1}>{secH(<>Sete ferramentas.<br/>Um <em style={{ fontStyle: "italic", color: K.o }}>único</em> lugar.</>)}</AnimateIn>
            </div>
            <AnimateIn delay={0.2}>
              <p style={{ fontSize: 14, color: K.w2, lineHeight: 1.65, fontWeight: 300, maxWidth: 280 }}>
                Cada ferramenta foi construída especificamente para o fluxo de produção DR.
              </p>
            </AnimateIn>
          </div>

          <div className="site-tools-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {/* Storyboard — featured */}
            <AnimateIn className="site-tools-featured" style={{ gridColumn: "span 2" }}>
              <div onClick={() => router.push("/storyboard")} style={{ background: K.k2, border: "1px solid rgba(255,255,255,.05)", borderRadius: 14, overflow: "hidden", cursor: "pointer", transition: "all .25s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.1)"; e.currentTarget.style.transform = "translateY(-3px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.05)"; e.currentTarget.style.transform = ""; }}>
                <div style={{ height: 200, position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#1A0A06,#0A0604)" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "70%", padding: "16px 0" }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        {[["Choque","rgba(232,81,42,.8)","rgba(232,81,42,.1)","rgba(232,81,42,.25)"],["Urgência","rgba(245,166,35,.8)","rgba(245,166,35,.1)","rgba(245,166,35,.2)"],["Mistério","rgba(155,143,248,.8)","rgba(155,143,248,.1)","rgba(155,143,248,.2)"],["Esperança","rgba(62,207,142,.8)","rgba(62,207,142,.1)","rgba(62,207,142,.2)"]].map(([l,c,bg,br], i) => (
                          <div key={i} style={{ flex: 1, height: 24, borderRadius: 4, background: bg, border: `1px solid ${br}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: c, letterSpacing: ".06em", textTransform: "uppercase" as const }}>{l}</div>
                        ))}
                      </div>
                      <div style={{ height: 6, borderRadius: 2, background: "rgba(255,255,255,.06)", width: "90%" }} />
                      <div style={{ height: 6, borderRadius: 2, background: "rgba(255,255,255,.04)", width: "75%" }} />
                      <div style={{ height: 28, borderRadius: 5, background: K.o, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", gap: 4, marginTop: 4 }}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1L4.5 4H2l2 1.5-1 3L6 7l3 2.5-1-3 2-1.5H7.5L6 1z" fill="currentColor" opacity=".9"/></svg>
                        Gerar Sequência →
                      </div>
                    </div>
                  </div>
                  <div style={{ position: "absolute", bottom: 10, left: 10, fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 10, letterSpacing: ".08em", textTransform: "uppercase" as const, background: "rgba(232,81,42,.12)", color: K.o, border: "1px solid rgba(232,81,42,.25)" }}>Storyboard DR</div>
                </div>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: K.w, letterSpacing: "-.01em", marginBottom: 4 }}>Storyboard</div>
                  <div style={{ fontSize: 12, color: K.w3, lineHeight: 1.55 }}>Cola o roteiro e a IA mapeia cada cena — emoção, B-roll, timecode e trilha. Do texto ao mapa editorial em segundos.</div>
                </div>
              </div>
            </AnimateIn>

            {/* Audio */}
            <AnimateIn delay={0.1}>
              <ToolCard onClick={() => router.push("/audio")} thumb={
                <div style={{ display: "flex", alignItems: "center", gap: 2, height: 48 }}>
                  {[12,22,36,18,42,24,36,14,30,44,20].map((h, i) => (
                    <div key={i} style={{ width: 4, borderRadius: 2, background: K.g, animation: `hfa-bar-anim 1.5s ${(i*0.05).toFixed(2)}s ease-in-out infinite`, height: h }} />
                  ))}
                </div>
              } thumbBg="linear-gradient(135deg,#061A10,#040C08)" tag="Audio Studio" tagColor={K.g} tagBg="rgba(62,207,142,.1)" tagBorder="rgba(62,207,142,.25)" name="Audio Studio" desc="TTS de alta fidelidade com 40+ vozes em 8 idiomas. Waveform única por voz." />
            </AnimateIn>

            {/* B-Roll */}
            <AnimateIn delay={0.1}>
              <ToolCard onClick={() => router.push("/enricher")} thumb={
                <div style={{ display: "flex", gap: 5, padding: 14 }}>
                  <div style={{ flex: 2, height: 80, borderRadius: 6, background: "rgba(74,158,255,.08)", border: "1.5px dashed rgba(74,158,255,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="1" y="3" width="14" height="16" rx="2" stroke="rgba(74,158,255,.5)" strokeWidth="1.2"/><path d="M15 7l5-3v14l-5-3V7z" stroke="rgba(74,158,255,.5)" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    {["rgba(74,158,255,.1)","rgba(74,158,255,.06)","rgba(74,158,255,.08)"].map((bg, i) => (
                      <div key={i} style={{ flex: 1, borderRadius: 4, background: bg, border: `1px solid rgba(74,158,255,${.15+i*.03})` }} />
                    ))}
                  </div>
                </div>
              } thumbBg="linear-gradient(135deg,#061428,#040810)" tag="B-Roll Studio" tagColor={K.b} tagBg="rgba(74,158,255,.1)" tagBorder="rgba(74,158,255,.25)" name="B-Roll Studio" desc="Sobe o vídeo, a IA extrai roteiro, detecta cenas e sugere B-roll por conceito emocional." />
            </AnimateIn>

            {/* LipSync */}
            <AnimateIn delay={0.2}>
              <ToolCard onClick={() => router.push("/dreamface")} thumb={
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                    <div style={{ width: 52, height: 60, borderRadius: "50% 50% 46% 46%", background: "linear-gradient(170deg,#1A2840,#0C1828)", marginBottom: -8, border: "1px solid rgba(255,255,255,.05)" }} />
                    <div style={{ width: 88, height: 70, borderRadius: "50% 50% 0 0", background: "linear-gradient(170deg,#0E1A2C,#080E18)", border: "1px solid rgba(255,255,255,.04)" }} />
                  </div>
                  {[[80,0],[110,.5],[140,1]].map(([size, delay], i) => (
                    <div key={i} style={{ position: "absolute", width: size, height: size, borderRadius: "50%", border: `1px solid rgba(232,81,42,${.12-i*.03})`, animation: `tc-ring-pulse 2.5s ${delay}s ease-out infinite` }} />
                  ))}
                </div>
              } thumbBg="linear-gradient(135deg,#1A0806,#0A0402)" tag="LipSync Studio" tagColor={K.o} tagBg="rgba(232,81,42,.1)" tagBorder="rgba(232,81,42,.25)" name="LipSync Studio" desc="Sincroniza lábios de qualquer avatar com o áudio em minutos. Newport AI." />
            </AnimateIn>

            {/* DreamAct */}
            <AnimateIn delay={0.2}>
              <ToolCard onClick={() => router.push("/dreamact")} thumb={
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ position: "relative", width: 80, height: 100 }}>
                    <div style={{ width: 80, height: 100, borderRadius: 14, background: "linear-gradient(170deg,#1A2840,#050810)", border: "1px solid rgba(155,143,248,.1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", overflow: "hidden" }}>
                      <div style={{ width: 40, height: 44, borderRadius: "50% 50% 45% 45%", background: "linear-gradient(170deg,#1A2840,#0C1828)", marginBottom: -6, border: "1px solid rgba(255,255,255,.05)" }} />
                      <div style={{ width: 60, height: 40, borderRadius: "50% 50% 0 0", background: "linear-gradient(170deg,#0E1A2C,#080E18)", border: "1px solid rgba(255,255,255,.04)" }} />
                    </div>
                    <div style={{ position: "absolute", top: 20, left: -8, width: 14, height: 14, borderRadius: "50%", border: "1px solid rgba(155,143,248,.4)", animation: "tc-ring-pulse 2s ease-in-out infinite" }} />
                    <div style={{ position: "absolute", bottom: 30, right: -6, width: 10, height: 10, borderRadius: "50%", border: "1px solid rgba(155,143,248,.3)", animation: "tc-ring-pulse 2s .4s ease-in-out infinite" }} />
                  </div>
                </div>
              } thumbBg="linear-gradient(135deg,#100820,#060410)" tag="DreamAct" tagColor={K.p} tagBg="rgba(155,143,248,.1)" tagBorder="rgba(155,143,248,.25)" name="DreamAct" desc="Transforma uma foto em avatar animado com movimentos naturais gerados por IA." />
            </AnimateIn>

            {/* Voice Clone */}
            <AnimateIn delay={0.3}>
              <ToolCard onClick={() => router.push("/voiceclone")} thumb={
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(74,158,255,.08)", border: "1.5px solid rgba(74,158,255,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="18" height="18" viewBox="0 0 22 22" fill="none"><rect x="7" y="2" width="8" height="11" rx="4" stroke="rgba(74,158,255,.7)" strokeWidth="1.3"/><path d="M4 12c0 3.9 3.1 7 7 7s7-3.1 7-7" stroke="rgba(74,158,255,.7)" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  </div>
                  <div style={{ display: "flex", gap: 1.5, height: 16, alignItems: "center" }}>
                    {[6,12,16,10,14,8,12].map((h, i) => (
                      <div key={i} style={{ width: 2, height: h, borderRadius: 1, background: K.b, animation: `hfa-bar-anim 1.2s ${(i*0.04).toFixed(2)}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>
              } thumbBg="linear-gradient(135deg,#061428,#030810)" tag="Voice Clone" tagColor={K.b} tagBg="rgba(74,158,255,.1)" tagBorder="rgba(74,158,255,.25)" name="Voice Clone" desc="Clone sua voz em minutos. Grave 3 amostras e use em qualquer geração TTS." />
            </AnimateIn>
          </div>
        </div>
      </div>

      {/* ── PLANOS ── */}
      <div id="planos" style={{ padding: "100px 0", background: `linear-gradient(180deg,${K.k},${K.k2})` }}>
        <div className="site-plans" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>
          <AnimateIn style={{ textAlign: "center" }}>
            {sec("Planos", K.o)}
            {secH(<>Construídos para <em style={{ fontStyle: "italic", color: K.o }}>escalar.</em></>)}
            <p style={{ fontSize: 16, color: K.w2, lineHeight: 1.65, fontWeight: 300, margin: "12px auto 0", maxWidth: 400 }}>
              Sistema de créditos — use em qualquer ferramenta, sem desperdício.
            </p>
          </AnimateIn>
          <div className="site-plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 48 }}>
            {[
              { n: "Starter",  role: "Freelancer",   p: "R$97",  credits: "1.000 créditos / mês", hot: false, fs: ["Storyboard + Audio Studio", "B-Roll Studio", "40+ vozes TTS", "Export profissional"], cta: "Começar →", ctaStyle: "ghost" },
              { n: "Pro",      role: "Editor DR",     p: "R$197", credits: "5.000 créditos / mês", hot: true,  fs: ["Todas as ferramentas", "LipSync Studio", "DreamAct · Avatar animado", "Voice Clone proprietário", "Upload A-roll MP4"], cta: "Começar →", ctaStyle: "fill" },
              { n: "Agency",   role: "Produtoras",    p: "R$497", credits: "Créditos ilimitados",  hot: false, fs: ["Tudo do Pro", "Até 5 usuários", "Cofre da agência", "Suporte prioritário", "API access"], cta: "Falar com time →", ctaStyle: "ghost" },
            ].map((plan, i) => (
              <AnimateIn key={i} delay={i * 0.08}>
                <div style={{
                  background: plan.hot ? `linear-gradient(180deg,rgba(232,81,42,.06),${K.k3})` : K.k3,
                  border: `1px solid ${plan.hot ? K.ob : "rgba(255,255,255,.05)"}`,
                  borderRadius: 16, padding: 28, position: "relative", transition: "all .2s",
                }}>
                  {plan.hot && (
                    <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: K.o, color: "#fff", letterSpacing: ".06em", textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>
                      Mais popular
                    </div>
                  )}
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: K.w, marginBottom: 2 }}>{plan.n}</div>
                  <div style={{ fontSize: 11, color: K.w3, marginBottom: 20, letterSpacing: ".04em", textTransform: "uppercase" as const }}>{plan.role}</div>
                  <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-.04em", color: K.w, lineHeight: 1, marginBottom: 4 }}>
                    {plan.p}<small style={{ fontSize: 14, fontWeight: 400, color: K.w3 }}>/mês</small>
                  </div>
                  <div style={{ fontSize: 12, color: K.o, fontWeight: 600, marginBottom: 20, paddingBottom: 4, borderBottom: "1px solid rgba(255,255,255,.05)" }}>{plan.credits}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 24 }}>
                    {plan.fs.map((f, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: K.w2 }}>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", background: K.ob, border: "1px solid rgba(232,81,42,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2L6.5 2.5" stroke={K.o} strokeWidth="1.2" strokeLinecap="round"/></svg>
                        </div>
                        {f}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => router.push("/dashboard")} style={{
                    display: "block", width: "100%", textAlign: "center" as const, padding: 11, borderRadius: 8,
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    background: plan.ctaStyle === "fill" ? K.o : "transparent",
                    border: plan.ctaStyle === "fill" ? `1px solid ${K.o}` : "1px solid rgba(255,255,255,.1)",
                    color: plan.ctaStyle === "fill" ? "#fff" : K.w,
                    letterSpacing: "-.01em",
                  }}>{plan.cta}</button>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </div>

      {/* ── PROOF (Testimonials) ── */}
      <div id="cases" style={{ padding: "100px 0", background: K.k2 }}>
        <div className="site-cases" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>
          <AnimateIn>{sec("Quem já usa")}</AnimateIn>
          <AnimateIn delay={0.1}>{secH(<>Editores reais.<br/><em style={{ fontStyle: "italic", color: K.o }}>Resultados reais.</em></>)}</AnimateIn>
          <div className="site-cases-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 48 }}>
            {[
              { q: `"Colei o roteiro, 40 segundos depois o mapa estava pronto. Uma VSL que levava 2 dias agora leva 4 horas. Mudou meu negócio."`, strong: "Uma VSL que levava 2 dias agora leva 4 horas.", av: "MR", avBg: "#1A0A05", avC: K.o, name: "Marcos R.", role: "Editor DR · São Paulo" },
              { q: `"A IA pensa como diretor de DR. Ela entende o gancho, a dor, o momento certo. Nenhuma outra ferramenta faz isso."`, strong: "Ela entende o gancho, a dor, o momento certo.", av: "CF", avBg: "#051020", avC: "#7B71D8", name: "Carolina F.", role: "Produtora · Rio de Janeiro" },
              { q: `"A agência foi de 4 para 40 vídeos por mês sem contratar mais ninguém. O volume que a Suarik permite é absurdo."`, strong: "A agência foi de 4 para 40 vídeos por mês sem contratar mais ninguém.", av: "JP", avBg: "#041004", avC: K.g, name: "João P.", role: "Head de Criação · Agência" },
            ].map((t, i) => (
              <AnimateIn key={i} delay={i * 0.09}>
                <div style={{ background: K.k3, border: "1px solid rgba(255,255,255,.05)", borderRadius: 14, padding: 24, transition: "all .2s" }}>
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 16, lineHeight: 1.6, color: K.w2, marginBottom: 20, fontStyle: "italic" }}>
                    {t.q.split(t.strong).map((part, j, arr) => (
                      <span key={j}>{part}{j < arr.length - 1 ? <strong style={{ color: K.w, fontStyle: "normal" }}>{t.strong}</strong> : null}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: t.avBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: t.avC, flexShrink: 0 }}>{t.av}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: K.w }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: K.w3 }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA FINAL ── */}
      <div style={{ padding: "120px 0", background: K.k, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 100%,rgba(232,81,42,.12),transparent 60%)" }} />
        <div className="site-cta-final" style={{ maxWidth: 700, margin: "0 auto", padding: "0 48px", textAlign: "center", position: "relative", zIndex: 2 }}>
          <AnimateIn>{sec("Comece agora", K.o)}</AnimateIn>
          <AnimateIn delay={0.1}>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(40px,5vw,68px)", lineHeight: .93, letterSpacing: "-.025em", marginBottom: 20 }}>
              Pare de garimprar.<br/>Comece a <em style={{ fontStyle: "italic", color: K.o }}>criar.</em>
            </div>
          </AnimateIn>
          <AnimateIn delay={0.2}>
            <p style={{ fontSize: 16, color: K.w2, lineHeight: 1.65, fontWeight: 300, marginBottom: 36 }}>Junte-se a mais de 340 editores DR que já transformaram seu fluxo de produção.</p>
            <button onClick={() => router.push("/dashboard")} style={{
              display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#fff",
              background: K.o, padding: "16px 32px", borderRadius: 8, border: "none", cursor: "pointer", letterSpacing: "-.02em",
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3l9 5-9 5V3z" fill="currentColor"/></svg>
              Criar conta gratuita
            </button>
            <p style={{ fontSize: 12, color: K.w3, marginTop: 14 }}>Sem cartão de crédito · 500 créditos grátis para testar</p>
          </AnimateIn>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <AnimateIn>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: K.w, textAlign: "center", marginBottom: 40, letterSpacing: "-.03em" }}>Perguntas Frequentes</h2>
          </AnimateIn>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQ.map((item, i) => (
              <AnimateIn key={i} delay={i * 0.04}>
                <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)", borderRadius: 12, overflow: "hidden" }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "16px 20px", textAlign: "left", fontSize: 14, fontWeight: 600, color: K.w2,
                    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                  }}>
                    {item.q}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform .2s", color: K.w3 }}>
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  {openFaq === i && (
                    <div style={{ padding: "0 20px 16px", fontSize: 14, color: K.w3, lineHeight: 1.65, borderTop: "1px solid rgba(255,255,255,.05)", paddingTop: 12 }}>
                      {item.a}
                    </div>
                  )}
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="site-footer" style={{ padding: "32px 48px", borderTop: "1px solid rgba(255,255,255,.04)", display: "flex", alignItems: "center", justifyContent: "space-between", background: K.k }}>
        <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 15, fontWeight: 700, color: K.w3, letterSpacing: "-.03em" }}>Suarik</span>
        <div className="site-footer-links" style={{ display: "flex", gap: 24 }}>
          {([
            ["Termos", "/terms"],
            ["Privacidade", "/privacy"],
            ["Contato", "mailto:contato@suarik.com"],
            ["Blog", "#"],
          ] as [string, string][]).map(([label, href]) => (
            <a key={label} href={href} style={{ fontSize: 11, color: K.w3, textDecoration: "none", letterSpacing: ".02em" }}>{label}</a>
          ))}
        </div>
        <span style={{ fontSize: 11, color: K.w4 }}>© 2025 Suarik. Todos os direitos reservados.</span>
      </footer>
    </div>
  );
}

// ─── Tool Card helper ─────────────────────────────────────────────────────────
function ToolCard({ thumb, thumbBg, tag, tagColor, tagBg, tagBorder, name, desc, onClick }: {
  thumb: React.ReactNode; thumbBg: string;
  tag: string; tagColor: string; tagBg: string; tagBorder: string;
  name: string; desc: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{ background: "#080808", border: "1px solid rgba(255,255,255,.05)", borderRadius: 14, overflow: "hidden", cursor: "pointer", height: "100%", transition: "all .25s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.1)"; e.currentTarget.style.transform = "translateY(-3px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.05)"; e.currentTarget.style.transform = ""; }}>
      <div style={{ height: 160, position: "relative", overflow: "hidden", background: thumbBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
        <div style={{ position: "relative", zIndex: 1 }}>{thumb}</div>
        <div style={{ position: "absolute", bottom: 10, left: 10, fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 10, letterSpacing: ".08em", textTransform: "uppercase" as const, background: tagBg, color: tagColor, border: `1px solid ${tagBorder}` }}>{tag}</div>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#F0EFEC", letterSpacing: "-.01em", marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 12, color: "#4A4845", lineHeight: 1.55 }}>{desc}</div>
      </div>
    </div>
  );
}
