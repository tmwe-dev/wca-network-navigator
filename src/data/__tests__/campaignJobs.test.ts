import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));
import { fetchCampaignJobs, createCampaignJob, updateCampaignJob } from "@/data/campaignJobs";

describe("DAL — campaignJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockEq.mockReturnValue({ order: mockOrder, eq: mockEq });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });
  it("fetches jobs", async () => {
    const jobs = [{ id: "j1", status: "active" }];
    mockOrder.mockResolvedValue({ data: jobs, error: null });
    const result = await fetchCampaignJobs();
    expect(result).toEqual(jobs);
  });
  it("creates a job", async () => {
    await createCampaignJob({ name: "test" } as never);
    expect(mockInsert).toHaveBeenCalled();
  });
  it("throws on create error", async () => {
    mockInsert.mockResolvedValue({ error: { message: "dup" } });
    await expect(createCampaignJob({ name: "x" } as never)).rejects.toEqual({ message: "dup" });
  });
});
