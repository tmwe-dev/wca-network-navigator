import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockUntypedFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
vi.mock("@/lib/supabaseUntyped", () => ({ untypedFrom: (...a: unknown[]) => mockUntypedFrom(...a) }));
import { listSharedMailboxes } from "@/data/mailboxes";
describe("DAL — mailboxes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockUntypedFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockResolvedValue({ data: [], error: null });
  });
  it("lists shared mailboxes", async () => {
    const mboxes = [{ email: "shared@co.com" }];
    mockSelect.mockResolvedValue({ data: mboxes, error: null });
    const r = await listSharedMailboxes();
    expect(r).toBeDefined();
  });
});
