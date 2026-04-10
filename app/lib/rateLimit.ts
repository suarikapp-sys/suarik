// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are
// set — fully distributed across Vercel serverless instances.
// Falls back to an in-memory Map when those vars are absent (local dev / single
// instance). To enable Redis: add both vars to Vercel env settings.

// ── In-memory fallback (single-instance only) ─────────────────────────────────
const store = new Map<string, { count: number; resetAt: number }>();

function inMemoryLimit(key: string, limit: number, windowMs: number): boolean {
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

// ── Upstash Redis (distributed) ───────────────────────────────────────────────
async function redisLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const url   = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const ttlSec = Math.ceil(windowMs / 1000);

  // INCR atomically increments the counter; first call also sets TTL via EXPIRE
  const incrRes = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });
  if (!incrRes.ok) return true; // fail open on Redis error

  const { result: count } = await incrRes.json() as { result: number };

  // Set expiry only on first request (count === 1) to create a sliding window
  if (count === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
      headers: { Authorization: `Bearer ${token}` },
      method: "POST",
    });
  }

  return count <= limit;
}

// ── Public API ─────────────────────────────────────────────────────────────────
/**
 * Returns true if the request is allowed, false if the rate limit is exceeded.
 * Async-safe: always returns a Promise<boolean> (sync in-memory path wraps automatically).
 *
 * @param key      Unique identifier, e.g. `tts:${userId}`
 * @param limit    Max requests allowed in the window
 * @param windowMs Time window in milliseconds (default: 60 seconds)
 */
export async function rateLimit(key: string, limit: number, windowMs = 60_000): Promise<boolean> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return redisLimit(key, limit, windowMs);
  }
  return inMemoryLimit(key, limit, windowMs);
}
