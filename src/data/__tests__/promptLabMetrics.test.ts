import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpsertAppSetting = vi.fn().mockResolvedValue(undefined);
const _mockGetAppSetting = vi.fn();

vi.mock("../appSettings", () => ({
  upsertAppSetting: (...args: any[]) => mockUpsertAppSetting(...args),
  getAppSetting: (...args: any[]) => _mockGetAppSetting(...args),
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

const mockTFromChain: Record<string, any> = {};

function resetTFromChain(returnData: any[] = []) {
  mockTFromChain.select = () => mockTFromChain;
  mockTFromChain.eq = () => mockTFromChain;
  mockTFromChain.order = () => Promise.resolve({ data: returnData, error: null });
}

vi.mock("@/lib/typedSupabase", () => ({
  tFrom: () => mockTFromChain,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => mockTFromChain,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetTFromChain();
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
    ] as never[];

    const metrics = await trackImprovementMetrics("run-1", "user-1", proposals);

    expect(metrics.total_blocks).toBe(5);
    expect(metrics.accepted_count).toBe(2);
    expect(metrics.rejected_count).toBe(1);
    expect(metrics.skipped_count).toBe(1);
    expect(metrics.error_count).toBe(1);
    expect(metrics.acceptance_rate).toBeCloseTo(0.6667, 3);
    expect(metrics.outcome_distribution.text_fix).toBe(2);
    expect(metrics.outcome_distribution.kb_fix).toBe(1);
    expect(metrics.outcome_distribution.no_change).toBe(1);

    expect(mockUpsertAppSetting).toHaveBeenCalledWith("user-1", "prompt_lab_metrics_run-1", expect.any(String));
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
    ] as never[];

    const metrics = await trackImprovementMetrics("run-3", "user-1", proposals);

    expect(metrics.avg_change_size).toBe(13);
  });
});

describe("getMetricsSummary", () => {
  it("returns excellent for high acceptance", async () => {
    const metricsData = JSON.stringify({
      acceptance_rate: 0.85,
      total_blocks: 10,
      accepted_count: 8,
      rejected_count: 2,
      skipped_count: 0,
      error_count: 0,
      outcome_distribution: {
        text_fix: 8,
        kb_fix: 0,
        contract_needed: 0,
        code_policy_needed: 0,
        runtime_mapping_fix: 0,
        no_change: 0,
      },
      avg_change_size: 10,
      run_id: "run-x",
      user_id: "u1",
      created_at: "2026-01-01",
    });

    resetTFromChain([{ key: "prompt_lab_metrics_run-x", value: metricsData }]);

    const { getMetricsSummary } = await import("../promptLabMetrics");
    const summary = await getMetricsSummary("u1");

    expect(summary.acceptance_rate).toBe(85);
    expect(summary.status).toBe("excellent");
    expect(summary.total_blocks).toBe(10);
  });

  it("returns poor status with no data", async () => {
    resetTFromChain([]);

    const { getMetricsSummary } = await import("../promptLabMetrics");
    const summary = await getMetricsSummary("u1");

    expect(summary.acceptance_rate).toBe(0);
    expect(summary.status).toBe("poor");
    expect(summary.total_blocks).toBe(0);
  });
});
