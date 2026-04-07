"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ToastType = "success" | "error" | "info" | "loading";

export type Toast = {
  id:       string;
  message:  string;
  type:     ToastType;
  duration?: number;  // ms, 0 = persistent
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const ICONS: Record<ToastType, string> = {
  success: "✓",
  error:   "⚠",
  info:    "ℹ",
  loading: "⏳",
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "#0d1a0d", border: "#34d39944", icon: "#34d399" },
  error:   { bg: "#1a0d0d", border: "#ef444444", icon: "#ef4444" },
  info:    { bg: "#0d0d1a", border: "#a78bfa44", icon: "#a78bfa" },
  loading: { bg: "#1a1a0d", border: "#F0563A44", icon: "#F0563A" },
};

// ─── Single Toast Item ────────────────────────────────────────────────────────
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const c = COLORS[toast.type];

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));
    // Auto-dismiss
    if (toast.duration !== 0) {
      const t = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onRemove(toast.id), 300);
      }, toast.duration ?? 3500);
      return () => clearTimeout(t);
    }
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px", borderRadius: 10, marginBottom: 8,
        background: c.bg, border: `1px solid ${c.border}`,
        backdropFilter: "blur(12px)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        minWidth: 240, maxWidth: 380,
        transform: visible ? "translateX(0)" : "translateX(120%)",
        opacity: visible ? 1 : 0,
        transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        cursor: "pointer",
        fontFamily: "'Inter', sans-serif",
      }}
      onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300); }}
    >
      {/* Icon */}
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        background: `${c.icon}18`, border: `1px solid ${c.icon}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: toast.type === "loading" ? 14 : 13, color: c.icon,
        animation: toast.type === "loading" ? "spin 1s linear infinite" : "none",
      }}>
        {ICONS[toast.type]}
      </div>

      {/* Message */}
      <span style={{ fontSize: 13, color: "#e5e5e5", lineHeight: 1.4, flex: 1 }}>
        {toast.message}
      </span>

      {/* Close */}
      <span style={{ fontSize: 12, color: "#444", flexShrink: 0 }}>✕</span>
    </div>
  );
}

// ─── Toast Container ──────────────────────────────────────────────────────────
export function ToastContainer({ toasts, onRemove }: {
  toasts:   Toast[];
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      display: "flex", flexDirection: "column-reverse",
      pointerEvents: "none",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: "all" }}>
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}

// ─── useToast hook ────────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const remove = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const add = useCallback((message: string, type: ToastType = "info", duration?: number): string => {
    const id = `toast-${Date.now()}-${++counterRef.current}`;
    setToasts(t => [...t, { id, message, type, duration }]);
    return id;
  }, []);

  const toast = {
    success: (msg: string, dur?: number) => add(msg, "success", dur),
    error:   (msg: string, dur?: number) => add(msg, "error",   dur ?? 5000),
    info:    (msg: string, dur?: number) => add(msg, "info",    dur),
    loading: (msg: string)               => add(msg, "loading", 0),
    dismiss: (id: string)                => remove(id),
    update:  (id: string, message: string, type: ToastType = "success") => {
      setToasts(t => t.map(x => x.id === id ? { ...x, message, type, duration: 3500 } : x));
      // auto-dismiss after update
      setTimeout(() => remove(id), 3500);
    },
  };

  return { toasts, remove, toast };
}
