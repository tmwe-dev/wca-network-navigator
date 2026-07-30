import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { fetchSenderGroupsOrdered, fetchAssignedAddressRules } from "@/data/emailGrouping";

type Terminal = { data?: unknown; error?: unknown };

function chain(terminals: Terminal[]) {
  const calls: Record<string, unknown[][]> = {};
  let i = 0;
  const c: Record<string, unknown> = {};
  for (const m of ["select", "order", "not", "range"]) {
    c[m] = vi.fn((...args: unknown[]) => {
      (calls[m] ||= []).push(args);
      return c;
    });
  }
  c.then = (resolve: (v: Terminal) => void) => resolve(terminals[Math.min(i++, terminals.length - 1)]);
  return { c, calls };
}

beforeEach(() => mockFrom.mockReset());

describe("DAL — emailGrouping", () => {
  describe("fetchSenderGroupsOrdered", () => {
    it("queries email_sender_groups with * ordered by sort_order asc", async () => {
      const { c, calls } = chain([{ data: [{ id: "g1" }], error: null }]);
      mockFrom.mockReturnValue(c);
      const res = await fetchSenderGroupsOrdered();
      expect(mockFrom).toHaveBeenCalledWith("email_sender_groups");
      expect(calls.select[0]).toEqual(["*"]);
      expect(calls.order[0]).toEqual(["sort_order", { ascending: true }]);
      expect(res).toEqual([{ id: "g1" }]);
    });

    it("returns empty array when data is null (error ignored, legacy semantics)", async () => {
      const { c } = chain([{ data: null, error: { message: "denied" } }]);
      mockFrom.mockReturnValue(c);
      await expect(fetchSenderGroupsOrdered()).resolves.toEqual([]);
    });
  });

  describe("fetchAssignedAddressRules", () => {
    it("queries email_address_rules with group_name not null, created_at desc, paged range", async () => {
      const { c, calls } = chain([{ data: [{ id: "r1" }], error: null }]);
      mockFrom.mockReturnValue(c);
      const res = await fetchAssignedAddressRules();
      expect(mockFrom).toHaveBeenCalledWith("email_address_rules");
      expect(calls.select[0]).toEqual([
        "id, email_address, display_name, group_name, created_at, company_name, domain",
      ]);
      expect(calls.not[0]).toEqual(["group_name", "is", null]);
      expect(calls.order[0]).toEqual(["created_at", { ascending: false }]);
      expect(calls.range[0]).toEqual([0, 999]);
      expect(res).toEqual([{ id: "r1" }]);
    });

    it("paginates until a partial page is returned", async () => {
      const full = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}` }));
      const { c, calls } = chain([
        { data: full, error: null },
        { data: [{ id: "last" }], error: null },
      ]);
      mockFrom.mockReturnValue(c);
      const res = await fetchAssignedAddressRules();
      expect(calls.range).toEqual([[0, 999], [1000, 1999]]);
      expect(res).toHaveLength(1001);
    });

    it("throws on query error", async () => {
      const { c } = chain([{ data: null, error: { message: "boom" } }]);
      mockFrom.mockReturnValue(c);
      await expect(fetchAssignedAddressRules()).rejects.toEqual({ message: "boom" });
    });
  });
});
