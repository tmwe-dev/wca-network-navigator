import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
describe("DAL — agentRoutingRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
  });
  it("module loads", async () => {
    const mod = await import("@/data/agentRoutingRules");
    expect(mod).toBeDefined();
  });
});
