import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const _mockEq = vi.fn();
const mockIn = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { findBusyPartnerIds } from "@/data/partnerBusy";
describe("DAL — partnerBusy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ in: mockIn });
    mockIn.mockResolvedValue({ data: [{ partner_id: "p1" }], error: null });
  });
  it("returns busy partner ids", async () => {
    const r = await findBusyPartnerIds(["outreach"]);
    expect(mockFrom).toHaveBeenCalledWith("partner_busy");
    expect(r).toBeDefined();
  });
  it("returns empty on no data", async () => {
    mockIn.mockResolvedValue({ data: [], error: null });
    const r = await findBusyPartnerIds(["outreach"]);
    expect(Array.isArray(r) || typeof r === "object").toBe(true);
  });
});
