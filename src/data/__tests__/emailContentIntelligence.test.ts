import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockIn = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (...a: unknown[]) => mockFrom(...a),
}));

import { fetchContentIntelligence, fetchContentIntelligenceBulk } from "@/data/emailContentIntelligence";

describe("DAL — emailContentIntelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, in: mockIn });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
  });

  describe("fetchContentIntelligence", () => {
    it("returns intelligence for message", async () => {
      const row = { id: "e1", message_id: "m1", content_label: "commercial" };
      mockMaybeSingle.mockResolvedValue({ data: row, error: null });
      const result = await fetchContentIntelligence("m1");
      expect(mockFrom).toHaveBeenCalledWith("email_content_intelligence");
      expect(result).toEqual(row);
    });

    it("returns null when not found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await fetchContentIntelligence("m99");
      expect(result).toBeNull();
    });

    it("returns null on error", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "fail" } });
      const result = await fetchContentIntelligence("m1");
      expect(result).toBeNull();
    });
  });

  describe("fetchContentIntelligenceBulk", () => {
    it("returns empty for empty ids", async () => {
      const result = await fetchContentIntelligenceBulk([]);
      expect(result).toEqual({});
    });

    it("returns map of intelligence rows", async () => {
      const rows = [
        { id: "e1", message_id: "m1", content_label: "commercial" },
        { id: "e2", message_id: "m2", content_label: "operational" },
      ];
      mockIn.mockResolvedValue({ data: rows, error: null });
      const result = await fetchContentIntelligenceBulk(["m1", "m2"]);
      expect(result["m1"]).toBeDefined();
      expect(result["m2"]).toBeDefined();
    });

    it("returns empty map on error", async () => {
      mockIn.mockResolvedValue({ data: null, error: { message: "fail" } });
      const result = await fetchContentIntelligenceBulk(["m1"]);
      expect(result).toEqual({});
    });
  });
});
