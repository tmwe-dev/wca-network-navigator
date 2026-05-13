import { describe, it, expect, vi } from "vitest";
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
describe("DAL — aiTestScenarios", () => {
  it("module loads", async () => {
    const mod = await import("@/data/aiTestScenarios");
    expect(mod).toBeDefined();
  });
});
