"use client";

import { useRouter } from "next/navigation";
import { X, Lock, Zap, Check } from "lucide-react";

export function PaywallModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.85)",backdropFilter:"blur(14px)"}} onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-2xl p-7 text-center" style={{background:"#0e0e0e",border:"1px solid rgba(232,89,60,0.35)",boxShadow:"0 0 80px rgba(232,89,60,0.2)"}} onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors"><X className="w-4 h-4"/></button>
        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{background:"radial-gradient(ellipse at 50% 0%,rgba(232,89,60,0.2) 0%,transparent 65%)"}}/>
        <div className="relative z-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{background:"rgba(232,89,60,0.15)",border:"1px solid rgba(232,89,60,0.3)"}}>
            <Lock className="w-6 h-6" style={{color:"#E8593C"}}/>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{color:"#E8593C"}}>Recurso PRO</p>
          <h3 className="text-2xl font-black text-white mb-2" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1.5px"}}>Desbloqueie o poder total</h3>
          <p className="text-xs text-gray-500 leading-relaxed mb-5">Exporte e baixe suas mídias com qualidade máxima, sem marca d&apos;água.</p>
          <ul className="space-y-2 mb-6 text-left">
            {["Exportar XML para Premiere","Download de mídias HD","Acervo Kraft Premium","Projetos ilimitados"].map(f=>(
              <li key={f} className="flex items-center gap-2.5 text-xs text-gray-400"><Check className="w-3.5 h-3.5 shrink-0" style={{color:"#E8593C"}}/>{f}</li>
            ))}
          </ul>
          <button onClick={()=>router.push("/pricing")} className="w-full py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2" style={{background:"linear-gradient(135deg,#E8593C,#E8593C)",boxShadow:"0 8px 28px rgba(232,89,60,0.45)"}}>
            <Zap className="w-4 h-4 text-yellow-300"/>⚡ Desbloquear Recursos PRO
          </button>
          <p className="text-[10px] text-gray-500 mt-2.5">Cancele quando quiser · Sem fidelidade</p>
        </div>
      </div>
    </div>
  );
}
