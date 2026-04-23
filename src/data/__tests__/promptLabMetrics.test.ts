/**
 * promptLabMetrics — Unit tests for improvement metrics tracking.
 *
 * Tests: trackImprovementMetrics calculation logic, getMetricsSummary status mapping.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock upsertAppSetting / getAppSetting
const mockUpsertAppSetting = vi.fn().mockResolvedValue(undefined);
const mockGetAppSetting = vi.fn();

vi.mock("../appSettings", () => ({
  upsertAppSetting: (...args: unknown[]) => mockUpsertAppSetting(...args),
  getAppSetting: (...args: unknown[]) => mockGetAppSetting(...args),
}));

// Mock supabase for loadRunMetrics
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...a: unknown[]) => { mockFrom(...a); return mockSupaChain; },
  },
}));

let mockSupaChain: any;
function resetSupaChain(returnData: unknown[] = []) {
  mockSupaChain = {
    select: () => mockSupaChain,
    eq: () => mockSupaChain,
    order: () => Promise.resolve({ data: returnData, error: null }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSupaChain();
});

describe("trackImprovementMetrics", () => {
  it("calculates acceptance rate correctly", async () => {
    const { trackImprovementMetrics } = await import("../promptLabMetrics");

    const proposals = [
      { status: "saved", outcomeType: "text_fix", before: "abc", after: "abcde" },
      { status: "saved", outcomeType: "text_fix", before: "xyz", after: "xyz123" },
      { status: "ready", outcomeType: "kb_fix", before: "old", after: "new" },
      { status: "skipped", outcomeType: "no_change", before: null, after: null },
      { status: "error", outcomeType: null, before: null, after: null },
    ] as any;

    const metrics = await trackImprovementMetrics("run-1", "user-1", proposals);

    expect(metrics.total_blocks).toBe(5);
    expect(metrics.accepted_count).toBe(2);
    expect(metrics.rejected_count).toBe(1);
    expect(metrics.skipped_count).toBe(1);
    expect(metrics.error_count).toBe(1);
    // acceptance_rate = 2 / (2 + 1) = 0.6667
    expect(metrics.acceptance_rate).toBeCloseTo(0.6667, 3);
    expect(metrics.outcome_distribution.text_fix).toBe(2);
    expect(metrics.outcome_distribution.kb_fix).toBe(1);
    expect(metrics.outcome_distribution.no_change).toBe(1);

    // Verify it was saved
    expect(mockUpsertAppSetting).toHaveBeenCalledWith(
      "user-1",
      "prompt_lab_metrics_run-1",
      expect.any(String),
    );
  });

  it("handles empty proposals array", async () => {
    const { trackImprovementMetrics } = await import("../promptLabMetrics");

    const metrics = await trackImprovementMetrics("run-2", "user-1", []);

    expect(metrics.total_blocks).toBe(0);
    expect(metrics.acceptance_rate).toBe(0);
    expect(metrics.avg_change_size).toBe(0);
  });

  it("calculates avg_change_size from before/after diffs", async () => {
    const { trackImprovementMetrics } = await import("../promptLabMetrics");

    const proposals = [
      { status: "saved", outcomeType: "text_fix", before: "short", after: "a much longer text here" },
      { status: "saved", outcomeType: "text_fix", before: "abcdefghij", after: "ab" },
    ] as any;

    const metrics = await trackImprovementMetrics("run-3", "user-1", proposals);

    // |22 - 5| = 17, |2 - 10| = 8 → avg = 12.5
    expect(metrics.avg_change_size).toBe(12.5);
  });
});

describe("getMetricsSummary", () => {
  it("returns excellent for ≥70% acceptance", async () => {
    const metricsData = JSON.stringify({
      acceptance_rate: 0.85,
      total_blocks: 10,
      accepted_count: 8,
      run_id: "run-x",
      user_id: "u1",
      created_at: "2026-01-01",
    });

    resetSupaChain([{ key: "prompt_lab_metrics_run-x", value: metricsData }]);

    const { getMetricsSummary } = await import("../promptLabMetrics");
    const summary = await getMetricsSummary("u1");

    expect(summary.acceptance_rate).toBe(85);
    expect(summary.status).toBe("excellent");
    expect(summary.total_blocks).toBe(10);
  });

  it("returns moderate for 30-49% acceptance", async () => {
    const metricsData = JSON.stringify({
      acceptance_rate: 0.35,
      total_blocks: 20,
      accepted_count: 7,
      run_id: "run-y",
      user_id: "u1",
      created_at: "2026-01-01",
    });

    resetSupaChain([{ key: "prompt_lab_metrics_run-y", value: metricsData }]);

    const { getMetricsSummary } = await import("../promptLabMetrics");
    const summary = await getMetricsSummary("u1");

    expect(summary.acceptance_rate).toBe(35);
    expect(summary.status).toBe("moderate");
  });

  it("returns poor status with no data", async () => {
    resetSupaChain([]);

    const { getMetricsSummary } = await import("../promptLabMetrics");
    const summary = await getMetricsSummary("u1");

    expect(summary.acceptance_rate).toBe(0);
    expect(summary.status).toBe("poor");
    expect(summary.total_blocks).toBe(0);
  });
});
