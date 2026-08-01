import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    functions: { invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) },
  },
}));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }) }));

import {
  listFunnemailEvalCases,
  listFunnemailEvalRuns,
  createFunnemailEvalCase,
  fetchEvalBatchRuns,
} from "@/data/funnemailEval";

function chain(terminal: { data?: any; error?: any } = { data: [], error: null }) {
  const c: Record<string, any> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.is = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.single = vi.fn().mockReturnValue(c);
  c.insert = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: any) => void) => resolve(terminal);
  return c;
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ─── Legacy Sprint 5 functions ─── */

describe("DAL — funnemailEval (Sprint 5)", () => {
  describe("listFunnemailEvalCases", () => {
    it("returns cases", async () => {
      const row = {
        id: "1",
        name: "test",
        description: null,
        inbound_payload: { from: "a@b.com" },
        expected_decision: { category: "commercial" },
        tags: [],
        enabled: true,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      };
      mockFrom.mockReturnValue(chain({ data: [row], error: null }));
      const result = await listFunnemailEvalCases();
      expect(mockFrom).toHaveBeenCalledWith("funnemail_eval_cases");
      expect(result).toEqual([row]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(listFunnemailEvalCases()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("listFunnemailEvalRuns", () => {
    it("returns runs", async () => {
      const run = {
        id: "r1",
        case_id: "c1",
        prompt_version_id: null,
        actual_decision: null,
        passed: true,
        diff: null,
        latency_ms: 10,
        cost_usd: null,
        error: null,
        run_at: "2026-01-01",
      };
      mockFrom.mockReturnValue(chain({ data: [run], error: null }));
      const result = await listFunnemailEvalRuns(50);
      expect(result).toEqual([run]);
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
    it("returns an empty list without querying: the relation is absent from the live schema", async () => {
      mockFrom.mockClear();
      const result = await fetchEvalBatchRuns();
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });
});
