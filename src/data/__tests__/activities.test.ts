import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));
vi.mock("@/lib/queryKeys", () => ({
  queryKeys: { crm: { activities: { all: ["activities"] } } },
}));

import { fetchActivities, createActivity, updateActivity, getActivityById } from "@/data/activities";

describe("DAL — activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockEq.mockReturnValue({ order: mockOrder, maybeSingle: mockMaybeSingle, eq: mockEq });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  describe("fetchActivities", () => {
    it("returns activities for partner", async () => {
      const acts = [{ id: "a1", title: "Call" }];
      mockLimit.mockResolvedValue({ data: acts, error: null });
      const result = await fetchActivities("partner-1");
      expect(mockFrom).toHaveBeenCalledWith("activities");
      expect(result).toEqual(acts);
    });

    it("returns empty on null", async () => {
      mockLimit.mockResolvedValue({ data: null, error: null });
      const result = await fetchActivities("p1");
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockLimit.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(fetchActivities("p1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("getActivityById", () => {
    it("returns single activity", async () => {
      const act = { id: "a1", title: "Call" };
      mockMaybeSingle.mockResolvedValue({ data: act, error: null });
      const result = await getActivityById("a1");
      expect(result).toEqual(act);
    });

    it("returns null when not found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await getActivityById("missing");
      expect(result).toBeNull();
    });
  });
});
