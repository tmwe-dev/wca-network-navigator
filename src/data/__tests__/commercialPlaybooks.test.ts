import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => mockFrom(...a) },
}));

import { findCommercialPlaybooks, updateCommercialPlaybook } from "@/data/commercialPlaybooks";

function chain(terminal: { data?: any; error?: any } = { data: [], error: null }) {
  const c: Record<string, any> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.update = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: any) => void) => resolve(terminal);
  return c;
}

describe("DAL — commercialPlaybooks", () => {
  describe("findCommercialPlaybooks", () => {
    it("returns playbooks for user", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "p1", name: "Cold Outreach" }], error: null }));
      const result = await findCommercialPlaybooks("u1");
      expect(mockFrom).toHaveBeenCalledWith("commercial_playbooks");
      expect(result).toEqual([{ id: "p1", name: "Cold Outreach" }]);
    });

    it("returns empty on null data", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }));
      const result = await findCommercialPlaybooks("u1");
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(findCommercialPlaybooks("u1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("updateCommercialPlaybook", () => {
    it("updates playbook", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await updateCommercialPlaybook("p1", { name: "Updated" });
      expect(mockFrom).toHaveBeenCalledWith("commercial_playbooks");
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ error: { message: "fail" } }));
      await expect(updateCommercialPlaybook("p1", {})).rejects.toEqual({ message: "fail" });
    });
  });
});
