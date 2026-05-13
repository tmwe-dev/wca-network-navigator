import { describe, it, expect, vi } from "vitest";
const mockSelect = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
describe("DAL — emailPrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
  });
  it("module loads", async () => {
    const mod = await import("@/data/emailPrompts");
    expect(mod).toBeDefined();
  });
});
