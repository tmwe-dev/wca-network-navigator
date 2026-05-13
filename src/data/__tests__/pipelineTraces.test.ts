import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { listPipelineTraces, getTraceTimeline } from "@/data/pipelineTraces";
describe("DAL — pipelineTraces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });
  it("lists traces", async () => {
    const traces = [{ id: "t1", status: "success" }];
    mockLimit.mockResolvedValue({ data: traces, error: null });
    const r = await listPipelineTraces();
    expect(r).toEqual(traces);
  });
  it("gets trace timeline", async () => {
    mockOrder.mockResolvedValue({ data: [{ id: "t1" }], error: null });
    const r = await getTraceTimeline("t1");
    expect(mockFrom).toHaveBeenCalledWith("pipeline_traces");
    expect(r).toBeDefined();
  });
  it("throws on error", async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: "fail" } });
    await expect(listPipelineTraces()).rejects.toEqual({ message: "fail" });
  });
});
