import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { listFunnemailBrain } from "@/data/funnemailBrain";
describe("DAL — funnemailBrain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });
  it("returns brain entries", async () => {
    const entries = [{ id: "b1", rule: "test" }];
    mockLimit.mockResolvedValue({ data: entries, error: null });
    const r = await listFunnemailBrain();
    expect(r).toEqual(entries);
  });
  it("returns empty when no entries", async () => {
    const r = await listFunnemailBrain();
    expect(r).toEqual([]);
  });
});
