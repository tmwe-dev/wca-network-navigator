import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));
import { updateProspectLeadStatus, updateProspect } from "@/data/prospects";
describe("DAL — prospects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });
  it("updates lead status", async () => {
    await updateProspectLeadStatus("p1", "qualified");
    expect(mockFrom).toHaveBeenCalledWith("prospects");
  });
  it("updates prospect fields", async () => {
    await updateProspect("p1", { company: "test" });
    expect(mockFrom).toHaveBeenCalledWith("prospects");
  });
  it("throws on error", async () => {
    mockEq.mockResolvedValue({ error: { message: "fail" } });
    await expect(updateProspectLeadStatus("p1", "x")).rejects.toEqual({ message: "fail" });
  });
});
