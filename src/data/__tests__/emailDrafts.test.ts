import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));
import { countEmailDrafts, insertEmailDraft } from "@/data/emailDrafts";
describe("DAL — emailDrafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });
    mockSelect.mockReturnValue({ count: 5, error: null });
    mockInsert.mockResolvedValue({ error: null });
  });
  it("returns count", async () => {
    const r = await countEmailDrafts();
    expect(r).toBe(5);
    expect(mockFrom).toHaveBeenCalledWith("email_drafts");
  });
  it("returns 0 when null", async () => {
    mockSelect.mockReturnValue({ count: null, error: null });
    expect(await countEmailDrafts()).toBe(0);
  });
  it("throws on count error", async () => {
    mockSelect.mockReturnValue({ count: null, error: { message: "fail" } });
    await expect(countEmailDrafts()).rejects.toEqual({ message: "fail" });
  });
  it("inserts a draft", async () => {
    await expect(insertEmailDraft({ subject: "test" })).resolves.not.toThrow();
  });
  it("throws on insert error", async () => {
    mockInsert.mockResolvedValue({ error: { message: "dup" } });
    await expect(insertEmailDraft({})).rejects.toEqual({ message: "dup" });
  });
});
