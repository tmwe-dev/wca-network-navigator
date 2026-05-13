import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));
import { findContactInteractions, createContactInteraction } from "@/data/contactInteractions";

describe("DAL — contactInteractions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValue({ error: null });
  });
  it("fetches interactions for contact", async () => {
    const ix = [{ id: "i1", type: "email" }];
    mockOrder.mockResolvedValue({ data: ix, error: null });
    const result = await findContactInteractions("c1");
    expect(result).toEqual(ix);
  });
  it("creates interaction", async () => {
    await createContactInteraction({ contact_id: "c1", type: "call" } as never);
    expect(mockInsert).toHaveBeenCalled();
  });
  it("throws on error", async () => {
    mockInsert.mockResolvedValue({ error: { message: "fail" } });
    await expect(createContactInteraction({ contact_id: "c1" } as never)).rejects.toEqual({ message: "fail" });
  });
});
