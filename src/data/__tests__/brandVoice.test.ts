import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { getBrandVoice, upsertBrandVoice } from "@/data/brandVoice";

describe("DAL — brandVoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockUpsert.mockResolvedValue({ error: null });
  });

  describe("getBrandVoice", () => {
    it("returns brand voice data", async () => {
      const voice = { id: "bv1", tone: "professional" };
      mockMaybeSingle.mockResolvedValue({ data: voice, error: null });
      const result = await getBrandVoice("user-1");
      expect(mockFrom).toHaveBeenCalledWith("brand_voice_config");
      expect(result).toEqual(voice);
    });

    it("returns null when no data", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await getBrandVoice("user-1");
      expect(result).toBeNull();
    });

    it("throws on error", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(getBrandVoice("u1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("upsertBrandVoice", () => {
    it("upserts voice config", async () => {
      await upsertBrandVoice("u1", { tone: "casual" } as never);
      expect(mockUpsert).toHaveBeenCalled();
    });

    it("throws on error", async () => {
      mockUpsert.mockResolvedValue({ error: { message: "fail" } });
      await expect(upsertBrandVoice("u1", {} as never)).rejects.toEqual({ message: "fail" });
    });
  });
});
