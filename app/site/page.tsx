"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ChevronDown, Zap, Play, ArrowRight, Check, Star, Film, Music2, Type } from "lucide-react";

// ─── Video URLs ──────────────────────────────────────────────────────────────
const VA = "https://assets.mixkit.co/videos/18296/18296-360.mp4";
const VB = "https://assets.mixkit.co/videos/24354/24354-360.mp4";
const VC = "https://assets.mixkit.co/videos/47583/47583-360.mp4";
const VD = "https://assets.mixkit.co/videos/33376/33376-360.mp4";
const VE = "https://assets.mixkit.co/videos/25575/25575-360.mp4";

const DEMO_VIDEOS = [VA, VB, VC, VD, VE];

// ─── Timeline track colors (Premiere-like) ───────────────────────────────────
const TIMELINE_TRACKS = [
  {
    label: "V1", color: "#4f46e5", icon: Film, clips: [
      { w: 18, gap: 0 }, { w: 12, gap: 2 }, { w: 22, gap: 1 }, { w: 9, gap: 2 }, { w: 16, gap: 1 }, { w: 11, gap: 2 },
    ],
  },
  {
    label: "V2", color: "#7c3aed", icon: Film, clips: [
      { w: 8, gap: 2 }, { w: 14, gap: 1 }, { w: 7, gap: 2 }, { w: 18, gap: 1 }, { w: 10, gap: 2 }, { w: 13, gap: 1 },
    ],
  },
  {
    label: "SFX", color: "#F0563A", icon: Zap, clips: [
      { w: 4, gap: 4 }, { w: 3, gap: 6 }, { w: 4, gap: 5 }, { w: 3, gap: 4 }, { w: 4, gap: 5 }, { w: 3, gap: 6 },
    ],
  },
  {
    label: "SUB", color: "#059669", icon: Type, clips: [
      { w: 16, gap: 1 }, { w: 14, gap: 1 }, { w: 18, gap: 0 }, { w: 12, gap: 1 }, { w: 15, gap: 1 }, { w: 10, gap: 1 },
    ],
  },
  {
    label: "MUS", color: "#0891b2", icon: Music2, clips: [
      { w: 90, gap: 0 },
    ],
  },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────────
const FAQ = [
  { q: "O que exatamente o Suarik faz?", a: "O Suarik analisa sua copy ou vídeo A-roll e gera automaticamente um mapa de edição completo: B-rolls sincronizados, legendas karaokê, SFX de impacto e trilha sonora — tudo pronto para o editor montar em minutos." },
  { q: "Preciso saber editar vídeo para usar?", a: "Não. O Suarik gera o mapa de edição pronto. Você só precisa colar a copy ou fazer upload do vídeo e clicar em gerar. O resultado é um pacote pronto para qualquer editor aplicar." },
  { q: "Funciona para qualquer nicho?", a: "Sim. O Suarik é treinado para VSLs de saúde/nutra, finanças, renda extra, emagrecimento, infoprodutos e mais. A IA adapta o estilo de edição ao nicho escolhido." },
  { q: "Quanto custa?", a: "Temos planos a partir do Starter até o Agency. Acesse a página de preços para ver os detalhes." },
  { q: "Posso usar meus próprios vídeos de A-roll?", a: "Com certeza. Faça upload do seu MP4 e o Suarik vai transcrever, sincronizar legendas karaokê, adicionar B-rolls e SFX automaticamente em cima do seu vídeo." },
];

const FEATURES = [
  { title: "Faça o Upload", desc: "Suba seu vídeo A-roll ou cole o roteiro da sua VSL. A IA analisa cada palavra e mapeia os cortes.", step: "01", color: "#4f46e5" },
  { title: "A IA Decupa Tudo", desc: "Em segundos gera B-rolls sincronizados, legendas karaokê com glow, SFX de impacto e trilha — tudo cronometrado.", step: "02", color: "#7c3aed" },
  { title: "Exporte e Edite", desc: "Baixe o mapa de edição completo com timeline e mídia. Seu editor monta o vídeo final em minutos, não horas.", step: "03", color: "#F0563A" },
];

const BENEFITS = [
  "B-rolls sincronizados com a fala",
  "Legendas karaokê com glow automático",
  "SFX de impacto nos Power Words",
  "Trilha sonora por mood da copy",
  "Export para Premiere/DaVinci",
  "Suporte a múltiplos nichos DR",
];

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const staggerFast = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

// ─── Reusable animated section wrapper ───────────────────────────────────────
function AnimateIn({ children, className, style, delay = 0 }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ─── Timeline Mockup ─────────────────────────────────────────────────────────
function TimelineMockup() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{
      background: "rgba(9,9,11,0.7)",
      backdropFilter: "blur(24px)",
      border: "1px solid rgba(255,255,255,0.07)",
      boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 60px rgba(240,86,58,0.06)",
    }}>
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ffbd2e" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
        </div>
        <div className="flex-1 text-center text-[10px] font-mono text-zinc-600">suarik — timeline.xml</div>
        <div className="text-[10px] text-zinc-600 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Live
        </div>
      </div>

      {/* Video preview strip */}
      <div className="flex gap-0.5 overflow-hidden" style={{ height: 56 }}>
        {DEMO_VIDEOS.slice(0, 5).map((v, i) => (
          <div key={i} className="flex-1 overflow-hidden">
            <video src={v} autoPlay loop muted playsInline className="w-full h-full object-cover" style={{ filter: "brightness(0.6) saturate(1.2)" }} />
          </div>
        ))}
      </div>

      {/* Timeline tracks */}
      <div className="px-3 py-2.5 space-y-1.5">
        {TIMELINE_TRACKS.map((track, ti) => {
          const Icon = track.icon;
          return (
            <motion.div
              key={track.label}
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + ti * 0.1, duration: 0.5, ease: "easeOut" }}
            >
              <div className="flex items-center gap-1 w-9 shrink-0">
                <Icon className="w-2.5 h-2.5" style={{ color: track.color }} />
                <span className="text-[8px] font-bold font-mono" style={{ color: track.color }}>{track.label}</span>
              </div>
              <div className="flex-1 flex items-center gap-0.5 overflow-hidden" style={{ height: 14 }}>
                {track.clips.map((clip, ci) => (
                  <motion.div
                    key={ci}
                    className="h-full rounded-sm shrink-0"
                    style={{
                      width: `${clip.w}%`,
                      background: `linear-gradient(135deg, ${track.color}cc, ${track.color}88)`,
                      marginLeft: `${clip.gap}%`,
                      boxShadow: `0 0 4px ${track.color}44`,
                    }}
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.5 + ti * 0.12 + ci * 0.04, duration: 0.4, ease: "easeOut" }}
                  />
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Playhead indicator */}
      <div className="relative mx-3 mb-2 mt-1">
        <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
        <motion.div
          className="absolute top-0 w-px h-5 -mt-2"
          style={{ background: "#F0563A", boxShadow: "0 0 8px #F0563A" }}
          initial={{ left: "0%" }}
          animate={{ left: "62%" }}
          transition={{ delay: 1.2, duration: 2.5, ease: "easeInOut" }}
        />
      </div>

      {/* Bottom status bar */}
      <div className="px-3 pb-3 flex items-center justify-between">
        <span className="text-[9px] font-mono text-zinc-600">00:00:24:12</span>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-zinc-600">5 faixas · 47 cortes</span>
          <div className="px-2 py-0.5 rounded text-[8px] font-bold" style={{ background: "rgba(240,86,58,0.15)", color: "#F0563A", border: "1px solid rgba(240,86,58,0.25)" }}>
            AUTO SYNC ✓
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SitePage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: "#050505", color: "#e5e5e5" }}>

      {/* ═══ NAV ═══ */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="sticky top-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(5,5,5,0.85)", backdropFilter: "blur(20px)" }}
      >
        <div className="flex items-center gap-8">
          <span className="text-xl font-black tracking-tighter text-white select-none" style={{ letterSpacing: "-0.04em" }}>Suarik</span>
          <div className="hidden md:flex items-center gap-6">
            <span className="text-sm font-medium text-gray-300 cursor-pointer hover:text-white transition-colors">Home</span>
            <span onClick={() => router.push("/site#recursos")} className="text-sm text-gray-500 cursor-pointer hover:text-gray-200 transition-colors">Recursos</span>
            <span onClick={() => router.push("/pricing")} className="text-sm text-gray-500 cursor-pointer hover:text-gray-200 transition-colors">Planos</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/login")} className="text-sm text-gray-500 hover:text-gray-200 transition-colors hidden sm:block">Entrar</button>
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: "0 0 30px rgba(240,86,58,0.45)" }}
            whileTap={{ scale: 0.96 }}
            onClick={() => router.push("/dashboard")}
            className="text-sm font-black text-white px-5 py-2.5 rounded-xl"
            style={{ background: "linear-gradient(135deg,#F0563A,#c44527)", boxShadow: "0 4px 20px rgba(240,86,58,0.3)" }}
          >
            Criar conta
          </motion.button>
        </div>
      </motion.nav>

      {/* ═══ HERO ═══ */}
      <section className="relative px-6 pt-20 pb-10 lg:pt-28 lg:pb-16 overflow-hidden">
        {/* Studio glow lights */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-20"
            style={{ background: "radial-gradient(ellipse at center, #F0563A 0%, transparent 65%)", filter: "blur(120px)" }} />
          <div className="absolute top-20 left-1/4 w-[400px] h-[300px] rounded-full opacity-10"
            style={{ background: "radial-gradient(ellipse at center, #7c3aed 0%, transparent 65%)", filter: "blur(100px)" }} />
          <div className="absolute top-20 right-1/4 w-[400px] h-[300px] rounded-full opacity-10"
            style={{ background: "radial-gradient(ellipse at center, #4f46e5 0%, transparent 65%)", filter: "blur(100px)" }} />
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="text-center lg:text-left"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold mb-8 border"
              style={{ background: "rgba(240,86,58,0.08)", borderColor: "rgba(240,86,58,0.25)", color: "#fca896" }}>
              <Star className="w-3 h-3 fill-current" style={{ color: "#F0563A" }} />
              Menos trabalho. Mais escala.
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.05]" style={{ letterSpacing: "-0.04em" }}>
              Multiplique seus<br />criativos{" "}
              <span style={{ background: "linear-gradient(90deg,#F0563A,#ff8c6b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                validados
              </span>
              <br />em minutos.
            </motion.h1>

            <motion.p variants={fadeUp} className="text-base text-gray-500 mt-6 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Cole sua copy, suba seu A-roll e deixe a IA gerar o mapa de edição completo — B-rolls, legendas, SFX e trilha. 10x mais rápido.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-4 justify-center lg:justify-start">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(240,86,58,0.4), 0 8px 30px rgba(240,86,58,0.25)" }}
                whileTap={{ scale: 0.96 }}
                onClick={() => router.push("/dashboard")}
                className="text-sm font-black text-white px-8 py-3.5 rounded-xl inline-flex items-center gap-2"
                style={{ background: "linear-gradient(135deg,#F0563A,#c44527)", boxShadow: "0 8px 32px rgba(240,86,58,0.3)" }}
              >
                Quero começar <ArrowRight className="w-4 h-4" />
              </motion.button>

              <motion.button
                whileHover={{ borderColor: "rgba(255,255,255,0.2)", color: "#e5e5e5" }}
                onClick={() => router.push("/pricing")}
                className="text-sm font-semibold px-6 py-3.5 rounded-xl transition-colors"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", color: "#a5b4fc" }}
              >
                Ver planos
              </motion.button>
            </motion.div>

            {/* Social proof micro */}
            <motion.div variants={fadeUp} className="mt-8 flex items-center gap-3 justify-center lg:justify-start">
              <div className="flex -space-x-2">
                {["#F0563A", "#4f46e5", "#059669", "#7c3aed"].map((c, i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: c, borderColor: "#050505" }}>
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600">+1.200 editores já escalaram</p>
            </motion.div>
          </motion.div>

          {/* Right: Timeline Mockup */}
          <AnimateIn delay={0.3} className="w-full max-w-xl mx-auto lg:mx-0">
            <TimelineMockup />
          </AnimateIn>
        </div>
      </section>

      {/* ═══ LOGO CAROUSEL ═══ */}
      <section className="py-8 overflow-hidden border-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-14 whitespace-nowrap"
          style={{ animation: "logoScroll 22s linear infinite", width: "200%" }}>
          <style>{`@keyframes logoScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
          {[...Array(2)].flatMap((_, r) =>
            ["Google Ads", "Meta Ads", "TikTok Ads", "Kwai Ads", "YouTube Ads", "Instagram Ads"].map((name, i) => (
              <span key={`${r}-${i}`} className="text-base font-bold text-gray-800 shrink-0">{name}</span>
            ))
          )}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="recursos" className="relative max-w-6xl mx-auto px-6 py-24">
        {/* Studio glow */}
        <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[400px] -z-10 opacity-15"
          style={{ background: "radial-gradient(ellipse at center, #F0563A 0%, transparent 65%)", filter: "blur(120px)" }} />

        <AnimateIn className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-white" style={{ letterSpacing: "-0.04em", lineHeight: 1.15 }}>
            Gere variações de criativos<br />
            <span style={{ background: "linear-gradient(90deg,#F0563A,#ff8c6b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              em minutos, não dias.
            </span>
          </h2>
        </AnimateIn>

        <motion.div
          variants={staggerFast}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid md:grid-cols-3 gap-5"
        >
          {FEATURES.map((f) => (
            <motion.div key={f.step} variants={fadeUp}
              className="relative p-6 rounded-2xl group"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: `0 0 0px ${f.color}00`,
                transition: "box-shadow 0.3s ease, border-color 0.3s ease",
              }}
              whileHover={{ boxShadow: `0 0 40px ${f.color}18`, borderColor: `${f.color}30` }}
            >
              <div className="text-[52px] font-black leading-none mb-3"
                style={{ fontFamily: "'Bebas Neue',sans-serif", background: `linear-gradient(180deg,${f.color}44,${f.color}10)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {f.step}
              </div>
              <h3 className="text-base font-black text-white mb-2" style={{ letterSpacing: "-0.02em" }}>{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              <div className="absolute bottom-0 left-0 right-0 h-px rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(90deg,transparent,${f.color}60,transparent)` }} />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══ FEATURES ALTERNATING ═══ */}
      <section className="max-w-6xl mx-auto px-6 pb-24 space-y-28">

        {/* Feature 1 — Copy left, Videos right */}
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
          <AnimateIn>
            <h3 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ letterSpacing: "-0.03em" }}>
              Gere múltiplas variações<br />em minutos
            </h3>
            <p className="text-base text-gray-500 mt-5 leading-relaxed">
              Combine hooks, promessas e CTAs com inteligência. Gere dezenas de criativos em um piscar de olhos.
            </p>
            <motion.div
              variants={staggerFast}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="mt-6 flex flex-wrap gap-2"
            >
              {BENEFITS.slice(0, 3).map((b) => (
                <motion.div key={b} variants={fadeUp}
                  className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(240,86,58,0.08)", border: "1px solid rgba(240,86,58,0.2)", color: "#fca896" }}>
                  <Check className="w-3.5 h-3.5 text-orange-400" />{b}
                </motion.div>
              ))}
            </motion.div>
          </AnimateIn>

          <AnimateIn delay={0.15} className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="grid grid-cols-3 gap-1.5 p-3">
              {DEMO_VIDEOS.slice(0, 3).map((v, i) => (
                <div key={i} className="rounded-xl overflow-hidden" style={{ aspectRatio: "9/16" }}>
                  <video src={v} autoPlay loop muted playsInline className="w-full h-full object-cover"
                    style={{ filter: "brightness(0.7) saturate(1.1)" }} />
                </div>
              ))}
            </div>
          </AnimateIn>
        </div>

        {/* Feature 2 — Metrics left, Copy right */}
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
          <AnimateIn delay={0.1} className="rounded-2xl p-7 order-2 md:order-1"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="space-y-3">
              {[
                { icon: Zap, iconBg: "rgba(79,70,229,0.12)", iconBorder: "rgba(79,70,229,0.2)", iconColor: "text-indigo-400", label: "Faturamento", value: "R$ 476.891", valueColor: "#fff" },
                { icon: Play, iconBg: "rgba(16,185,129,0.1)", iconBorder: "rgba(16,185,129,0.2)", iconColor: "text-emerald-400", label: "Margem", value: "52%", valueColor: "#34d399" },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.15, duration: 0.5, ease: "easeOut" }}
                    className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: item.iconBg, border: `1px solid ${item.iconBorder}` }}>
                      <Icon className={`w-5 h-5 ${item.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500">{item.label}</p>
                      <p className="text-xl font-black" style={{ color: item.valueColor, letterSpacing: "-0.03em" }}>{item.value}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimateIn>

          <AnimateIn className="order-1 md:order-2">
            <h3 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ letterSpacing: "-0.03em" }}>
              Organize seus criativos<br />em um só lugar
            </h3>
            <p className="text-base text-gray-500 mt-5 leading-relaxed">
              Gerencie seus criativos em um só local. Fim da bagunça de arquivos soltos. Organização é ROI.
            </p>
            <motion.div
              variants={staggerFast}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="mt-6 flex flex-wrap gap-2"
            >
              {BENEFITS.slice(3).map((b) => (
                <motion.div key={b} variants={fadeUp}
                  className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(240,86,58,0.08)", border: "1px solid rgba(240,86,58,0.2)", color: "#fca896" }}>
                  <Check className="w-3.5 h-3.5 text-orange-400" />{b}
                </motion.div>
              ))}
            </motion.div>
          </AnimateIn>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF ═══ */}
      <section className="py-24 border-t relative" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        {/* Glow */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] -z-10 opacity-12"
          style={{ background: "radial-gradient(ellipse at center, #7c3aed 0%, transparent 65%)", filter: "blur(120px)" }} />

        <div className="max-w-5xl mx-auto px-6 text-center">
          <AnimateIn>
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight" style={{ letterSpacing: "-0.04em" }}>
              Os maiores anunciantes que escalam<br />
              <span style={{ background: "linear-gradient(90deg,#F0563A,#ff8c6b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                têm algo em comum...
              </span>
            </h2>
            <p className="text-base text-gray-500 mt-5 max-w-2xl mx-auto">
              Elas utilizam a criação modular pra potencializar ao máximo a escala de criativos vencedores.
            </p>
          </AnimateIn>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="mt-14 grid md:grid-cols-2 gap-5 max-w-3xl mx-auto"
          >
            {[
              { name: "Agência Scale", niche: "Performance & Tráfego", revenue: "+R$ 2M/mês", desc: "Produção criativa em escala industrial, com estrutura modular replicável.", accent: "rgba(240,86,58,0.12)", border: "rgba(240,86,58,0.2)" },
              { name: "Studio DR", niche: "Infoprodutos & VSL", revenue: "+R$ 800K/mês", desc: "Criação modular. Variação sistemática. Escala sem limites.", accent: "rgba(79,70,229,0.1)", border: "rgba(79,70,229,0.2)" },
            ].map((card, i) => (
              <motion.div key={i} variants={fadeUp}
                className="text-left p-6 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${card.border}`, boxShadow: `0 0 30px ${card.accent}` }}
                whileHover={{ boxShadow: `0 0 50px ${card.accent}`, y: -4, transition: { duration: 0.2 } }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: "linear-gradient(135deg,#F0563A,#c44527)" }}>
                    {card.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">{card.name}</p>
                    <p className="text-xs text-gray-600">{card.niche}</p>
                  </div>
                </div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Faturamento mensal:</p>
                <p className="text-2xl font-black text-white" style={{ letterSpacing: "-0.03em" }}>{card.revenue}</p>
                <p className="text-sm text-gray-500 mt-3 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="py-28 relative overflow-hidden">
        {/* Big center glow */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full opacity-20"
            style={{ background: "radial-gradient(ellipse at center, #F0563A 0%, transparent 65%)", filter: "blur(130px)" }} />
        </div>
        <AnimateIn className="max-w-3xl mx-auto text-center px-6">
          <h2 className="text-3xl md:text-5xl font-black text-white leading-tight" style={{ letterSpacing: "-0.04em" }}>
            Escale seus anúncios<br />vencedores,{" "}
            <span style={{ background: "linear-gradient(90deg,#F0563A,#ff8c6b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              10x mais rápido!
            </span>
          </h2>
          <p className="text-base text-gray-500 mt-5">Menos trabalho. Mais teste. Mais escala.</p>
          <div className="mt-10">
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(240,86,58,0.5), 0 10px 40px rgba(240,86,58,0.3)" }}
              whileTap={{ scale: 0.96 }}
              onClick={() => router.push("/dashboard")}
              className="text-sm font-black text-white px-10 py-4 rounded-xl inline-flex items-center gap-2"
              style={{ background: "linear-gradient(135deg,#F0563A,#c44527)", boxShadow: "0 8px 32px rgba(240,86,58,0.35)" }}
            >
              Quero começar <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
          <p className="text-xs text-gray-700 mt-5">✓ Sem fidelidade &nbsp;·&nbsp; ✓ Cancele quando quiser &nbsp;·&nbsp; ✓ Pagamento seguro</p>
        </AnimateIn>
      </section>

      {/* ═══ FAQ ═══ */}
      <div className="border-t px-6 py-16" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="max-w-2xl mx-auto">
          <AnimateIn>
            <h2 className="text-xl font-black text-white text-center mb-10" style={{ letterSpacing: "-0.03em" }}>Perguntas Frequentes</h2>
          </AnimateIn>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="space-y-3"
          >
            {FAQ.map((item, i) => (
              <motion.div key={i} variants={fadeUp}
                className="rounded-xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-gray-300 hover:text-white transition-colors"
                >
                  {item.q}
                  <ChevronDown className={`w-4 h-4 text-gray-600 shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-5 pb-4 text-sm text-gray-500 leading-relaxed border-t"
                    style={{ borderColor: "rgba(255,255,255,0.05)" }}
                  >
                    <p className="pt-3">{item.a}</p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t px-6 lg:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-700"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <span className="font-black text-gray-600" style={{ letterSpacing: "-0.03em" }}>Suarik</span>
        <span>&copy; 2025 Kraft Mídia · Todos os direitos reservados</span>
        <div className="flex gap-4">
          <button className="hover:text-gray-400 transition-colors">Termos</button>
          <button className="hover:text-gray-400 transition-colors">Privacidade</button>
        </div>
      </footer>
    </div>
  );
}
