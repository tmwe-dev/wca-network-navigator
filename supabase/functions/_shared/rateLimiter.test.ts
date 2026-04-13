import { describe, it, expect } from "vitest";
import { checkRateLimit } from "./rateLimiter.ts";

describe("checkRateLimit", () => {
  it("permette il primo request", () => {
    const result = checkRateLimit("test-first-" + Date.now());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBe(0);
  });

  it("esaurisce i token dopo burst", () => {
    const key = "test-burst-" + Date.now();
    const config = { maxTokens: 3, refillRate: 0.001, windowMs: 60_000 };
    checkRateLimit(key, config); // 1st — allowed (2 left)
    checkRateLimit(key, config); // 2nd — allowed (1 left)
    checkRateLimit(key, config); // 3rd — allowed (0 left)
    const result = checkRateLimit(key, config); // 4th — denied
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("ricarica token nel tempo", async () => {
    const key = "test-refill-" + Date.now();
    const config = { maxTokens: 2, refillRate: 100, windowMs: 60_000 }; // 100 tokens/sec
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    const empty = checkRateLimit(key, config);
    expect(empty.allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 50)); // 50ms → ~5 tokens refilled
    const refilled = checkRateLimit(key, config);
    expect(refilled.allowed).toBe(true);
  });

  it("usa configurazione di default quando non specificata", () => {
    const key = "test-default-" + Date.now();
    const result = checkRateLimit(key);
    expect(result.allowed).toBe(true);
    // Default maxTokens is 20, after consuming 1 → 19 remaining
    expect(result.remaining).toBe(19);
  });

  it("non supera maxTokens durante il refill", async () => {
    const key = "test-cap-" + Date.now();
    const config = { maxTokens: 3, refillRate: 1000, windowMs: 60_000 };
    checkRateLimit(key, config); // init with 3, consume 1 → 2 left

    await new Promise((r) => setTimeout(r, 50)); // huge refill but capped
    const result = checkRateLimit(key, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeLessThanOrEqual(3);
  });
});
