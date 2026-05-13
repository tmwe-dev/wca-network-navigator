import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { fetchMemoryEntries, createMemoryEntry, updateMemoryEntry } from "@/data/aiMemory";

describe("DAL — aiMemory extended", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockEq.mockReturnValue({ order: mockOrder, eq: mockEq });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  describe("fetchMemoryEntries", () => {
    it("returns memory entries for user", async () => {
      const entries = [{ id: "m1", key: "test", value: "val" }];
      mockLimit.mockResolvedValue({ data: entries, error: null });
      const result = await fetchMemoryEntries("user-1");
      expect(mockFrom).toHaveBeenCalledWith("ai_memory");
      expect(result).toEqual(entries);
    });

    it("returns empty array on null data", async () => {
      mockLimit.mockResolvedValue({ data: null, error: null });
      const result = await fetchMemoryEntries("user-1");
      expect(result).toEqual([]);
    });
  });

  describe("createMemoryEntry", () => {
    it("inserts new entry", async () => {
      await createMemoryEntry({ key: "pref", value: "dark", user_id: "u1" } as never);
      expect(mockInsert).toHaveBeenCalled();
    });
  });
});
