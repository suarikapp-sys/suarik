"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ToolId = "lipsync" | "dreamact" | "voice";

interface UnlockItem {
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  tag: string;
  tagColor: string;
  tagBg: string;
}

interface ToolConfig {
  color: string;
  lockBg: string;
  lockBorder: string;
  name: string;
  titleLine1: string;
  titleLine2: React.ReactNode;
  sub: string;
  unlocks: UnlockItem[];
  coinsFrom: string;
  coinsTo: string;
}

// ─── SVG icons ─────────────────────────────────────────────────────────────────
const IcoLipsync = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: "block", flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.2"/>
    <path d="M5.5 8.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);
const IcoDreamact = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: "block", flexShrink: 0 }}>
    <rect x="4" y="1" width="8" height="14" rx="4" stroke={color} strokeWidth="1.2"/>
  </svg>
);
const IcoVoice = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: "block", flexShrink: 0 }}>
    <rect x="5" y="1" width="6" height="9" rx="3" stroke={color} strokeWidth="1.2"/>
    <path d="M3 10c0 3 2.2 5.5 5 5.5s5-2.5 5-5.5" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IcoVault = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: "block", flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.2"/>
  </svg>
);
const IcoLibrary = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: "block", flexShrink: 0 }}>
    <path d="M3 8l10-6v12L3 8z" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);
const IcoBilling = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: "block", flexShrink: 0 }}>
    <rect x="1" y="3" width="14" height="10" rx="2" stroke={color} strokeWidth="1.2"/>
    <path d="M5 8h6" stroke={color} strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

