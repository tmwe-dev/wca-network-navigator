import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { insertContactInteraction } from "@/data/contactInteractions";

describe("DAL — contactInteractions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });
  });

  describe("insertContactInteraction", () => {
    it("inserts interaction", async () => {
      await insertContactInteraction({ contact_id: "c1", interaction_type: "email" } as never);
      expect(mockFrom).toHaveBeenCalledWith("contact_interactions");
      expect(mockInsert).toHaveBeenCalled();
    });

    it("throws on error", async () => {
      mockInsert.mockResolvedValue({ error: { message: "fail" } });
      await expect(insertContactInteraction({ contact_id: "c1" } as never)).rejects.toEqual({ message: "fail" });
    });
  });
});
