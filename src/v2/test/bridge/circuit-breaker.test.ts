/**
 * Tests: Circuit Breaker
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  withCircuitBreaker,
  getCircuitState,
  resetAllCircuits,
} from "../../bridge/circuit-breaker";
import { isOk, isErr } from "../../core/domain/result";

beforeEach(() => {
  resetAllCircuits();
});

describe("Circuit Breaker", () => {
  it("starts closed and passes through success", async () => {
    const r = await withCircuitBreaker("test", async () => 42);
    expect(isOk(r) && r.value).toBe(42);
    expect(getCircuitState("test")).toBe("closed");
  });

  it("opens after 3 failures", async () => {
    const fail = () => withCircuitBreaker("test", async () => { throw new Error("fail"); });

    await fail();
    expect(getCircuitState("test")).toBe("closed");
    await fail();
    expect(getCircuitState("test")).toBe("closed");
    await fail();
    expect(getCircuitState("test")).toBe("open");
  });

  it("rejects immediately when open", async () => {
    const fail = () => withCircuitBreaker("test", async () => { throw new Error("fail"); });
    await fail();
    await fail();
    await fail();

    const r = await withCircuitBreaker("test", async () => 42);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("CIRCUIT_OPEN");
  });

  it("transitions to half-open after cooldown", async () => {
    const fail = () =>
      withCircuitBreaker("test", async () => { throw new Error("fail"); }, { cooldownMs: 10 });

    await fail();
    await fail();
    await fail();
    expect(getCircuitState("test")).toBe("open");

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 20));

    const r = await withCircuitBreaker("test", async () => "recovered", { cooldownMs: 10 });
    expect(isOk(r)).toBe(true);
    expect(getCircuitState("test")).toBe("closed");
  });
});
