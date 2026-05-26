import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => mockFrom(...a) },
}));
vi.mock("@/v2/hooks/useBusyPartners", () => ({
  emitBusyPartnersChanged: vi.fn(),
}));

import { findPendingOutreachItems, updateOutreachItem, getOutreachItemField } from "@/data/outreachQueue";

function chain(terminal: { data?: any; error?: any } = { data: [], error: null }) {
  const c: Record<string, any> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.update = vi.fn().mockReturnValue(c);
  c.single = vi.fn().mockResolvedValue(terminal);
  c.then = (resolve: (v: any) => void) => resolve(terminal);
  return c;
}

describe("DAL — outreachQueue", () => {
  describe("findPendingOutreachItems", () => {
    it("returns pending items", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "o1" }], error: null }));
      const result = await findPendingOutreachItems(5);
      expect(mockFrom).toHaveBeenCalledWith("outreach_queue");
      expect(result).toHaveLength(1);
    });

    it("returns empty when none", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }));
      const result = await findPendingOutreachItems();
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(findPendingOutreachItems()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("updateOutreachItem", () => {
    it("updates an item", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await updateOutreachItem("o1", { status: "sent" });
      expect(mockFrom).toHaveBeenCalledWith("outreach_queue");
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ error: { message: "fail" } }));
      await expect(updateOutreachItem("o1", {})).rejects.toEqual({ message: "fail" });
    });
  });

  describe("getOutreachItemField", () => {
    it("returns field value", async () => {
      const c = chain();
      (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { subject: "Test" }, error: null });
      mockFrom.mockReturnValue(c);
      const result = await getOutreachItemField("o1", "subject");
      expect(result).toEqual({ subject: "Test" });
    });

    it("throws on error", async () => {
      const c = chain();
      (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: "fail" } });
      mockFrom.mockReturnValue(c);
      await expect(getOutreachItemField("o1", "subject")).rejects.toEqual({ message: "fail" });
    });
  });
});
