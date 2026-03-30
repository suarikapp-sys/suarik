"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Zap, Play, ArrowRight, Check, Star, ArrowLeft } from "lucide-react";

// ─── Video URLs ──────────────────────────────────────────────────────────────
const VA = "https://assets.mixkit.co/videos/18296/18296-360.mp4";
const VB = "https://assets.mixkit.co/videos/24354/24354-360.mp4";
const VC = "https://assets.mixkit.co/videos/47583/47583-360.mp4";
const VD = "https://assets.mixkit.co/videos/33376/33376-360.mp4";
const VE = "https://assets.mixkit.co/videos/25575/25575-360.mp4";
const VF = "https://assets.mixkit.co/videos/5601/5601-360.mp4";

const DEMO_VIDEOS = [VA, VB, VC, VD, VE, VF];

// ─── FAQ ─────────────────────────────────────────────────────────────────────
const FAQ = [
  { q: "O que exatamente o Suarik faz?", a: "O Suarik analisa sua copy ou vídeo A-roll e gera automaticamente um mapa de edição completo: B-rolls sincronizados, legendas karaokê, SFX de impacto e trilha sonora — tudo pronto para o editor montar em minutos." },
  { q: "Preciso saber editar vídeo para usar?", a: "Não. O Suarik gera o mapa de edição pronto. Você só precisa colar a copy ou fazer upload do vídeo e clicar em gerar. O resultado é um pacote pronto para qualquer editor aplicar." },
  { q: "Funciona para qualquer nicho?", a: "Sim. O Suarik é treinado para VSLs de saúde/nutra, finanças, renda extra, emagrecimento, infoprodutos e mais. A IA adapta o estilo de edição ao nicho escolhido." },
  { q: "Quanto custa?", a: "Temos planos a partir do Starter até o Agency. Acesse a página de preços para ver os detalhes." },
  { q: "Posso usar meus próprios vídeos de A-roll?", a: "Com certeza. Faça upload do seu MP4 e o Suarik vai transcrever, sincronizar legendas karaokê, adicionar B-rolls e SFX automaticamente em cima do seu vídeo." },
];

// ─── Features ────────────────────────────────────────────────────────────────
const FEATURES = [
  { title: "Faça o Upload", desc: "Suba seu vídeo A-roll ou cole o roteiro da sua VSL. A IA analisa cada palavra, detecta gatilhos emocionais e mapeia os cortes.", step: "01" },
  { title: "A IA Decupa Tudo", desc: "Em segundos, o Suarik gera B-rolls sincronizados, legendas karaokê com glow, SFX de impacto e trilha sonora — tudo cronometrado.", step: "02" },
  { title: "Exporte e Edite", desc: "Baixe o mapa de edição completo com timeline, mídia e instruções. Seu editor monta o vídeo final em minutos, não horas.", step: "03" },
];

const BENEFITS = [
  "B-rolls sincronizados com a fala",
  "Legendas karaokê com glow automático",
  "SFX de impacto nos Power Words",
  "Trilha sonora por mood da copy",
  "Export para Premiere/DaVinci",
  "Suporte a múltiplos nichos DR",
];

