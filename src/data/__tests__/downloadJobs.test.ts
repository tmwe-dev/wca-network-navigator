import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { findDownloadJobs, getDownloadJob, _findActiveJobs } from "@/data/downloadJobs";
describe("DAL — downloadJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder, in: vi.fn().mockReturnValue({ order: mockOrder }) });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle, order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });
  it("finds download jobs", async () => {
    const jobs = [{ id: "j1" }];
    mockLimit.mockResolvedValue({ data: jobs, error: null });
    const r = await findDownloadJobs();
    expect(r).toEqual(jobs);
  });
  it("gets single job", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "j1" }, error: null });
    const r = await getDownloadJob("j1");
    expect(r).toEqual({ id: "j1" });
  });
  it("returns null when job not found", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const r = await getDownloadJob("j99");
    expect(r).toBeNull();
  });
});
