"use client";

import { useRouter } from "next/navigation";

// ─── Tool configs ──────────────────────────────────────────────────────────────
type ToolId = "lipsync" | "dreamact" | "voice";

interface UnlockItem { name: string; tag: string; color: string; bg: string }

interface ToolConfig {
  color: string;
  lockBg: string;
  lockBorder: string;
  name: string;
  title: [string, string]; // [normal, italic part]
  sub: string;
  unlocks: UnlockItem[];
}

const TOOLS: Record<ToolId, ToolConfig> = {
  lipsync: {
    color: "#E8512A",
    lockBg: "rgba(232,81,42,.12)",
    lockBorder: "rgba(232,81,42,.25)",
    name: "LipSync Studio",
    title: ["Sincronize lábios. Escale ", "qualquer avatar."],
    sub: "Você está no Starter. Faça upgrade para o Pro e desbloqueie o LipSync Studio + 4 outras ferramentas premium.",
    unlocks: [
      { name: "LipSync Studio",                  tag: "Desbloqueado", color: "#E8512A",  bg: "rgba(232,81,42,.07)"  },
      { name: "DreamAct",                         tag: "Desbloqueado", color: "#9B8FF8",  bg: "rgba(155,143,248,.08)" },
      { name: "Voice Clone",                      tag: "Desbloqueado", color: "#4A9EFF",  bg: "rgba(74,158,255,.08)"  },
      { name: "Vault Completo",                   tag: "Desbloqueado", color: "#3ECF8E",  bg: "rgba(62,207,142,.07)"  },
    ],
  },
  dreamact: {
    color: "#9B8FF8",
    lockBg: "rgba(155,143,248,.1)",
    lockBorder: "rgba(155,143,248,.25)",
    name: "DreamAct",
    title: ["Anime qualquer foto. ", "Apresentador em segundos."],
    sub: "Você está no Starter. Faça upgrade para o Pro e desbloqueie o DreamAct + avatares com movimentos naturais gerados por IA.",
    unlocks: [
      { name: "DreamAct",                             tag: "Desbloqueado", color: "#9B8FF8",  bg: "rgba(155,143,248,.08)" },
      { name: "LipSync Studio",                       tag: "Desbloqueado", color: "#E8512A",  bg: "rgba(232,81,42,.07)"  },
      { name: "Voice Clone",                          tag: "Desbloqueado", color: "#4A9EFF",  bg: "rgba(74,158,255,.08)"  },
      { name: "Biblioteca de anúncios vencedores",    tag: "Desbloqueado", color: "#3ECF8E",  bg: "rgba(62,207,142,.07)"  },
    ],
  },
  voice: {
    color: "#4A9EFF",
    lockBg: "rgba(74,158,255,.1)",
    lockBorder: "rgba(74,158,255,.25)",
    name: "Voice Clone",
    title: ["Clone sua voz. Gere em qualquer ", "idioma."],
    sub: "Você está no Starter. Faça upgrade para o Pro e clone sua voz com apenas 3 amostras de áudio.",
    unlocks: [
      { name: "Voice Clone proprietário",    tag: "Desbloqueado", color: "#4A9EFF",  bg: "rgba(74,158,255,.08)"  },
      { name: "LipSync Studio",              tag: "Desbloqueado", color: "#E8512A",  bg: "rgba(232,81,42,.07)"  },
      { name: "DreamAct",                    tag: "Desbloqueado", color: "#9B8FF8",  bg: "rgba(155,143,248,.08)" },
      { name: "Vault completo por nicho",    tag: "Desbloqueado", color: "#3ECF8E",  bg: "rgba(62,207,142,.07)"  },
    ],
  },
};

// ─── Props ─────────────────────────────────────────────────────────────────────
interface UpsellModalProps {
  onClose: () => void;
  tool?: ToolId;
  creditsUsed?: number;
  creditsTotal?: number;
}

