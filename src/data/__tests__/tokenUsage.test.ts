import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }) }));
import { getTodayUsage } from "@/data/tokenUsage";
describe("DAL — tokenUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ gte: mockGte });
    mockGte.mockResolvedValue({ data: [{ total_tokens: 50 }, { total_tokens: 30 }], error: null });
  });
  it("returns sum of today tokens", async () => {
    const r = await getTodayUsage("u1");
    expect(r).toBe(80);
  });
  it("returns 0 on error", async () => {
    mockGte.mockResolvedValue({ data: null, error: { message: "fail" } });
    const r = await getTodayUsage("u1");
    expect(r).toBe(0);
  });
  it("returns 0 on empty", async () => {
    mockGte.mockResolvedValue({ data: [], error: null });
    expect(await getTodayUsage("u1")).toBe(0);
  });
});
