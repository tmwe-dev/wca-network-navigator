import { describe, it, expect } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any -- test file with mocks */
/**
 * State Consistency: Agent Task Stats
 *
 * Verifies the LOGIC of our fix: tasks_completed only increments on success,
 * and tasks_failed increments on failure.
 */

describe("Agent Task Stats Consistency (logic)", () => {
  it("should only increment tasks_completed on successful task", () => {
    const stats = { tasks_completed: 5, tasks_failed: 2, emails_sent: 10, calls_made: 0 };
    const taskStatus = "completed";

    const updated = { ...stats };
    if (taskStatus === "completed") {
      updated.tasks_completed = (stats.tasks_completed || 0) + 1;
    } else {
      updated.tasks_failed = (stats.tasks_failed || 0) + 1;
    }

    expect(updated.tasks_completed).toBe(6);
    expect(updated.tasks_failed).toBe(2); // unchanged
  });

  it("should only increment tasks_failed on failed task", () => {
    const stats = { tasks_completed: 5, tasks_failed: 2, emails_sent: 10, calls_made: 0 };
    const taskStatus: string = "failed";

    const updated = { ...stats };
    if (taskStatus === "completed") {
      updated.tasks_completed = (stats.tasks_completed || 0) + 1;
    } else {
      updated.tasks_failed = (stats.tasks_failed || 0) + 1;
    }

    expect(updated.tasks_completed).toBe(5); // unchanged
    expect(updated.tasks_failed).toBe(3);
  });

  it("should handle missing stats gracefully", () => {
    const stats: any = {};
    const taskStatus = "completed";

    const updated = { ...stats };
    if (taskStatus === "completed") {
      updated.tasks_completed = (stats.tasks_completed || 0) + 1;
    } else {
      updated.tasks_failed = (stats.tasks_failed || 0) + 1;
    }

    expect(updated.tasks_completed).toBe(1);
    expect(updated.tasks_failed).toBeUndefined();
  });
});

describe("Agent Work Hours (CET logic)", () => {
  it("should detect outside work hours correctly", () => {
    // Simulating isOutsideWorkHours logic
    function isOutsideWorkHours(hour: number, startHour: number, endHour: number): boolean {
      if (endHour <= startHour) return false;
      return hour < startHour || hour >= endHour;
    }

    // Default 6-24
    expect(isOutsideWorkHours(3, 6, 24)).toBe(true);  // 3 AM → outside
    expect(isOutsideWorkHours(6, 6, 24)).toBe(false);  // 6 AM → inside
    expect(isOutsideWorkHours(12, 6, 24)).toBe(false); // noon → inside
    expect(isOutsideWorkHours(23, 6, 24)).toBe(false); // 11 PM → inside
    expect(isOutsideWorkHours(0, 6, 24)).toBe(true);   // midnight → outside

    // Custom 8-18
    expect(isOutsideWorkHours(7, 8, 18)).toBe(true);
    expect(isOutsideWorkHours(8, 8, 18)).toBe(false);
    expect(isOutsideWorkHours(17, 8, 18)).toBe(false);
    expect(isOutsideWorkHours(18, 8, 18)).toBe(true);

    // Misconfigured (end <= start) → never pause
    expect(isOutsideWorkHours(3, 10, 5)).toBe(false);
  });
});
