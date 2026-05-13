import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { findPendingOutreach, findSentOutreach, findScheduledOutreach } from "@/data/outreachPipeline";
describe("DAL — outreachPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: [], error: null });
  });
  it("finds pending outreach", async () => {
    const items = [{ id: "o1" }];
    mockOrder.mockResolvedValue({ data: items, error: null });
    const r = await findPendingOutreach();
    expect(r).toEqual(items);
  });
  it("finds sent outreach", async () => {
    mockOrder.mockResolvedValue({ data: [{ id: "o2" }], error: null });
    const r = await findSentOutreach();
    expect(r).toBeDefined();
  });
  it("finds scheduled outreach", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    const r = await findScheduledOutreach();
    expect(r).toEqual([]);
  });
});
