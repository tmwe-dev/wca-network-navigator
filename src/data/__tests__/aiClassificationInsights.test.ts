/**
 * DAL — aiClassificationInsights module tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let mockResult: { data?: any; count?: number | null; error: any };

const builder: Record<string, any> = {};
builder.select = vi.fn().mockReturnValue(builder);
builder.eq = vi.fn().mockReturnValue(builder);
builder.order = vi.fn().mockReturnValue(builder);
builder.limit = vi.fn().mockImplementation(() => mockResult);
builder.update = vi.fn().mockReturnValue(builder);

vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: () => builder,
}));

import {
  listClassificationInsights,
  countPendingInsights,
  rejectInsight,
  updateInsightDraft,
} from "@/data/aiClassificationInsights";

describe("DAL — aiClassificationInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResult = { data: null, count: null, error: null };
  });

  describe("listClassificationInsights", () => {
    it("returns insights filtered by status", async () => {
      const rows = [{ id: "i1", status: "pending" }];
      mockResult = { data: rows, error: null };
      const result = await listClassificationInsights("pending");
      expect(builder.select).toHaveBeenCalledWith("*");
      expect(builder.eq).toHaveBeenCalledWith("status", "pending");
      expect(result).toEqual(rows);
    });

    it("throws on error", async () => {
      mockResult = { data: null, error: { message: "timeout" } };
      await expect(listClassificationInsights()).rejects.toEqual({ message: "timeout" });
    });

    it("returns empty array when data is null", async () => {
      mockResult = { data: null, error: null };
      const result = await listClassificationInsights();
      expect(result).toEqual([]);
    });
  });

  describe("countPendingInsights", () => {
    it("returns count of pending insights", async () => {
      // For count queries, select returns the result directly (no chaining to limit)
      builder.select = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ count: 7, error: null }),
      });
      const result = await countPendingInsights();
      expect(result).toBe(7);
    });

    it("returns 0 when count is null", async () => {
      builder.select = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ count: null, error: null }),
      });
      const result = await countPendingInsights();
      expect(result).toBe(0);
    });

    it("throws on error", async () => {
      builder.select = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ count: null, error: { message: "denied" } }),
      });
      await expect(countPendingInsights()).rejects.toEqual({ message: "denied" });
    });
  });

  describe("rejectInsight", () => {
    it("updates status to rejected", async () => {
      // Reset builder for update chain
      builder.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ error: null }),
      });
      await rejectInsight("i1", "not relevant");
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "rejected", rejection_reason: "not relevant" })
      );
    });

    it("throws on error", async () => {
      builder.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ error: { message: "not found" } }),
      });
      await expect(rejectInsight("bad")).rejects.toEqual({ message: "not found" });
    });
  });

  describe("updateInsightDraft", () => {
    it("updates draft text", async () => {
      builder.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ error: null }),
      });
      await updateInsightDraft("i1", { proposed_change_text: "new text" });
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ proposed_change_text: "new text" })
      );
    });

    it("throws on error", async () => {
      builder.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ error: { message: "rls" } }),
      });
      await expect(
        updateInsightDraft("i1", { user_note: "note" })
      ).rejects.toEqual({ message: "rls" });
    });
  });
});
