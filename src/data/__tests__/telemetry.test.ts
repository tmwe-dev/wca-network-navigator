import { describe, it, expect, vi, beforeEach } from "vitest";
const mockInsert = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));
import { insertPageEvent } from "@/data/telemetry";
describe("DAL — telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });
  });
  it("inserts a page event", async () => {
    await insertPageEvent({ page: "/dashboard", ts: Date.now() });
    expect(mockFrom).toHaveBeenCalledWith("page_events");
  });
  it("resolves even on error", async () => {
    mockInsert.mockResolvedValue({ error: { message: "rls" } });
    await expect(insertPageEvent({ page: "/" })).resolves.not.toThrow();
  });
});
