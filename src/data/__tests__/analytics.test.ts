/**
 * DAL — analytics module tests
 * Tests: getEmailMetrics, getPartnerMetrics, getActivityTimeline, getPipelineMetrics
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
let mockActivitiesResult: { data: unknown; error: unknown };
let mockChannelsResult: { data: unknown; error: unknown };
let mockPartnersResult: { data: unknown; error: unknown };
let mockDealsResult: { data: unknown; error: unknown };
let mockLogsResult: { data: unknown; error: unknown };

const chainBuilder = (result: () => { data: unknown; error: unknown }) => {
  const b: Record<string, any> = {};
  b.select = vi.fn().mockReturnValue(b);
  b.eq = vi.fn().mockReturnValue(b);
  b.gte = vi.fn().mockReturnValue(b);
  b.lte = vi.fn().mockReturnValue(b);
  b.is = vi.fn().mockReturnValue(b);
  b.then = (resolve: any) => resolve(result());
  return b;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table);
      const b: Record<string, any> = {};
      b.select = vi.fn().mockReturnValue(b);
      b.eq = vi.fn().mockReturnValue(b);
      b.gte = vi.fn().mockReturnValue(b);
      b.lte = vi.fn().mockReturnValue(b);
      b.is = vi.fn().mockReturnValue(b);
      b.order = vi.fn().mockReturnValue(b);
      // Return the appropriate mock result based on table
      const getResult = () => {
        switch (table) {
          case "activities": return mockActivitiesResult;
          case "channel_messages": return mockChannelsResult;
          case "partners": return mockPartnersResult;
          default: return { data: null, error: null };
        }
      };
      // Make the builder itself thenable (await resolves to result)
      Object.defineProperty(b, "then", {
        value: (resolve: any) => Promise.resolve(getResult()).then(resolve),
        writable: true,
      });
      return b;
    },
  },
}));

vi.mock("@/lib/typedSupabase", () => ({
  tFrom: (table: string) => {
    const b: Record<string, any> = {};
    b.select = vi.fn().mockReturnValue(b);
    b.eq = vi.fn().mockReturnValue(b);
    b.gte = vi.fn().mockReturnValue(b);
    b.lte = vi.fn().mockReturnValue(b);
    Object.defineProperty(b, "then", {
      value: (resolve: any) => {
        const result = table === "deals" ? mockDealsResult : mockLogsResult;
        return Promise.resolve(result).then(resolve);
      },
      writable: true,
    });
    return b;
  },
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

import {
  getEmailMetrics,
  getPartnerMetrics,
  getPipelineMetrics,
  getActivityTimeline,
} from "@/data/analytics";

const dateRange = {
  from: new Date("2025-01-01"),
  to: new Date("2025-01-31"),
};

describe("DAL — analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivitiesResult = { data: null, error: null };
    mockChannelsResult = { data: null, error: null };
    mockPartnersResult = { data: null, error: null };
    mockDealsResult = { data: null, error: null };
    mockLogsResult = { data: null, error: null };
  });

  describe("getEmailMetrics", () => {
    it("computes totals from channel messages", async () => {
      mockChannelsResult = {
        data: [
          { direction: "outbound", created_at: "2025-01-05T10:00:00Z" },
          { direction: "outbound", created_at: "2025-01-06T10:00:00Z" },
          { direction: "inbound", created_at: "2025-01-07T10:00:00Z" },
        ],
        error: null,
      };
      const result = await getEmailMetrics("u1", dateRange);
      expect(result.totalSent).toBe(2);
      expect(result.totalReceived).toBe(1);
    });

    it("returns defaults when no data", async () => {
      mockChannelsResult = { data: null, error: null };
      const result = await getEmailMetrics("u1", dateRange);
      expect(result).toEqual({
        totalSent: 0,
        totalReceived: 0,
        openRate: 0,
        responseRate: 0,
        avgResponseTime: 0,
      });
    });

    it("returns defaults on error", async () => {
      mockChannelsResult = { data: null, error: { message: "fail" } };
      // The function catches errors and returns defaults
      const result = await getEmailMetrics("u1", dateRange);
      expect(result.totalSent).toBe(0);
    });
  });

  describe("getPartnerMetrics", () => {
    it("aggregates partner data", async () => {
      mockPartnersResult = {
        data: [
          { lead_status: "qualified", country_code: "US", enrichment_data: { foo: 1 } },
          { lead_status: "qualified", country_code: "UK", enrichment_data: null },
          { lead_status: "negotiation", country_code: "US", enrichment_data: { bar: 2 } },
        ],
        error: null,
      };
      const result = await getPartnerMetrics("u1");
      expect(result.totalPartners).toBe(3);
      expect(result.activePartners).toBe(3); // 2 qualified + 1 negotiation
      expect(result.byCountry["US"]).toBe(2);
      expect(result.enrichmentCoverage).toBeCloseTo(66.67, 0);
    });

    it("returns defaults on error", async () => {
      mockPartnersResult = { data: null, error: { message: "rls" } };
      const result = await getPartnerMetrics("u1");
      expect(result.totalPartners).toBe(0);
    });
  });

  describe("getPipelineMetrics", () => {
    it("calculates pipeline values and weighted forecast", async () => {
      mockDealsResult = {
        data: [
          { stage: "qualified", value: 1000 },
          { stage: "won", value: 500 },
          { stage: "lost", value: 200 },
        ],
        error: null,
      };
      const result = await getPipelineMetrics("u1");
      expect(result.totalValue).toBe(1700);
      expect(result.byStage["qualified"]).toBe(1);
      expect(result.byStage["won"]).toBe(1);
      expect(result.winLossRatio).toBe(1); // 1 won / 1 lost
      expect(result.weightedForecast).toBe(1000 * 0.5 + 500 * 1.0 + 200 * 0.0);
    });

    it("returns defaults when no deals", async () => {
      mockDealsResult = { data: [], error: null };
      const result = await getPipelineMetrics("u1");
      expect(result.totalValue).toBe(0);
      expect(result.weightedForecast).toBe(0);
    });

    it("returns defaults on error", async () => {
      mockDealsResult = { data: null, error: { message: "denied" } };
      const result = await getPipelineMetrics("u1");
      expect(result.totalValue).toBe(0);
    });
  });

  describe("getActivityTimeline", () => {
    it("groups activities by date and type", async () => {
      mockActivitiesResult = {
        data: [
          { created_at: "2025-01-10T09:00:00Z", activity_type: "email" },
          { created_at: "2025-01-10T10:00:00Z", activity_type: "email" },
          { created_at: "2025-01-10T11:00:00Z", activity_type: "call" },
          { created_at: "2025-01-11T09:00:00Z", activity_type: "meeting" },
        ],
        error: null,
      };
      const result = await getActivityTimeline("u1", 30);
      expect(result).toHaveLength(2);
      const jan10 = result.find((r) => r.date === "2025-01-10");
      expect(jan10?.count).toBe(3);
      expect(jan10?.type).toBe("email"); // most frequent type that day
    });

    it("returns empty array on error", async () => {
      mockActivitiesResult = { data: null, error: { message: "fail" } };
      const result = await getActivityTimeline("u1");
      expect(result).toEqual([]);
    });
  });
});
