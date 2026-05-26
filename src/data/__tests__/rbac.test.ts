import { describe, it, expect, vi } from "vitest";
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));
describe("DAL — rbac", () => {
  it("module loads and exports types", async () => {
    const mod = await import("@/data/rbac");
    expect(mod).toBeDefined();
  });
});
