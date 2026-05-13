/**
 * Unit Tests — Analytics Data Layer
 * Comprehensive tests for email, partner, outreach, AI usage, pipeline, and activity metrics.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Setup ────────────────────────────────────────
const _mockSelect = vi.fn();
const _mockEq = vi.fn();
const _mockIs = vi.fn();
const _mockGte = vi.fn();
const _mockLte = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

import {
  getEmailMetrics,
  getPartnerMetrics,
  getOutreachMetrics,
  getActivityTimeline,
  getMetricsComparison,
} from "@/data/analytics";

// ─── Test Data ──────────────────────────────────────────
const dateRange = {
  from: new Date("2026-04-01"),
  to: new Date("2026-04-22"),
};

const mockChannelMessages = [
  { direction: "outbound", created_at: "2026-04-15T10:00:00Z" },
  { direction: "inbound", created_at: "2026-04-15T11:00:00Z" },
  { direction: "outbound", created_at: "2026-04-16T10:00:00Z" },
];

const mockPartners = [
  { lead_status: "qualified", country_code: "US", enrichment_data: { score: 0.8 } },
  { lead_status: "qualified", country_code: "US", enrichment_data: { score: 0.7 } },
  { lead_status: "negotiation", country_code: "UK", enrichment_data: { score: 0.6 } },
  { lead_status: "new", country_code: "DE", enrichment_data: null },
];

const mockActivityLogs = [
  { activity_type: "email", created_at: "2026-04-15T10:00:00Z" },
  { activity_type: "call", created_at: "2026-04-15T12:00:00Z" },
  { activity_type: "email", created_at: "2026-04-16T10:00:00Z" },
  { activity_type: "meeting", created_at: "2026-04-17T10:00:00Z" },
];

// ─── Helpers ────────────────────────────────────────────

/** Build a chainable mock that terminates at the given method with the given resolved value. */
function buildChain(
  terminator: string,
  resolvedValue: { data: unknown; error: unknown },
  methods: string[] = ["select", "eq", "is", "gte", "lte"],
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of methods) {
    if (m === terminator) {
      chain[m] = vi.fn().mockResolvedValue(resolvedValue);
    } else {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
  }
  // Make non-terminator methods point to chain (circular ref needs post-assignment)
  for (const m of methods) {
    if (m !== terminator) {
      chain[m].mockReturnValue(chain);
    }
  }
  return chain;
}