// ─── Tool configs ───────────────────────────────────────────────────────────────
const TOOLS: Record<ToolId, ToolConfig> = {
  lipsync: {
    color: "#E8512A",
    lockBg: "rgba(232,81,42,.12)",
    lockBorder: "rgba(232,81,42,.25)",
    name: "LipSync Studio",
    titleLine1: "Sincronize lábios.",
    titleLine2: <>Escale <em style={{ fontStyle: "italic" }}>qualquer</em> avatar.</>,
    sub: "Você está no Starter. Faça upgrade para o Pro e desbloqueie o LipSync Studio + 4 outras ferramentas premium.",
    unlocks: [
      { icon: <IcoLipsync color="#E8512A"/>, iconBg: "rgba(232,81,42,.1)",   name: "LipSync Studio",  tag: "Desbloqueado", tagColor: "#E8512A", tagBg: "rgba(232,81,42,.07)"   },
      { icon: <IcoDreamact color="#9B8FF8"/>, iconBg: "rgba(155,143,248,.1)", name: "DreamAct",         tag: "Desbloqueado", tagColor: "#9B8FF8", tagBg: "rgba(155,143,248,.08)" },
      { icon: <IcoVoice color="#4A9EFF"/>,   iconBg: "rgba(74,158,255,.1)",  name: "Voice Clone",      tag: "Desbloqueado", tagColor: "#4A9EFF", tagBg: "rgba(74,158,255,.08)"  },
      { icon: <IcoVault color="#3ECF8E"/>,   iconBg: "rgba(62,207,142,.1)",  name: "Vault Completo",   tag: "Desbloqueado", tagColor: "#3ECF8E", tagBg: "rgba(62,207,142,.07)"  },
    ],
    coinsFrom: "5.000", coinsTo: "15.000",
  },
  dreamact: {
    color: "#9B8FF8",
    lockBg: "rgba(155,143,248,.1)",
    lockBorder: "rgba(155,143,248,.25)",
    name: "DreamAct",
    titleLine1: "Anime qualquer foto.",
    titleLine2: <><em style={{ fontStyle: "italic" }}>Apresentador</em> em segundos.</>,
    sub: "Você está no Starter. Faça upgrade para o Pro e desbloqueie o DreamAct + avatares com movimentos naturais gerados por IA.",
    unlocks: [
      { icon: <IcoDreamact color="#9B8FF8"/>, iconBg: "rgba(155,143,248,.1)", name: "DreamAct",                          tag: "Desbloqueado", tagColor: "#9B8FF8", tagBg: "rgba(155,143,248,.08)" },
      { icon: <IcoLipsync color="#E8512A"/>,  iconBg: "rgba(232,81,42,.1)",   name: "LipSync Studio",                   tag: "Desbloqueado", tagColor: "#E8512A", tagBg: "rgba(232,81,42,.07)"   },
      { icon: <IcoVoice color="#4A9EFF"/>,    iconBg: "rgba(74,158,255,.1)",  name: "Voice Clone",                      tag: "Desbloqueado", tagColor: "#4A9EFF", tagBg: "rgba(74,158,255,.08)"  },
      { icon: <IcoLibrary color="#3ECF8E"/>,  iconBg: "rgba(62,207,142,.1)",  name: "Biblioteca de anúncios vencedores", tag: "Desbloqueado", tagColor: "#3ECF8E", tagBg: "rgba(62,207,142,.07)"  },
    ],
    coinsFrom: "5.000", coinsTo: "15.000",
  },
  voice: {
    color: "#4A9EFF",
    lockBg: "rgba(74,158,255,.1)",
    lockBorder: "rgba(74,158,255,.25)",
    name: "Voice Clone",
    titleLine1: "Clone sua voz.",
    titleLine2: <>Gere em qualquer <em style={{ fontStyle: "italic" }}>idioma.</em></>,
    sub: "Você está no Starter. Faça upgrade para o Pro e clone sua voz com apenas 3 amostras de áudio.",
    unlocks: [
      { icon: <IcoVoice color="#4A9EFF"/>,   iconBg: "rgba(74,158,255,.1)",  name: "Voice Clone proprietário",    tag: "Desbloqueado", tagColor: "#4A9EFF", tagBg: "rgba(74,158,255,.08)"  },
      { icon: <IcoLipsync color="#E8512A"/>, iconBg: "rgba(232,81,42,.1)",   name: "LipSync Studio",              tag: "Desbloqueado", tagColor: "#E8512A", tagBg: "rgba(232,81,42,.07)"   },
      { icon: <IcoDreamact color="#9B8FF8"/>,iconBg: "rgba(155,143,248,.1)", name: "DreamAct",                    tag: "Desbloqueado", tagColor: "#9B8FF8", tagBg: "rgba(155,143,248,.08)" },
      { icon: <IcoBilling color="#3ECF8E"/>, iconBg: "rgba(62,207,142,.1)",  name: "Vault completo por nicho",    tag: "Desbloqueado", tagColor: "#3ECF8E", tagBg: "rgba(62,207,142,.07)"  },
    ],
    coinsFrom: "5.000", coinsTo: "15.000",
  },
};

// ─── Props ──────────────────────────────────────────────────────────────────────
interface UpsellModalProps {
  onClose: () => void;
  tool?: ToolId;
  creditsUsed?: number;
  creditsTotal?: number;
}

// ─── Sub-icons ──────────────────────────────────────────────────────────────────
function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 11 11" fill="none" style={{ display: "block", flexShrink: 0 }}>
      <path d="M2 2l7 7M9 2l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function LockIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth="1.5"/>
      <path d="M8 11V7a4 4 0 018 0v4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function ArrowUpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ display: "block", flexShrink: 0 }}>
      <path d="M7 1v10M3.5 4.5L7 1l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: "block", flexShrink: 0 }}>
      <path d="M8 1L6 6H1l4 3-1.5 5L8 11l4.5 3L11 9l4-3H10L8 1z" fill="#3ECF8E" opacity=".8"/>
    </svg>
  );
}

