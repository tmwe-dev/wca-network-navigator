/**
 * DAL — funnemailJobs module tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { listFunnemailJobs, getFunnemailJob } from "@/data/funnemailJobs";

describe("DAL — funnemailJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle, order: mockOrder, eq: mockEq });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  describe("listFunnemailJobs", () => {
    it("returns jobs list", async () => {
      const jobs = [{ message_id: "m1", status: "done" }];
      mockLimit.mockResolvedValue({ data: jobs, error: null });
      const result = await listFunnemailJobs();
      expect(mockFrom).toHaveBeenCalledWith("funnemail_jobs");
      expect(result).toEqual(jobs);
    });
  });

  describe("getFunnemailJob", () => {
    it("returns single job", async () => {
      const job = { message_id: "m1", status: "processing" };
      mockMaybeSingle.mockResolvedValue({ data: job, error: null });
      const result = await getFunnemailJob("m1");
      expect(result).toEqual(job);
    });

    it("returns null when not found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await getFunnemailJob("m999");
      expect(result).toBeNull();
    });
  });
});
