import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import {
  listPipelineTraces,
  getTraceTimeline,
  listDistinctEntityTypes,
  listDistinctStepNames,
} from "@/data/pipelineTraces";

function chain(terminal: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const c: Record<string, unknown> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.gte = vi.fn().mockReturnValue(c);
  c.lte = vi.fn().mockReturnValue(c);
  c.or = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: unknown) => void) => resolve(terminal);
  return c;
}

describe("DAL — pipelineTraces", () => {
  describe("listPipelineTraces", () => {
    it("returns traces", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "t1" }], error: null }));
      const result = await listPipelineTraces();
      expect(mockFrom).toHaveBeenCalledWith("pipeline_traces");
      expect(result).toEqual([{ id: "t1" }]);
    });

    it("returns empty on null data", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }));
      const result = await listPipelineTraces();
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(listPipelineTraces()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("getTraceTimeline", () => {
    it("returns timeline for trace", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "t1", step_order: 1 }], error: null }));
      const result = await getTraceTimeline("trace-1");
      expect(result).toEqual([{ id: "t1", step_order: 1 }]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(getTraceTimeline("x")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("listDistinctEntityTypes", () => {
    it("returns distinct types", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ entity_type: "email" }, { entity_type: "contact" }], error: null }));
      const result = await listDistinctEntityTypes();
      expect(result).toContain("email");
      expect(result).toContain("contact");
    });
  });

  describe("listDistinctStepNames", () => {
    it("returns distinct step names", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ step_name: "classify" }, { step_name: "route" }], error: null }));
      const result = await listDistinctStepNames();
      expect(result).toContain("classify");
    });
  });
});
