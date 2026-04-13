import { describe, it, expect, beforeEach, vi } from "vitest";

// Clear module between tests so the in-memory store resets
beforeEach(() => {
  vi.resetModules();
  // Ensure no Upstash env vars so we use in-memory path
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("rateLimit — in-memory fallback", () => {
  it("allows requests up to the limit", async () => {
    const { rateLimit } = await import("../rateLimit");
    const key = `test:${Date.now()}`;

    expect(await rateLimit(key, 3, 60_000)).toBe(true);
    expect(await rateLimit(key, 3, 60_000)).toBe(true);
    expect(await rateLimit(key, 3, 60_000)).toBe(true);
  });

  it("blocks the request after limit is exceeded", async () => {
    const { rateLimit } = await import("../rateLimit");
    const key = `test:${Date.now()}`;

    await rateLimit(key, 2, 60_000);
    await rateLimit(key, 2, 60_000);
    expect(await rateLimit(key, 2, 60_000)).toBe(false);
  });

  it("resets after window expires", async () => {
    vi.useFakeTimers();
    const { rateLimit } = await import("../rateLimit");
    const key = `test:${Date.now()}`;

    await rateLimit(key, 1, 1000);
    expect(await rateLimit(key, 1, 1000)).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(1001);
    expect(await rateLimit(key, 1, 1000)).toBe(true);
    vi.useRealTimers();
  });

  it("uses separate counters per key", async () => {
    const { rateLimit } = await import("../rateLimit");
    const ts = Date.now();
    const keyA = `testA:${ts}`;
    const keyB = `testB:${ts}`;

    await rateLimit(keyA, 1, 60_000);
    // keyA is now at limit, keyB is fresh
    expect(await rateLimit(keyA, 1, 60_000)).toBe(false);
    expect(await rateLimit(keyB, 1, 60_000)).toBe(true);
  });
});
