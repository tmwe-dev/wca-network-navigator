import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { listTestCasesForPrompt } from "@/data/promptTests";
describe("DAL — promptTests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ data: [], error: null });
  });
  it("lists test cases for prompt", async () => {
    const cases = [{ id: "tc1", input: "x" }];
    mockEq.mockResolvedValue({ data: cases, error: null });
    const r = await listTestCasesForPrompt("p1");
    expect(r).toEqual(cases);
  });
  it("returns empty when no cases", async () => {
    const r = await listTestCasesForPrompt("p99");
    expect(r).toEqual([]);
  });
  it("throws on error", async () => {
    mockEq.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(listTestCasesForPrompt("p1")).rejects.toEqual({ message: "denied" });
  });
});
