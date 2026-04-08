// ─── Credit Cost Calculator ────────────────────────────────────────────────
// Shared between client (useCredits) and server (api/credits).
// No Node.js APIs — safe for both environments.

export interface CostMeta {
  chars?:    number;  // text length for TTS
  duration?: number;  // seconds for Music
}

// Static fallback costs for tools that don't use metadata
const STATIC_COST: Record<string, number> = {
  sfx:           5,
  lipsync:       50,
  talkingphoto:  40,
  videotranslate: 60,
  voiceclone:    30,
  dreamact:      45,
  storyboard:    20,
};

/**
 * Compute credit cost for an action.
 * TTS: 1cr per 500 chars, min 2cr, max 30cr
 * Music: 3cr per 10s of duration, min 5cr
 * Everything else: static from STATIC_COST
 */
export function computeCost(action: string, meta?: CostMeta): number {
  if (action === "tts") {
    const chars = meta?.chars ?? 0;
    return Math.min(30, Math.max(2, Math.ceil(chars / 500)));
  }
  if (action === "music") {
    const dur = meta?.duration ?? 30;
    return Math.max(5, Math.ceil(dur / 10) * 3);
  }
  return STATIC_COST[action] ?? 10;
}
