import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
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
  c.returns = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: any) => void) => resolve(terminal);
  return c;
}

describe("DAL — promptTests", () => {
  describe("listTestCasesForPrompt", () => {
    it("returns test cases", async () => {
      const row = {
        id: "tc1",
        prompt_id: "p1",
        user_id: "u1",
        name: "case",
        description: null,
        input_payload: { q: 1 },
        expected_contains: ["ok"],
        expected_not_contains: [],
        expected_regex: null,
        model: "gpt-4o-mini",
        temperature: 0.2,
        severity: "critical",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      };
      mockFrom.mockReturnValue(chain({ data: [row], error: null }));
      const result = await listTestCasesForPrompt("p1");
      expect(mockFrom).toHaveBeenCalledWith("prompt_test_cases");
      expect(result).toEqual([row]);
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
      const row = {
        id: "r1",
        test_case_id: "tc1",
        prompt_id: "p1",
        prompt_version_id: null,
        user_id: "u1",
        status: "passed",
        ai_output: "out",
        failure_reasons: [],
        model_used: "gpt-4o-mini",
        tokens_input: 10,
        tokens_output: 20,
        duration_ms: 150,
        trigger_source: "manual",
        created_at: "2026-01-01T00:00:00Z",
      };
      mockFrom.mockReturnValue(chain({ data: [row], error: null }));
      const result = await listRunsForPrompt("p1");
      expect(result).toEqual([{ ...row, metadata: null }]);
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
