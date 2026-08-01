import { describe, it, expect, vi } from "vitest";
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => mockFrom(table) } }));
describe("DAL — promptChangeProposals", () => {
  it("module loads", async () => {
    const mod = await import("@/data/promptChangeProposals");
    expect(mod).toBeDefined();
  });
});