// ─── Shared unlock list ─────────────────────────────────────────────────────────
function UnlockList({ items }: { items: UnlockItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((u, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: "#0F0F0F", border: "1px solid #131313", borderRadius: 8, transition: "border-color .2s" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: u.iconBg, flexShrink: 0 }}>
            {u.icon}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#EAEAEA", flex: 1 }}>{u.name}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 6, letterSpacing: ".05em", textTransform: "uppercase", color: u.tagColor, background: u.tagBg, flexShrink: 0 }}>
            {u.tag}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Tool content ───────────────────────────────────────────────────────────────
function ToolContent({ config, creditsUsed, creditsTotal, onClose, router }: {
  config: ToolConfig;
  creditsUsed: number;
  creditsTotal: number;
  onClose: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const pct = creditsTotal > 0 ? Math.round((creditsUsed / creditsTotal) * 100) : 0;
  const { color, lockBg, lockBorder, name, titleLine1, titleLine2, sub, unlocks, coinsFrom, coinsTo } = config;

  return (
    <>
      {/* Hero */}
      <div style={{ padding: "28px 24px 20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", filter: "blur(80px)", top: -100, left: "50%", transform: "translateX(-50%)", pointerEvents: "none", opacity: .25, background: color }} />
        <div style={{ width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, position: "relative", zIndex: 1, background: lockBg, border: `1px solid ${lockBorder}` }}>
          <LockIcon color={color}/>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6, position: "relative", zIndex: 1, color }}>{name}</div>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, lineHeight: .95, letterSpacing: "-.02em", color: "#EAEAEA", marginBottom: 8, position: "relative", zIndex: 1 }}>
          {titleLine1}<br/>{titleLine2}
        </h2>
        <p style={{ fontSize: 13, color: "#7A7A7A", fontWeight: 300, lineHeight: 1.6, position: "relative", zIndex: 1, maxWidth: 340, margin: 0 }}>{sub}</p>
      </div>

      {/* Proof of value */}
      <div style={{ margin: "0 24px", padding: "12px 14px", background: "rgba(62,207,142,.07)", border: "1px solid rgba(62,207,142,.18)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(62,207,142,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <StarIcon/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#EAEAEA" }}>
            Você já usou <strong>{creditsUsed.toLocaleString("pt-BR")} moedas</strong> este mês
          </div>
          <div style={{ fontSize: 11, color: "#7A7A7A", marginTop: 1 }}>
            {pct}% do seu plano Starter consumido — você está crescendo
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.03em", color: "#3ECF8E" }}>{pct}%</div>
      </div>

      {/* Unlocks */}
      <div style={{ padding: "16px 24px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#252525", marginBottom: 10 }}>No Pro você desbloqueia</div>
        <UnlockList items={unlocks}/>
      </div>

      {/* Coins diff */}
      <div style={{ margin: "0 24px 16px", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(232,81,42,.07)", border: "1px solid rgba(232,81,42,.16)", borderRadius: 12 }}>
        <span style={{ fontSize: 12, color: "#7A7A7A", flex: 1 }}>Moedas por mês no Pro</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#252525", textDecoration: "line-through" }}>{coinsFrom}</span>
          <span style={{ color: "#444" }}>→</span>
          <span style={{ fontSize: 14, fontWeight: 800, color, letterSpacing: "-.02em" }}>{coinsTo}</span>
        </div>
      </div>

      {/* Footer */}
      <ModalFooter color={color} onClose={onClose} router={router}/>
    </>
  );
}

// ─── Generic (export/download) content ─────────────────────────────────────────
function GenericContent({ onClose, router }: { onClose: () => void; router: ReturnType<typeof useRouter> }) {
  const color = "#E8512A";
  const unlocks: UnlockItem[] = [
    { icon: <IcoLipsync color="#E8512A"/>,  iconBg: "rgba(232,81,42,.1)",   name: "Exportar XML para Premiere",  tag: "PRO", tagColor: "#E8512A", tagBg: "rgba(232,81,42,.07)"   },
    { icon: <IcoBilling color="#4A9EFF"/>,  iconBg: "rgba(74,158,255,.1)",  name: "Download de mídias HD",       tag: "PRO", tagColor: "#4A9EFF", tagBg: "rgba(74,158,255,.08)"  },
    { icon: <IcoVault color="#3ECF8E"/>,    iconBg: "rgba(62,207,142,.1)",  name: "Acervo Kraft Premium",        tag: "PRO", tagColor: "#3ECF8E", tagBg: "rgba(62,207,142,.07)"  },
    { icon: <IcoDreamact color="#9B8FF8"/>, iconBg: "rgba(155,143,248,.1)", name: "Projetos ilimitados",         tag: "PRO", tagColor: "#9B8FF8", tagBg: "rgba(155,143,248,.08)" },
  ];
  return (
    <>
      <div style={{ padding: "28px 24px 20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", filter: "blur(80px)", top: -100, left: "50%", transform: "translateX(-50%)", pointerEvents: "none", opacity: .22, background: color }} />
        <div style={{ width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, position: "relative", zIndex: 1, background: "rgba(232,81,42,.12)", border: "1px solid rgba(232,81,42,.25)" }}>
          <LockIcon color={color}/>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6, position: "relative", zIndex: 1, color }}>Recurso PRO</div>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, lineHeight: .95, letterSpacing: "-.02em", color: "#EAEAEA", marginBottom: 8, position: "relative", zIndex: 1 }}>
          Desbloqueie o <em style={{ fontStyle: "italic" }}>poder total.</em>
        </h2>
        <p style={{ fontSize: 13, color: "#7A7A7A", fontWeight: 300, lineHeight: 1.6, position: "relative", zIndex: 1, maxWidth: 340, margin: 0 }}>
          Exporte e baixe suas mídias com qualidade máxima, sem marca d&apos;água.
        </p>
      </div>
      <div style={{ padding: "4px 24px 16px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#252525", marginBottom: 10 }}>No Pro você desbloqueia</div>
        <UnlockList items={unlocks}/>
      </div>
      <ModalFooter color={color} onClose={onClose} router={router}/>
    </>
  );
}

