import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockOrder1 = vi.fn();
const mockOrder2 = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { listFunnemailGroups, listFunnemailActions } from "@/data/funnemail";
describe("DAL — funnemail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    // listFunnemailGroups: select→order→order → {data,error}
    mockOrder2.mockResolvedValue({ data: [], error: null });
    mockOrder1.mockReturnValue({ order: mockOrder2 });
    // listFunnemailActions: select→order→limit → {data,error}
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockSelect.mockReturnValue({ order: mockOrder1 });
  });
  it("lists groups", async () => {
    const g = [{ id: "g1", nome_gruppo: "x", funnemail_enabled: true, funnemail_policy: {} }];
    mockOrder2.mockResolvedValue({ data: g, error: null });
    const r = await listFunnemailGroups();
    expect(r.length).toBe(1);
  });
  it("throws on groups error", async () => {
    mockOrder2.mockResolvedValue({ data: null, error: { message: "rls" } });
    await expect(listFunnemailGroups()).rejects.toEqual({ message: "rls" });
  });
  it("lists actions", async () => {
    mockOrder1.mockReturnValue({ order: mockOrder2, limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [{ id: "a1" }], error: null });
    const r = await listFunnemailActions(10);
    expect(r).toHaveLength(1);
  });
});
