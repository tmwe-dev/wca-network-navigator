import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }) }));
import { listNotifications } from "@/data/notifications";
describe("DAL — notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder, eq: mockEq });
    mockOrder.mockReturnValue({ range: mockRange });
    mockRange.mockResolvedValue({ data: [], error: null });
  });
  it("returns notifications", async () => {
    const notes = [{ id: "n1", type: "email_received" }];
    mockRange.mockResolvedValue({ data: notes, error: null });
    const result = await listNotifications("u1");
    expect(result).toEqual(notes);
  });
  it("returns empty on error", async () => {
    mockRange.mockResolvedValue({ data: null, error: { message: "fail" } });
    const result = await listNotifications("u1");
    expect(result).toEqual([]);
  });
  it("returns empty when no data", async () => {
    const result = await listNotifications("u1");
    expect(result).toEqual([]);
  });
});
