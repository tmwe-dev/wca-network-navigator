import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => mockFrom(...a) },
}));
vi.mock("@/v2/hooks/useBusyPartners", () => ({
  emitBusyPartnersChanged: vi.fn(),
}));

import {
  findCampaignQueueItems,
  countPendingCampaignEmails,
  updateEmailDraft,
  getEmailDraftField,
  countEmailDrafts,
} from "@/data/emailCampaigns";

function chain(terminal: { data?: any; error?: any; count?: any } = { data: [], error: null }) {
  const c: Record<string, any> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.in = vi.fn().mockReturnValue(c);
  c.insert = vi.fn().mockResolvedValue({ error: terminal.error ?? null });
  c.update = vi.fn().mockReturnValue(c);
  c.single = vi.fn().mockResolvedValue(terminal);
  c.maybeSingle = vi.fn().mockResolvedValue(terminal);
  c.then = (resolve: (v: any) => void) => resolve(terminal);
  return c;
}

describe("DAL — emailCampaigns", () => {
  describe("findCampaignQueueItems", () => {
    it("returns queue items for draft", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "q1" }], error: null }));
      const result = await findCampaignQueueItems("d1");
      expect(mockFrom).toHaveBeenCalledWith("email_campaign_queue");
      expect(result).toEqual([{ id: "q1" }]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(findCampaignQueueItems("d1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("countPendingCampaignEmails", () => {
    it("returns count", async () => {
      mockFrom.mockReturnValue(chain({ count: 25, error: null }));
      const result = await countPendingCampaignEmails();
      expect(result).toBe(25);
    });

    it("returns 0 when null", async () => {
      mockFrom.mockReturnValue(chain({ count: null, error: null }));
      const result = await countPendingCampaignEmails();
      expect(result).toBe(0);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ count: null, error: { message: "fail" } }));
      await expect(countPendingCampaignEmails()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("updateEmailDraft", () => {
    it("updates draft", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await updateEmailDraft("d1", { subject: "new" });
      expect(mockFrom).toHaveBeenCalledWith("email_drafts");
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ error: { message: "fail" } }));
      await expect(updateEmailDraft("d1", {})).rejects.toEqual({ message: "fail" });
    });
  });

  describe("getEmailDraftField", () => {
    it("returns field data", async () => {
      const c = chain();
      (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { subject: "Test" }, error: null });
      mockFrom.mockReturnValue(c);
      const result = await getEmailDraftField("d1", "subject");
      expect(result).toEqual({ subject: "Test" });
    });
  });

  describe("countEmailDrafts", () => {
    it("returns draft count", async () => {
      mockFrom.mockReturnValue(chain({ count: 10, error: null }));
      const result = await countEmailDrafts();
      expect(result).toBe(10);
    });
  });
});
