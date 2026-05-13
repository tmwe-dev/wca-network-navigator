import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { findOperativePrompts, updateOperativePrompt } from "@/data/operativePrompts";
describe("DAL — operativePrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ data: [], error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });
  it("finds operative prompts for user", async () => {
    const prompts = [{ id: "p1", name: "test" }];
    mockEq.mockResolvedValue({ data: prompts, error: null });
    const r = await findOperativePrompts("u1");
    expect(r).toEqual(prompts);
  });
  it("updates an operative prompt", async () => {
    mockEq.mockResolvedValue({ error: null });
    await expect(updateOperativePrompt("p1", { name: "updated" })).resolves.not.toThrow();
  });
  it("throws on error", async () => {
    mockEq.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(findOperativePrompts("u1")).rejects.toEqual({ message: "denied" });
  });
});
