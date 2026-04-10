import { describe, it, expect, beforeEach } from "vitest";
import { checkBudget, trackCost, getSessionStats, resetSession, configureCostTracker } from "@/lib/api/costTracker";
import { isApiError } from "@/lib/api/apiError";

describe("costTracker", () => {
  beforeEach(() => {
    resetSession();
    configureCostTracker({ softLimit: 100, hardLimit: 200 });
  });

  it("tracks credits and call count", () => {
    trackCost("fn-a", 10);
    trackCost("fn-a", 5);
    trackCost("fn-b", 3);
    const s = getSessionStats();
    expect(s.totalCredits).toBe(18);
    expect(s.callCount).toBe(3);
    expect(s.callsByFunction["fn-a"]).toEqual({ count: 2, credits: 15 });
    expect(s.callsByFunction["fn-b"]).toEqual({ count: 1, credits: 3 });
  });

  it("returns true when soft limit is first crossed", () => {
    expect(trackCost("fn", 99)).toBe(false);
    expect(trackCost("fn", 1)).toBe(true); // exactly at soft limit
    expect(trackCost("fn", 10)).toBe(false); // already warned
  });

  it("throws RATE_LIMITED when hard limit exceeded", () => {
    trackCost("fn", 200);
    expect(() => checkBudget()).toThrow();
    try { checkBudget(); } catch (e) {
      expect(isApiError(e)).toBe(true);
      expect((e as any).code).toBe("RATE_LIMITED");
    }
  });

  it("does not throw below hard limit", () => {
    trackCost("fn", 199);
    expect(() => checkBudget()).not.toThrow();
  });

  it("resets session correctly", () => {
    trackCost("fn", 50);
    resetSession();
    const s = getSessionStats();
    expect(s.totalCredits).toBe(0);
    expect(s.callCount).toBe(0);
  });

  it("ignores zero or negative credits", () => {
    expect(trackCost("fn", 0)).toBe(false);
    expect(trackCost("fn", -5)).toBe(false);
    expect(getSessionStats().totalCredits).toBe(0);
  });
});