// ─── Close icon SVG ────────────────────────────────────────────────────────────
function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 11 11" fill="none" style={{display:"block",flexShrink:0}}>
      <path d="M2 2l7 7M9 2l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Lock icon SVG ─────────────────────────────────────────────────────────────
function LockIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{display:"block"}}>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth="1.5"/>
      <path d="M8 11V7a4 4 0 018 0v4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Arrow up icon ─────────────────────────────────────────────────────────────
function ArrowUpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{display:"block",flexShrink:0}}>
      <path d="M7 1v10M3.5 4.5L7 1l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Star icon ─────────────────────────────────────────────────────────────────
function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{display:"block",flexShrink:0}}>
      <path d="M8 1L6 6H1l4 3-1.5 5L8 11l4.5 3L11 9l4-3H10L8 1z" fill="#3ECF8E" opacity=".8"/>
    </svg>
  );
}

// ─── Generic paywall (download/export context) ─────────────────────────────────
function GenericContent({ onClose, router }: { onClose: () => void; router: ReturnType<typeof useRouter> }) {
  const color = "#E8593C";
  const unlocks = [
    { name: "Exportar XML para Premiere",    color: "#E8593C", bg: "rgba(232,89,60,.07)"  },
    { name: "Download de mídias HD",         color: "#4A9EFF", bg: "rgba(74,158,255,.08)" },
    { name: "Acervo Kraft Premium",          color: "#3ECF8E", bg: "rgba(62,207,142,.07)" },
    { name: "Projetos ilimitados",           color: "#9B8FF8", bg: "rgba(155,143,248,.08)"},
  ];
  return (
    <>
      {/* Hero */}
      <div style={{padding:"28px 24px 20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",width:"300px",height:"300px",borderRadius:"50%",filter:"blur(80px)",top:"-100px",left:"50%",transform:"translateX(-50%)",pointerEvents:"none",opacity:.22,background:color}}/>
        <div style={{width:"52px",height:"52px",borderRadius:"14px",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"16px",position:"relative",zIndex:1,background:"rgba(232,89,60,.12)",border:"1px solid rgba(232,89,60,.25)"}}>
          <LockIcon color={color}/>
        </div>
        <div style={{fontSize:"11px",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase" as const,marginBottom:"6px",position:"relative",zIndex:1,color}}>Recurso PRO</div>
        <h2 style={{fontFamily:"'Instrument Serif',serif",fontSize:"26px",lineHeight:.95,letterSpacing:"-.02em",color:"#EAEAEA",marginBottom:"8px",position:"relative",zIndex:1}}>
          Desbloqueie o <em style={{fontStyle:"italic"}}>poder total.</em>
        </h2>
        <p style={{fontSize:"13px",color:"#7A7A7A",fontWeight:300,lineHeight:1.6,position:"relative",zIndex:1,maxWidth:"340px"}}>
          Exporte e baixe suas mídias com qualidade máxima, sem marca d&apos;água.
        </p>
      </div>
      {/* Unlock list */}
      <div style={{padding:"4px 24px 16px"}}>
        <div style={{fontSize:"10px",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase" as const,color:"#252525",marginBottom:"10px"}}>No Pro você desbloqueia</div>
        <div style={{display:"flex",flexDirection:"column" as const,gap:"6px"}}>
          {unlocks.map(u => (
            <div key={u.name} style={{display:"flex",alignItems:"center",gap:"10px",padding:"9px 11px",background:"#0F0F0F",border:"1px solid #131313",borderRadius:"8px"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:u.color,flexShrink:0}}/>
              <span style={{fontSize:"12px",fontWeight:600,color:"#EAEAEA",flex:1}}>{u.name}</span>
              <span style={{fontSize:"9px",fontWeight:700,padding:"2px 7px",borderRadius:"6px",letterSpacing:".05em",textTransform:"uppercase" as const,color:u.color,background:u.bg,flexShrink:0}}>PRO</span>
            </div>
          ))}
        </div>
      </div>
      {/* Footer */}
      <div style={{padding:"16px 24px",borderTop:"1px solid #131313",display:"flex",flexDirection:"column" as const,gap:"8px"}}>
        <button onClick={() => { onClose(); router.push("/pricing"); }}
          style={{width:"100%",padding:"13px",background:"#E8593C",color:"#fff",border:"none",borderRadius:"8px",fontSize:"14px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",letterSpacing:"-.01em"}}>
          <ArrowUpIcon/>Fazer upgrade para Pro — R$197/mês
        </button>
        <button onClick={onClose}
          style={{width:"100%",padding:"10px",background:"transparent",color:"#444",border:"1px solid #131313",borderRadius:"8px",fontSize:"12px",fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
          Continuar no Starter por enquanto
        </button>
        <div style={{fontSize:"11px",color:"#252525",textAlign:"center" as const}}>
          Cancele quando quiser · <span style={{color:"#444",cursor:"pointer"}} onClick={() => { onClose(); router.push("/pricing"); }}>Ver todos os planos</span>
        </div>
      </div>
    </>
  );
}

// ─── Tool-specific content ─────────────────────────────────────────────────────
function ToolContent({
  config, creditsUsed, creditsTotal, onClose, router,
}: {
  config: ToolConfig;
  creditsUsed: number;
  creditsTotal: number;
  onClose: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const pct = creditsTotal > 0 ? Math.round((creditsUsed / creditsTotal) * 100) : 0;
  const { color, lockBg, lockBorder, name, title, sub, unlocks } = config;

  return (
    <>
      {/* Hero */}
      <div style={{padding:"28px 24px 20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",width:"300px",height:"300px",borderRadius:"50%",filter:"blur(80px)",top:"-100px",left:"50%",transform:"translateX(-50%)",pointerEvents:"none",opacity:.25,background:color}}/>
        <div style={{width:"52px",height:"52px",borderRadius:"14px",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"16px",position:"relative",zIndex:1,background:lockBg,border:`1px solid ${lockBorder}`}}>
          <LockIcon color={color}/>
        </div>
        <div style={{fontSize:"11px",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase" as const,marginBottom:"6px",position:"relative",zIndex:1,color}}>{name}</div>
        <h2 style={{fontFamily:"'Instrument Serif',serif",fontSize:"26px",lineHeight:.95,letterSpacing:"-.02em",color:"#EAEAEA",marginBottom:"8px",position:"relative",zIndex:1}}>
          {title[0]}<em style={{fontStyle:"italic"}}>{title[1]}</em>
        </h2>
        <p style={{fontSize:"13px",color:"#7A7A7A",fontWeight:300,lineHeight:1.6,position:"relative",zIndex:1,maxWidth:"340px"}}>{sub}</p>
      </div>

      {/* Proof of value — coins used */}
      <div style={{margin:"0 24px",padding:"12px 14px",background:"rgba(62,207,142,.07)",border:"1px solid rgba(62,207,142,.18)",borderRadius:"12px",display:"flex",alignItems:"center",gap:"10px"}}>
        <div style={{width:"28px",height:"28px",borderRadius:"8px",background:"rgba(62,207,142,.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <StarIcon/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:"12px",fontWeight:600,color:"#EAEAEA"}}>
            Você já usou <strong>{creditsUsed.toLocaleString("pt-BR")} moedas</strong> este mês
          </div>
          <div style={{fontSize:"11px",color:"#7A7A7A",marginTop:"1px"}}>
            {pct}% do seu plano Starter consumido — você está crescendo
          </div>
        </div>
        <div style={{fontSize:"18px",fontWeight:800,letterSpacing:"-.03em",color:"#3ECF8E"}}>{pct}%</div>
      </div>

      {/* What gets unlocked */}
      <div style={{padding:"16px 24px"}}>
        <div style={{fontSize:"10px",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase" as const,color:"#252525",marginBottom:"10px"}}>No Pro você desbloqueia</div>
        <div style={{display:"flex",flexDirection:"column" as const,gap:"6px"}}>
          {unlocks.map(u => (
            <div key={u.name} style={{display:"flex",alignItems:"center",gap:"10px",padding:"9px 11px",background:"#0F0F0F",border:"1px solid #131313",borderRadius:"8px"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:u.color,flexShrink:0}}/>
              <span style={{fontSize:"12px",fontWeight:600,color:"#EAEAEA",flex:1}}>{u.name}</span>
              <span style={{fontSize:"9px",fontWeight:700,padding:"2px 7px",borderRadius:"6px",letterSpacing:".05em",textTransform:"uppercase" as const,color:u.color,background:u.bg,flexShrink:0}}>{u.tag}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coins diff */}
      <div style={{margin:"0 24px 16px",display:"flex",alignItems:"center",gap:"8px",padding:"10px 14px",background:"rgba(232,81,42,.07)",border:"1px solid rgba(232,81,42,.16)",borderRadius:"12px"}}>
        <span style={{fontSize:"12px",color:"#7A7A7A",flex:1}}>Moedas por mês no Pro</span>
        <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
          <span style={{fontSize:"13px",color:"#252525",textDecoration:"line-through"}}>5.000</span>
          <span style={{color:"#444"}}>→</span>
          <span style={{fontSize:"14px",fontWeight:800,color:color,letterSpacing:"-.02em"}}>15.000</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{padding:"16px 24px",borderTop:"1px solid #131313",display:"flex",flexDirection:"column" as const,gap:"8px"}}>
        <button onClick={() => { onClose(); router.push("/pricing"); }}
          style={{width:"100%",padding:"13px",background:color,color:"#fff",border:"none",borderRadius:"8px",fontSize:"14px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",letterSpacing:"-.01em"}}>
          <ArrowUpIcon/>Fazer upgrade para Pro — R$197/mês
        </button>
        <button onClick={onClose}
          style={{width:"100%",padding:"10px",background:"transparent",color:"#444",border:"1px solid #131313",borderRadius:"8px",fontSize:"12px",fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
          Continuar no Starter por enquanto
        </button>
        <div style={{fontSize:"11px",color:"#252525",textAlign:"center" as const}}>
          Cancele quando quiser · <span style={{color:"#444",cursor:"pointer"}} onClick={() => { onClose(); router.push("/pricing"); }}>Ver todos os planos</span>
        </div>
      </div>
    </>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────
export function UpsellModal({ onClose, tool, creditsUsed = 0, creditsTotal = 5000 }: UpsellModalProps) {
  const router = useRouter();
  const config = tool ? TOOLS[tool] : null;

  return (
    <div
      style={{position:"fixed",inset:0,zIndex:100,background:"rgba(4,4,4,.88)",backdropFilter:"blur(20px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}
      onClick={onClose}>
      <div
        style={{background:"#09090B",border:"1px solid #1A1A1A",borderRadius:"16px",width:"100%",maxWidth:"460px",overflow:"hidden",position:"relative",boxShadow:"0 40px 80px rgba(0,0,0,.9)",fontFamily:"'Geist',system-ui,sans-serif"}}
        onClick={e => e.stopPropagation()}>

        {/* Close button */}
        <button onClick={onClose}
          style={{position:"absolute",top:"14px",right:"14px",width:"26px",height:"26px",borderRadius:"6px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#444",zIndex:10,padding:0}}>
          <CloseIcon/>
        </button>

        {config
          ? <ToolContent config={config} creditsUsed={creditsUsed} creditsTotal={creditsTotal} onClose={onClose} router={router}/>
          : <GenericContent onClose={onClose} router={router}/>
        }
      </div>
    </div>
  );
}
