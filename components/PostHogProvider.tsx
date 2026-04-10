"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

// ─── Auto page-view tracker ───────────────────────────────────────────────────
function PageViewTracker() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const ph           = usePostHog();

  useEffect(() => {
    if (!ph) return;
    const url = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return; // no-op in dev when key isn't set
    posthog.init(key, {
      api_host:           process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      capture_pageview:   false, // manual via PageViewTracker
      capture_pageleave:  true,
      autocapture:        true,
      session_recording:  { maskAllInputs: true }, // LGPD: mask sensitive fields
      persistence:        "localStorage+cookie",
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}

// ─── Typed event helpers (import and call anywhere) ──────────────────────────
export function trackEvent(
  event: string,
  props?: Record<string, string | number | boolean | null>
) {
  try {
    posthog.capture(event, props ?? {});
  } catch { /* silent — never crash the app for analytics */ }
}
