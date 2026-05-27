import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { findOperativePrompts, findOperativePromptsFull, updateOperativePrompt } from "@/data/operativePrompts";

function chain(terminal: { data?: any; error?: any } = { data: [], error: null }) {
  const c: Record<string, any> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.update = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: any) => void) => resolve(terminal);
  return c;
}

describe("DAL — operativePrompts", () => {
  describe("findOperativePrompts", () => {
    it("returns prompts for user", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "p1", name: "test" }], error: null }));
      const result = await findOperativePrompts("u1");
      expect(mockFrom).toHaveBeenCalledWith("operative_prompts");
      expect(result).toEqual([{ id: "p1", name: "test" }]);
    });

    it("returns empty on null data", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }));
      const result = await findOperativePrompts("u1");
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "denied" } }));
      await expect(findOperativePrompts("u1")).rejects.toEqual({ message: "denied" });
    });
  });

  describe("findOperativePromptsFull", () => {
    it("returns full prompts", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "p1", context: "ctx" }], error: null }));
      const result = await findOperativePromptsFull("u1");
      expect(result).toEqual([{ id: "p1", context: "ctx" }]);
    });
  });

  describe("updateOperativePrompt", () => {
    it("updates a prompt", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await updateOperativePrompt("p1", { name: "updated" });
      expect(mockFrom).toHaveBeenCalledWith("operative_prompts");
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ error: { message: "fail" } }));
      await expect(updateOperativePrompt("p1", {})).rejects.toEqual({ message: "fail" });
    });
  });
});
