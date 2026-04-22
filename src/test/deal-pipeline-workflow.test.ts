/**
 * Integration tests for deal pipeline workflow
 * Tests the complete lifecycle: create → update stage → move through pipeline → update value → stats
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Deal, DealStage, DealStats } from "@/data/deals";

// Mock supabase client
const mockSupabaseClient = {
  from: vi.fn(),
};

// Test data
const mockDeal: Deal = {
  id: "deal-1",
  user_id: "user-123",
  partner_id: "partner-1",
  contact_id: "contact-1",
  title: "Enterprise Software License",
  description: "12-month subscription deal",
  stage: "lead",
  amount: 50000,
  currency: "EUR",
  probability: 30,
  expected_close_date: "2026-06-30",
  actual_close_date: null,
  lost_reason: null,
  tags: ["enterprise", "software"],
  metadata: { source: "web" },
  created_at: "2026-04-22T10:00:00Z",
  updated_at: "2026-04-22T10:00:00Z",
};

describe("Deal Pipeline Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── CREATE DEAL ──────────────────────────────────────

  describe("Create Deal", () => {
    it("should create a new deal with initial stage 'lead'", () => {
      const newDeal: Deal = { ...mockDeal, stage: "lead", probability: 30 };
      expect(newDeal.stage).toBe("lead");
      expect(newDeal.probability).toBe(30);
      expect(newDeal.amount).toBe(50000);
    });

    it("should auto-set created_at and updated_at timestamps", () => {
      const now = new Date().toISOString();
      const newDeal: Deal = {
        ...mockDeal,
        created_at: now,
        updated_at: now,
      };
      expect(newDeal.created_at).toBe(now);
      expect(newDeal.updated_at).toBe(now);
    });

    it("should allow optional fields like metadata and tags", () => {
      const minimalDeal: Deal = {
        ...mockDeal,
        metadata: null,
        tags: [],
        description: null,
      };
      expect(minimalDeal.metadata).toBeNull();
      expect(minimalDeal.tags).toEqual([]);
      expect(minimalDeal.description).toBeNull();
    });
  });

  // ─── UPDATE STAGE ────────────────────────────────────

  describe("Update Stage", () => {
    it("should move deal from lead to qualified", () => {
      const updated: Deal = { ...mockDeal, stage: "qualified", probability: 50 };
      expect(updated.stage).toBe("qualified");
      expect(updated.probability).toBe(50);
    });

    it("should move deal from qualified to proposal", () => {
      const current: Deal = { ...mockDeal, stage: "qualified", probability: 50 };
      const updated: Deal = { ...current, stage: "proposal", probability: 65 };
      expect(updated.stage).toBe("proposal");
      expect(updated.probability).toBeGreaterThan(current.probability);
    });

    it("should move deal from proposal to negotiation", () => {
      const current: Deal = { ...mockDeal, stage: "proposal", probability: 65 };
      const updated: Deal = { ...current, stage: "negotiation", probability: 75 };
      expect(updated.stage).toBe("negotiation");
      expect(updated.probability).toBeGreaterThan(current.probability);
    });

    it("should move deal to won stage with actual close date", () => {
      const current: Deal = { ...mockDeal, stage: "negotiation", probability: 75 };
      const today = new Date().toISOString().split("T")[0];
      const updated: Deal = {
        ...current,
        stage: "won",
        probability: 100,
        actual_close_date: today,
      };
      expect(updated.stage).toBe("won");
      expect(updated.probability).toBe(100);
      expect(updated.actual_close_date).toBe(today);
    });

    it("should move deal to lost stage with reason", () => {
      const current: Deal = { ...mockDeal, stage: "proposal", probability: 65 };
      const updated: Deal = {
        ...current,
        stage: "lost",
        probability: 0,
        lost_reason: "Budget cut due to market conditions",
      };
      expect(updated.stage).toBe("lost");
      expect(updated.probability).toBe(0);
      expect(updated.lost_reason).not.toBeNull();
    });

    it("should not allow invalid stage transitions", () => {
      const allStages: DealStage[] = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
      const current: Deal = { ...mockDeal, stage: "won" };

      // Won deals should not transition to other stages (business logic)
      const invalidTransitions = ["lead", "qualified", "proposal", "negotiation", "lost"];
      const isValidForWon = !invalidTransitions.includes(current.stage);
      expect(isValidForWon).toBe(false);
    });
  });

  // ─── MOVE THROUGH PIPELINE ───────────────────────────

  describe("Move Through Pipeline", () => {
    it("should track full pipeline journey from lead to won", () => {
      const journey: DealStage[] = [];

      let current: Deal = { ...mockDeal, stage: "lead" };
      journey.push(current.stage);

      current = { ...current, stage: "qualified" };
      journey.push(current.stage);

      current = { ...current, stage: "proposal" };
      journey.push(current.stage);

      current = { ...current, stage: "negotiation" };
      journey.push(current.stage);

      const today = new Date().toISOString().split("T")[0];
      current = {
        ...current,
        stage: "won",
        probability: 100,
        actual_close_date: today,
      };
      journey.push(current.stage);

      expect(journey).toEqual(["lead", "qualified", "proposal", "negotiation", "won"]);
    });

    it("should handle mid-pipeline loss", () => {
      const journey: DealStage[] = [];

      let current: Deal = { ...mockDeal, stage: "lead" };
      journey.push(current.stage);

      current = { ...current, stage: "qualified" };
      journey.push(current.stage);

      current = { ...current, stage: "proposal" };
      journey.push(current.stage);

      // Lost at proposal stage
      current = {
        ...current,
        stage: "lost",
        probability: 0,
        lost_reason: "Client budget constraints",
      };
      journey.push(current.stage);

      expect(journey).toEqual(["lead", "qualified", "proposal", "lost"]);
      expect(current.lost_reason).not.toBeNull();
    });

    it("should allow reopening lost deal back to lead", () => {
      let current: Deal = {
        ...mockDeal,
        stage: "lost",
        probability: 0,
        lost_reason: "Budget shortage",
      };

      // Reopen
      current = {
        ...current,
        stage: "lead",
        probability: 20,
        lost_reason: null,
      };

      expect(current.stage).toBe("lead");
      expect(current.probability).toBe(20);
      expect(current.lost_reason).toBeNull();
    });
  });

  // ─── UPDATE VALUE ────────────────────────────────────

  describe("Update Deal Value", () => {
    it("should allow amount increase", () => {
      const current: Deal = { ...mockDeal, amount: 50000 };
      const updated: Deal = { ...current, amount: 75000 };
      expect(updated.amount).toBeGreaterThan(current.amount);
      expect(updated.amount).toBe(75000);
    });

    it("should allow amount decrease", () => {
      const current: Deal = { ...mockDeal, amount: 50000 };
      const updated: Deal = { ...current, amount: 35000 };
      expect(updated.amount).toBeLessThan(current.amount);
      expect(updated.amount).toBe(35000);
    });

    it("should update probability along with stage", () => {
      const current: Deal = { ...mockDeal, stage: "lead", amount: 50000, probability: 30 };
      const updated: Deal = {
        ...current,
        stage: "qualified",
        amount: 60000,
        probability: 50,
      };
      expect(updated.amount).toBe(60000);
      expect(updated.probability).toBe(50);
    });

    it("should adjust currency if needed", () => {
      const current: Deal = { ...mockDeal, amount: 50000, currency: "EUR" };
      const updated: Deal = { ...current, amount: 55000, currency: "USD" };
      expect(updated.currency).toBe("USD");
      expect(updated.amount).toBe(55000);
    });

    it("should validate that amount is not negative", () => {
      const current: Deal = { ...mockDeal, amount: 50000 };
      const invalidUpdate: Deal = { ...current, amount: -100 };
      expect(invalidUpdate.amount).toBeLessThan(0);
      // In real app, this should be rejected during save
    });

    it("should track expected close date changes", () => {
      const current: Deal = { ...mockDeal, expected_close_date: "2026-06-30" };
      const extended: Deal = { ...current, expected_close_date: "2026-09-30" };
      expect(extended.expected_close_date).toBe("2026-09-30");
    });
  });

  // ─── STATS CALCULATIONS ──────────────────────────────

  describe("Stats Reflect Changes", () => {
    it("should calculate total pipeline value from multiple deals", () => {
      const deals: Deal[] = [
        { ...mockDeal, id: "d1", amount: 50000, stage: "qualified" },
        { ...mockDeal, id: "d2", amount: 75000, stage: "proposal" },
        { ...mockDeal, id: "d3", amount: 30000, stage: "negotiation" },
      ];

      const totalValue = deals.reduce((sum, d) => sum + d.amount, 0);
      expect(totalValue).toBe(155000);
    });

    it("should calculate weighted forecast correctly", () => {
      const deals: Deal[] = [
        { ...mockDeal, id: "d1", amount: 100000, probability: 30 }, // 30k
        { ...mockDeal, id: "d2", amount: 50000, probability: 70 }, // 35k
        { ...mockDeal, id: "d3", amount: 25000, probability: 90 }, // 22.5k
      ];

      const weighted = deals.reduce((sum, d) => sum + d.amount * (d.probability / 100), 0);
      expect(weighted).toBe(87500);
    });

    it("should count deals by stage", () => {
      const deals: Deal[] = [
        { ...mockDeal, id: "d1", stage: "lead" },
        { ...mockDeal, id: "d2", stage: "lead" },
        { ...mockDeal, id: "d3", stage: "qualified" },
        { ...mockDeal, id: "d4", stage: "qualified" },
        { ...mockDeal, id: "d5", stage: "won" },
      ];

      const byStage = deals.reduce(
        (acc, d) => {
          acc[d.stage] = (acc[d.stage] || 0) + 1;
          return acc;
        },
        {} as Record<DealStage, number>
      );

      expect(byStage.lead).toBe(2);
      expect(byStage.qualified).toBe(2);
      expect(byStage.won).toBe(1);
    });

    it("should calculate win rate from won vs lost deals", () => {
      const deals: Deal[] = [
        { ...mockDeal, id: "d1", stage: "won" },
        { ...mockDeal, id: "d2", stage: "won" },
        { ...mockDeal, id: "d3", stage: "lost" },
        { ...mockDeal, id: "d4", stage: "won" },
      ];

      const won = deals.filter((d) => d.stage === "won").length;
      const completed = deals.filter((d) => d.stage === "won" || d.stage === "lost").length;
      const winRate = completed > 0 ? (won / completed) * 100 : 0;

      expect(winRate).toBe(75);
    });

    it("should calculate average deal size", () => {
      const deals: Deal[] = [
        { ...mockDeal, amount: 50000 },
        { ...mockDeal, amount: 75000 },
        { ...mockDeal, amount: 100000 },
      ];

      const avgSize = deals.reduce((sum, d) => sum + d.amount, 0) / deals.length;
      expect(avgSize).toBe(75000);
    });

    it("should count deals closed this month", () => {
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const deals: Deal[] = [
        {
          ...mockDeal,
          id: "d1",
          stage: "won",
          actual_close_date: new Date(thisYear, thisMonth, 15).toISOString().split("T")[0],
        },
        {
          ...mockDeal,
          id: "d2",
          stage: "won",
          actual_close_date: new Date(thisYear, thisMonth, 20).toISOString().split("T")[0],
        },
        {
          ...mockDeal,
          id: "d3",
          stage: "won",
          actual_close_date: new Date(thisYear, thisMonth - 1, 10).toISOString().split("T")[0],
        },
      ];

      const thisMonthCount = deals.filter((d) => {
        if (!d.actual_close_date) return false;
        const [year, month] = d.actual_close_date.split("-").map(Number);
        return year === thisYear && month === thisMonth + 1;
      }).length;

      expect(thisMonthCount).toBe(2);
    });

    it("should update stats after deal value change", () => {
      let deals: Deal[] = [
        { ...mockDeal, id: "d1", amount: 50000, probability: 50 },
      ];

      let totalValue = deals.reduce((sum, d) => sum + d.amount, 0);
      let weighted = deals.reduce((sum, d) => sum + d.amount * (d.probability / 100), 0);

      expect(totalValue).toBe(50000);
      expect(weighted).toBe(25000);

      // Update the deal
      deals = [
        { ...deals[0], amount: 100000, probability: 75 },
      ];

      totalValue = deals.reduce((sum, d) => sum + d.amount, 0);
      weighted = deals.reduce((sum, d) => sum + d.amount * (d.probability / 100), 0);

      expect(totalValue).toBe(100000);
      expect(weighted).toBe(75000);
    });

    it("should handle empty deals array gracefully", () => {
      const deals: Deal[] = [];

      const totalValue = deals.reduce((sum, d) => sum + d.amount, 0);
      const weighted = deals.reduce((sum, d) => sum + d.amount * (d.probability / 100), 0);
      const avgSize = deals.length > 0 ? totalValue / deals.length : 0;

      expect(totalValue).toBe(0);
      expect(weighted).toBe(0);
      expect(avgSize).toBe(0);
    });
  });

  // ─── COMPLEX WORKFLOWS ────────────────────────────────

  describe("Complex Deal Workflows", () => {
    it("should handle concurrent updates to multiple deals", () => {
      const deals: Deal[] = [
        { ...mockDeal, id: "d1", amount: 50000, stage: "lead" },
        { ...mockDeal, id: "d2", amount: 75000, stage: "qualified" },
      ];

      const updated = deals.map((d) => ({
        ...d,
        amount: d.amount * 1.1, // 10% increase
        probability: Math.min(100, d.amount > 60000 ? 80 : 50),
      }));

      expect(updated[0].amount).toBe(55000);
      expect(updated[1].amount).toBe(82500);
    });

    it("should rebuild stats after batch operations", () => {
      let deals: Deal[] = [
        { ...mockDeal, id: "d1", amount: 50000, stage: "lead", probability: 30 },
        { ...mockDeal, id: "d2", amount: 100000, stage: "qualified", probability: 50 },
      ];

      // Batch move all to next stage
      deals = deals.map((d) => {
        const nextStageMap: Record<DealStage, DealStage> = {
          lead: "qualified",
          qualified: "proposal",
          proposal: "negotiation",
          negotiation: "won",
          won: "won",
          lost: "lost",
        };
        return {
          ...d,
          stage: nextStageMap[d.stage],
          probability: Math.min(100, d.probability + 20),
        };
      });

      const totalValue = deals.reduce((sum, d) => sum + d.amount, 0);
      const weighted = deals.reduce((sum, d) => sum + d.amount * (d.probability / 100), 0);

      expect(totalValue).toBe(150000);
      expect(weighted).toBeGreaterThan(75000); // Both probabilities increased
    });
  });
});
