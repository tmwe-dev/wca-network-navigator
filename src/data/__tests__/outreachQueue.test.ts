import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOrder1 = vi.fn();
const mockOrder2 = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
vi.mock("@/data/partnerBusy", () => ({ emitBusyPartnersChanged: vi.fn() }));
import { findPendingOutreachItems, updateOutreachItem } from "@/data/outreachQueue";
describe("DAL — outreachQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // findPendingOutreachItems: select→eq("status","pending")→order→order→limit
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockOrder2.mockReturnValue({ limit: mockLimit });
    mockOrder1.mockReturnValue({ order: mockOrder2 });
    mockEq.mockReturnValue({ order: mockOrder1 });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });
  it("finds pending items", async () => {
    mockLimit.mockResolvedValue({ data: [{ id: "o1" }], error: null });
    const r = await findPendingOutreachItems(5);
    expect(r).toHaveLength(1);
  });
  it("returns empty when none", async () => {
    const r = await findPendingOutreachItems();
    expect(r).toEqual([]);
  });
  it("updates an item", async () => {
    await expect(updateOutreachItem("o1", { status: "sent" })).resolves.not.toThrow();
  });
});
