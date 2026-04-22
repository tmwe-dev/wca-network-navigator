/**
 * Unit Tests — Deals & Pipeline Management
 * Comprehensive tests for CRUD operations, filtering, stats, and activity logging.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  getDealsByStage,
  getDealStats,
  logDealActivity,
  getDealActivities,
  type Deal,
  type DealActivity,
  type DealWithRelations,
  type DealStats,
  type DealFilters,
} from "@/data/deals";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";

const mockSupabase = supabase as any;

// ─── Test Data ──────────────────────────────────────────
const mockDeal: Deal = {
  id: "deal-1",
  user_id: "user-1",
  partner_id: "partner-1",
  contact_id: "contact-1",
  title: "Enterprise Deal",
  description: "High-value partnership opportunity",
  stage: "proposal",
  amount: 50000,
  currency: "USD",
  probability: 60,
  expected_close_date: "2026-05-15",
  actual_close_date: null,
  lost_reason: null,
  tags: ["enterprise", "technical"],
  metadata: { source: "inbound", priority: "high" },
  created_at: "2026-04-01T10:00:00Z",
  updated_at: "2026-04-22T10:00:00Z",
};

const mockDealWithRelations: DealWithRelations = {
  ...mockDeal,
  partner: { company_name: "TechCorp", country_code: "US" },
  contact: { name: "John Doe", email: "john@example.com", mobile: "+1234567890" },
};

const mockDealActivity: DealActivity = {
  id: "activity-1",
  deal_id: "deal-1",
  user_id: "user-1",
  activity_type: "stage_change",
  description: "Moved from lead to proposal",
  old_value: "lead",
  new_value: "proposal",
  created_at: "2026-04-22T10:00:00Z",
};

// ─── Test Suite ─────────────────────────────────────────
describe("Deals Data Access Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── listDeals Tests ────────────────────────────────────
  describe("listDeals", () => {
    it("should fetch all deals for a user", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: [mockDealWithRelations], error: null });

      const result = await listDeals("user-1");

      expect(result).toEqual([mockDealWithRelations]);
      expect(mockSupabase.from).toHaveBeenCalledWith("deals");
    });

    it("should return empty array when no deals exist", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: null, error: null });

      const result = await listDeals("user-1");

      expect(result).toEqual([]);
    });

    it("should filter deals by stage", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: [mockDealWithRelations], error: null });

      const filters: DealFilters = { stage: "proposal" };
      const result = await listDeals("user-1", filters);

      expect(result).toEqual([mockDealWithRelations]);
      expect(mockQuery.in).toHaveBeenCalledWith("stage", ["proposal"]);
    });

    it("should filter deals by multiple stages", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: [mockDealWithRelations], error: null });

      const filters: DealFilters = { stage: ["proposal", "negotiation"] };
      const result = await listDeals("user-1", filters);

      expect(mockQuery.in).toHaveBeenCalledWith("stage", ["proposal", "negotiation"]);
    });

    it("should filter deals by amount range", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: [mockDealWithRelations], error: null });

      const filters: DealFilters = { minAmount: 10000, maxAmount: 100000 };
      const result = await listDeals("user-1", filters);

      expect(mockQuery.gte).toHaveBeenCalledWith("amount", 10000);
      expect(mockQuery.lte).toHaveBeenCalledWith("amount", 100000);
    });

    it("should throw error on query failure", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);
      const testError = new Error("Database error");
      mockQuery.select.mockResolvedValue({ data: null, error: testError });

      await expect(listDeals("user-1")).rejects.toThrow("Database error");
    });
  });

  // ─── getDeal Tests ──────────────────────────────────────
  describe("getDeal", () => {
    it("should fetch a single deal by id", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDealWithRelations, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getDeal("deal-1");

      expect(result).toEqual(mockDealWithRelations);
      expect(mockSupabase.from).toHaveBeenCalledWith("deals");
    });

    it("should return null when deal not found", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getDeal("nonexistent-id");

      expect(result).toBeNull();
    });

    it("should throw error on non-404 errors", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST999", message: "Database error" } }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(getDeal("deal-1")).rejects.toThrow();
    });
  });

  // ─── createDeal Tests ───────────────────────────────────
  describe("createDeal", () => {
    it("should create a new deal", async () => {
      const { id, user_id, created_at, updated_at, ...dealWithoutMeta } = mockDeal;
      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDeal, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await createDeal("user-1", dealWithoutMeta);

      expect(result).toEqual(mockDeal);
      expect(mockQuery.insert).toHaveBeenCalledWith([expect.objectContaining({ user_id: "user-1" })]);
    });

    it("should include all deal fields when creating", async () => {
      const { id, user_id, created_at, updated_at, ...dealData } = mockDeal;
      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDeal, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await createDeal("user-1", dealData);

      const insertedData = mockQuery.insert.mock.calls[0][0][0];
      expect(insertedData).toMatchObject({
        user_id: "user-1",
        title: mockDeal.title,
        amount: mockDeal.amount,
        stage: mockDeal.stage,
      });
    });

    it("should throw error on creation failure", async () => {
      const { id, user_id, created_at, updated_at, ...dealData } = mockDeal;
      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error("Insert failed") }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(createDeal("user-1", dealData)).rejects.toThrow("Insert failed");
    });
  });

  // ─── updateDeal Tests ───────────────────────────────────
  describe("updateDeal", () => {
    it("should update a deal", async () => {
      const mockQuerySelect = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDealWithRelations, error: null }),
      };

      const mockQueryUpdate = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockDeal, title: "Updated Title" },
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === "deals") {
          const isSelectCall = mockQuery.select !== undefined;
          return isSelectCall ? mockQuerySelect : mockQueryUpdate;
        }
        return mockQueryUpdate;
      });

      const mockQuery = mockQuerySelect;
      mockSupabase.from.mockReturnValueOnce(mockQuerySelect).mockReturnValueOnce(mockQueryUpdate);

      const result = await updateDeal("deal-1", { title: "Updated Title" });

      expect(result.title).toBe("Updated Title");
    });

    it("should log stage changes", async () => {
      const mockQuerySelect = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDealWithRelations, error: null }),
      };

      const mockQueryUpdate = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockDeal, stage: "negotiation" },
          error: null,
        }),
      };

      const mockQueryActivity = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDealActivity, error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table) => {
        callCount++;
        if (callCount === 1) return mockQuerySelect;
        if (callCount === 2) return mockQueryUpdate;
        return mockQueryActivity;
      });

      await updateDeal("deal-1", { stage: "negotiation" });

      expect(mockQueryActivity.insert).toHaveBeenCalled();
    });

    it("should not log stage changes when stage is unchanged", async () => {
      const mockQuerySelect = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDealWithRelations, error: null }),
      };

      const mockQueryUpdate = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDeal, error: null }),
      };

      mockSupabase.from.mockReturnValueOnce(mockQuerySelect).mockReturnValueOnce(mockQueryUpdate);

      await updateDeal("deal-1", { amount: 60000 });

      expect(mockQueryUpdate.update).toHaveBeenCalled();
    });
  });

  // ─── deleteDeal Tests ───────────────────────────────────
  describe("deleteDeal", () => {
    it("should delete a deal", async () => {
      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(deleteDeal("deal-1")).resolves.toBeUndefined();

      expect(mockQuery.delete).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith("id", "deal-1");
    });

    it("should throw error on deletion failure", async () => {
      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: new Error("Delete failed") }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(deleteDeal("deal-1")).rejects.toThrow("Delete failed");
    });
  });

  // ─── getDealsByStage Tests ──────────────────────────────
  describe("getDealsByStage", () => {
    it("should group deals by stage", async () => {
      const deals: DealWithRelations[] = [
        { ...mockDealWithRelations, stage: "lead", amount: 10000 },
        { ...mockDealWithRelations, stage: "lead", amount: 20000 },
        { ...mockDealWithRelations, stage: "proposal", amount: 50000 },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: deals, error: null });

      const result = await getDealsByStage("user-1");

      expect(result.get("lead")).toEqual({
        deals: deals.filter((d) => d.stage === "lead"),
        count: 2,
        value: 30000,
      });

      expect(result.get("proposal")).toEqual({
        deals: deals.filter((d) => d.stage === "proposal"),
        count: 1,
        value: 50000,
      });
    });

    it("should include all stages even without deals", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const result = await getDealsByStage("user-1");

      expect(result.has("lead")).toBe(true);
      expect(result.has("qualified")).toBe(true);
      expect(result.has("proposal")).toBe(true);
      expect(result.has("negotiation")).toBe(true);
      expect(result.has("won")).toBe(true);
      expect(result.has("lost")).toBe(true);
    });
  });

  // ─── getDealStats Tests ─────────────────────────────────
  describe("getDealStats", () => {
    it("should calculate correct pipeline statistics", async () => {
      const deals: DealWithRelations[] = [
        { ...mockDealWithRelations, stage: "won", amount: 100000, probability: 100 },
        { ...mockDealWithRelations, stage: "lost", amount: 50000, probability: 0 },
        { ...mockDealWithRelations, stage: "proposal", amount: 30000, probability: 50 },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: deals, error: null });

      const stats = await getDealStats("user-1");

      expect(stats).toMatchObject({
        totalPipelineValue: 30000, // excludes won and lost
        dealsByStage: expect.any(Array),
        winRate: 50, // 1 won / 2 closed
      });
    });

    it("should calculate weighted forecast correctly", async () => {
      const deals: DealWithRelations[] = [
        { ...mockDealWithRelations, stage: "proposal", amount: 100000, probability: 50 },
        { ...mockDealWithRelations, stage: "negotiation", amount: 50000, probability: 75 },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: deals, error: null });

      const stats = await getDealStats("user-1");

      // (100000 * 50) / 100 + (50000 * 75) / 100 = 50000 + 37500 = 87500
      expect(stats.weightedForecast).toBe(87500);
    });

    it("should handle empty deals list", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const stats = await getDealStats("user-1");

      expect(stats.totalPipelineValue).toBe(0);
      expect(stats.weightedForecast).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.avgDealSize).toBe(0);
    });

    it("should return correct average deal size", async () => {
      const deals: DealWithRelations[] = [
        { ...mockDealWithRelations, amount: 50000 },
        { ...mockDealWithRelations, amount: 75000 },
        { ...mockDealWithRelations, amount: 25000 },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: deals, error: null });

      const stats = await getDealStats("user-1");

      expect(stats.avgDealSize).toBe(50000); // (50000 + 75000 + 25000) / 3
    });
  });

  // ─── Activity Logging Tests ──────────────────────────────
  describe("logDealActivity", () => {
    it("should log a deal activity", async () => {
      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDealActivity, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await logDealActivity("deal-1", "user-1", "stage_change", "Moved to proposal");

      expect(result).toEqual(mockDealActivity);
      expect(mockQuery.insert).toHaveBeenCalled();
    });

    it("should include old and new values in activity log", async () => {
      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDealActivity, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await logDealActivity("deal-1", "user-1", "stage_change", "Stage changed", "lead", "proposal");

      const insertedData = mockQuery.insert.mock.calls[0][0][0];
      expect(insertedData).toMatchObject({
        old_value: "lead",
        new_value: "proposal",
      });
    });
  });

  // ─── getDealActivities Tests ────────────────────────────
  describe("getDealActivities", () => {
    it("should fetch deal activities", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [mockDealActivity], error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getDealActivities("deal-1");

      expect(result).toEqual([mockDealActivity]);
      expect(mockQuery.limit).toHaveBeenCalledWith(50); // default limit
    });

    it("should respect custom limit", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [mockDealActivity], error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await getDealActivities("deal-1", 100);

      expect(mockQuery.limit).toHaveBeenCalledWith(100);
    });

    it("should return empty array when no activities exist", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getDealActivities("deal-1");

      expect(result).toEqual([]);
    });

    it("should throw error on query failure", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: new Error("Query failed") }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(getDealActivities("deal-1")).rejects.toThrow("Query failed");
    });
  });
});
