import { describe, it, expect, vi } from "vitest";

// Motivazione: import dinamico modulo DAL — transform Vite a freddo sotto carico
// parallelo può superare i 5s default. Nessun cambio runtime.
vi.setConfig({ testTimeout: 30_000 });
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => mockFrom(table) } }));
describe("DAL — agentSimulator", () => {
  it("module loads", async () => {
    const mod = await import("@/data/agentSimulator");
    expect(mod).toBeDefined();
  });
});
