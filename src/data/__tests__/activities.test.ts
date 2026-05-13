import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const _mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockIn = vi.fn();
const mockIs = vi.fn();
const mockNot = vi.fn();
const mockOr = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));
vi.mock("@/lib/queryKeys", () => ({
  queryKeys: { activities: { all: ["activities"] } },
}));

import {
  findActivitiesForPartner,
  findAllActivities,
  createActivities,
  updateActivity,
  deleteActivities,
  insertActivity,
  countActivitiesWithNullPartner,
  approveActivity,
  updateActivityDepartment,
} from "@/data/activities";

describe("DAL — activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: () => ({ in: mockIn, eq: mockEq }),
    });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder, is: mockIs });
    mockEq.mockReturnValue({ order: mockOrder, eq: mockEq, select: mockSelect });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockIn.mockResolvedValue({ error: null });
    mockIs.mockResolvedValue({ count: 0, error: null });
    mockNot.mockReturnValue({ or: mockOr });
    mockOr.mockReturnValue({ order: mockOrder });
  });

  describe("findActivitiesForPartner", () => {
    it("returns activities for partner", async () => {
      const acts = [{ id: "a1", title: "Call" }];
      mockLimit.mockResolvedValue({ data: acts, error: null });
      const result = await findActivitiesForPartner("partner-1");
      expect(mockFrom).toHaveBeenCalledWith("activities");
      expect(result).toEqual(acts);
    });

    it("throws on error", async () => {
      mockLimit.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(findActivitiesForPartner("p1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("findAllActivities", () => {
    it("returns all activities", async () => {
      const acts = [{ id: "a1" }];
      mockLimit.mockResolvedValue({ data: acts, error: null });
      const result = await findAllActivities();
      expect(result).toEqual(acts);
    });

    it("returns empty array on null data", async () => {
      mockLimit.mockResolvedValue({ data: null, error: null });
      const result = await findAllActivities();
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockLimit.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(findAllActivities()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("createActivities", () => {
    it("inserts activities and returns data", async () => {
      const returned = [{ id: "a1" }];
      mockSelect.mockResolvedValue({ data: returned, error: null });
      const result = await createActivities([{ activity_type: "phone_call", title: "Call" }]);
      expect(mockFrom).toHaveBeenCalledWith("activities");
      expect(result).toEqual(returned);
    });

    it("throws on insert error", async () => {
      mockSelect.mockResolvedValue({ data: null, error: { message: "dup" } });
      await expect(createActivities([{ activity_type: "phone_call", title: "Call" }])).rejects.toEqual({
        message: "dup",
      });
    });
  });

  describe("updateActivity", () => {
    it("updates activity by id", async () => {
      mockEq.mockResolvedValue({ error: null });
      await updateActivity("a1", { status: "completed" });
      expect(mockFrom).toHaveBeenCalledWith("activities");
    });

    it("throws on update error", async () => {
      mockEq.mockResolvedValue({ error: { message: "not found" } });
      await expect(updateActivity("a1", { status: "completed" })).rejects.toEqual({ message: "not found" });
    });
  });

  describe("deleteActivities", () => {
    it("returns 0 for empty ids", async () => {
      const result = await deleteActivities([]);
      expect(result).toBe(0);
    });

    it("deletes and returns count", async () => {
      mockIn.mockResolvedValue({ error: null });
      const result = await deleteActivities(["a1", "a2"]);
      expect(result).toBe(2);
    });

    it("throws on delete error", async () => {
      mockIn.mockResolvedValue({ error: { message: "fail" } });
      await expect(deleteActivities(["a1"])).rejects.toEqual({ message: "fail" });
    });
  });

  describe("insertActivity", () => {
    it("inserts single activity", async () => {
      mockInsert.mockResolvedValue({ error: null });
      await insertActivity({ partner_id: "p1", activity_type: "phone_call", title: "Call" } as never);
      expect(mockFrom).toHaveBeenCalledWith("activities");
    });

    it("throws on insert error", async () => {
      mockInsert.mockResolvedValue({ error: { message: "fail" } });
      await expect(
        insertActivity({ partner_id: "p1", activity_type: "phone_call", title: "X" } as never),
      ).rejects.toEqual({ message: "fail" });
    });
  });

  describe("countActivitiesWithNullPartner", () => {
    it("returns count", async () => {
      mockIs.mockResolvedValue({ count: 5, error: null });
      const result = await countActivitiesWithNullPartner();
      expect(result).toBe(5);
    });

    it("throws on error", async () => {
      mockIs.mockResolvedValue({ count: null, error: { message: "fail" } });
      await expect(countActivitiesWithNullPartner()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("approveActivity", () => {
    it("approves activity", async () => {
      mockEq.mockResolvedValue({ error: null });
      await approveActivity("a1");
      expect(mockFrom).toHaveBeenCalledWith("activities");
    });

    it("throws on error", async () => {
      mockEq.mockResolvedValue({ error: { message: "fail" } });
      await expect(approveActivity("a1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("updateActivityDepartment", () => {
    it("updates department", async () => {
      mockEq.mockResolvedValue({ error: null });
      await updateActivityDepartment("a1", "commercial");
      expect(mockFrom).toHaveBeenCalledWith("activities");
    });

    it("throws on error", async () => {
      mockEq.mockResolvedValue({ error: { message: "fail" } });
      await expect(updateActivityDepartment("a1", "commercial")).rejects.toEqual({ message: "fail" });
    });
  });
});
