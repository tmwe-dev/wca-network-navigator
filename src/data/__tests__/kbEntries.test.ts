import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));
vi.mock("@/lib/queryKeys", () => ({ queryKeys: { v2: { kbEntries: () => ["v2", "kbEntries"] } } }));
import { findKbEntries, countKbEntries, deleteKbEntry } from "@/data/kbEntries";
describe("DAL — kbEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // findKbEntries: select("*").order("category").order("sort_order") → {data,error}
    const orderChain = { order: vi.fn() };
    orderChain.order.mockResolvedValue({ data: [], error: null });
    mockOrder.mockReturnValue(orderChain);
    mockFrom.mockReturnValue({ select: mockSelect, delete: mockDelete });
    mockSelect.mockReturnValue({ order: mockOrder, count: 0, error: null });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });
  it("finds kb entries", async () => {
    const entries = [{ id: "k1" }];
    const orderChain = { order: vi.fn().mockResolvedValue({ data: entries, error: null }) };
    mockOrder.mockReturnValue(orderChain);
    const r = await findKbEntries();
    expect(r).toEqual(entries);
  });
  it("throws on error", async () => {
    const orderChain = { order: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) };
    mockOrder.mockReturnValue(orderChain);
    await expect(findKbEntries()).rejects.toEqual({ message: "x" });
  });
  it("counts entries", async () => {
    mockSelect.mockReturnValue({ count: 10, error: null });
    const r = await countKbEntries();
    expect(r).toBe(10);
  });
  it("deletes entry", async () => {
    await expect(deleteKbEntry("k1")).resolves.not.toThrow();
  });
});
