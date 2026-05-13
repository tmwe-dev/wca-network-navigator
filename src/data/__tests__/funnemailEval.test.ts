import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockUntypedFrom = vi.fn();

vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (...a: unknown[]) => mockUntypedFrom(...a),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { listFunnemailEvalCases, listFunnemailEvalRuns, createFunnemailEvalCase, fetchEvalBatchRuns } from "@/data/funnemailEval";

describe("DAL — funnemailEval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUntypedFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockOrder.mockResolvedValue({ data: [], error: null });
  });

  describe("listFunnemailEvalCases", () => {
    it("returns cases ordered by created_at desc", async () => {
      const cases = [{ id: "1", name: "test" }];
      mockOrder.mockResolvedValue({ data: cases, error: null });
      const result = await listFunnemailEvalCases();
      expect(mockUntypedFrom).toHaveBeenCalledWith("funnemail_eval_cases");
      expect(result).toEqual(cases);
    });

    it("throws on error", async () => {
      mockOrder.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(listFunnemailEvalCases()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("listFunnemailEvalRuns", () => {
    it("returns runs with limit", async () => {
      const runs = [{ id: "r1", passed: true }];
      mockLimit.mockResolvedValue({ data: runs, error: null });
      const result = await listFunnemailEvalRuns(50);
      expect(result).toEqual(runs);
    });
  });

  describe("createFunnemailEvalCase", () => {
    it("inserts a new case", async () => {
      mockInsert.mockResolvedValue({ error: null });
      await createFunnemailEvalCase({
        name: "test",
        inbound_payload: { from: "a@b.com" },
        expected_decision: { category: "commercial" },
      });
      expect(mockInsert).toHaveBeenCalled();
    });

    it("throws on insert error", async () => {
      mockInsert.mockResolvedValue({ error: { message: "dup" } });
      await expect(createFunnemailEvalCase({
        name: "x",
        inbound_payload: {},
        expected_decision: {},
      })).rejects.toEqual({ message: "dup" });
    });
  });

  describe("fetchEvalBatchRuns", () => {
    it("returns batch runs", async () => {
      const batch = [{ id: "b1", accuracy: 0.85 }];
      mockLimit.mockResolvedValue({ data: batch, error: null });
      const result = await fetchEvalBatchRuns();
      expect(mockUntypedFrom).toHaveBeenCalledWith("funnemail_eval_batch_runs");
      expect(result).toEqual(batch);
    });
  });
});
