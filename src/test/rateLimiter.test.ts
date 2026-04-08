/**
 * Test rate limiter + circuit breaker.
 * Vol. II §10.3 (resilience patterns).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  withRateLimit,
  configureRateLimiter,
  getRateLimiterState,
  resetAllRateLimiters,
  RateLimitedError,
  CircuitOpenError,
} from "@/lib/api/rateLimiter";

beforeEach(() => {
  resetAllRateLimiters();
});

describe("withRateLimit", () => {
  it("returns success when fn resolves", async () => {
    const result = await withRateLimit("test:ok", async () => 42);
    expect(result).toBe(42);
  });

  it("decrements tokens on each call", async () => {
    configureRateLimiter("test:tokens", { maxTokens: 3, windowMs: 60_000 });
    await withRateLimit("test:tokens", async () => "a");
    await withRateLimit("test:tokens", async () => "b");
    const state = getRateLimiterState("test:tokens");
    expect(state.tokensRemaining).toBe(1);
  });

  it("throws RateLimitedError when bucket exhausted", async () => {
    configureRateLimiter("test:exhaust", { maxTokens: 1, windowMs: 60_000 });
    await withRateLimit("test:exhaust", async () => "ok");
    await expect(withRateLimit("test:exhaust", async () => "x")).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("opens circuit after threshold non-retryable failures", async () => {
    configureRateLimiter("test:circuit", {
      maxTokens: 100,
      failureThreshold: 3,
      baseBackoffMs: 1,
      maxBackoffMs: 2,
    });
    const failing = async () => { throw new Error("permanent failure"); };
    for (let i = 0; i < 3; i++) {
      await expect(withRateLimit("test:circuit", failing, 0)).rejects.toThrow();
    }
    const state = getRateLimiterState("test:circuit");
    expect(state.circuit).toBe("open");
  });

  it("throws CircuitOpenError when circuit is open", async () => {
    configureRateLimiter("test:open", {
      maxTokens: 100,
      failureThreshold: 1,
      baseBackoffMs: 1,
      maxBackoffMs: 2,
    });
    await expect(
      withRateLimit("test:open", async () => { throw new Error("fail"); }, 0)
    ).rejects.toThrow();
    // Next call should hit open circuit
    await expect(
      withRateLimit("test:open", async () => "should not run")
    ).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("resets failures on successful call", async () => {
    configureRateLimiter("test:reset", {
      maxTokens: 100,
      failureThreshold: 5,
      baseBackoffMs: 1,
      maxBackoffMs: 2,
    });
    await expect(
      withRateLimit("test:reset", async () => { throw new Error("transient"); }, 0)
    ).rejects.toThrow();
    await withRateLimit("test:reset", async () => "ok");
    const state = getRateLimiterState("test:reset");
    expect(state.failures).toBe(0);
  });

  it("retries retryable errors (network/429) up to maxRetries", async () => {
    configureRateLimiter("test:retry", {
      maxTokens: 100,
      baseBackoffMs: 1,
      maxBackoffMs: 2,
    });
    let attempts = 0;
    const result = await withRateLimit("test:retry", async () => {
      attempts++;
      if (attempts < 3) throw new Error("network timeout");
      return "ok";
    }, 5);
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });
});
