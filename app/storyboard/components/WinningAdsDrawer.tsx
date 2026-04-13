"use client";

import { useState } from "react";
import { X, Flame, TrendingUp, Eye, Zap, Play } from "lucide-react";
import type { WinningAd } from "../types";

const WINNING_ADS: WinningAd[] = [
  {
    id:"w1", title:"VSL – Planilha do Governo",       niche:"Renda Extra",
    daysActive:"Rodando há 67 dias",
    thumbnailUrl:"https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=600",
    videoUrl:"https://player.vimeo.com/external/541258672.sd.mp4?s=4b6c318534ac06b6f0012584d4b1f486663f94e9&profile_id=165",
    views:"2.1M views", spend:"~R$45k investido",
    hookText:"Você sabia que existem planilhas do governo que pagam até R$1.200 por mês sem fazer nada?",
  },
  {
    id:"w2", title:"VSL – Composto Articular 21 Dias", niche:"Saúde",
    daysActive:"Rodando há 112 dias",
    thumbnailUrl:"https://images.pexels.com/photos/7176026/pexels-photo-7176026.jpeg?auto=compress&w=600",
    videoUrl:"https://player.vimeo.com/external/391104990.sd.mp4?s=5517f699f579d98416d86a60a7470659a888a75e&profile_id=165",
    views:"5.8M views", spend:"~R$130k investido",
    hookText:"Médicos odeiam esse truque: composto natural elimina dor articular em 21 dias, sem cirurgia.",
  },
  {
    id:"w3", title:"VSL – Método Slot Secreto",        niche:"iGaming",
    daysActive:"Rodando há 33 dias",
    thumbnailUrl:"https://images.pexels.com/photos/2263436/pexels-photo-2263436.jpeg?auto=compress&w=600",
    videoUrl:"https://player.vimeo.com/external/494285880.sd.mp4?s=7b6c3f6f96216a652e75e92534570077c5e53c40&profile_id=165",
    views:"890k views", spend:"~R$22k investido",
    hookText:"Esse padrão nos slots que os cassinos tentam esconder deu +R$3.200 em apenas 48 horas.",
  },
  {
    id:"w4", title:"VSL – Licença Master PLR",          niche:"PLR",
    daysActive:"Rodando há 89 dias",
    thumbnailUrl:"https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&w=600",
    videoUrl:"https://player.vimeo.com/external/541258672.sd.mp4?s=4b6c318534ac06b6f0012584d4b1f486663f94e9&profile_id=165",
    views:"3.4M views", spend:"~R$78k investido",
    hookText:"Como eu ganho R$8.000 por mês revendendo produtos digitais que eu nunca criei.",
  },
  {
    id:"w5", title:"VSL – Glicemia Controle Total",     niche:"Saúde",
    daysActive:"Rodando há 156 dias",
    thumbnailUrl:"https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&w=600",
    videoUrl:"https://player.vimeo.com/external/391104990.sd.mp4?s=5517f699f579d98416d86a60a7470659a888a75e&profile_id=165",
    views:"12.3M views", spend:"~R$290k investido",
    hookText:"Este fruto amazônico normaliza a glicemia em 14 dias. Farmácias tentam censurar.",
  },
  {
    id:"w6", title:"VSL – Indenização Trabalhista",     niche:"Renda Extra",
    daysActive:"Rodando há 44 dias",
    thumbnailUrl:"https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&w=600",
    videoUrl:"https://player.vimeo.com/external/494285880.sd.mp4?s=7b6c3f6f96216a652e75e92534570077c5e53c40&profile_id=165",
    views:"1.9M views", spend:"~R$51k investido",
    hookText:"47 bilhões em indenizações esquecidas pelo governo. Seu CPF pode estar na lista — confira grátis.",
  },
];

const AD_NICHES  = ["Todos","Renda Extra","Saúde","iGaming","PLR"];
const AD_COLORS: Record<string,string> = {
  "Renda Extra":"#fbbf24","Saúde":"#34d399","iGaming":"#FF7A5C","PLR":"#B8B5AF",
};