// ─── Footer shared ──────────────────────────────────────────────────────────────
function ModalFooter({ color, onClose, router }: { color: string; onClose: () => void; router: ReturnType<typeof useRouter> }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ padding: "16px 24px", borderTop: "1px solid #131313", display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => { onClose(); router.push("/pricing"); }}
        style={{
          width: "100%", padding: 13, background: hovered ? "#FF6B3D" : color,
          color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          letterSpacing: "-.01em", transition: "all .25s",
          transform: hovered ? "translateY(-1px)" : "translateY(0)",
          boxShadow: hovered ? "0 10px 28px rgba(232,81,42,.4)" : "none",
        }}>
        <ArrowUpIcon/>Fazer upgrade para Pro — R$197/mês
      </button>
      <button onClick={onClose}
        style={{ width: "100%", padding: 10, background: "transparent", color: "#444", border: "1px solid #131313", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>
        Continuar no Starter por enquanto
      </button>
      <div style={{ fontSize: 11, color: "#252525", textAlign: "center" }}>
        Cancele quando quiser · <span style={{ color: "#444", cursor: "pointer" }} onClick={() => { onClose(); router.push("/pricing"); }}>Ver todos os planos</span>
      </div>
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────────
export function UpsellModal({ onClose, tool, creditsUsed = 0, creditsTotal = 5000 }: UpsellModalProps) {
  const router = useRouter();
  const config = tool ? TOOLS[tool] : null;
  const [visible, setVisible] = useState(false);

  // Entry animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(4,4,4,.88)", backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        opacity: visible ? 1 : 0,
        transition: "opacity .3s cubic-bezier(.16,1,.3,1)",
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#09090B", border: "1px solid #1A1A1A",
          borderRadius: 16, width: "100%", maxWidth: 460,
          overflow: "hidden", position: "relative",
          boxShadow: "0 40px 80px rgba(0,0,0,.9)",
          fontFamily: "'Geist', system-ui, sans-serif",
          transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(.97)",
          transition: "transform .35s cubic-bezier(.16,1,.3,1)",
        }}>

        {/* Close */}
        <button onClick={onClose}
          style={{ position: "absolute", top: 14, right: 14, width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#444", zIndex: 10, padding: 0 }}>
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
