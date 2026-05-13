import { describe, it, expect, vi } from "vitest";
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
describe("DAL — aiEditPatterns", () => {
  it("module loads", async () => {
    const mod = await import("@/data/aiEditPatterns");
    expect(mod).toBeDefined();
  });
});