export function WinningAdsDrawer({ open, onClose, onRaioX }:{
  open: boolean;
  onClose: () => void;
  onRaioX: (ad: WinningAd) => void;
}) {
  const [niche, setNiche] = useState("Todos");
  const filtered = niche==="Todos" ? WINNING_ADS : WINNING_ADS.filter(a=>a.niche===niche);

  return(
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background:"rgba(0,0,0,0.55)",
          backdropFilter:"blur(5px)",
          opacity:open?1:0,
          pointerEvents:open?"auto":"none",
        }}/>

      {/* Sliding panel */}
      <div className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width:"420px",
          background:"#0e0e0e",
          borderLeft:"1px solid rgba(255,255,255,0.07)",
          boxShadow:"-32px 0 80px rgba(0,0,0,0.75)",
          transform:open?"translateX(0)":"translateX(100%)",
          transition:"transform 0.34s cubic-bezier(0.22,1,0.36,1)",
        }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b"
          style={{borderColor:"rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.02)"}}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Flame className="w-4 h-4 text-orange-400" style={{filter:"drop-shadow(0 0 6px rgba(251,146,60,0.6))"}}/>
              <span className="text-[16px] font-black text-white" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1.5px"}}>
                Biblioteca de Vencedores
              </span>
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                style={{background:"rgba(251,191,36,0.12)",color:"#fbbf24",border:"1px solid rgba(251,191,36,0.25)"}}>
                SWIPE FILE
              </span>
            </div>
            <p className="text-[9px] text-gray-400 flex items-center gap-1">
              <TrendingUp className="w-2.5 h-2.5"/>
              {WINNING_ADS.length} anúncios vencedores · Alta performance confirmada
            </p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-100 hover:bg-white/6 transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* ── Niche filters ── */}
        <div className="flex items-center gap-1.5 px-4 py-3 shrink-0 border-b overflow-x-auto"
          style={{borderColor:"rgba(255,255,255,0.05)"}}>
          {AD_NICHES.map(n=>{
            const isAct = niche===n;
            const col   = AD_COLORS[n]??"#9ca3af";
            return(
              <button key={n} onClick={()=>setNiche(n)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
                style={{
                  background:isAct?`${col}20`:"rgba(255,255,255,0.04)",
                  border:`1px solid ${isAct?`${col}55`:"rgba(255,255,255,0.07)"}`,
                  color:isAct?col:"#6b7280",
                  boxShadow:isAct?`0 0 14px ${col}25`:"none",
                }}>
                {n==="Todos"?"🌐":n==="Saúde"?"🏥":n==="Renda Extra"?"💰":n==="iGaming"?"🎰":"📦"} {n}
              </button>
            );
          })}
        </div>

        {/* ── Count ── */}
        <div className="px-5 pt-2.5 pb-1 shrink-0">
          <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">
            {filtered.length} anúncio{filtered.length!==1?"s":""} · clique em 🧬 para extrair a estrutura
          </p>
        </div>

        {/* ── Cards ── */}
        <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-4"
          style={{scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.08) transparent"}}>
          {filtered.map(ad=>{
            const col = AD_COLORS[ad.niche]??"#9ca3af";
            return(
              <div key={ad.id} className="rounded-2xl overflow-hidden group/card"
                style={{
                  background:"#111111",
                  border:"1px solid rgba(255,255,255,0.07)",
                  boxShadow:"0 6px 28px rgba(0,0,0,0.45)",
                  transition:"border-color 0.2s",
                }}>

                {/* Thumbnail — 9:16 crop, max 240px tall */}
                <div className="relative overflow-hidden" style={{aspectRatio:"9/16",maxHeight:"240px"}}>
                  {ad.videoUrl
                    ? <video src={ad.videoUrl} autoPlay loop muted playsInline
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                        style={{filter:"brightness(0.8) saturate(1.2)"}}/>
                    : <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ad.thumbnailUrl} alt={ad.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                          style={{filter:"brightness(0.72) saturate(1.15)"}}
                          loading="lazy"/>
                      </>
                  }
                  {/* Gradient */}
                  <div className="absolute inset-0"
                    style={{background:"linear-gradient(to top,rgba(0,0,0,0.93) 0%,rgba(0,0,0,0.25) 55%,transparent 100%)"}}/>
                  {/* Niche badge */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full"
                      style={{background:`${col}25`,color:col,border:`1px solid ${col}40`}}>
                      {ad.niche}
                    </span>
                  </div>
                  {/* Days active */}
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{background:"rgba(0,0,0,0.75)",color:"#34d399",border:"1px solid rgba(52,211,153,0.3)"}}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"/>
                      {ad.daysActive}
                    </span>
                  </div>
                  {/* Play circle */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{background:"rgba(255,255,255,0.14)",border:"1.5px solid rgba(255,255,255,0.3)",backdropFilter:"blur(6px)"}}>
                      <Play className="w-4 h-4 text-white ml-0.5" fill="white"/>
                    </div>
                  </div>
                  {/* Stats row */}
                  <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-white/75 flex items-center gap-1">
                      <Eye className="w-2.5 h-2.5"/>{ad.views}
                    </span>
                    <span className="text-[9px] font-bold" style={{color:"#fbbf24"}}>
                      💰 {ad.spend}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-3.5">
                  {/* Title */}
                  <p className="text-[12px] font-black text-white mb-2" style={{letterSpacing:"-0.01em"}}>
                    {ad.title}
                  </p>
                  {/* Hook text */}
                  <div className="rounded-xl px-3 py-2.5 mb-3"
                    style={{background:"rgba(255,255,255,0.035)",border:"1px solid rgba(255,255,255,0.06)"}}>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5 text-yellow-500"/> Hook dos 3 primeiros segundos
                    </p>
                    <p className="text-[11px] text-gray-300 leading-relaxed" style={{fontStyle:"italic"}}>
                      &quot;{ad.hookText}&quot;
                    </p>
                  </div>
                  {/* Raio-X button */}
                  <button onClick={()=>onRaioX(ad)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black transition-all hover:brightness-125 active:scale-95"
                    style={{
                      background:"linear-gradient(135deg,rgba(232,89,60,0.22),rgba(232,89,60,0.14))",
                      border:"1px solid rgba(232,89,60,0.45)",
                      color:"#FF7A5C",
                      boxShadow:"0 0 24px rgba(232,89,60,0.14)",
                    }}>
                    <span className="text-sm">🧬</span>
                    <span>Extrair Raio-X (Estrutura)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
