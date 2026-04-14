/**
 * DAL — profiles module tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          limit: (...lArgs: unknown[]) => {
            mockLimit(...lArgs);
            return {
              single: mockSingle,
            };
          },
        };
      },
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return { error: null };
          },
        };
      },
    }),
  },
}));

import { getProfileSummary, updateProfileOnboarding, checkProfileConnection } from "@/data/profiles";

describe("DAL — profiles", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getProfileSummary", () => {
    it("returns profile data on success", async () => {
      mockSingle.mockResolvedValue({
        data: { id: "p1", display_name: "Alice", onboarding_completed: true },
        error: null,
      });
      const result = await getProfileSummary();
      expect(result).toEqual({ id: "p1", display_name: "Alice", onboarding_completed: true });
    });

    it("throws on error", async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
      await expect(getProfileSummary()).rejects.toEqual({ message: "not found" });
    });
  });

  describe("updateProfileOnboarding", () => {
    it("updates onboarding_completed for user", async () => {
      await updateProfileOnboarding("user-123");
      expect(mockUpdate).toHaveBeenCalledWith({ onboarding_completed: true });
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-123");
    });
  });
});
