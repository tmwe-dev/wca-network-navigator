import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockGte = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));
import { fetchEmailSendLogStats } from "@/data/emailSendLog";
describe("DAL — emailSendLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ gte: mockGte });
    mockGte.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });
  it("returns stats for period", async () => {
    mockLimit.mockResolvedValue({ data: [{ id: "1", status: "sent", sent_at: "2024-01-01" }], error: null });
    const r = await fetchEmailSendLogStats("2024-01-01");
    expect(r).toBeDefined();
    expect(mockFrom).toHaveBeenCalledWith("email_send_log");
  });
  it("throws on error", async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: "fail" } });
    await expect(fetchEmailSendLogStats("2024-01-01")).rejects.toEqual({ message: "fail" });
  });
});
