import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => mockFrom(...a) },
}));

import { fetchBrandVoiceOutcomes, fetchRecentBrandVoiceAudits, topDeviations } from "@/data/brandVoice";

describe("DAL — brandVoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  describe("fetchBrandVoiceOutcomes", () => {
    it("returns outcomes", async () => {
      const outcomes = [{ day: "2026-01-01", channel: "email", audits: 5 }];
      mockLimit.mockResolvedValue({ data: outcomes, error: null });
      const result = await fetchBrandVoiceOutcomes();
      expect(result).toEqual(outcomes);
    });

    it("returns empty on null data", async () => {
      mockLimit.mockResolvedValue({ data: null, error: null });
      const result = await fetchBrandVoiceOutcomes();
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockLimit.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(fetchBrandVoiceOutcomes()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("fetchRecentBrandVoiceAudits", () => {
    it("returns audits", async () => {
      const audits = [{ id: "a1", score: 80 }];
      mockLimit.mockResolvedValue({ data: audits, error: null });
      const result = await fetchRecentBrandVoiceAudits();
      expect(result).toEqual(audits);
    });

    it("throws on error", async () => {
      mockLimit.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(fetchRecentBrandVoiceAudits()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("topDeviations", () => {
    it("aggregates deviations from audits", () => {
      const audits = [
        {
          id: "a1",
          deviations: ["tone_too_casual", "missing_cta"],
          created_at: "",
          channel: "email",
          journalist_role: null,
          score: 50,
          excerpt: null,
          outreach_message_id: null,
        },
        {
          id: "a2",
          deviations: ["tone_too_casual", "too_long"],
          created_at: "",
          channel: "email",
          journalist_role: null,
          score: 60,
          excerpt: null,
          outreach_message_id: null,
        },
      ] as const;
      const result = topDeviations(audits as any as Parameters<typeof topDeviations>[0]);
      expect(result[0].code).toBe("tone_too_casual");
      expect(result[0].count).toBe(2);
    });

    it("returns empty for no audits", () => {
      const result = topDeviations([]);
      expect(result).toEqual([]);
    });
  });
});
