// ─── In-memory rate limiter ───────────────────────────────────────────────────
// One entry per "key" (e.g. "tts:user-id"). Resets after windowMs.
// Good for single-process deployments (Vercel serverless per-function).
// For multi-region production, swap the Map for Upstash Redis.

const store = new Map<string, { count: number; resetAt: number }>();

/**
 * Returns true if the request is allowed, false if the rate limit is exceeded.
 * @param key      Unique identifier, e.g. `tts:${userId}`
 * @param limit    Max requests allowed in the window
 * @param windowMs Time window in milliseconds (default: 60 seconds)
 */
export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now   = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}
