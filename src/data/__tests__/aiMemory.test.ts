/**
 * DAL — aiMemory module tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
      delete: () => ({
        eq: (...args: unknown[]) => {
          mockEq(...args);
          return mockDelete();
        },
      }),
    }),
  },
}));

import { createMemory, deleteMemory } from "@/data/aiMemory";

describe("DAL — aiMemory", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createMemory", () => {
    it("inserts a memory entry", async () => {
      mockInsert.mockResolvedValue({ error: null });
      await createMemory({
        user_id: "u1",
        content: "Test memory",
        memory_type: "fact",
      });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: "u1", content: "Test memory" })
      );
    });

    it("throws on insert error", async () => {
      mockInsert.mockResolvedValue({ error: { message: "duplicate" } });
      await expect(
        createMemory({ user_id: "u1", content: "dup" })
      ).rejects.toEqual({ message: "duplicate" });
    });
  });

  describe("deleteMemory", () => {
    it("deletes by id", async () => {
      mockDelete.mockResolvedValue({ error: null });
      await deleteMemory("mem-1");
      expect(mockEq).toHaveBeenCalledWith("id", "mem-1");
    });

    it("throws on delete error", async () => {
      mockDelete.mockResolvedValue({ error: { message: "not found" } });
      await expect(deleteMemory("bad-id")).rejects.toEqual({ message: "not found" });
    });
  });
});
