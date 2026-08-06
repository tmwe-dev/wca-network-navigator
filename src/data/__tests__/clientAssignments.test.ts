import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { findClientAssignmentsByUser } from "@/data/clientAssignments";

/** Terminal risultato query che supporta anche `.returns<T>()` come il client reale. */
function res(value: any) {
  const node: any = {
    returns: () => node,
    then: (onOk: (v: any) => void, onErr?: (e: any) => void) => Promise.resolve(value).then(onOk, onErr),
  };
  node.eq = () => node;
  node.in = () => node;
  node.order = () => node;
  node.limit = () => node;
  return node;
}

describe("DAL — clientAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue(res({ data: [], error: null }));
  });

  describe("findClientAssignmentsByUser", () => {
    it("returns assignments for user", async () => {
      const assignments = [{ agent_id: "a1" }];
      mockEq.mockReturnValue(res({ data: assignments, error: null }));
      const result = await findClientAssignmentsByUser("u1");
      expect(mockFrom).toHaveBeenCalledWith("client_assignments");
      expect(result).toEqual(assignments);
    });

    it("returns empty on null data", async () => {
      mockEq.mockReturnValue(res({ data: null, error: null }));
      const result = await findClientAssignmentsByUser("u1");
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockEq.mockReturnValue(res({ data: null, error: { message: "fail" } }));
      await expect(findClientAssignmentsByUser("u1")).rejects.toEqual({ message: "fail" });
    });
  });
});
