import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));
import { fetchAlertRecipients, createAlertRecipient, deleteAlertRecipient } from "@/data/alertRecipients";

describe("DAL — alertRecipients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, delete: mockDelete });
    mockSelect.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });
  it("fetches recipients", async () => {
    const r = [{ id: "1", email: "a@b.com" }];
    mockSelect.mockResolvedValue({ data: r, error: null });
    const result = await fetchAlertRecipients();
    expect(result).toEqual(r);
  });
  it("creates recipient", async () => {
    await createAlertRecipient({ email: "x@y.com", channel: "email" } as never);
    expect(mockInsert).toHaveBeenCalled();
  });
  it("deletes recipient", async () => {
    await deleteAlertRecipient("r1");
    expect(mockDelete).toHaveBeenCalled();
  });
});
