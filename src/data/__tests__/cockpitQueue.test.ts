import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));
import { fetchCockpitQueue } from "@/data/cockpitQueue";

describe("DAL — cockpitQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });
  it("returns queue items", async () => {
    const items = [{ id: "q1", status: "pending" }];
    mockLimit.mockResolvedValue({ data: items, error: null });
    const result = await fetchCockpitQueue();
    expect(result).toEqual(items);
  });
  it("returns empty on null", async () => {
    mockLimit.mockResolvedValue({ data: null, error: null });
    const result = await fetchCockpitQueue();
    expect(result).toEqual([]);
  });
});
