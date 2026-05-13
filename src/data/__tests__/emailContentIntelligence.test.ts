import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockIn = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { fetchContentIntelligence, fetchContentIntelligenceBulk } from "@/data/emailContentIntelligence";
describe("DAL — emailContentIntelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, in: mockIn });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({ data: { id: "e1", suggestions: [] }, error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
  });
  it("fetches content intelligence for message", async () => {
    const r = await fetchContentIntelligence("m1");
    expect(r).toBeDefined();
  });
  it("returns null when not found", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const r = await fetchContentIntelligence("m99");
    expect(r).toBeNull();
  });
  it("fetches bulk intelligence", async () => {
    const rows = [{ id: "e1" }, { id: "e2" }];
    mockIn.mockResolvedValue({ data: rows, error: null });
    const r = await fetchContentIntelligenceBulk(["m1", "m2"]);
    expect(r).toEqual(rows);
  });
});
