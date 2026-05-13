import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { getBulkJob } from "@/data/bulkJobs";
describe("DAL — bulkJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({ data: { id: "b1", status: "running" }, error: null });
  });
  it("gets a bulk job", async () => {
    const r = await getBulkJob("b1");
    expect(r).toEqual({ id: "b1", status: "running" });
  });
  it("returns null when not found", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const r = await getBulkJob("b99");
    expect(r).toBeNull();
  });
});
