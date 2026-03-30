"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown, Zap, Play, ArrowRight, Check } from "lucide-react";

// ─── Video URLs (same as main app) ───────────────────────────────────────────
const VA = "https://assets.mixkit.co/videos/18296/18296-360.mp4";
const VB = "https://assets.mixkit.co/videos/24354/24354-360.mp4";
const VC = "https://assets.mixkit.co/videos/47583/47583-360.mp4";
const VD = "https://assets.mixkit.co/videos/33376/33376-360.mp4";
const VE = "https://assets.mixkit.co/videos/25575/25575-360.mp4";
const VF = "https://assets.mixkit.co/videos/5601/5601-360.mp4";

const DEMO_VIDEOS = [VA, VB, VC, VD, VE, VF];

// ─── FAQ Data ────────────────────────────────────────────────────────────────
const FAQ = [
  { q: "O que exatamente o Suarik faz?", a: "O Suarik analisa sua copy ou vídeo A-roll e gera automaticamente um mapa de edição completo: B-rolls sincronizados, legendas karaokê, SFX de impacto e trilha sonora — tudo pronto para o editor montar em minutos." },
  { q: "Preciso saber editar vídeo para usar?", a: "Não. O Suarik gera o mapa de edição pronto. Você só precisa colar a copy ou fazer upload do vídeo e clicar em gerar. O resultado é um pacote pronto para qualquer editor aplicar." },
  { q: "Funciona para qualquer nicho?", a: "Sim. O Suarik é treinado para VSLs de saúde/nutra, finanças, renda extra, emagrecimento, infoprodutos e mais. A IA adapta o estilo de edição ao nicho escolhido." },
  { q: "Quanto custa?", a: "Temos planos a partir do gratuito com créditos limitados até o Pro ilimitado. Acesse a página de preços para ver os detalhes." },
  { q: "Posso usar meus próprios vídeos de A-roll?", a: "Com certeza. Faça upload do seu MP4 e o Suarik vai transcrever, sincronizar legendas karaokê, adicionar B-rolls e SFX automaticamente em cima do seu vídeo." },
];

