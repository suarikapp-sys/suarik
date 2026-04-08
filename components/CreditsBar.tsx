"use client";

import { useState } from "react";
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

const PACKAGES = [
  { key: "small",  label: "100 cr",  price: "R$ 9",  highlight: false },
  { key: "medium", label: "300 cr",  price: "R$ 19", highlight: true  },
  { key: "large",  label: "1000 cr", price: "R$ 49", highlight: false },
] as const;

export function InsufficientCreditsModal({ action, cost, credits, onClose }: InsufficientProps) {
  const router  = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const buyPack = async (pack: string) => {
    setLoading(pack);
    try {
      const res = await fetch("/api/stripe/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const { url, error } = await res.json() as { url?: string; error?: string };
      if (url) { window.location.href = url; return; }
      console.error("topup error:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#1a1a1a", borderRadius: 16, padding: 28,
          border: "1px solid #ef444444", maxWidth: 400, width: "90%",
          textAlign: "center",
        }}
      >
        <div style={{
          width: 52, height: 52, borderRadius: "50%", margin: "0 auto 16px",
          background: "#ef444418", border: "1px solid #ef444444",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
        }}>⚡</div>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>Créditos insuficientes</h2>
        <p style={{ color: "#666", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
          Para {ACTION_LABEL[action] ?? action} você precisa de{" "}
          <strong style={{ color: "#F0563A" }}>{cost} cr</strong>.{" "}
          Você tem <strong style={{ color: "#ef4444" }}>{credits}</strong>.
        </p>

        {/* Quick top-up packages */}
        <p style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
          Recarregar créditos
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
          {PACKAGES.map(pkg => (
            <button
              key={pkg.key}
              onClick={() => buyPack(pkg.key)}
              disabled={loading !== null}
              style={{
                padding: "12px 8px", borderRadius: 10, cursor: "pointer",
                border: pkg.highlight ? "1px solid #F0563A66" : "1px solid #2a2a2a",
                background: pkg.highlight ? "#F0563A14" : "#111",
                opacity: loading && loading !== pkg.key ? 0.5 : 1,
                transition: "all 0.2s",
              }}
            >
              {loading === pkg.key ? (
                <span style={{ fontSize: 18 }}>⏳</span>
              ) : (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: pkg.highlight ? "#F0563A" : "#ccc" }}>
                    {pkg.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{pkg.price}</div>
                </>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => { router.push("/pricing"); onClose(); }}
          style={{
            width: "100%", height: 40, borderRadius: 10, border: "1px solid #333",
            background: "transparent", color: "#888", fontSize: 13, cursor: "pointer",
            marginBottom: 8,
          }}
        >
          Ver todos os planos →
        </button>
        <button
          onClick={onClose}
          style={{
            width: "100%", height: 36, borderRadius: 10,
            border: "1px solid #222", background: "transparent",
            color: "#555", fontSize: 12, cursor: "pointer",
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
