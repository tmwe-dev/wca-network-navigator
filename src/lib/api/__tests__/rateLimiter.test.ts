import { describe, it, expect, beforeEach } from "vitest";
import {
  configureRateLimiter,
  getRateLimiterState,
  resetRateLimiter,
  resetAllRateLimiters,
  withRateLimit,
  RateLimitedError,
} from "@/lib/api/rateLimiter";

describe("rateLimiter", () => {
  beforeEach(() => {
    resetAllRateLimiters();
  });

  it("allows requests under the limit", async () => {
    configureRateLimiter("test", { maxTokens: 5, windowMs: 60000, failureThreshold: 5, resetMs: 300000, baseBackoffMs: 100, maxBackoffMs: 1000 });
    const result = await withRateLimit("test", async () => "ok");
    expect(result).toBe("ok");
  });

  it("blocks when tokens exhausted", async () => {
    configureRateLimiter("test2", { maxTokens: 1, windowMs: 60000, failureThreshold: 5, resetMs: 300000, baseBackoffMs: 100, maxBackoffMs: 1000 });
    await withRateLimit("test2", async () => "first");
    await expect(withRateLimit("test2", async () => "second")).rejects.toThrow(RateLimitedError);
  });

  it("reports state correctly", () => {
    configureRateLimiter("test3", { maxTokens: 10, windowMs: 60000, failureThreshold: 5, resetMs: 300000, baseBackoffMs: 100, maxBackoffMs: 1000 });
    const state = getRateLimiterState("test3");
    expect(state.circuit).toBe("closed");
    expect(state.tokensRemaining).toBe(10);
  });

  it("resets a specific limiter", async () => {
    configureRateLimiter("test4", { maxTokens: 1, windowMs: 60000, failureThreshold: 5, resetMs: 300000, baseBackoffMs: 100, maxBackoffMs: 1000 });
    await withRateLimit("test4", async () => "ok");
    resetRateLimiter("test4");
    const state = getRateLimiterState("test4");
    expect(state.tokensRemaining).toBe(1);
  });

  it("opens circuit after threshold failures", async () => {
    configureRateLimiter("test5", { maxTokens: 100, windowMs: 60000, failureThreshold: 1, resetMs: 300000, baseBackoffMs: 10, maxBackoffMs: 50 });
    try {
      await withRateLimit("test5", async () => { throw new Error("network error"); }, 0);
    } catch {}
    expect(getRateLimiterState("test5").circuit).toBe("open");
  });
});
