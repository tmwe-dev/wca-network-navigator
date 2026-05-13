import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import {
  findPartnerContacts,
  insertPartnerContact,
  updatePartnerContact,
  countPartnerContacts,
} from "@/data/partnerRelations";
describe("DAL — partnerRelations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq, count: 0, error: null });
    mockEq.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });
  it("finds partner contacts", async () => {
    const cs = [{ id: "c1", name: "Test" }];
    mockEq.mockResolvedValue({ data: cs, error: null });
    const r = await findPartnerContacts("p1");
    expect(r).toEqual(cs);
  });
  it("inserts a contact", async () => {
    await expect(insertPartnerContact({ name: "New" })).resolves.not.toThrow();
  });
  it("updates a contact", async () => {
    mockEq.mockResolvedValue({ error: null });
    await expect(updatePartnerContact("c1", { name: "Updated" })).resolves.not.toThrow();
  });
  it("counts contacts", async () => {
    mockSelect.mockReturnValue({ count: 42, error: null });
    const r = await countPartnerContacts();
    expect(r).toBe(42);
  });
});
