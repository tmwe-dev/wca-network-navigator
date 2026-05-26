import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));
import { getCronPaused, listSystemFlags } from "@/data/systemFlags";
describe("DAL — systemFlags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({ data: { value: "true" }, error: null });
    mockOrder.mockResolvedValue({ data: [], error: null });
  });
  it("returns true when flag is true", async () => {
    const r = await getCronPaused();
    expect(r).toBe(true);
  });
  it("returns false when not found", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getCronPaused()).toBe(false);
  });
  it("returns false on error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "err" } });
    expect(await getCronPaused()).toBe(false);
  });
  it("lists system flags", async () => {
    mockOrder.mockResolvedValue({ data: [{ key: "k", value: "v" }], error: null });
    const r = await listSystemFlags();
    expect(r).toHaveLength(1);
  });
  it("returns empty on list error", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "x" } });
    expect(await listSystemFlags()).toEqual([]);
  });
});
