/**
 * DAL — emailCampaigns module tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { findCampaignQueueItems, countPendingCampaignEmails } from "@/data/emailCampaigns";

describe("DAL — emailCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq, count: 0, error: null });
    mockEq.mockResolvedValue({ data: [], error: null });
  });

  describe("findCampaignQueueItems", () => {
    it("returns queue items for draft", async () => {
      const items = [{ id: "q1", draft_id: "d1" }];
      mockEq.mockResolvedValue({ data: items, error: null });
      const result = await findCampaignQueueItems("d1");
      expect(mockFrom).toHaveBeenCalledWith("campaign_queue");
      expect(result).toEqual(items);
    });

    it("throws on error", async () => {
      mockEq.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(findCampaignQueueItems("d1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("countPendingCampaignEmails", () => {
    it("returns count", async () => {
      mockSelect.mockReturnValue({ count: 25, error: null });
      const result = await countPendingCampaignEmails();
      expect(result).toBe(25);
    });

    it("returns 0 when null", async () => {
      mockSelect.mockReturnValue({ count: null, error: null });
      const result = await countPendingCampaignEmails();
      expect(result).toBe(0);
    });
  });
});
