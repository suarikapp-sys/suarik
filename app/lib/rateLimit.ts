// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Usa Upstash Redis em produção (NODE_ENV=production + UPSTASH_* configurado).
// Em dev local sem Redis, cai para in-memory Map.
//
// Comportamento em produção (fail-closed):
//   • Se UPSTASH_* não configurado → bloqueia a requisição (misconfig é grave)
//   • Se Redis retornar erro → bloqueia a requisição (prevenir spam)
//
// Comportamento em dev (fail-open para não atrapalhar):
//   • In-memory Map por instância

const isProd = process.env.NODE_ENV === "production";
const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

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

  try {
    const incrRes = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      method: "POST",
    });
    if (!incrRes.ok) {
      console.error(`[rateLimit] Redis INCR failed: ${incrRes.status}`);
      return false; // fail-closed em produção
    }
    const { result: count } = await incrRes.json() as { result: number };

    if (count === 1) {
      // Set expiry na primeira requisição para criar janela deslizante
      await fetch(`${url}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
      }).catch(() => {}); // expire failure é não-crítico (key expira via outro mecanismo)
    }
    return count <= limit;
  } catch (err) {
    console.error(`[rateLimit] Redis unreachable:`, err);
    return false; // fail-closed: se Redis cair, rejeita a requisição
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────
/**
 * Retorna true se a requisição é permitida, false se excedeu o limite.
 *
 * Em produção: se Redis não estiver configurado ou falhar, bloqueia (fail-closed).
 * Em dev: usa Map in-memory se Redis ausente.
 *
 * @param key      Identificador único, ex: `tts:${userId}`
 * @param limit    Máximo de requisições por janela
 * @param windowMs Janela em ms (default: 60 segundos)
 */
export async function rateLimit(key: string, limit: number, windowMs = 60_000): Promise<boolean> {
  if (hasRedis) return redisLimit(key, limit, windowMs);

  if (isProd) {
    console.error("[rateLimit] UPSTASH_REDIS_* missing in production — rejecting request");
    return false; // fail-closed — misconfig em prod é inaceitável
  }

  return inMemoryLimit(key, limit, windowMs);
}
