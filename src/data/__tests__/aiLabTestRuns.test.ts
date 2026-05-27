import { describe, it, expect, vi, beforeEach } from "vitest";
const mockInsert = vi.fn();
const mockFrom = vi.fn();
const mockGetSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table), auth: { getSession: () => mockGetSession() } },
}));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }) }));
import { insertTestRun } from "@/data/aiLabTestRuns";
describe("DAL — aiLabTestRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "r1" }, error: null }) }),
    });
  });
  it("inserts a test run", async () => {
    const id = await insertTestRun({
      totalScore: 10,
      maxScore: 20,
      passCount: 5,
      warnCount: 3,
      failCount: 2,
      summary: {},
    } as never);
    expect(id).toBe("r1");
  });
  it("returns null when not authenticated", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const id = await insertTestRun({} as never);
    expect(id).toBeNull();
  });
});