// ─── Features ────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    title: "Faça o Upload",
    desc: "Suba seu vídeo A-roll ou cole o roteiro da sua VSL. A IA analisa cada palavra, detecta gatilhos emocionais e mapeia os cortes.",
    step: "01",
  },
  {
    title: "A IA Decupa Tudo",
    desc: "Em segundos, o Suarik gera B-rolls sincronizados, legendas karaokê com glow, SFX de impacto e trilha sonora — tudo cronometrado.",
    step: "02",
  },
  {
    title: "Exporte e Edite",
    desc: "Baixe o mapa de edição completo com timeline, mídia e instruções. Seu editor monta o vídeo final em minutos, não horas.",
    step: "03",
  },
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
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .fade-up{animation:fadeUp 0.7s ease both}
        .fade-up-d1{animation:fadeUp 0.7s ease 0.1s both}
        .fade-up-d2{animation:fadeUp 0.7s ease 0.2s both}
        .fade-up-d3{animation:fadeUp 0.7s ease 0.3s both}
      `}</style>

      <div className="min-h-screen" style={{background:"#fafafa",color:"#111",fontFamily:"'DM Sans',sans-serif"}}>

        {/* ═══ NAV ═══ */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4" style={{background:"rgba(250,250,250,0.85)",backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-white text-sm" style={{background:"#F0563A"}}>S</div>
              <span className="text-lg font-bold tracking-wide" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2px",color:"#111"}}>SUARIK</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <span className="text-[14px] font-medium text-zinc-800 cursor-pointer hover:text-black transition-colors">Home</span>
              <span onClick={()=>router.push("/site#recursos")} className="text-[14px] text-zinc-500 cursor-pointer hover:text-black transition-colors">Recursos</span>
              <span onClick={()=>router.push("/pricing")} className="text-[14px] text-zinc-500 cursor-pointer hover:text-black transition-colors">Planos</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={()=>router.push("/login")} className="text-[14px] font-medium text-zinc-600 hover:text-black transition-colors px-3 py-2">
              Entrar
            </button>
            <button onClick={()=>router.push("/")}
              className="text-[14px] font-semibold text-white px-5 py-2.5 rounded-full transition-all hover:scale-[1.03] active:scale-95"
              style={{background:"#111"}}>
              Criar conta
            </button>
          </div>
        </header>

        {/* ═══ HERO ═══ */}
        <section className="max-w-4xl mx-auto text-center px-6 pt-20 pb-16">
          <div className="fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8" style={{background:"rgba(240,86,58,0.06)",border:"1px solid rgba(240,86,58,0.12)"}}>
            <Plus className="w-3.5 h-3.5" style={{color:"#F0563A"}}/>
            <span className="text-[12px] font-semibold" style={{color:"#F0563A"}}>Menos trabalho. Mais escala.</span>
          </div>

          <h1 className="fade-up-d1 text-[clamp(2.5rem,5.5vw,4.2rem)] font-black leading-[1.05] tracking-tight text-black">
            Multiplique seus criativos<br/>validados em minutos
          </h1>

          <p className="fade-up-d2 text-[17px] text-zinc-500 mt-6 max-w-xl mx-auto leading-relaxed">
            Cole sua copy, suba seu A-roll e deixe a IA gerar o mapa de edição completo — B-rolls, legendas, SFX e trilha. 10x mais rápido.
          </p>

          <div className="fade-up-d3 mt-10">
            <button onClick={()=>router.push("/")}
              className="text-[16px] font-bold text-white px-8 py-4 rounded-full transition-all hover:scale-[1.04] active:scale-95 inline-flex items-center gap-2"
              style={{background:"#111",boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}}>
              Quero começar
              <ArrowRight className="w-4 h-4"/>
            </button>
          </div>

          {/* ── App Preview Mockup ── */}
          <div className="mt-16 rounded-2xl overflow-hidden shadow-2xl border" style={{border:"1px solid rgba(0,0,0,0.08)"}}>
            <div className="flex items-center gap-2 px-4 py-3" style={{background:"#1a1a1a"}}>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{background:"#ff5f57"}}/>
                <div className="w-3 h-3 rounded-full" style={{background:"#ffbd2e"}}/>
                <div className="w-3 h-3 rounded-full" style={{background:"#28c840"}}/>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-6 py-1 rounded-md text-[11px] text-zinc-500" style={{background:"rgba(255,255,255,0.06)"}}>app.suarik.com</div>
              </div>
            </div>
            <div className="relative" style={{background:"#09090b",aspectRatio:"16/9"}}>
              <div className="absolute inset-0 flex gap-1.5 p-2 opacity-30">
                {DEMO_VIDEOS.slice(0,4).map((v,i)=>(
                  <div key={i} className="flex-1 rounded-lg overflow-hidden">
                    <video src={v} autoPlay loop muted playsInline className="w-full h-full object-cover" style={{filter:"brightness(0.7)"}}/>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center" style={{background:"radial-gradient(ellipse at center,rgba(9,9,11,0.5) 0%,rgba(9,9,11,0.85) 70%)"}}>
                <div className="text-center">
                  <p className="text-white text-2xl font-black" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1.5px"}}>O CÉREBRO VISUAL DO SEU EDITOR.</p>
                  <p className="text-zinc-500 text-sm mt-2">Sobe um MP4 do seu A-roll</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ LOGO CAROUSEL ═══ */}
        <section className="py-10 overflow-hidden" style={{borderTop:"1px solid rgba(0,0,0,0.04)",borderBottom:"1px solid rgba(0,0,0,0.04)"}}>
          <div className="flex items-center gap-16 whitespace-nowrap" style={{animation:"logoScroll 25s linear infinite",width:"200%"}}>
            {[...Array(2)].flatMap((_,r) => [
              <span key={`g${r}`} className="text-[18px] font-bold text-zinc-300 flex items-center gap-2">Google Ads</span>,
              <span key={`m${r}`} className="text-[18px] font-bold text-zinc-300 flex items-center gap-2">Meta Ads</span>,
              <span key={`t${r}`} className="text-[18px] font-bold text-zinc-300 flex items-center gap-2">TikTok Ads</span>,
              <span key={`k${r}`} className="text-[18px] font-bold text-zinc-300 flex items-center gap-2">Kwai Ads</span>,
              <span key={`y${r}`} className="text-[18px] font-bold text-zinc-300 flex items-center gap-2">YouTube Ads</span>,
              <span key={`i${r}`} className="text-[18px] font-bold text-zinc-300 flex items-center gap-2">Instagram Ads</span>,
            ])}
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section id="recursos" className="max-w-6xl mx-auto px-6 py-24">
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-black text-center text-black leading-tight">
            Gere variações de criativos<br/>em minutos, não dias.
          </h2>

          <div className="mt-16 grid md:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <div key={i} className="relative p-8 rounded-2xl transition-all hover:shadow-lg" style={{background:"#fff",border:"1px solid rgba(0,0,0,0.06)"}}>
                <div className="text-[48px] font-black leading-none" style={{color:"rgba(240,86,58,0.12)",fontFamily:"'Bebas Neue',sans-serif"}}>{f.step}</div>
                <h3 className="text-[20px] font-bold text-black mt-4">{f.title}</h3>
                <p className="text-[15px] text-zinc-500 mt-3 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ FEATURES ALTERNATING ═══ */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          {/* Feature 1 — Left text, Right video */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
            <div>
              <h3 className="text-[clamp(1.5rem,3vw,2.2rem)] font-black text-black leading-tight">
                Gere múltiplas variações em minutos
              </h3>
              <p className="text-[16px] text-zinc-500 mt-5 leading-relaxed">
                Combine hooks, promessas e CTAs com inteligência. Gere dezenas de criativos em um piscar de olhos.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {BENEFITS.slice(0,3).map((b,i) => (
                  <div key={i} className="flex items-center gap-2 text-[13px] font-medium text-zinc-600 px-3 py-1.5 rounded-full" style={{background:"rgba(240,86,58,0.05)",border:"1px solid rgba(240,86,58,0.1)"}}>
                    <Check className="w-3.5 h-3.5" style={{color:"#F0563A"}}/>{b}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{background:"#f0f0f0",border:"1px solid rgba(0,0,0,0.06)"}}>
              <div className="grid grid-cols-3 gap-1.5 p-4">
                {DEMO_VIDEOS.slice(0,3).map((v,i)=>(
                  <div key={i} className="rounded-xl overflow-hidden" style={{aspectRatio:"9/16"}}>
                    <video src={v} autoPlay loop muted playsInline className="w-full h-full object-cover" style={{filter:"brightness(0.85)"}}/>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 2 — Right text, Left mockup */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="rounded-2xl overflow-hidden p-8 order-2 md:order-1" style={{background:"#f5f5f5",border:"1px solid rgba(0,0,0,0.06)"}}>
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-white shadow-sm">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background:"rgba(240,86,58,0.1)"}}><Zap className="w-5 h-5" style={{color:"#F0563A"}}/></div>
                  <div><p className="text-[14px] font-bold text-black">Faturamento</p><p className="text-[22px] font-black text-black">R$ 476.891</p></div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-white shadow-sm">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background:"rgba(34,197,94,0.1)"}}><Play className="w-5 h-5 text-green-600"/></div>
                  <div><p className="text-[14px] font-bold text-black">Margem</p><p className="text-[22px] font-black text-green-600">52%</p></div>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h3 className="text-[clamp(1.5rem,3vw,2.2rem)] font-black text-black leading-tight">
                Organize seus criativos em um só lugar
              </h3>
              <p className="text-[16px] text-zinc-500 mt-5 leading-relaxed">
                Gerencie seus criativos em um só local. Fim da bagunça de arquivos soltos. Organização é ROI.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {BENEFITS.slice(3).map((b,i) => (
                  <div key={i} className="flex items-center gap-2 text-[13px] font-medium text-zinc-600 px-3 py-1.5 rounded-full" style={{background:"rgba(240,86,58,0.05)",border:"1px solid rgba(240,86,58,0.1)"}}>
                    <Check className="w-3.5 h-3.5" style={{color:"#F0563A"}}/>{b}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SOCIAL PROOF ═══ */}
        <section className="py-24" style={{background:"#f5f5f5"}}>
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-black text-black leading-tight">
              Os maiores anunciantes que escalam<br/>do mercado têm algo em comum...
            </h2>
            <p className="text-[16px] text-zinc-500 mt-5 max-w-2xl mx-auto">
              Elas utilizam a criação modular pra potencializar ao máximo a escala de criativos vencedores.
            </p>

            <div className="mt-14 grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {[
                { name: "Agência Scale", niche: "Performance & Tráfego", revenue: "+R$ 2M/mês", desc: "Produção criativa em escala industrial, com estrutura modular replicável." },
                { name: "Studio DR", niche: "Infoprodutos & VSL", revenue: "+R$ 800K/mês", desc: "Criação modular. Variação sistemática. Escala sem limites." },
              ].map((card, i) => (
                <div key={i} className="text-left p-8 rounded-2xl bg-white" style={{border:"1px solid rgba(0,0,0,0.06)"}}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-bold text-white" style={{background:"linear-gradient(135deg,#F0563A,#FF7A5C)"}}>
                      {card.name[0]}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-black">{card.name}</p>
                      <p className="text-[12px] text-zinc-500">{card.niche}</p>
                    </div>
                  </div>
                  <p className="text-[13px] font-semibold text-zinc-400 mb-1">Faturamento mensal:</p>
                  <p className="text-[24px] font-black text-black">{card.revenue}</p>
                  <p className="text-[14px] text-zinc-500 mt-3 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FINAL CTA ═══ */}
        <section className="py-24" style={{background:"linear-gradient(180deg,#f0f7ff 0%,#fafafa 100%)"}}>
          <div className="max-w-3xl mx-auto text-center px-6">
            <h2 className="text-[clamp(2rem,4.5vw,3.2rem)] font-black text-black leading-tight">
              Escale seus anúncios vencedores, 10x mais rápido!
            </h2>
            <p className="text-[17px] text-zinc-500 mt-5">
              Menos trabalho. Mais teste. Mais escala.
            </p>
            <div className="mt-10">
              <button onClick={()=>router.push("/")}
                className="text-[16px] font-bold text-white px-8 py-4 rounded-full transition-all hover:scale-[1.04] active:scale-95 inline-flex items-center gap-2"
                style={{background:"#111",boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}}>
                Quero começar
                <ArrowRight className="w-4 h-4"/>
              </button>
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="max-w-3xl mx-auto px-6 py-24">
          <h2 className="text-[clamp(1.8rem,3.5vw,2.5rem)] font-black text-center text-black mb-12">
            Perguntas frequentes
          </h2>
          <div className="space-y-0 divide-y" style={{borderTop:"1px solid rgba(0,0,0,0.08)",borderBottom:"1px solid rgba(0,0,0,0.08)"}}>
            {FAQ.map((item, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left group">
                  <span className="text-[15px] font-semibold text-black pr-8">{item.q}</span>
                  <Plus className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-45" : ""}`}/>
                </button>
                {openFaq === i && (
                  <div className="pb-5 pr-12" style={{animation:"fadeUp 0.2s ease both"}}>
                    <p className="text-[14px] text-zinc-500 leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="px-6 lg:px-12 py-12" style={{borderTop:"1px solid rgba(0,0,0,0.06)"}}>
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start justify-between gap-8">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center font-bold text-white text-xs" style={{background:"#F0563A"}}>S</div>
              <span className="text-lg font-bold" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2px"}}>SUARIK</span>
            </div>
            <div className="flex gap-8">
              <div>
                <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Início</p>
                <div className="flex flex-col gap-2">
                  <span className="text-[14px] text-zinc-600 hover:text-black cursor-pointer transition-colors">Home</span>
                  <span onClick={()=>router.push("/site#recursos")} className="text-[14px] text-zinc-600 hover:text-black cursor-pointer transition-colors">Recursos</span>
                  <span onClick={()=>router.push("/pricing")} className="text-[14px] text-zinc-600 hover:text-black cursor-pointer transition-colors">Planos</span>
                </div>
              </div>
            </div>
          </div>
          <div className="max-w-6xl mx-auto mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3" style={{borderTop:"1px solid rgba(0,0,0,0.06)"}}>
            <p className="text-[12px] text-zinc-400">Suarik. Todos direitos reservados. &copy; 2026</p>
          </div>
        </footer>
      </div>
    </>
  );
}
