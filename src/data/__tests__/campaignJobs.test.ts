import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));
vi.mock("@/v2/hooks/useBusyPartners", () => ({
  emitBusyPartnersChanged: vi.fn(),
}));

import { insertCampaignJobs } from "@/data/campaignJobs";

describe("DAL — campaignJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });
  });

  describe("insertCampaignJobs", () => {
    it("inserts campaign jobs", async () => {
      await insertCampaignJobs([{ campaign_id: "c1", partner_id: "p1" } as never]);
      expect(mockFrom).toHaveBeenCalledWith("campaign_jobs");
      expect(mockInsert).toHaveBeenCalled();
    });

    it("throws on insert error", async () => {
      mockInsert.mockResolvedValue({ error: { message: "dup" } });
      await expect(insertCampaignJobs([{ campaign_id: "c1" } as never])).rejects.toEqual({ message: "dup" });
    });
  });
});
