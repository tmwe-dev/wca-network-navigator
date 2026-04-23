/**
 * Unit Tests — Analytics Data Layer
 * Comprehensive tests for email, partner, outreach, AI usage, pipeline, and activity metrics.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getEmailMetrics,
  getPartnerMetrics,
  getOutreachMetrics,
  getAIUsageMetrics,
  getPipelineMetrics,
  getActivityTimeline,
  getMetricsComparison,
  type EmailMetricsData,
  type PartnerMetricsData,
  type OutreachMetricsData,
  type AIUsageMetricsData,
  type PipelineMetricsData,
  type ActivityTimelineItem,
} from "@/data/analytics";

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
const dateRange = {
  from: new Date("2026-04-01"),
  to: new Date("2026-04-22"),
};

const mockActivities = [
  { activity_type: "email_sent", created_at: "2026-04-15T10:00:00Z", details: null },
  { activity_type: "email_opened", created_at: "2026-04-15T11:00:00Z", details: null },
];

const mockChannelMessages = [
  { direction: "outbound", created_at: "2026-04-15T10:00:00Z", message_metadata: null },
  { direction: "inbound", created_at: "2026-04-15T11:00:00Z", message_metadata: null },
  { direction: "outbound", created_at: "2026-04-16T10:00:00Z", message_metadata: null },
];

const mockPartners = [
  { lead_status: "qualified", country: "US", enrichment_score: 0.8 },
  { lead_status: "qualified", country: "US", enrichment_score: 0.7 },
  { lead_status: "in_progress", country: "UK", enrichment_score: 0.6 },
  { lead_status: "new", country: "DE", enrichment_score: 0.3 },
];

const mockDeals = [
  { stage: "won", value: 100000 },
  { stage: "lost", value: 50000 },
  { stage: "proposal", value: 30000 },
  { stage: "negotiation", value: 40000 },
];

const mockLogs = [
  { action: "email_sent", created_at: "2026-04-15T10:00:00Z" },
  { action: "email_sent", created_at: "2026-04-15T11:00:00Z" },
  { action: "call", created_at: "2026-04-15T12:00:00Z" },
  { action: "email_sent", created_at: "2026-04-16T10:00:00Z" },
];

const mockActivityLogs = [
  { activity_type: "email", created_at: "2026-04-15T10:00:00Z" },
  { activity_type: "call", created_at: "2026-04-15T12:00:00Z" },
  { activity_type: "email", created_at: "2026-04-16T10:00:00Z" },
  { activity_type: "meeting", created_at: "2026-04-17T10:00:00Z" },
];

// ─── Test Suite ─────────────────────────────────────────
describe("Analytics Data Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── getEmailMetrics Tests ──────────────────────────────
  describe("getEmailMetrics", () => {
    it("should return correct email metrics structure", async () => {
      const mockActivityQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockActivities, error: null }),
      };

      const mockChannelQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockChannelMessages, error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: any) => {
        callCount++;
        return callCount === 1 ? mockActivityQuery : mockChannelQuery;
      });

      const result = await getEmailMetrics("user-1", dateRange);

      expect(result).toHaveProperty("totalSent");
      expect(result).toHaveProperty("totalReceived");
      expect(result).toHaveProperty("openRate");
      expect(result).toHaveProperty("responseRate");
      expect(result).toHaveProperty("avgResponseTime");
    });

    it("should count sent and received messages correctly", async () => {
      const mockActivityQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockChannelQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockChannelMessages, error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: any) => {
        callCount++;
        return callCount === 1 ? mockActivityQuery : mockChannelQuery;
      });

      const result = await getEmailMetrics("user-1", dateRange);

      expect(result.totalSent).toBe(2); // 2 outbound messages
      expect(result.totalReceived).toBe(1); // 1 inbound message
    });

    it("should handle empty data gracefully", async () => {
      const mockActivityQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockChannelQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: any) => {
        callCount++;
        return callCount === 1 ? mockActivityQuery : mockChannelQuery;
      });

      const result = await getEmailMetrics("user-1", dateRange);

      expect(result.totalSent).toBe(0);
      expect(result.openRate).toBe(0);
    });

    it("should handle errors gracefully and return default values", async () => {
      const mockActivityQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: null, error: new Error("Query failed") }),
      };

      mockSupabase.from.mockReturnValue(mockActivityQuery);

      const result = await getEmailMetrics("user-1", dateRange);

      expect(result.totalSent).toBe(0);
      expect(result.totalReceived).toBe(0);
      expect(result.openRate).toBe(0);
      expect(result.responseRate).toBe(0);
    });
  });

  // ─── getPartnerMetrics Tests ────────────────────────────
  describe("getPartnerMetrics", () => {
    it("should return correct partner metrics structure", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockPartners, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPartnerMetrics("user-1");

      expect(result).toHaveProperty("totalPartners");
      expect(result).toHaveProperty("byLeadStatus");
      expect(result).toHaveProperty("byCountry");
      expect(result).toHaveProperty("enrichmentCoverage");
      expect(result).toHaveProperty("activePartners");
    });

    it("should count partners correctly", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockPartners, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPartnerMetrics("user-1");

      expect(result.totalPartners).toBe(4);
    });

    it("should group partners by lead status", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockPartners, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPartnerMetrics("user-1");

      expect(result.byLeadStatus["qualified"]).toBe(2);
      expect(result.byLeadStatus["in_progress"]).toBe(1);
      expect(result.byLeadStatus["new"]).toBe(1);
    });

    it("should group partners by country", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockPartners, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPartnerMetrics("user-1");

      expect(result.byCountry["US"]).toBe(2);
      expect(result.byCountry["UK"]).toBe(1);
      expect(result.byCountry["DE"]).toBe(1);
    });

    it("should calculate enrichment coverage correctly", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockPartners, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPartnerMetrics("user-1");

      // 3 out of 4 partners have enrichment_score > 0.5
      expect(result.enrichmentCoverage).toBe(75);
    });

    it("should count active partners", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockPartners, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPartnerMetrics("user-1");

      // 2 qualified + 1 in_progress = 3
      expect(result.activePartners).toBe(3);
    });

    it("should handle empty partners list", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPartnerMetrics("user-1");

      expect(result.totalPartners).toBe(0);
      expect(result.enrichmentCoverage).toBe(0);
    });

    it("should handle errors gracefully", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: new Error("Query failed") }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPartnerMetrics("user-1");

      expect(result.totalPartners).toBe(0);
      expect(result.byLeadStatus).toEqual({});
      expect(result.byCountry).toEqual({});
    });
  });

  // ─── getOutreachMetrics Tests ───────────────────────────
  describe("getOutreachMetrics", () => {
    it("should return correct outreach metrics structure", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockChannelMessages, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getOutreachMetrics("user-1", dateRange);

      expect(result).toHaveProperty("emailsSentPerDay");
      expect(result).toHaveProperty("responseRate");
      expect(result).toHaveProperty("avgResponseTime");
      expect(result).toHaveProperty("conversionFunnel");
    });

    it("should aggregate emails by day", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockChannelMessages, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getOutreachMetrics("user-1", dateRange);

      expect(result.emailsSentPerDay).toEqual([
        { date: "2026-04-15", count: 1 },
        { date: "2026-04-16", count: 1 },
      ]);
    });

    it("should calculate response rate correctly", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockChannelMessages, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getOutreachMetrics("user-1", dateRange);

      // 1 inbound / 2 outbound = 50%
      expect(result.responseRate).toBe(50);
    });

    it("should calculate conversion funnel", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockChannelMessages, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getOutreachMetrics("user-1", dateRange);

      expect(result.conversionFunnel.contacted).toBe(2);
      expect(result.conversionFunnel.replied).toBe(1);
      expect(result.conversionFunnel.interested).toBe(0); // floor(1 * 0.6)
      expect(result.conversionFunnel.meeting).toBe(0); // floor(1 * 0.3)
      expect(result.conversionFunnel.deal).toBe(0); // floor(1 * 0.1)
    });

    it("should handle empty channels", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getOutreachMetrics("user-1", dateRange);

      expect(result.emailsSentPerDay).toEqual([]);
      expect(result.responseRate).toBe(0);
    });

    it("should handle errors gracefully", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: null, error: new Error("Query failed") }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getOutreachMetrics("user-1", dateRange);

      expect(result.emailsSentPerDay).toEqual([]);
      expect(result.responseRate).toBe(0);
      expect(result.conversionFunnel.contacted).toBe(0);
    });
  });

  // ─── getAIUsageMetrics Tests ────────────────────────────
  describe("getAIUsageMetrics", () => {
    it("should return correct AI usage metrics structure", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockLogs, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getAIUsageMetrics("user-1", dateRange);

      expect(result).toHaveProperty("totalCalls");
      expect(result).toHaveProperty("byType");
      expect(result).toHaveProperty("dailyUsage");
    });

    it("should count total AI calls", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockLogs, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getAIUsageMetrics("user-1", dateRange);

      expect(result.totalCalls).toBe(4);
    });

    it("should group calls by type", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockLogs, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getAIUsageMetrics("user-1", dateRange);

      expect(result.byType["email_sent"]).toBe(3);
      expect(result.byType["call"]).toBe(1);
    });

    it("should aggregate daily usage", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockLogs, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getAIUsageMetrics("user-1", dateRange);

      expect(result.dailyUsage).toEqual([
        { date: "2026-04-15", calls: 3 },
        { date: "2026-04-16", calls: 1 },
      ]);
    });

    it("should handle empty logs", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getAIUsageMetrics("user-1", dateRange);

      expect(result.totalCalls).toBe(0);
      expect(result.byType).toEqual({});
      expect(result.dailyUsage).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: null, error: new Error("Query failed") }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getAIUsageMetrics("user-1", dateRange);

      expect(result.totalCalls).toBe(0);
      expect(result.byType).toEqual({});
    });
  });

  // ─── getPipelineMetrics Tests ───────────────────────────
  describe("getPipelineMetrics", () => {
    it("should return correct pipeline metrics structure", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockDeals, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPipelineMetrics("user-1");

      expect(result).toHaveProperty("totalValue");
      expect(result).toHaveProperty("byStage");
      expect(result).toHaveProperty("valueByStage");
      expect(result).toHaveProperty("weightedForecast");
      expect(result).toHaveProperty("winLossRatio");
    });

    it("should calculate total pipeline value", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockDeals, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPipelineMetrics("user-1");

      // 100000 + 50000 + 30000 + 40000
      expect(result.totalValue).toBe(220000);
    });

    it("should group deals by stage", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockDeals, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPipelineMetrics("user-1");

      expect(result.byStage["won"]).toBe(1);
      expect(result.byStage["lost"]).toBe(1);
      expect(result.byStage["proposal"]).toBe(1);
      expect(result.byStage["negotiation"]).toBe(1);
    });

    it("should calculate value by stage", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockDeals, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPipelineMetrics("user-1");

      expect(result.valueByStage["won"]).toBe(100000);
      expect(result.valueByStage["proposal"]).toBe(30000);
    });

    it("should calculate win loss ratio", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockDeals, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPipelineMetrics("user-1");

      // 1 won / 1 lost = 1
      expect(result.winLossRatio).toBe(1);
    });

    it("should handle empty deals", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPipelineMetrics("user-1");

      expect(result.totalValue).toBe(0);
      expect(result.byStage).toEqual({});
      expect(result.weightedForecast).toBe(0);
    });

    it("should handle errors gracefully", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: new Error("Query failed") }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getPipelineMetrics("user-1");

      expect(result.totalValue).toBe(0);
      expect(result.byStage).toEqual({});
    });
  });

  // ─── getActivityTimeline Tests ──────────────────────────
  describe("getActivityTimeline", () => {
    it("should return correct activity timeline structure", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockActivityLogs, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getActivityTimeline("user-1", 30);

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("date");
        expect(result[0]).toHaveProperty("type");
        expect(result[0]).toHaveProperty("count");
        expect(result[0]).toHaveProperty("details");
      }
    });

    it("should aggregate activities by date", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockActivityLogs, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getActivityTimeline("user-1", 30);

      const april15 = result.find((a) => a.date === "2026-04-15");
      expect(april15?.count).toBe(2); // email + call
    });

    it("should sort timeline in descending date order", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockActivityLogs, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getActivityTimeline("user-1", 30);

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].date as string).toBeGreaterThanOrEqual(result[i].date as string);
      }
    });

    it("should handle empty activities", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getActivityTimeline("user-1", 30);

      expect(result).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: null, error: new Error("Query failed") }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getActivityTimeline("user-1", 30);

      expect(result).toEqual([]);
    });

    it("should respect days parameter", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockActivityLogs, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      await getActivityTimeline("user-1", 7);

      expect(mockQuery.gte).toHaveBeenCalled();
    });
  });

  // ─── getMetricsComparison Tests ─────────────────────────
  describe("getMetricsComparison", () => {
    it("should return comparison metrics structure", async () => {
      const mockActivityQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockChannelQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockChannelMessages, error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: any) => {
        callCount++;
        // First set of calls for current period
        if (callCount <= 2) {
          return callCount === 1 ? mockActivityQuery : mockChannelQuery;
        }
        // Second set of calls for previous period
        return callCount === 3 ? mockActivityQuery : mockChannelQuery;
      });

      const current = { from: new Date("2026-04-15"), to: new Date("2026-04-22") };
      const previous = { from: new Date("2026-04-08"), to: new Date("2026-04-14") };

      const result = await getMetricsComparison("user-1", current, previous);

      expect(result).toHaveProperty("sentTrend");
      expect(result).toHaveProperty("responseTrend");
    });

    it("should calculate sent trend correctly", async () => {
      const currentChannels = [
        { direction: "outbound", created_at: "2026-04-20T10:00:00Z", message_metadata: null },
        { direction: "outbound", created_at: "2026-04-21T10:00:00Z", message_metadata: null },
        { direction: "inbound", created_at: "2026-04-21T11:00:00Z", message_metadata: null },
      ];

      const previousChannels = [
        { direction: "outbound", created_at: "2026-04-10T10:00:00Z", message_metadata: null },
        { direction: "inbound", created_at: "2026-04-10T11:00:00Z", message_metadata: null },
      ];

      const mockActivityQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockChannelQueryCurrent = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: currentChannels, error: null }),
      };

      const mockChannelQueryPrevious = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: previousChannels, error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: any) => {
        callCount++;
        if (callCount === 1 || callCount === 3) return mockActivityQuery;
        if (callCount === 2) return mockChannelQueryCurrent;
        return mockChannelQueryPrevious;
      });

      const current = { from: new Date("2026-04-15"), to: new Date("2026-04-22") };
      const previous = { from: new Date("2026-04-08"), to: new Date("2026-04-14") };

      const result = await getMetricsComparison("user-1", current, previous);

      expect(result.sentTrend.current).toBe(2); // 2 outbound in current
      expect(result.sentTrend.previous).toBe(1); // 1 outbound in previous
    });

    it("should handle errors gracefully", async () => {
      const mockActivityQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: null, error: new Error("Query failed") }),
      };

      mockSupabase.from.mockReturnValue(mockActivityQuery);

      const current = { from: new Date("2026-04-15"), to: new Date("2026-04-22") };
      const previous = { from: new Date("2026-04-08"), to: new Date("2026-04-14") };

      const result = await getMetricsComparison("user-1", current, previous);

      expect(result.sentTrend.current).toBe(0);
      expect(result.sentTrend.previous).toBe(0);
    });
  });
});
