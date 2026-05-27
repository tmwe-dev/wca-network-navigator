import { describe, it, expect, vi } from "vitest";
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => mockFrom(table) } }));
describe("DAL — promptLabSignals", () => {
  it("module loads", async () => {
    const mod = await import("@/data/promptLabSignals");
    expect(mod).toBeDefined();
  });
});
