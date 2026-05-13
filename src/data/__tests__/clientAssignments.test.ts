import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));
import { fetchClientAssignments, createClientAssignment, deleteClientAssignment } from "@/data/clientAssignments";

describe("DAL — clientAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, delete: mockDelete });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq });
    mockSelect.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });
  it("fetches assignments", async () => {
    const a = [{ id: "a1", client_id: "c1" }];
    mockSelect.mockResolvedValue({ data: a, error: null });
    const result = await fetchClientAssignments();
    expect(result).toEqual(a);
  });
  it("creates assignment", async () => {
    await createClientAssignment({ client_id: "c1", user_id: "u1" } as never);
    expect(mockInsert).toHaveBeenCalled();
  });
  it("deletes assignment", async () => {
    await deleteClientAssignment("a1");
    expect(mockDelete).toHaveBeenCalled();
  });
});
