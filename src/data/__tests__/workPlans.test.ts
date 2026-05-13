import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { findWorkPlans, createWorkPlan, updateWorkPlan, deleteWorkPlan } from "@/data/workPlans";
describe("DAL — workPlans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder, eq: mockEq });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ data: [], error: null });
  });
  it("finds work plans for user", async () => {
    const plans = [{ id: "w1", title: "test" }];
    mockLimit.mockResolvedValue({ data: plans, error: null });
    const _r = await findWorkPlans("u1");
    expect(mockFrom).toHaveBeenCalledWith("work_plans");
  });
  it("creates a work plan", async () => {
    await expect(createWorkPlan({ user_id: "u1", title: "new" } as never)).resolves.not.toThrow();
  });
  it("updates a work plan", async () => {
    await expect(updateWorkPlan("w1", { status: "done" })).resolves.not.toThrow();
  });
  it("deletes a work plan", async () => {
    await expect(deleteWorkPlan("w1")).resolves.not.toThrow();
  });
});
