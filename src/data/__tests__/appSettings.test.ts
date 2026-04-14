/**
 * DAL — appSettings module tests
 * Tests: upsertAppSetting, getAppSetting, getAppSettingByKey
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      upsert: mockUpsert,
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              eq: (...eqArgs2: unknown[]) => {
                mockEq(...eqArgs2);
                return { maybeSingle: mockMaybeSingle };
              },
              maybeSingle: mockMaybeSingle,
            };
          },
        };
      },
      insert: mockInsert,
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return {
          eq: () => ({ eq: () => ({ error: null }) }),
        };
      },
    }),
  },
}));

import {
  upsertAppSetting,
  getAppSetting,
  getAppSettingByKey,
  insertAppSetting,
} from "@/data/appSettings";

describe("DAL — appSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("upsertAppSetting", () => {
    it("calls upsert with correct params", async () => {
      mockUpsert.mockResolvedValue({ error: null });
      await upsertAppSetting("user-1", "theme", "dark");
      expect(mockUpsert).toHaveBeenCalledWith(
        { user_id: "user-1", key: "theme", value: "dark" },
        { onConflict: "user_id,key" }
      );
    });

    it("throws on supabase error", async () => {
      mockUpsert.mockResolvedValue({ error: { message: "conflict" } });
      await expect(upsertAppSetting("u", "k", "v")).rejects.toEqual({ message: "conflict" });
    });
  });

  describe("getAppSetting", () => {
    it("returns value when found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: { value: "dark" }, error: null });
      const result = await getAppSetting("theme", "user-1");
      expect(result).toBe("dark");
    });

    it("returns null when not found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await getAppSetting("missing", "user-1");
      expect(result).toBeNull();
    });
  });

  describe("getAppSettingByKey", () => {
    it("returns value for key", async () => {
      mockMaybeSingle.mockResolvedValue({ data: { value: "enabled" }, error: null });
      const result = await getAppSettingByKey("feature_flag");
      expect(result).toBe("enabled");
    });
  });

  describe("insertAppSetting", () => {
    it("calls insert with setting object", async () => {
      mockInsert.mockResolvedValue({ error: null });
      await insertAppSetting({ key: "new_key", value: "val", user_id: "u1" });
      expect(mockInsert).toHaveBeenCalledWith({ key: "new_key", value: "val", user_id: "u1" });
    });
  });
});
