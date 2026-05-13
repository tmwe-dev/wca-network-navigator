import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { listRecentE2ERuns, getLatestE2ERun } from "@/data/e2eRuns";

describe("DAL — e2eRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  describe("listRecentE2ERuns", () => {
    it("returns recent runs", async () => {
      const runs = [{ id: "r1", passed: 10 }];
      mockLimit.mockResolvedValue({ data: runs, error: null });
      const result = await listRecentE2ERuns();
      expect(result).toEqual(runs);
    });

    it("returns empty on null data", async () => {
      mockLimit.mockResolvedValue({ data: null, error: null });
      const result = await listRecentE2ERuns();
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockLimit.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(listRecentE2ERuns()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("getLatestE2ERun", () => {
    it("returns latest run", async () => {
      mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockMaybeSingle.mockResolvedValue({ data: { id: "r1" }, error: null });
      const result = await getLatestE2ERun();
      expect(result).toEqual({ id: "r1" });
    });

    it("returns null when no runs", async () => {
      mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await getLatestE2ERun();
      expect(result).toBeNull();
    });

    it("throws on error", async () => {
      mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(getLatestE2ERun()).rejects.toEqual({ message: "fail" });
    });
  });
});
