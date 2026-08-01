import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => mockFrom(table) } }));
import { findConversations, deleteConversation } from "@/data/aiConversations";
describe("DAL — aiConversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    const eq2 = vi.fn().mockReturnValue({ order: mockOrder });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    mockSelect.mockReturnValue({ eq: eq1 });
    const delEq = vi.fn().mockResolvedValue({ error: null });
    mockDelete.mockReturnValue({ eq: delEq });
    mockFrom.mockReturnValue({ select: mockSelect, delete: mockDelete });
  });
  it("finds conversations", async () => {
    mockLimit.mockResolvedValue({ data: [{ id: "c1" }], error: null });
    const r = await findConversations("u1", "lab");
    expect(r).toHaveLength(1);
  });
  it("returns empty", async () => {
    const r = await findConversations("u1", "lab");
    expect(r).toEqual([]);
  });
  it("deletes conversation", async () => {
    await expect(deleteConversation("c1")).resolves.not.toThrow();
  });
});
