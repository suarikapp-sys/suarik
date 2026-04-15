"use client";
// ─── CookieBanner ─────────────────────────────────────────────────────────────
// LGPD-compliant cookie consent banner.
// - Shown once to visitors who haven't yet accepted/declined.
// - Preference stored in localStorage under "suarik_cookie_consent".
// - "Aceitar" enables analytics (PostHog); "Apenas essenciais" disables it.
// - Does NOT block page rendering (lazy mount via useEffect).

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "suarik_cookie_consent";

export type ConsentValue = "accepted" | "essential";

export function useCookieConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(STORAGE_KEY) as ConsentValue) ?? null;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if no previous choice
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, "essential");
    setVisible(false);
    // Opt-out of PostHog if it's loaded
    if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).posthog) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).posthog?.opt_out_capturing?.();
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        width: "min(560px, calc(100vw - 32px))",
        background: "var(--card, #111)",
        border: "1px solid var(--border, rgba(255,255,255,.1))",
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: "0 8px 40px rgba(0,0,0,.5)",
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: "var(--text2, #aaa)", lineHeight: 1.55 }}>
        Usamos cookies e análises para melhorar sua experiência. Seus dados são tratados
        conforme nossa{" "}
        <Link href="/privacy" style={{ color: "var(--o, #F0563A)", textDecoration: "none" }}>
          Política de Privacidade
        </Link>
        {" "}(Lei 13.709/2018 — LGPD).
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button
          onClick={decline}
          style={{
            padding: "7px 16px",
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 6,
            border: "1px solid var(--border, rgba(255,255,255,.12))",
            background: "transparent",
            color: "var(--text2, #aaa)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Apenas essenciais
        </button>
        <button
          onClick={accept}
          style={{
            padding: "7px 16px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: "none",
            background: "var(--o, #F0563A)",
            color: "#fff",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Aceitar cookies
        </button>
      </div>
    </div>
  );
}
