import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (fn: string, args?: unknown) => mockRpc(fn, args) },
}));

import { listCronJobStatus, listCronRecentRuns } from "@/data/cronJobs";

describe("DAL — cronJobs", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("listCronJobStatus", () => {
    it("returns job status array", async () => {
      const jobs = [{ jobname: "test", schedule: "* * * * *", active: true }];
      mockRpc.mockResolvedValue({ data: jobs, error: null });
      const result = await listCronJobStatus();
      expect(result).toEqual(jobs);
    });

    it("returns empty array on error", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "fail" } });
      const result = await listCronJobStatus();
      expect(result).toEqual([]);
    });

    it("returns empty array when data null", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });
      const result = await listCronJobStatus();
      expect(result).toEqual([]);
    });
  });

  describe("listCronRecentRuns", () => {
    it("returns runs with default limit", async () => {
      const runs = [{ jobid: 1, status: "succeeded" }];
      mockRpc.mockResolvedValue({ data: runs, error: null });
      const result = await listCronRecentRuns();
      expect(result).toEqual(runs);
    });

    it("returns empty on error", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "x" } });
      const result = await listCronRecentRuns(10);
      expect(result).toEqual([]);
    });
  });
});
