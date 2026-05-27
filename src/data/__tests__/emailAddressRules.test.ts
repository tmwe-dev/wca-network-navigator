import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();
const mockUntypedFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));
vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (table: string) => mockUntypedFrom(table),
}));

import { findEmailAddressRules, updateEmailAddressRule } from "@/data/emailAddressRules";

function chain(terminal: { data?: any; error?: any } = { data: [], error: null }) {
  const c: Record<string, any> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.update = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: any) => void) => resolve(terminal);
  return c;
}

describe("DAL — emailAddressRules", () => {
  describe("findEmailAddressRules", () => {
    it("returns rules for user", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "r1", email_address: "a@b.com" }], error: null }));
      const result = await findEmailAddressRules("u1");
      expect(mockFrom).toHaveBeenCalledWith("email_address_rules");
      expect(result).toEqual([{ id: "r1", email_address: "a@b.com" }]);
    });

    it("returns empty on no data", async () => {
      mockFrom.mockReturnValue(chain({ data: [], error: null }));
      const result = await findEmailAddressRules("u1");
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "denied" } }));
      await expect(findEmailAddressRules("u1")).rejects.toEqual({ message: "denied" });
    });
  });

  describe("updateEmailAddressRule", () => {
    it("updates a rule by id", async () => {
      mockUntypedFrom.mockReturnValue(chain({ error: null }));
      await updateEmailAddressRule("r1", { email_address: "new@b.com" });
      expect(mockUntypedFrom).toHaveBeenCalledWith("email_address_rules");
    });

    it("throws on update error", async () => {
      mockUntypedFrom.mockReturnValue(chain({ error: { message: "not found" } }));
      await expect(updateEmailAddressRule("r1", {})).rejects.toEqual({ message: "not found" });
    });
  });
});
