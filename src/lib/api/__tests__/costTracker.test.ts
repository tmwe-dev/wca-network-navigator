import { describe, it, expect, beforeEach } from "vitest";
import { trackCost, getSessionStats, resetSession, checkBudget, configureCostTracker } from "@/lib/api/costTracker";

describe("costTracker", () => {
  beforeEach(() => {
    resetSession();
    configureCostTracker({ softLimit: 500, hardLimit: 1000 });
  });

  it("tracks a single call cost", () => {
    trackCost("generate-email", 10);
    const stats = getSessionStats();
    expect(stats.totalCredits).toBe(10);
    expect(stats.callCount).toBe(1);
  });

  it("accumulates multiple calls", () => {
    trackCost("fn1", 10);
    trackCost("fn2", 20);
    expect(getSessionStats().totalCredits).toBe(30);
    expect(getSessionStats().callCount).toBe(2);
  });

  it("resets session counters", () => {
    trackCost("fn1", 50);
    resetSession();
    expect(getSessionStats().totalCredits).toBe(0);
  });

  it("throws when hard limit exceeded", () => {
    configureCostTracker({ softLimit: 5, hardLimit: 10 });
    trackCost("fn", 15);
    expect(() => checkBudget()).toThrow(/Budget sessione esaurito/);
  });
});
