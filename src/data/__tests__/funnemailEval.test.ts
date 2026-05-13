import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (...a: unknown[]) => mockFrom(...a),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) } },
}));

import {
  listFunnemailEvalCases,
  listFunnemailEvalRuns,
  createFunnemailEvalCase,
  fetchEvalBatchRuns,
} from "@/data/funnemailEval";

function chain(terminal: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const c: Record<string, unknown> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.insert = vi.fn().mockResolvedValue({ error: terminal.error ?? null });
  c.then = (resolve: (v: unknown) => void) => resolve(terminal);
  return c;
}

describe("DAL — funnemailEval", () => {
  describe("listFunnemailEvalCases", () => {
    it("returns cases", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "1", name: "test" }], error: null }));
      const result = await listFunnemailEvalCases();
      expect(mockFrom).toHaveBeenCalledWith("funnemail_eval_cases");
      expect(result).toEqual([{ id: "1", name: "test" }]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(listFunnemailEvalCases()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("listFunnemailEvalRuns", () => {
    it("returns runs", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "r1" }], error: null }));
      const result = await listFunnemailEvalRuns(50);
      expect(result).toEqual([{ id: "r1" }]);
    });
  });

  describe("createFunnemailEvalCase", () => {
    it("inserts a new case", async () => {
      mockFrom.mockReturnValue(chain());
      await createFunnemailEvalCase({
        name: "test",
        inbound_payload: { from: "a@b.com" },
        expected_decision: { category: "commercial" },
      });
      expect(mockFrom).toHaveBeenCalledWith("funnemail_eval_cases");
    });

    it("throws on insert error", async () => {
      const c = chain();
      (c.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: { message: "dup" } });
      mockFrom.mockReturnValue(c);
      await expect(
        createFunnemailEvalCase({
          name: "x",
          inbound_payload: {},
          expected_decision: {},
        }),
      ).rejects.toEqual({ message: "dup" });
    });
  });

  describe("fetchEvalBatchRuns", () => {
    it("returns batch runs", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "b1", accuracy: 0.85 }], error: null }));
      const result = await fetchEvalBatchRuns();
      expect(mockFrom).toHaveBeenCalledWith("funnemail_eval_batch_runs");
      expect(result).toEqual([{ id: "b1", accuracy: 0.85 }]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(fetchEvalBatchRuns()).rejects.toEqual({ message: "fail" });
    });
  });
});
