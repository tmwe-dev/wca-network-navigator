import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));
import { fetchPlaybooks } from "@/data/commercialPlaybooks";

describe("DAL — commercialPlaybooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockEq.mockReturnValue({ order: mockOrder });
  });
  it("returns playbooks", async () => {
    const pbs = [{ id: "p1", name: "Cold Outreach" }];
    mockOrder.mockResolvedValue({ data: pbs, error: null });
    const result = await fetchPlaybooks();
    expect(result).toEqual(pbs);
  });
  it("returns empty on null", async () => {
    mockOrder.mockResolvedValue({ data: null, error: null });
    const result = await fetchPlaybooks();
    expect(result).toEqual([]);
  });
});
