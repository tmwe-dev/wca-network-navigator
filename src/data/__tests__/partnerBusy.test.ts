import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (...a: unknown[]) => mockFrom(...a),
}));

import { findBusyPartnerIds, findBusyPartnerRows } from "@/data/partnerBusy";

function chain(terminal: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const c: Record<string, unknown> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.in = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: unknown) => void) => resolve(terminal);
  return c;
}

describe("DAL — partnerBusy", () => {
  describe("findBusyPartnerIds", () => {
    it("returns set of busy partner ids (no filter)", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ partner_id: "p1" }, { partner_id: "p2" }], error: null }));
      const result = await findBusyPartnerIds();
      expect(mockFrom).toHaveBeenCalledWith("v_partner_busy");
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
    });

    it("filters by partner ids when provided", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ partner_id: "p1" }], error: null }));
      const result = await findBusyPartnerIds(["p1", "p2"]);
      expect(result).toBeInstanceOf(Set);
      expect(result.has("p1")).toBe(true);
    });

    it("returns empty set on no data", async () => {
      mockFrom.mockReturnValue(chain({ data: [], error: null }));
      const result = await findBusyPartnerIds();
      expect(result.size).toBe(0);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(findBusyPartnerIds()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("findBusyPartnerRows", () => {
    it("returns busy partner rows", async () => {
      mockFrom.mockReturnValue(
        chain({ data: [{ partner_id: "p1", source: "outreach", since: "2026-01-01" }], error: null }),
      );
      const result = await findBusyPartnerRows();
      expect(result).toHaveLength(1);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(findBusyPartnerRows()).rejects.toEqual({ message: "fail" });
    });
  });
});
