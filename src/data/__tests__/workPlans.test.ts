import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { findWorkPlans, createWorkPlan, updateWorkPlan, deleteWorkPlan, findActiveWorkPlans } from "@/data/workPlans";

function chain(terminal: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const c: Record<string, unknown> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.in = vi.fn().mockReturnValue(c);
  c.contains = vi.fn().mockReturnValue(c);
  c.insert = vi.fn().mockReturnValue(c);
  c.update = vi.fn().mockReturnValue(c);
  c.delete = vi.fn().mockReturnValue(c);
  c.single = vi.fn().mockResolvedValue(terminal);
  c.then = (resolve: (v: unknown) => void) => resolve(terminal);
  return c;
}

describe("DAL — workPlans", () => {
  describe("findWorkPlans", () => {
    it("returns work plans for user", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "w1" }], error: null }));
      const result = await findWorkPlans("u1");
      expect(mockFrom).toHaveBeenCalledWith("ai_work_plans");
      expect(result).toEqual([{ id: "w1" }]);
    });

    it("returns empty on null data", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }));
      const result = await findWorkPlans("u1");
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(findWorkPlans("u1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("createWorkPlan", () => {
    it("inserts and returns plan", async () => {
      const c = chain();
      (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: "w1" }, error: null });
      mockFrom.mockReturnValue(c);
      const result = await createWorkPlan({ user_id: "u1", title: "new" } as never);
      expect(result).toEqual({ id: "w1" });
    });

    it("throws on error", async () => {
      const c = chain();
      (c.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: "fail" } });
      mockFrom.mockReturnValue(c);
      await expect(createWorkPlan({ user_id: "u1" } as never)).rejects.toEqual({ message: "fail" });
    });
  });

  describe("updateWorkPlan", () => {
    it("updates a plan", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await updateWorkPlan("w1", { status: "done" });
      expect(mockFrom).toHaveBeenCalledWith("ai_work_plans");
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ error: { message: "fail" } }));
      await expect(updateWorkPlan("w1", {})).rejects.toEqual({ message: "fail" });
    });
  });

  describe("deleteWorkPlan", () => {
    it("deletes a plan", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await deleteWorkPlan("w1");
      expect(mockFrom).toHaveBeenCalledWith("ai_work_plans");
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ error: { message: "fail" } }));
      await expect(deleteWorkPlan("w1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("findActiveWorkPlans", () => {
    it("returns active plans", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ id: "w1", status: "running" }], error: null }));
      const result = await findActiveWorkPlans("u1");
      expect(result).toEqual([{ id: "w1", status: "running" }]);
    });
  });
});
