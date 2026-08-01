import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => mockFrom(table) } }));
import { getBulkJob } from "@/data/bulkJobs";
describe("DAL — bulkJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({ data: { id: "b1", status: "running" }, error: null });
  });
  it("gets a bulk job", async () => {
    const r = await getBulkJob("b1");
    // Il DAL normalizza la riga DB nel tipo di dominio (payload Json -> record,
    // contatori nullable -> 0), quindi il confronto è sui campi normalizzati.
    expect(r).toMatchObject({ id: "b1", status: "running", payload: {}, processed: 0, total: 0 });
  });
  it("returns null when not found", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const r = await getBulkJob("b99");
    expect(r).toBeNull();
  });
});
