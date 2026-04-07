"use client";

import { useRouter } from "next/navigation";

type Props = {
  credits:  number;
  plan:     string;
  loading?: boolean;
  compact?: boolean;  // topbar mode (compact) vs sidebar mode (full)
};

const PLAN_MAX: Record<string, number> = {
  free: 100, starter: 500, pro: 2000, agency: 10000, premium: 50000,
};

export function CreditsBar({ credits, plan, loading, compact = false }: Props) {
  const router = useRouter();
  const max    = PLAN_MAX[plan] ?? 10;
  const pct    = Math.min((credits / max) * 100, 100);

  // Color based on remaining
  const color = pct > 30 ? "#F0563A"
              : pct > 10 ? "#f59e0b"   // warning yellow
              :             "#ef4444";  // danger red

  if (loading) return null;

  // ── COMPACT (topbar) ──────────────────────────────────────────────────────
  if (compact) {
    return (
      <div
        onClick={() => router.push("/pricing")}
        title={`${credits} créditos restantes — clique para recarregar`}
        style={{
          display: "flex", flexDirection: "column", alignItems: "flex-end",
          cursor: "pointer", gap: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color, fontWeight: 700, fontFamily: "monospace" }}>
            {credits.toLocaleString("pt-BR")}
          </span>
          <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 0.8 }}>
            créditos
          </span>
          {pct <= 20 && (
            <span style={{
              fontSize: 10, padding: "1px 6px", borderRadius: 4,
              background: `${color}22`, color, fontWeight: 700,
            }}>
              {pct <= 10 ? "CRÍTICO" : "BAIXO"}
            </span>
          )}
        </div>
        <div style={{ width: 100, height: 3, background: "#2a2a2a", borderRadius: 2 }}>
          <div style={{
            height: "100%", borderRadius: 2,
            width: `${pct}%`,
            background: pct > 30
              ? `linear-gradient(90deg, #F0563A, #ff7a4d)`
              : `linear-gradient(90deg, ${color}, ${color}99)`,
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>
    );
  }

  // ── FULL (sidebar / panel) ────────────────────────────────────────────────
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 10,
      background: pct <= 10 ? "#ef444408" : "#1a1a1a",
      border: `1px solid ${pct <= 10 ? "#ef444433" : "#2a2a2a"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 0.8 }}>
          🔥 Créditos
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "monospace" }}>
          {credits.toLocaleString("pt-BR")} / {max.toLocaleString("pt-BR")}
        </span>
      </div>

      <div style={{ height: 4, background: "#2a2a2a", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 2,
          width: `${pct}%`,
          background: pct > 30
            ? "linear-gradient(90deg, #F0563A, #ff7a4d)"
            : `linear-gradient(90deg, ${color}, ${color}88)`,
          transition: "width 0.4s ease",
        }} />
      </div>

      {pct <= 20 && (
        <button
          onClick={() => router.push("/pricing")}
          style={{
            width: "100%", padding: "7px 0", borderRadius: 7,
            background: `${color}18`, border: `1px solid ${color}44`,
            color, fontSize: 11, fontWeight: 700, cursor: "pointer",
            textTransform: "uppercase", letterSpacing: 0.8,
          }}
        >
          {pct <= 5 ? "⚠ Recarregar agora" : "↑ Ver planos"}
        </button>
      )}
    </div>
  );
}

// ── Modal de créditos insuficientes (aparece ao tentar gerar sem créditos) ────
type InsufficientProps = {
  action:   string;
  cost:     number;
  credits:  number;
  onClose:  () => void;
};

const ACTION_LABEL: Record<string, string> = {
  tts:        "gerar áudio",
  lipsync:    "gerar LipSync",
  voiceclone: "clonar voz",
  storyboard: "gerar storyboard",
};

export function InsufficientCreditsModal({ action, cost, credits, onClose }: InsufficientProps) {
  const router = useRouter();

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#1a1a1a", borderRadius: 16, padding: 32,
          border: "1px solid #ef444444", maxWidth: 380, width: "90%",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: "50%", margin: "0 auto 20px",
          background: "#ef444418", border: "1px solid #ef444444",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28,
        }}>⚡</div>

        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
          Créditos insuficientes
        </h2>
        <p style={{ color: "#666", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
          Para {ACTION_LABEL[action] ?? action} você precisa de{" "}
          <strong style={{ color: "#F0563A" }}>{cost} créditos</strong>.{" "}
          Você tem apenas{" "}
          <strong style={{ color: "#ef4444" }}>{credits}</strong>.
        </p>

        {/* Credits visual */}
        <div style={{
          background: "#111", borderRadius: 10, padding: "14px 18px",
          marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.8 }}>Disponível</p>
            <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: "#ef4444", fontFamily: "monospace" }}>
              {credits}
            </p>
          </div>
          <div style={{ fontSize: 20, color: "#333" }}>→</div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.8 }}>Necessário</p>
            <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: "#F0563A", fontFamily: "monospace" }}>
              {cost}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <button
          onClick={() => { router.push("/pricing"); onClose(); }}
          style={{
            width: "100%", height: 48, borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #F0563A, #c44527)",
            color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
            marginBottom: 10,
          }}
        >
          ⚡ Ver planos e recarregar
        </button>
        <button
          onClick={onClose}
          style={{
            width: "100%", height: 40, borderRadius: 10,
            border: "1px solid #2a2a2a", background: "transparent",
            color: "#666", fontSize: 13, cursor: "pointer",
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
