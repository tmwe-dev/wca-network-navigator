import { describe, it, expect, vi } from "vitest";
const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  then: (cb: any) => Promise.resolve({ data: [], error: null }).then(cb),
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...a: any[]) => mockFrom(...a),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
    removeChannel: vi.fn(),
    storage: { from: vi.fn().mockReturnValue({ upload: vi.fn(), download: vi.fn() }) },
  },
}));
vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (...a: any[]) => mockFrom(...a),
}));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));
describe("DAL — funnemailStatuses", () => {
  it("module loads", async () => {
    const mod = await import("@/data/funnemailStatuses");
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
