import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => mockFrom(...a) },
}));

import { findClientAssignmentsByUser } from "@/data/clientAssignments";

describe("DAL — clientAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ data: [], error: null });
  });

  describe("findClientAssignmentsByUser", () => {
    it("returns assignments for user", async () => {
      const assignments = [{ agent_id: "a1" }];
      mockEq.mockResolvedValue({ data: assignments, error: null });
      const result = await findClientAssignmentsByUser("u1");
      expect(mockFrom).toHaveBeenCalledWith("client_assignments");
      expect(result).toEqual(assignments);
    });

    it("returns empty on null data", async () => {
      mockEq.mockResolvedValue({ data: null, error: null });
      const result = await findClientAssignmentsByUser("u1");
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockEq.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(findClientAssignmentsByUser("u1")).rejects.toEqual({ message: "fail" });
    });
  });
});