export default function SitePage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes logoScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .fade-up{animation:fadeUp 0.7s ease both}
        .fade-up-d1{animation:fadeUp 0.7s ease 0.1s both}
        .fade-up-d2{animation:fadeUp 0.7s ease 0.2s both}
        .fade-up-d3{animation:fadeUp 0.7s ease 0.3s both}
      `}</style>

      <div className="min-h-screen font-sans" style={{background:"#050505",color:"#e5e5e5"}}>

        {/* ═══ NAV (pricing-style) ═══ */}
        <nav className="flex items-center justify-between px-10 py-5 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <div className="flex items-center gap-8">
            <span className="text-xl font-black tracking-tighter text-white select-none" style={{letterSpacing:"-0.04em"}}>
              Suarik
            </span>
            <div className="hidden md:flex items-center gap-6">
              <span className="text-sm font-medium text-gray-300 cursor-pointer hover:text-white transition-colors">Home</span>
              <span onClick={()=>router.push("/site#recursos")} className="text-sm text-gray-500 cursor-pointer hover:text-gray-200 transition-colors">Recursos</span>
              <span onClick={()=>router.push("/pricing")} className="text-sm text-gray-500 cursor-pointer hover:text-gray-200 transition-colors">Planos</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={()=>router.push("/login")} className="text-sm text-gray-500 hover:text-gray-200 transition-colors">
              Entrar
            </button>
            <button onClick={()=>router.push("/")}
              className="text-sm font-black text-white px-5 py-2.5 rounded-xl transition-all hover:scale-[1.03] active:scale-95"
              style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",boxShadow:"0 8px 32px rgba(79,70,229,0.4)"}}>
              Criar conta
            </button>
          </div>
        </nav>

        {/* ═══ HERO ═══ */}
        <section className="text-center px-6 pt-20 pb-16 relative">
          {/* Background glow — same as pricing */}
          <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse 60% 40% at 50% 0%, rgba(79,70,229,0.12) 0%, transparent 70%)"}}/>

          <div className="relative z-10 max-w-4xl mx-auto">
            <div className="fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold mb-8 border"
              style={{background:"rgba(79,70,229,0.1)",borderColor:"rgba(79,70,229,0.25)",color:"#a5b4fc"}}>
              <Star className="w-3 h-3 fill-current"/>
              Menos trabalho. Mais escala.
            </div>

            <h1 className="fade-up-d1 text-4xl md:text-5xl font-black text-white mb-5" style={{letterSpacing:"-0.04em",lineHeight:1.1}}>
              Multiplique seus criativos<br/>
              <span style={{background:"linear-gradient(90deg,#60a5fa,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                validados em minutos.
              </span>
            </h1>

            <p className="fade-up-d2 text-base text-gray-500 mt-6 max-w-xl mx-auto leading-relaxed">
              Cole sua copy, suba seu A-roll e deixe a IA gerar o mapa de edição completo — B-rolls, legendas, SFX e trilha. 10x mais rápido.
            </p>

            <div className="fade-up-d3 mt-10 flex items-center justify-center gap-4">
              <button onClick={()=>router.push("/")}
                className="text-sm font-black text-white px-8 py-3.5 rounded-xl transition-all hover:scale-[1.04] active:scale-95 inline-flex items-center gap-2"
                style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",boxShadow:"0 8px 32px rgba(79,70,229,0.4)"}}>
                Quero começar
                <ArrowRight className="w-4 h-4"/>
              </button>
              <button onClick={()=>router.push("/pricing")}
                className="text-sm font-semibold px-6 py-3.5 rounded-xl transition-all hover:bg-white/[0.04]"
                style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.08)",color:"#a5b4fc"}}>
                Ver planos
              </button>
            </div>

            {/* ── App Preview Mockup ── */}
            <div className="mt-16 rounded-2xl overflow-hidden" style={{border:"1px solid rgba(79,70,229,0.2)",boxShadow:"0 0 60px rgba(79,70,229,0.08)"}}>
              <div className="flex items-center gap-2 px-4 py-3" style={{background:"rgba(255,255,255,0.02)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{background:"rgba(255,255,255,0.08)"}}/>
                  <div className="w-3 h-3 rounded-full" style={{background:"rgba(255,255,255,0.08)"}}/>
                  <div className="w-3 h-3 rounded-full" style={{background:"rgba(255,255,255,0.08)"}}/>
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-6 py-1 rounded-md text-[11px] text-gray-600" style={{background:"rgba(255,255,255,0.03)"}}>app.suarik.com</div>
                </div>
              </div>
              <div className="relative" style={{background:"#09090b",aspectRatio:"16/9"}}>
                <div className="absolute inset-0 flex gap-1.5 p-2 opacity-30">
                  {DEMO_VIDEOS.slice(0,4).map((v,i)=>(
                    <div key={i} className="flex-1 rounded-lg overflow-hidden">
                      <video src={v} autoPlay loop muted playsInline className="w-full h-full object-cover" style={{filter:"brightness(0.6)"}}/>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center" style={{background:"radial-gradient(ellipse at center,rgba(9,9,11,0.5) 0%,rgba(9,9,11,0.9) 70%)"}}>
                  <div className="text-center">
                    <p className="text-white text-2xl font-black" style={{letterSpacing:"-0.03em"}}>O CÉREBRO VISUAL DO SEU EDITOR.</p>
                    <p className="text-gray-600 text-sm mt-2">Sobe um MP4 do seu A-roll</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ LOGO CAROUSEL ═══ */}
        <section className="py-10 overflow-hidden border-y" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <div className="flex items-center gap-16 whitespace-nowrap" style={{animation:"logoScroll 25s linear infinite",width:"200%"}}>
            {[...Array(2)].flatMap((_,r) => [
              <span key={`g${r}`} className="text-[18px] font-bold text-gray-700 flex items-center gap-2">Google Ads</span>,
              <span key={`m${r}`} className="text-[18px] font-bold text-gray-700 flex items-center gap-2">Meta Ads</span>,
              <span key={`t${r}`} className="text-[18px] font-bold text-gray-700 flex items-center gap-2">TikTok Ads</span>,
              <span key={`k${r}`} className="text-[18px] font-bold text-gray-700 flex items-center gap-2">Kwai Ads</span>,
              <span key={`y${r}`} className="text-[18px] font-bold text-gray-700 flex items-center gap-2">YouTube Ads</span>,
              <span key={`i${r}`} className="text-[18px] font-bold text-gray-700 flex items-center gap-2">Instagram Ads</span>,
            ])}
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section id="recursos" className="max-w-6xl mx-auto px-6 py-24 relative">
          <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse 50% 50% at 50% 30%, rgba(79,70,229,0.06) 0%, transparent 70%)"}}/>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-black text-center text-white leading-tight" style={{letterSpacing:"-0.04em"}}>
              Gere variações de criativos<br/>
              <span style={{background:"linear-gradient(90deg,#60a5fa,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                em minutos, não dias.
              </span>
            </h2>

            <div className="mt-16 grid md:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => (
                <div key={i} className="relative p-6 rounded-2xl transition-all duration-300"
                  style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",boxShadow:"0 0 20px rgba(79,70,229,0.04)"}}>
                  <div className="text-[48px] font-black leading-none" style={{background:"linear-gradient(180deg,rgba(79,70,229,0.25),rgba(79,70,229,0.05))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontFamily:"'Bebas Neue',sans-serif"}}>{f.step}</div>
                  <h3 className="text-lg font-black text-white mt-3" style={{letterSpacing:"-0.02em"}}>{f.title}</h3>
                  <p className="text-sm text-gray-500 mt-3 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FEATURES ALTERNATING ═══ */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          {/* Feature 1 */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{letterSpacing:"-0.03em"}}>
                Gere múltiplas variações em minutos
              </h3>
              <p className="text-base text-gray-500 mt-5 leading-relaxed">
                Combine hooks, promessas e CTAs com inteligência. Gere dezenas de criativos em um piscar de olhos.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {BENEFITS.slice(0,3).map((b,i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{background:"rgba(79,70,229,0.1)",border:"1px solid rgba(79,70,229,0.2)",color:"#a5b4fc"}}>
                    <Check className="w-3.5 h-3.5"/>{b}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
              <div className="grid grid-cols-3 gap-1.5 p-3">
                {DEMO_VIDEOS.slice(0,3).map((v,i)=>(
                  <div key={i} className="rounded-xl overflow-hidden" style={{aspectRatio:"9/16"}}>
                    <video src={v} autoPlay loop muted playsInline className="w-full h-full object-cover" style={{filter:"brightness(0.7)"}}/>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="rounded-2xl overflow-hidden p-8 order-2 md:order-1" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-4 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)"}}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background:"rgba(79,70,229,0.12)",border:"1px solid rgba(79,70,229,0.2)"}}><Zap className="w-5 h-5 text-indigo-400"/></div>
                  <div><p className="text-xs font-bold text-gray-400">Faturamento</p><p className="text-xl font-black text-white" style={{letterSpacing:"-0.03em"}}>R$ 476.891</p></div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)"}}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)"}}><Play className="w-5 h-5 text-emerald-400"/></div>
                  <div><p className="text-xs font-bold text-gray-400">Margem</p><p className="text-xl font-black text-emerald-400" style={{letterSpacing:"-0.03em"}}>52%</p></div>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h3 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{letterSpacing:"-0.03em"}}>
                Organize seus criativos em um só lugar
              </h3>
              <p className="text-base text-gray-500 mt-5 leading-relaxed">
                Gerencie seus criativos em um só local. Fim da bagunça de arquivos soltos. Organização é ROI.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {BENEFITS.slice(3).map((b,i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{background:"rgba(79,70,229,0.1)",border:"1px solid rgba(79,70,229,0.2)",color:"#a5b4fc"}}>
                    <Check className="w-3.5 h-3.5"/>{b}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SOCIAL PROOF ═══ */}
        <section className="py-24 border-t" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight" style={{letterSpacing:"-0.04em"}}>
              Os maiores anunciantes que escalam<br/>
              <span style={{background:"linear-gradient(90deg,#60a5fa,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                têm algo em comum...
              </span>
            </h2>
            <p className="text-base text-gray-500 mt-5 max-w-2xl mx-auto">
              Elas utilizam a criação modular pra potencializar ao máximo a escala de criativos vencedores.
            </p>

            <div className="mt-14 grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
              {[
                { name: "Agência Scale", niche: "Performance & Tráfego", revenue: "+R$ 2M/mês", desc: "Produção criativa em escala industrial, com estrutura modular replicável.", accent: "rgba(59,130,246,0.15)", accentBorder: "rgba(59,130,246,0.2)", iconColor: "#93c5fd" },
                { name: "Studio DR", niche: "Infoprodutos & VSL", revenue: "+R$ 800K/mês", desc: "Criação modular. Variação sistemática. Escala sem limites.", accent: "rgba(16,185,129,0.1)", accentBorder: "rgba(16,185,129,0.15)", iconColor: "#6ee7b7" },
              ].map((card, i) => (
                <div key={i} className="text-left p-6 rounded-2xl transition-all duration-300"
                  style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${card.accentBorder}`,boxShadow:`0 0 20px ${card.accent}`}}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)"}}>
                      {card.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">{card.name}</p>
                      <p className="text-xs text-gray-600">{card.niche}</p>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Faturamento mensal:</p>
                  <p className="text-2xl font-black text-white" style={{letterSpacing:"-0.03em"}}>{card.revenue}</p>
                  <p className="text-sm text-gray-500 mt-3 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FINAL CTA ═══ */}
        <section className="py-24 relative">
          <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse 60% 50% at 50% 50%, rgba(79,70,229,0.1) 0%, transparent 70%)"}}/>
          <div className="relative z-10 max-w-3xl mx-auto text-center px-6">
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight" style={{letterSpacing:"-0.04em"}}>
              Escale seus anúncios vencedores,{" "}
              <span style={{background:"linear-gradient(90deg,#60a5fa,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                10x mais rápido!
              </span>
            </h2>
            <p className="text-base text-gray-500 mt-5">
              Menos trabalho. Mais teste. Mais escala.
            </p>
            <div className="mt-10">
              <button onClick={()=>router.push("/")}
                className="text-sm font-black text-white px-8 py-3.5 rounded-xl transition-all hover:scale-[1.04] active:scale-95 inline-flex items-center gap-2"
                style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",boxShadow:"0 8px 32px rgba(79,70,229,0.4)"}}>
                Quero começar
                <ArrowRight className="w-4 h-4"/>
              </button>
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <div className="border-t px-6 py-16" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-white text-center mb-10" style={{letterSpacing:"-0.03em"}}>
              Perguntas Frequentes
            </h2>
            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <div key={i} className="rounded-xl overflow-hidden transition-all"
                  style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)"}}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-gray-300 hover:text-white transition-colors">
                    {item.q}
                    <ChevronDown className={`w-4 h-4 text-gray-600 shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}/>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed border-t" style={{borderColor:"rgba(255,255,255,0.05)"}}>
                      <p className="pt-3">{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <footer className="border-t px-10 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-700"
          style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <span className="font-black text-gray-600" style={{letterSpacing:"-0.03em"}}>Suarik</span>
          <span>&copy; 2025 Kraft Mídia · Todos os direitos reservados</span>
          <div className="flex gap-4">
            <button className="hover:text-gray-400 transition-colors">Termos</button>
            <button className="hover:text-gray-400 transition-colors">Privacidade</button>
          </div>
        </footer>
      </div>
    </>
  );
}
