import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));
import { listWhatsAppAddresses, updateWhatsAppAddressNotes } from "@/data/whatsappAddresses";
describe("DAL — whatsappAddresses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });
  it("lists whatsapp addresses", async () => {
    const addrs = [{ id: "w1", phone: "+39123" }];
    mockLimit.mockResolvedValue({ data: addrs, error: null });
    const r = await listWhatsAppAddresses({});
    expect(r).toEqual(addrs);
  });
  it("updates notes", async () => {
    await expect(updateWhatsAppAddressNotes("w1", "note")).resolves.not.toThrow();
  });
});
