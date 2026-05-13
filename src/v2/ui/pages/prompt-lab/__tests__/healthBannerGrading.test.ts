/**
 * Sprint F — Test grading functions from PromptLabHealthBanner.
 * Extracted logic for testability without rendering React.
 */
import { describe, it, expect } from "vitest";

// Re-implement the grading logic as pure functions (same as in PromptLabHealthBanner)
type Level = "ok" | "warn" | "alert";

interface HealthSnapshot {
  testRuns7d: number;
  testPassed7d: number;
  testRuns30d: number;
  duplicateGroups: number;
  duplicateExtraRows: number;
  personasThin: number;
  personasTotal: number;
  cronTestRunner: boolean;
  cronRefiner: boolean;
  copilotPending: number;
  refinerPending: number;
  promptsActive: number;
  promptsDistinctNames: number;
}

function gradeTestRuns(h: HealthSnapshot): { level: Level; label: string } {
  if (h.testRuns7d === 0) return { level: "alert", label: "0 run / 7g" };
  const passRate = h.testRuns7d > 0 ? h.testPassed7d / h.testRuns7d : 0;
  if (passRate >= 0.95) return { level: "ok", label: `${Math.round(passRate * 100)}% pass` };
  if (passRate >= 0.85) return { level: "warn", label: `${Math.round(passRate * 100)}% pass` };
  return { level: "alert", label: `${Math.round(passRate * 100)}% pass` };
}

function gradeDuplicates(h: HealthSnapshot): { level: Level; label: string } {
  if (h.duplicateGroups === 0) return { level: "ok", label: "0 dup" };
  if (h.duplicateGroups <= 5) return { level: "warn", label: `${h.duplicateGroups} dup` };
  return { level: "alert", label: `${h.duplicateGroups} dup` };
}

function gradePersonas(h: HealthSnapshot): { level: Level; label: string } {
  if (h.personasThin === 0) return { level: "ok", label: "complete" };
  if (h.personasThin <= 2) return { level: "warn", label: `${h.personasThin} thin` };
  return { level: "alert", label: `${h.personasThin}/${h.personasTotal} thin` };
}

const baseHealth: HealthSnapshot = {
  testRuns7d: 10,
  testPassed7d: 10,
  testRuns30d: 50,
  duplicateGroups: 0,
  duplicateExtraRows: 0,
  personasThin: 0,
  personasTotal: 8,
  cronTestRunner: true,
  cronRefiner: true,
  copilotPending: 0,
  refinerPending: 0,
  promptsActive: 20,
  promptsDistinctNames: 15,
};

describe("gradeTestRuns", () => {
  it("should alert on zero runs", () => {
    const r = gradeTestRuns({ ...baseHealth, testRuns7d: 0, testPassed7d: 0 });
    expect(r.level).toBe("alert");
    expect(r.label).toContain("0 run");
  });

  it("should be ok at 100% pass rate", () => {
    const r = gradeTestRuns({ ...baseHealth, testRuns7d: 10, testPassed7d: 10 });
    expect(r.level).toBe("ok");
    expect(r.label).toContain("100% pass");
  });

  it("should be ok at 95% pass rate", () => {
    const r = gradeTestRuns({ ...baseHealth, testRuns7d: 100, testPassed7d: 95 });
    expect(r.level).toBe("ok");
  });

  it("should warn at 90% pass rate", () => {
    const r = gradeTestRuns({ ...baseHealth, testRuns7d: 100, testPassed7d: 90 });
    expect(r.level).toBe("warn");
  });

  it("should alert at 80% pass rate", () => {
    const r = gradeTestRuns({ ...baseHealth, testRuns7d: 100, testPassed7d: 80 });
    expect(r.level).toBe("alert");
  });
});

describe("gradeDuplicates", () => {
  it("should be ok at zero duplicates", () => {
    expect(gradeDuplicates({ ...baseHealth, duplicateGroups: 0 }).level).toBe("ok");
  });

  it("should warn at 3 duplicates", () => {
    expect(gradeDuplicates({ ...baseHealth, duplicateGroups: 3 }).level).toBe("warn");
  });

  it("should alert at 6 duplicates", () => {
    expect(gradeDuplicates({ ...baseHealth, duplicateGroups: 6 }).level).toBe("alert");
  });
});

describe("gradePersonas", () => {
  it("should be ok when all personas are complete", () => {
    expect(gradePersonas({ ...baseHealth, personasThin: 0 }).level).toBe("ok");
    expect(gradePersonas({ ...baseHealth, personasThin: 0 }).label).toBe("complete");
  });

  it("should warn with 1 thin persona", () => {
    expect(gradePersonas({ ...baseHealth, personasThin: 1 }).level).toBe("warn");
  });

  it("should alert with 3+ thin personas", () => {
    const r = gradePersonas({ ...baseHealth, personasThin: 3, personasTotal: 8 });
    expect(r.level).toBe("alert");
    expect(r.label).toBe("3/8 thin");
  });
});
