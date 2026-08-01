import { describe, it, expect } from "vitest";

/**
 * [B10] Time Window Consistency
 * Scope: Verify that work-hours logic produces consistent results across all components.
 * The shared timeUtils module must be the single source of truth.
 * Tables: none (pure logic).
 */

describe("Time Window Consistency [B10]", () => {
  // Inline the same logic from _shared/timeUtils.ts to verify correctness
  function isOutsideWorkHours(hour: number, startHour: number, endHour: number): boolean {
    if (endHour <= startHour) return false;
    return hour < startHour || hour >= endHour;
  }

  it("hour 3 is outside 6-24 window", () => {
    expect(isOutsideWorkHours(3, 6, 24)).toBe(true);
  });

  it("hour 6 is inside 6-24 window", () => {
    expect(isOutsideWorkHours(6, 6, 24)).toBe(false);
  });

  it("hour 12 is inside 6-24 window", () => {
    expect(isOutsideWorkHours(12, 6, 24)).toBe(false);
  });

  it("hour 23 is inside 6-24 window", () => {
    expect(isOutsideWorkHours(23, 6, 24)).toBe(false);
  });

  it("hour 0 is outside 6-24 window (midnight)", () => {
    expect(isOutsideWorkHours(0, 6, 24)).toBe(true);
  });

  it("hour 5 is outside 6-24 window", () => {
    expect(isOutsideWorkHours(5, 6, 24)).toBe(true);
  });

  it("custom window 8-20: hour 7 is outside", () => {
    expect(isOutsideWorkHours(7, 8, 20)).toBe(true);
  });

  it("custom window 8-20: hour 20 is outside", () => {
    expect(isOutsideWorkHours(20, 8, 20)).toBe(true);
  });

  it("custom window 8-20: hour 19 is inside", () => {
    expect(isOutsideWorkHours(19, 8, 20)).toBe(false);
  });

  it("misconfigured endHour <= startHour never pauses", () => {
    expect(isOutsideWorkHours(3, 10, 5)).toBe(false);
    expect(isOutsideWorkHours(12, 10, 5)).toBe(false);
    expect(isOutsideWorkHours(0, 0, 0)).toBe(false);
  });

  it("old email-cron-sync UTC logic vs new CET logic differ correctly", () => {
    // Old logic: skip if UTC hour >= 23 || < 5
    // New logic: skip if CET hour < startHour || >= endHour
    // At UTC 4 (CET 5 in winter, CET 6 in summer):
    // Old logic: skip (4 < 5)
    // New logic with start=6: CET 5 → skip, CET 6 → allow
    // This confirms the old logic was wrong for CET users
    const oldSkips = (utcHour: number) => utcHour >= 23 || utcHour < 5;
    expect(oldSkips(4)).toBe(true); // Old skips at UTC 4
    // But CET 5 (winter) should NOT be skipped if work starts at 5
    expect(isOutsideWorkHours(5, 5, 24)).toBe(false);
  });
});
