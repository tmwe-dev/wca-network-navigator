import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => mockFrom(table) } }));
import { listLinkedInAddresses, updateLinkedInAddressNotes } from "@/data/linkedinAddresses";
describe("DAL — linkedinAddresses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });
  it("lists linkedin addresses", async () => {
    const addrs = [{ id: "l1", url: "linkedin.com/in/test" }];
    mockLimit.mockResolvedValue({ data: addrs, error: null });
    const r = await listLinkedInAddresses({});
    expect(r).toEqual(addrs);
  });
  it("updates notes", async () => {
    await expect(updateLinkedInAddressNotes("l1", "note")).resolves.not.toThrow();
  });
});
