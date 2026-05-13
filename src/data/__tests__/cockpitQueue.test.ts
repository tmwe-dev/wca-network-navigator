import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));
vi.mock("@/v2/hooks/useBusyPartners", () => ({
  emitBusyPartnersChanged: vi.fn(),
}));

import { insertCockpitQueueItems, deleteCockpitQueueItem, findCockpitQueue } from "@/data/cockpitQueue";

function chain(terminal: { data?: unknown; error?: unknown; count?: unknown } = { data: [], error: null }) {
  const c: Record<string, unknown> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.upsert = vi.fn().mockResolvedValue({ error: terminal.error ?? null });
  c.delete = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: unknown) => void) => resolve(terminal);
  return c;
}

describe("DAL — cockpitQueue", () => {
  describe("insertCockpitQueueItems", () => {
    it("upserts queue items", async () => {
      mockFrom.mockReturnValue(chain());
      await insertCockpitQueueItems([{ user_id: "u1", source_type: "email", source_id: "s1" }]);
      expect(mockFrom).toHaveBeenCalledWith("cockpit_queue");
    });

    it("throws on error", async () => {
      const c = chain();
      (c.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: { message: "fail" } });
      mockFrom.mockReturnValue(c);
      await expect(insertCockpitQueueItems([{ user_id: "u1", source_type: "x", source_id: "s1" }])).rejects.toEqual({
        message: "fail",
      });
    });
  });

  describe("deleteCockpitQueueItem", () => {
    it("deletes by id", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await deleteCockpitQueueItem("q1");
      expect(mockFrom).toHaveBeenCalledWith("cockpit_queue");
    });
  });

  describe("findCockpitQueue", () => {
    it("returns queue items", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "q1" }], error: null }));
      const result = await findCockpitQueue("u1");
      expect(result).toEqual([{ id: "q1" }]);
    });

    it("returns empty on null data", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }));
      const result = await findCockpitQueue("u1");
      expect(result).toEqual([]);
    });
  });
});
