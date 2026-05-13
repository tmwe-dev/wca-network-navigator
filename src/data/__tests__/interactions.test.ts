import { describe, it, expect, vi, beforeEach } from "vitest";
const mockInsert = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { createInteraction } from "@/data/interactions";
describe("DAL — interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });
  });
  it("creates an interaction", async () => {
    await createInteraction({ type: "email", partner_id: "p1" } as never);
    expect(mockFrom).toHaveBeenCalledWith("interactions");
  });
  it("throws on error", async () => {
    mockInsert.mockResolvedValue({ error: { message: "fail" } });
    await expect(createInteraction({} as never)).rejects.toEqual({ message: "fail" });
  });
});
