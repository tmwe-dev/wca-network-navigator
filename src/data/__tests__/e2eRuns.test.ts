import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { listRecentE2ERuns, getLatestE2ERun } from "@/data/e2eRuns";
describe("DAL — e2eRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit, maybeSingle: mockMaybeSingle });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });
  it("lists recent runs", async () => {
    const runs = [{ id: "r1", status: "passed" }];
    mockLimit.mockResolvedValue({ data: runs, error: null });
    const r = await listRecentE2ERuns();
    expect(r).toEqual(runs);
  });
  it("gets latest run", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "r1" }, error: null });
    const r = await getLatestE2ERun();
    expect(r).toEqual({ id: "r1" });
  });
  it("returns null when no runs", async () => {
    const r = await getLatestE2ERun();
    expect(r).toBeNull();
  });
});
