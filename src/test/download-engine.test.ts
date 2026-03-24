import { describe, it, expect } from "vitest";

// ── Unit tests for circuit breaker logic ──

type CircuitState = "closed" | "open" | "half_open";

interface CircuitBreaker {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  threshold: number;
  cooldownMs: number;
  halfOpenSuccessNeeded: number;
  halfOpenSuccessCount: number;
}

function createCircuitBreaker(threshold = 5, cooldownMs = 60_000): CircuitBreaker {
  return { state: "closed", failureCount: 0, lastFailureTime: 0, threshold, cooldownMs, halfOpenSuccessNeeded: 2, halfOpenSuccessCount: 0 };
}

function recordSuccess(cb: CircuitBreaker): void {
  if (cb.state === "half_open") {
    cb.halfOpenSuccessCount++;
    if (cb.halfOpenSuccessCount >= cb.halfOpenSuccessNeeded) {
      cb.state = "closed"; cb.failureCount = 0; cb.halfOpenSuccessCount = 0;
    }
  } else { cb.failureCount = 0; }
}

function recordFailure(cb: CircuitBreaker): void {
  cb.failureCount++; cb.lastFailureTime = Date.now(); cb.halfOpenSuccessCount = 0;
  if (cb.state === "half_open") cb.state = "open";
  else if (cb.failureCount >= cb.threshold) cb.state = "open";
}

function canAttempt(cb: CircuitBreaker): boolean {
  if (cb.state === "closed") return true;
  if (cb.state === "open") {
    if (Date.now() - cb.lastFailureTime >= cb.cooldownMs) { cb.state = "half_open"; cb.halfOpenSuccessCount = 0; return true; }
    return false;
  }
  return true;
}

function calcBackoff(attempt: number, baseMs = 5000, maxMs = 60_000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
  const jitter = exponential * 0.5 * Math.random();
  return Math.round(exponential + jitter);
}

describe("Circuit Breaker", () => {
  it("starts closed", () => {
    const cb = createCircuitBreaker(3);
    expect(cb.state).toBe("closed");
    expect(canAttempt(cb)).toBe(true);
  });

  it("opens after threshold failures", () => {
    const cb = createCircuitBreaker(3);
    recordFailure(cb); expect(cb.state).toBe("closed");
    recordFailure(cb); expect(cb.state).toBe("closed");
    recordFailure(cb); expect(cb.state).toBe("open");
    expect(canAttempt(cb)).toBe(false);
  });

  it("resets on success", () => {
    const cb = createCircuitBreaker(3);
    recordFailure(cb);
    recordFailure(cb);
    recordSuccess(cb);
    expect(cb.failureCount).toBe(0);
    expect(cb.state).toBe("closed");
  });

  it("transitions to half_open after cooldown", () => {
    const cb = createCircuitBreaker(2, 100); // 100ms cooldown
    recordFailure(cb);
    recordFailure(cb);
    expect(cb.state).toBe("open");
    // Simulate time passing
    cb.lastFailureTime = Date.now() - 200;
    expect(canAttempt(cb)).toBe(true);
    expect(cb.state).toBe("half_open");
  });

  it("closes from half_open after enough successes", () => {
    const cb = createCircuitBreaker(2, 100);
    recordFailure(cb); recordFailure(cb);
    cb.lastFailureTime = Date.now() - 200;
    canAttempt(cb); // triggers half_open
    expect(cb.state).toBe("half_open");
    recordSuccess(cb); expect(cb.state).toBe("half_open");
    recordSuccess(cb); expect(cb.state).toBe("closed");
  });

  it("re-opens from half_open on failure", () => {
    const cb = createCircuitBreaker(2, 100);
    recordFailure(cb); recordFailure(cb);
    cb.lastFailureTime = Date.now() - 200;
    canAttempt(cb);
    expect(cb.state).toBe("half_open");
    recordFailure(cb);
    expect(cb.state).toBe("open");
  });
});

describe("Exponential Backoff with Jitter (RFC 7231)", () => {
  it("produces increasing delays", () => {
    const d1 = calcBackoff(1, 1000, 60000);
    const d2 = calcBackoff(2, 1000, 60000);
    const d3 = calcBackoff(3, 1000, 60000);
    // Due to jitter, we check the base exponential range
    expect(d1).toBeGreaterThanOrEqual(1000);
    expect(d1).toBeLessThanOrEqual(1500);
    expect(d2).toBeGreaterThanOrEqual(2000);
    expect(d3).toBeGreaterThanOrEqual(4000);
  });

  it("respects max ceiling", () => {
    const d = calcBackoff(20, 5000, 10000);
    expect(d).toBeLessThanOrEqual(15000); // max + 50% jitter
  });

  it("always returns positive values", () => {
    for (let i = 1; i <= 10; i++) {
      expect(calcBackoff(i)).toBeGreaterThan(0);
    }
  });
});

describe("Delay Pattern (12-Factor)", () => {
  const pattern = [3, 3, 2, 3, 8, 3, 5, 3, 12, 3, 4, 3, 6, 3, 9, 3, 3, 3, 10];

  it("cycles through pattern", () => {
    const getDelay = (i: number) => (pattern[i % pattern.length] || 3) * 1000;
    expect(getDelay(0)).toBe(3000);
    expect(getDelay(4)).toBe(8000);
    expect(getDelay(8)).toBe(12000);
    expect(getDelay(19)).toBe(3000); // wraps around
  });

  it("handles empty pattern gracefully", () => {
    const empty: number[] = [];
    const getDelay = (i: number) => (empty[i % (empty.length || 1)] || 3) * 1000;
    expect(getDelay(0)).toBe(3000); // fallback
  });
});
