import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...a: any[]) => mockFrom(...a),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } } }) },
    functions: { invoke: vi.fn().mockResolvedValue({ data: { runs: [] }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ error: null }),
  },
}));

import { listTestCasesForPrompt, listRunsForPrompt, deleteTestCase } from "@/data/promptTests";

function chain(terminal: { data?: any; error?: any } = { data: [], error: null }) {
  const c: Record<string, any> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.upsert = vi.fn().mockReturnValue(c);
  c.delete = vi.fn().mockReturnValue(c);
  c.single = vi.fn().mockResolvedValue(terminal);
  c.maybeSingle = vi.fn().mockResolvedValue(terminal);
  c.then = (resolve: (v: any) => void) => resolve(terminal);
  return c;
}

describe("DAL — promptTests", () => {
  describe("listTestCasesForPrompt", () => {
    it("returns test cases", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "tc1" }], error: null }));
      const result = await listTestCasesForPrompt("p1");
      expect(mockFrom).toHaveBeenCalledWith("prompt_test_cases");
      expect(result).toEqual([{ id: "tc1" }]);
    });

    it("returns empty when no cases", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }));
      const result = await listTestCasesForPrompt("p99");
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "denied" } }));
      await expect(listTestCasesForPrompt("p1")).rejects.toEqual({ message: "denied" });
    });
  });

  describe("listRunsForPrompt", () => {
    it("returns runs for prompt", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "r1" }], error: null }));
      const result = await listRunsForPrompt("p1");
      expect(result).toEqual([{ id: "r1" }]);
    });
  });

  describe("deleteTestCase", () => {
    it("deletes by id", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await deleteTestCase("tc1");
      expect(mockFrom).toHaveBeenCalledWith("prompt_test_cases");
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ error: { message: "fail" } }));
      await expect(deleteTestCase("tc1")).rejects.toEqual({ message: "fail" });
    });
  });
});
