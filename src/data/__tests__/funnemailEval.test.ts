import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (...a: any[]) => mockFrom(...a),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) } },
}));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }) }));

import {
  listFunnemailEvalCases,
  listFunnemailEvalRuns,
  createFunnemailEvalCase,
  fetchEvalBatchRuns,
  listEvalDataset,
  insertEvalDatasetRow,
  insertEvalRun,
  listFunnemailEvalDatasetRuns,
  fetchEvalRunById,
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

/* ─── Sprint D: new eval dataset + runs functions ─── */

describe("DAL — funnemailEval (Sprint D)", () => {
  describe("listEvalDataset", () => {
    it("returns active dataset rows", async () => {
      const rows = [{ id: "d1", email_subject: "Test", is_active: true }];
      mockFrom.mockReturnValue(chain({ data: rows, error: null }));
      const result = await listEvalDataset();
      expect(mockFrom).toHaveBeenCalledWith("funnemail_eval_dataset");
      expect(result).toEqual(rows);
    });

    it("returns empty array on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      const result = await listEvalDataset();
      expect(result).toEqual([]);
    });
  });

  describe("insertEvalDatasetRow", () => {
    it("inserts and returns the row", async () => {
      const row = {
        id: "d2",
        email_subject: "New",
        email_body: "body",
        expected_category: "inquiry",
        expected_intent: "request_info",
        expected_priority: "normal",
      };
      mockFrom.mockReturnValue(chain({ data: row, error: null }));
      const result = await insertEvalDatasetRow({
        email_subject: "New",
        email_body: "body",
        expected_category: "inquiry",
        expected_intent: "request_info",
        expected_priority: "normal",
      });
      expect(mockFrom).toHaveBeenCalledWith("funnemail_eval_dataset");
      expect(result).toEqual(row);
    });

    it("returns null on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "insert fail" } }));
      const result = await insertEvalDatasetRow({
        email_subject: "X",
        email_body: "Y",
        expected_category: "spam",
        expected_intent: "spam",
        expected_priority: "low",
      });
      expect(result).toBeNull();
    });
  });

  describe("insertEvalRun", () => {
    it("inserts and returns the run", async () => {
      const run = {
        id: "r1",
        dataset_size: 50,
        category_accuracy: 92.0,
        intent_accuracy: 88.0,
        priority_accuracy: 95.0,
        failures: [],
      };
      mockFrom.mockReturnValue(chain({ data: run, error: null }));
      const result = await insertEvalRun({
        dataset_size: 50,
        category_accuracy: 92.0,
        intent_accuracy: 88.0,
        priority_accuracy: 95.0,
      });
      expect(mockFrom).toHaveBeenCalledWith("funnemail_eval_runs");
      expect(result).toEqual(run);
    });

    it("returns null on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      const result = await insertEvalRun({
        dataset_size: 10,
        category_accuracy: null,
        intent_accuracy: null,
        priority_accuracy: null,
      });
      expect(result).toBeNull();
    });
  });

  describe("listFunnemailEvalDatasetRuns", () => {
    it("returns runs ordered by run_at", async () => {
      const runs = [
        { id: "r1", dataset_size: 50 },
        { id: "r2", dataset_size: 30 },
      ];
      mockFrom.mockReturnValue(chain({ data: runs, error: null }));
      const result = await listFunnemailEvalDatasetRuns(10);
      expect(mockFrom).toHaveBeenCalledWith("funnemail_eval_runs");
      expect(result).toEqual(runs);
    });

    it("returns empty array on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      const result = await listFunnemailEvalDatasetRuns();
      expect(result).toEqual([]);
    });
  });

  describe("fetchEvalRunById", () => {
    it("returns a single run by id", async () => {
      const run = { id: "r1", dataset_size: 50, category_accuracy: 92.0 };
      mockFrom.mockReturnValue(chain({ data: run, error: null }));
      const result = await fetchEvalRunById("r1");
      expect(mockFrom).toHaveBeenCalledWith("funnemail_eval_runs");
      expect(result).toEqual(run);
    });

    it("returns null on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "not found" } }));
      const result = await fetchEvalRunById("nonexistent");
      expect(result).toBeNull();
    });
  });
});
