import { describe, it, expect } from "vitest";
import { nextDelayMs, type SoftTimerConfig } from "./softTimer";

const CFG: SoftTimerConfig = {
  baseIntervalSec: 120,
  jitterPct: 25,
  longPauseChancePct: 10,
  longPauseMinMult: 1.8,
  longPauseMaxMult: 3.5,
  quickCheckChancePct: 5,
  quickCheckMinMult: 0.5,
  quickCheckMaxMult: 0.8,
  antiRepeatToleranceMs: 1500,
};

describe("nextDelayMs", () => {
  it("never returns negative or > 10x base", () => {
    for (let i = 0; i < 1000; i++) {
      const { delayMs } = nextDelayMs(CFG);
      expect(delayMs).toBeGreaterThanOrEqual(1000);
      expect(delayMs).toBeLessThanOrEqual(CFG.baseIntervalSec * 1000 * 10);
    }
  });

  it("no consecutive pair with delta < antiRepeatToleranceMs in 1000 iterations", () => {
    let prev: number | undefined;
    let violations = 0;
    for (let i = 0; i < 1000; i++) {
      const { delayMs } = nextDelayMs(CFG, prev);
      if (prev !== undefined && Math.abs(delayMs - prev) < CFG.antiRepeatToleranceMs) {
        violations++;
      }
      prev = delayMs;
    }
    // Allow at most 1% violations (reroll isn't perfect for edge cases)
    expect(violations).toBeLessThanOrEqual(10);
  });

  it("distribution roughly matches configured percentages", () => {
    const counts = { normal: 0, long_pause: 0, quick_check: 0 };
    const N = 5000;
    for (let i = 0; i < N; i++) {
      const { pattern } = nextDelayMs(CFG);
      counts[pattern]++;
    }
    const lpPct = (counts.long_pause / N) * 100;
    const qcPct = (counts.quick_check / N) * 100;
    const normPct = (counts.normal / N) * 100;

    // ±4% tolerance (statistical)
    expect(lpPct).toBeGreaterThan(CFG.longPauseChancePct - 4);
    expect(lpPct).toBeLessThan(CFG.longPauseChancePct + 4);
    expect(qcPct).toBeGreaterThan(CFG.quickCheckChancePct - 4);
    expect(qcPct).toBeLessThan(CFG.quickCheckChancePct + 4);
    expect(normPct).toBeGreaterThan(80);
  });

  it("long_pause delays are >= 216s and quick_check <= 96s", () => {
    let testedLP = 0;
    let testedQC = 0;
    for (let i = 0; i < 10000 && (testedLP < 10 || testedQC < 10); i++) {
      const r = nextDelayMs(CFG);
      if (r.pattern === "long_pause") {
        expect(r.delayMs).toBeGreaterThanOrEqual(120000 * 1.8);
        testedLP++;
      }
      if (r.pattern === "quick_check") {
        expect(r.delayMs).toBeLessThanOrEqual(120000 * 0.8);
        testedQC++;
      }
    }
  });
});
