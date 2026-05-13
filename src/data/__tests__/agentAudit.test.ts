import { describe, it, expect, vi, beforeEach } from "vitest";
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
describe("DAL — agentAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert, select: mockSelect });
  });
  it("module loads", async () => {
    const mod = await import("@/data/agentAudit");
    expect(mod).toBeDefined();
  });
});
