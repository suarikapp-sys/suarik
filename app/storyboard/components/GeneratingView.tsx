"use client";

import { useState, useEffect } from "react";
import { Brain } from "lucide-react";

const LOADING_MSGS = [
  "Analisando psicologia da copy…","Detectando gatilhos de retenção…",
  "Cortando silêncios automaticamente…","Adicionando SFX de impacto…",
  "Mapeando Palavras de Poder…","Sincronizando B-rolls com a fala…",
  "Calibrando trilha para tensão máxima…","Finalizando mapa de edição premium…",
];

export function GeneratingView() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fade,   setFade]   = useState(true);
  useEffect(()=>{
    const iv = setInterval(()=>{
      setFade(false);
      setTimeout(()=>{ setMsgIdx(i=>(i+1)%LOADING_MSGS.length); setFade(true); },250);
    },1100);
    return ()=>clearInterval(iv);
  },[]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{background:"radial-gradient(circle,rgba(232,89,60,0.6),transparent)",animationDuration:"1.4s"}}/>
        <div className="absolute inset-2 rounded-full animate-spin" style={{border:"2px solid transparent",borderTopColor:"rgba(232,89,60,0.8)",borderRightColor:"rgba(232,89,60,0.3)",animationDuration:"1s"}}/>
        <div className="absolute inset-5 rounded-full animate-spin" style={{border:"2px solid transparent",borderBottomColor:"rgba(232,89,60,0.9)",borderLeftColor:"rgba(232,89,60,0.3)",animationDuration:"1.8s",animationDirection:"reverse"}}/>
        <Brain className="w-8 h-8 text-orange-400" style={{filter:"drop-shadow(0 0 8px rgba(232,89,60,0.8))"}}/>
      </div>
      <div className="text-center space-y-2">
        <p className={`text-base font-semibold text-white transition-all duration-300 ${fade?"opacity-100 translate-y-0":"opacity-0 translate-y-1"}`} style={{letterSpacing:"-0.01em"}}>{LOADING_MSGS[msgIdx]}</p>
        <p className="text-xs text-gray-500">GPT-4o · Pexels HD · Freesound · Cofre Kraft</p>
      </div>
      <div className="w-48 h-0.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
        <div className="h-full rounded-full animate-pulse" style={{background:"linear-gradient(90deg,#E8593C,#E8593C,#E8593C)",width:"70%"}}/>
      </div>
    </div>
  );
}
