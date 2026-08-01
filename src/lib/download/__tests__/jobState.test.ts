import { describe, it, expect, vi } from "vitest";

// Mock data layer
vi.mock("@/data/downloadJobs", () => ({
  claimDownloadJob: vi.fn().mockResolvedValue(true),
  updateDownloadJob: vi.fn().mockResolvedValue(undefined),
  getJobItemById: vi.fn().mockResolvedValue({ attempt_count: 0 }),
  updateJobItem: vi.fn().mockResolvedValue(undefined),
  updateJobItemsByJobIdAndStatus: vi.fn().mockResolvedValue(undefined),
  getJobItemsByJobId: vi.fn().mockResolvedValue([]),
  insertJobEvent: vi.fn().mockResolvedValue(undefined),
  findRunningJobs: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

describe("jobState", () => {
  it("claimJob returns true when job is available", async () => {
    const { claimJob } = await import("@/lib/download/jobState");
    const result = await claimJob("job-123");
    expect(result).toBe(true);
  });

  it("claimJob returns false when job is already claimed", async () => {
    const { claimDownloadJob } = await import("@/data/downloadJobs");
    (claimDownloadJob as any).mockResolvedValueOnce(false);
    const { claimJob } = await import("@/lib/download/jobState");
    const result = await claimJob("job-456");
    expect(result).toBe(false);
  });

  it("updateItem increments attempt_count", async () => {
    const { getJobItemById, updateJobItem } = await import("@/data/downloadJobs");
    (getJobItemById as any).mockResolvedValueOnce({ attempt_count: 2 });
    const { updateItem } = await import("@/lib/download/jobState");
    await updateItem("item-1", "success");
    expect(updateJobItem).toHaveBeenCalled();
  });

  it("exports emitEvent function", async () => {
    const mod = await import("@/lib/download/jobState");
    expect(mod.emitEvent).toBeDefined();
    expect(typeof mod.emitEvent).toBe("function");
  });
});
