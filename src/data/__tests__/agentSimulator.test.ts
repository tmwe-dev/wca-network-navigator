import { describe, it, expect, vi } from "vitest";
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));
describe("DAL — agentSimulator", () => {
  it("module loads", async () => {
    const mod = await import("@/data/agentSimulator");
    expect(mod).toBeDefined();
  });
});