// ─── Test Suite ─────────────────────────────────────────
describe("Analytics Data Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getEmailMetrics Tests ──────────────────────────────
  describe("getEmailMetrics", () => {
    it("should return correct email metrics structure", async () => {
      // getEmailMetrics calls supabase.from("activities") then supabase.from("channel_messages")
      // Both chains: .select().eq().gte().lte()
      const activitiesChain = buildChain("lte", { data: [], error: null });
      const channelsChain = buildChain("lte", { data: mockChannelMessages, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? activitiesChain : channelsChain;
      });

      const result = await getEmailMetrics("user-1", dateRange);

      expect(result).toHaveProperty("totalSent");
      expect(result).toHaveProperty("totalReceived");
      expect(result).toHaveProperty("openRate");
      expect(result).toHaveProperty("responseRate");
      expect(result).toHaveProperty("avgResponseTime");
    });

    it("should count sent and received messages correctly", async () => {
      const activitiesChain = buildChain("lte", { data: [], error: null });
      const channelsChain = buildChain("lte", { data: mockChannelMessages, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? activitiesChain : channelsChain;
      });

      const result = await getEmailMetrics("user-1", dateRange);

      expect(result.totalSent).toBe(2);
      expect(result.totalReceived).toBe(1);
    });

    it("should handle empty data gracefully", async () => {
      const activitiesChain = buildChain("lte", { data: null, error: null });
      const channelsChain = buildChain("lte", { data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? activitiesChain : channelsChain;
      });

      const result = await getEmailMetrics("user-1", dateRange);

      expect(result.totalSent).toBe(0);
      expect(result.openRate).toBe(0);
    });

    it("should handle errors gracefully and return default values", async () => {
      // If the first query throws, the catch block returns defaults
      mockFrom.mockImplementation(() => {
        throw new Error("Query failed");
      });

      const result = await getEmailMetrics("user-1", dateRange);

      expect(result.totalSent).toBe(0);
      expect(result.totalReceived).toBe(0);
      expect(result.openRate).toBe(0);
      expect(result.responseRate).toBe(0);
    });
  });

  // ─── getPartnerMetrics Tests ────────────────────────────
  describe("getPartnerMetrics", () => {
    // getPartnerMetrics chain: .from("partners").select(...).is("deleted_at", null)
    function partnerChain(resolvedValue: { data: unknown; error: unknown }) {
      return buildChain("is", resolvedValue, ["select", "is"]);
    }

    it("should return correct partner metrics structure", async () => {
      mockFrom.mockReturnValue(partnerChain({ data: mockPartners, error: null }));

      const result = await getPartnerMetrics("user-1");

      expect(result).toHaveProperty("totalPartners");
      expect(result).toHaveProperty("byLeadStatus");
      expect(result).toHaveProperty("byCountry");
      expect(result).toHaveProperty("enrichmentCoverage");
      expect(result).toHaveProperty("activePartners");
    });

    it("should count partners correctly", async () => {
      mockFrom.mockReturnValue(partnerChain({ data: mockPartners, error: null }));

      const result = await getPartnerMetrics("user-1");

      expect(result.totalPartners).toBe(4);
    });

    it("should group partners by lead status", async () => {
      mockFrom.mockReturnValue(partnerChain({ data: mockPartners, error: null }));

      const result = await getPartnerMetrics("user-1");

      expect(result.byLeadStatus["qualified"]).toBe(2);
      expect(result.byLeadStatus["negotiation"]).toBe(1);
      expect(result.byLeadStatus["new"]).toBe(1);
    });

    it("should group partners by country_code", async () => {
      mockFrom.mockReturnValue(partnerChain({ data: mockPartners, error: null }));

      const result = await getPartnerMetrics("user-1");

      expect(result.byCountry["US"]).toBe(2);
      expect(result.byCountry["UK"]).toBe(1);
      expect(result.byCountry["DE"]).toBe(1);
    });

    it("should calculate enrichment coverage correctly", async () => {
      mockFrom.mockReturnValue(partnerChain({ data: mockPartners, error: null }));

      const result = await getPartnerMetrics("user-1");

      // 3 out of 4 partners have truthy enrichment_data
      expect(result.enrichmentCoverage).toBe(75);
    });

    it("should count active partners (qualified + negotiation)", async () => {
      mockFrom.mockReturnValue(partnerChain({ data: mockPartners, error: null }));

      const result = await getPartnerMetrics("user-1");

      // 2 qualified + 1 negotiation = 3
      expect(result.activePartners).toBe(3);
    });

    it("should handle empty partners list", async () => {
      mockFrom.mockReturnValue(partnerChain({ data: null, error: null }));

      const result = await getPartnerMetrics("user-1");

      expect(result.totalPartners).toBe(0);
      expect(result.enrichmentCoverage).toBe(0);
    });

    it("should handle errors gracefully", async () => {
      mockFrom.mockReturnValue(partnerChain({ data: null, error: new Error("Query failed") }));

      const result = await getPartnerMetrics("user-1");

      expect(result.totalPartners).toBe(0);
      expect(result.byLeadStatus).toEqual({});
      expect(result.byCountry).toEqual({});
    });
  });

  // ─── getOutreachMetrics Tests ───────────────────────────
  describe("getOutreachMetrics", () => {
    // chain: .from("channel_messages").select().eq().gte().lte()
    it("should return correct outreach metrics structure", async () => {
      mockFrom.mockReturnValue(buildChain("lte", { data: mockChannelMessages, error: null }));

      const result = await getOutreachMetrics("user-1", dateRange);

      expect(result).toHaveProperty("emailsSentPerDay");
      expect(result).toHaveProperty("responseRate");
      expect(result).toHaveProperty("avgResponseTime");
      expect(result).toHaveProperty("conversionFunnel");
    });

    it("should aggregate emails by day", async () => {
      mockFrom.mockReturnValue(buildChain("lte", { data: mockChannelMessages, error: null }));

      const result = await getOutreachMetrics("user-1", dateRange);

      expect(result.emailsSentPerDay).toEqual([
        { date: "2026-04-15", count: 1 },
        { date: "2026-04-16", count: 1 },
      ]);
    });

    it("should calculate response rate correctly", async () => {
      mockFrom.mockReturnValue(buildChain("lte", { data: mockChannelMessages, error: null }));

      const result = await getOutreachMetrics("user-1", dateRange);

      // 1 inbound / 2 outbound = 50%
      expect(result.responseRate).toBe(50);
    });

    it("should calculate conversion funnel", async () => {
      mockFrom.mockReturnValue(buildChain("lte", { data: mockChannelMessages, error: null }));

      const result = await getOutreachMetrics("user-1", dateRange);

      expect(result.conversionFunnel.contacted).toBe(2);
      expect(result.conversionFunnel.replied).toBe(1);
      expect(result.conversionFunnel.interested).toBe(0); // floor(1 * 0.6)
      expect(result.conversionFunnel.meeting).toBe(0); // floor(1 * 0.3)
      expect(result.conversionFunnel.deal).toBe(0); // floor(1 * 0.1)
    });

    it("should handle empty channels", async () => {
      mockFrom.mockReturnValue(buildChain("lte", { data: null, error: null }));

      const result = await getOutreachMetrics("user-1", dateRange);

      expect(result.emailsSentPerDay).toEqual([]);
      expect(result.responseRate).toBe(0);
    });

    it("should handle errors gracefully", async () => {
      mockFrom.mockImplementation(() => {
        throw new Error("Query failed");
      });

      const result = await getOutreachMetrics("user-1", dateRange);

      expect(result.emailsSentPerDay).toEqual([]);
      expect(result.responseRate).toBe(0);
      expect(result.conversionFunnel.contacted).toBe(0);
    });
  });

  // ─── getActivityTimeline Tests ──────────────────────────
  describe("getActivityTimeline", () => {
    // chain: .from("activities").select().eq().gte()
    function activityChain(resolvedValue: { data: unknown; error: unknown }) {
      return buildChain("gte", resolvedValue, ["select", "eq", "gte"]);
    }

    it("should return correct activity timeline structure", async () => {
      mockFrom.mockReturnValue(activityChain({ data: mockActivityLogs, error: null }));

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
      mockFrom.mockReturnValue(activityChain({ data: mockActivityLogs, error: null }));

      const result = await getActivityTimeline("user-1", 30);

      const april15 = result.find((a) => a.date === "2026-04-15");
      expect(april15?.count).toBe(2); // email + call
    });

    it("should sort timeline in descending date order", async () => {
      mockFrom.mockReturnValue(activityChain({ data: mockActivityLogs, error: null }));

      const result = await getActivityTimeline("user-1", 30);

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].date >= result[i].date).toBe(true);
      }
    });

    it("should handle empty activities", async () => {
      mockFrom.mockReturnValue(activityChain({ data: null, error: null }));

      const result = await getActivityTimeline("user-1", 30);

      expect(result).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      mockFrom.mockImplementation(() => {
        throw new Error("Query failed");
      });

      const result = await getActivityTimeline("user-1", 30);

      expect(result).toEqual([]);
    });

    it("should respect days parameter", async () => {
      const chain = activityChain({ data: mockActivityLogs, error: null });
      mockFrom.mockReturnValue(chain);

      await getActivityTimeline("user-1", 7);

      expect(chain.gte).toHaveBeenCalled();
    });
  });

  // ─── getMetricsComparison Tests ─────────────────────────
  describe("getMetricsComparison", () => {
    it("should return comparison metrics structure", async () => {
      // getMetricsComparison calls getEmailMetrics twice (current + previous)
      // Each getEmailMetrics call does 2 from() calls: activities + channel_messages
      const activitiesChain = buildChain("lte", { data: [], error: null });
      const channelsChain = buildChain("lte", { data: mockChannelMessages, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        // Odd calls = activities, even calls = channel_messages
        return callCount % 2 === 1 ? activitiesChain : channelsChain;
      });

      const current = { from: new Date("2026-04-15"), to: new Date("2026-04-22") };
      const previous = { from: new Date("2026-04-08"), to: new Date("2026-04-14") };

      const result = await getMetricsComparison("user-1", current, previous);

      expect(result).toHaveProperty("sentTrend");
      expect(result).toHaveProperty("responseTrend");
    });

    it("should calculate sent trend correctly", async () => {
      // Both periods get the same channel data since we can't distinguish
      // which period each call belongs to in a concurrent Promise.all scenario.
      // We verify the structure works with consistent data.
      const channels = [
        { direction: "outbound", created_at: "2026-04-20T10:00:00Z" },
        { direction: "outbound", created_at: "2026-04-21T10:00:00Z" },
        { direction: "inbound", created_at: "2026-04-21T11:00:00Z" },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "activities") {
          return buildChain("lte", { data: [], error: null });
        }
        // channel_messages
        return buildChain("lte", { data: channels, error: null });
      });

      const current = { from: new Date("2026-04-15"), to: new Date("2026-04-22") };
      const previous = { from: new Date("2026-04-08"), to: new Date("2026-04-14") };

      const result = await getMetricsComparison("user-1", current, previous);

      // Both periods get 2 outbound messages
      expect(result.sentTrend.current).toBe(2);
      expect(result.sentTrend.previous).toBe(2);
      expect(result.sentTrend.change).toBe(0);
    });

    it("should handle errors gracefully", async () => {
      mockFrom.mockImplementation(() => {
        throw new Error("Query failed");
      });

      const current = { from: new Date("2026-04-15"), to: new Date("2026-04-22") };
      const previous = { from: new Date("2026-04-08"), to: new Date("2026-04-14") };

      const result = await getMetricsComparison("user-1", current, previous);

      expect(result.sentTrend.current).toBe(0);
      expect(result.sentTrend.previous).toBe(0);
    });
  });
});
