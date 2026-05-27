import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => mockFrom(table) } }));
import { listEmailProcessingJobs, getEmailProcessingJob } from "@/data/emailProcessingJobs";
describe("DAL — emailProcessingJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder, maybeSingle: mockMaybeSingle });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });
  it("lists email processing jobs", async () => {
    const jobs = [{ id: "j1" }];
    mockLimit.mockResolvedValue({ data: jobs, error: null });
    const r = await listEmailProcessingJobs();
    expect(r).toEqual(jobs);
  });
  it("gets single job", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "j1" }, error: null });
    const r = await getEmailProcessingJob("j1");
    expect(r).toEqual({ id: "j1" });
  });
  it("returns null when not found", async () => {
    const r = await getEmailProcessingJob("j99");
    expect(r).toBeNull();
  });
});
