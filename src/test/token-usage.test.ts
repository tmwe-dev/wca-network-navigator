import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getTodayUsage,
  getMonthUsage,
  getUsageByFunction,
  getTokenSettings,
  updateTokenSetting,
  formatTokenCount,
  getFunctionDisplayName,
} from "@/data/tokenUsage";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockIn = vi.fn();
  const mockGte = vi.fn();
  const mockMaybeSingle = vi.fn();

  return {
    supabase: {
      from: mockFrom,
    },
    mockFrom,
    mockSelect,
    mockEq,
    mockIn,
    mockGte,
    mockMaybeSingle,
  };
});

import { supabase } from "@/integrations/supabase/client";

describe("Token Usage Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getTodayUsage", () => {
    it("should sum tokens used today", async () => {
      const mockData = [
        { total_tokens: 100 },
        { total_tokens: 200 },
        { total_tokens: 150 },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getTodayUsage("user123");

      expect(result).toBe(450);
      expect(supabase.from).toHaveBeenCalledWith("ai_token_usage");
      expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user123");
    });

    it("should return 0 when no usage records found", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getTodayUsage("user123");

      expect(result).toBe(0);
    });

    it("should handle empty array", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getTodayUsage("user123");

      expect(result).toBe(0);
    });

    it("should log error and return 0 on database error", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getTodayUsage("user123");

      expect(result).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should handle null total_tokens values", async () => {
      const mockData = [
        { total_tokens: 100 },
        { total_tokens: null },
        { total_tokens: 50 },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getTodayUsage("user123");

      expect(result).toBe(150);
    });
  });

  describe("getMonthUsage", () => {
    it("should sum tokens used this month", async () => {
      const mockData = [
        { total_tokens: 1000 },
        { total_tokens: 2000 },
        { total_tokens: 500 },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getMonthUsage("user123");

      expect(result).toBe(3500);
      expect(supabase.from).toHaveBeenCalledWith("ai_token_usage");
      expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user123");
    });

    it("should return 0 when no usage records found", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getMonthUsage("user123");

      expect(result).toBe(0);
    });

    it("should log error and return 0 on database error", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getMonthUsage("user123");

      expect(result).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("getUsageByFunction", () => {
    it("should aggregate tokens by function name", async () => {
      const mockData = [
        { function_name: "generate_email", total_tokens: 100 },
        { function_name: "generate_email", total_tokens: 200 },
        { function_name: "classify_email", total_tokens: 150 },
        { function_name: "classify_email", total_tokens: 75 },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getUsageByFunction("user123", 7);

      expect(result).toEqual({
        generate_email: 300,
        classify_email: 225,
      });
    });

    it("should support custom days parameter", async () => {
      const mockData = [{ function_name: "generate_email", total_tokens: 100 }];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await getUsageByFunction("user123", 30);

      expect(mockChain.gte).toHaveBeenCalled();
    });

    it("should return empty object when no data", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getUsageByFunction("user123");

      expect(result).toEqual({});
    });

    it("should log error and return empty object on database error", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getUsageByFunction("user123");

      expect(result).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should handle null total_tokens values", async () => {
      const mockData = [
        { function_name: "generate_email", total_tokens: 100 },
        { function_name: "generate_email", total_tokens: null },
        { function_name: "classify_email", total_tokens: 50 },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getUsageByFunction("user123");

      expect(result).toEqual({
        generate_email: 100,
        classify_email: 50,
      });
    });
  });

  describe("getTokenSettings", () => {
    it("should fetch token settings for user", async () => {
      const mockData = [
        { key: "ai_daily_token_limit", value: "10000" },
        { key: "ai_monthly_token_limit", value: "100000" },
        { key: "ai_rate_limit_per_minute", value: "10" },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getTokenSettings("user123");

      expect(result).toEqual({
        ai_daily_token_limit: "10000",
        ai_monthly_token_limit: "100000",
        ai_rate_limit_per_minute: "10",
      });
      expect(supabase.from).toHaveBeenCalledWith("app_settings");
      expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user123");
    });

    it("should return empty object when no settings found", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getTokenSettings("user123");

      expect(result).toEqual({});
    });

    it("should handle null values", async () => {
      const mockData = [
        { key: "ai_daily_token_limit", value: "10000" },
        { key: "ai_monthly_token_limit", value: null },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getTokenSettings("user123");

      expect(result).toEqual({
        ai_daily_token_limit: "10000",
        ai_monthly_token_limit: "",
      });
    });

    it("should log error and return empty object on database error", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await getTokenSettings("user123");

      expect(result).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("updateTokenSetting", () => {
    it("should update existing setting", async () => {
      const mockChainCheck = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "s1" }, error: null }),
      };

      const mockChainUpdate = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      mockChainUpdate.eq.mockResolvedValue({ error: null });

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockChainCheck as any)
        .mockReturnValueOnce(mockChainUpdate as any);

      await expect(updateTokenSetting("user123", "ai_daily_token_limit", "5000")).resolves.not.toThrow();
      expect(mockChainUpdate.update).toHaveBeenCalledWith({ value: "5000" });
    });

    it("should insert new setting when not exists", async () => {
      const mockChainCheck = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockChainInsert = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockChainCheck as any)
        .mockReturnValueOnce(mockChainInsert as any);

      await expect(updateTokenSetting("user123", "ai_daily_token_limit", "5000")).resolves.not.toThrow();
      expect(mockChainInsert.insert).toHaveBeenCalledWith({
        key: "ai_daily_token_limit",
        value: "5000",
        user_id: "user123",
      });
    });

    it("should throw error on update failure", async () => {
      const dbError = new Error("Update failed");

      const mockChainCheck = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "s1" }, error: null }),
      };

      const mockChainUpdate = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: dbError }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockChainCheck as any)
        .mockReturnValueOnce(mockChainUpdate as any);

      await expect(updateTokenSetting("user123", "ai_daily_token_limit", "5000")).rejects.toThrow("Update failed");
    });

    it("should throw error on insert failure", async () => {
      const dbError = new Error("Insert failed");

      const mockChainCheck = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockChainInsert = {
        insert: vi.fn().mockResolvedValue({ error: dbError }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockChainCheck as any)
        .mockReturnValueOnce(mockChainInsert as any);

      await expect(updateTokenSetting("user123", "ai_daily_token_limit", "5000")).rejects.toThrow("Insert failed");
    });
  });

  describe("formatTokenCount", () => {
    it("should format millions correctly", () => {
      expect(formatTokenCount(1000000)).toBe("1.0M");
      expect(formatTokenCount(5500000)).toBe("5.5M");
    });

    it("should format thousands correctly", () => {
      expect(formatTokenCount(1000)).toBe("1.0K");
      expect(formatTokenCount(5500)).toBe("5.5K");
    });

    it("should return plain numbers for values < 1000", () => {
      expect(formatTokenCount(0)).toBe("0");
      expect(formatTokenCount(500)).toBe("500");
      expect(formatTokenCount(999)).toBe("999");
    });

    it("should handle edge cases", () => {
      expect(formatTokenCount(1000000000)).toBe("1000.0M");
      expect(formatTokenCount(1500)).toBe("1.5K");
    });
  });

  describe("getFunctionDisplayName", () => {
    it("should return display name for known functions", () => {
      expect(getFunctionDisplayName("generate_email")).toBe("Genera Email");
      expect(getFunctionDisplayName("generate_outreach")).toBe("Genera Outreach");
      expect(getFunctionDisplayName("improve_email")).toBe("Migliora Email");
      expect(getFunctionDisplayName("classify_email")).toBe("Classifica Email");
      expect(getFunctionDisplayName("ai_assistant")).toBe("Assistente AI");
    });

    it("should return function name as-is for unknown functions", () => {
      expect(getFunctionDisplayName("unknown_function")).toBe("unknown_function");
      expect(getFunctionDisplayName("custom_ai")).toBe("custom_ai");
    });

    it("should be case sensitive", () => {
      expect(getFunctionDisplayName("GENERATE_EMAIL")).toBe("GENERATE_EMAIL");
      expect(getFunctionDisplayName("Generate_Email")).toBe("Generate_Email");
    });
  });
});
