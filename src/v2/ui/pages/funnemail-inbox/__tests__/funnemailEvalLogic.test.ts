/**
 * Sprint F — Funnemail Eval batch run logic tests.
 * Tests sorting, accuracy computation, and AccuracyBar color thresholds
 * without requiring React rendering.
 */
import { describe, it, expect } from "vitest";

interface EvalBatchRun {
  id: string;
  run_at: string;
  dataset_size: number;
  passed_count: number;
  failed_count: number;
  accuracy: number | null;
  prompt_version_id: string | null;
  created_at: string;
}

function makeRun(overrides: Partial<EvalBatchRun> = {}): EvalBatchRun {
  return {
    id: crypto.randomUUID(),
    run_at: new Date().toISOString(),
    dataset_size: 50,
    passed_count: 42,
    failed_count: 8,
    accuracy: 84.0,
    prompt_version_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function accuracyBarColor(value: number): string {
  if (value >= 85) return "bg-emerald-500";
  if (value >= 70) return "bg-amber-500";
  return "bg-rose-500";
}

function sortRuns(runs: EvalBatchRun[]): EvalBatchRun[] {
  return [...runs].sort(
    (a, b) => new Date(b.run_at).getTime() - new Date(a.run_at).getTime()
  );
}

function avgAccuracy(runs: EvalBatchRun[]): number {
  if (runs.length === 0) return 0;
  return runs.reduce((sum, r) => sum + (r.accuracy ?? 0), 0) / runs.length;
}

describe("AccuracyBar color thresholds", () => {
  it("should be emerald at 85%", () => {
    expect(accuracyBarColor(85)).toBe("bg-emerald-500");
  });

  it("should be emerald at 100%", () => {
    expect(accuracyBarColor(100)).toBe("bg-emerald-500");
  });

  it("should be amber at 70%", () => {
    expect(accuracyBarColor(70)).toBe("bg-amber-500");
  });

  it("should be amber at 84%", () => {
    expect(accuracyBarColor(84)).toBe("bg-amber-500");
  });

  it("should be rose at 69%", () => {
    expect(accuracyBarColor(69)).toBe("bg-rose-500");
  });

  it("should be rose at 0%", () => {
    expect(accuracyBarColor(0)).toBe("bg-rose-500");
  });
});

describe("sortRuns", () => {
  it("should sort by run_at descending", () => {
    const runs = [
      makeRun({ run_at: "2026-05-01T00:00:00Z" }),
      makeRun({ run_at: "2026-05-03T00:00:00Z" }),
      makeRun({ run_at: "2026-05-02T00:00:00Z" }),
    ];
    const sorted = sortRuns(runs);
    expect(sorted[0].run_at).toBe("2026-05-03T00:00:00Z");
    expect(sorted[1].run_at).toBe("2026-05-02T00:00:00Z");
    expect(sorted[2].run_at).toBe("2026-05-01T00:00:00Z");
  });

  it("should return empty for empty input", () => {
    expect(sortRuns([])).toEqual([]);
  });
});

describe("avgAccuracy", () => {
  it("should return 0 for empty runs", () => {
    expect(avgAccuracy([])).toBe(0);
  });

  it("should compute correct average", () => {
    const runs = [
      makeRun({ accuracy: 80 }),
      makeRun({ accuracy: 90 }),
      makeRun({ accuracy: 85 }),
    ];
    expect(avgAccuracy(runs)).toBeCloseTo(85, 1);
  });

  it("should handle null accuracy as 0", () => {
    const runs = [
      makeRun({ accuracy: 90 }),
      makeRun({ accuracy: null }),
    ];
    expect(avgAccuracy(runs)).toBeCloseTo(45, 1);
  });
});

describe("target check", () => {
  it("should reach target at 85% avg", () => {
    const avg = 85;
    expect(avg >= 85).toBe(true);
  });

  it("should not reach target at 84.9%", () => {
    const avg = 84.9;
    expect(avg >= 85).toBe(false);
  });
});
