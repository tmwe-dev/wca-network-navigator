import { describe, it, expect, vi, beforeEach } from "vitest";

// Import the pure functions from the source
import {
  formatTokenCount,
  getFunctionDisplayName,
  getMaxTokensForFunction,
} from "../../../supabase/functions/_shared/tokenLogger";

// Mock SupabaseClient type for tests
type MockSupabaseClient = {
  from: (table: string) => {
    select: (fields: string) => {
      eq: (field: string, value: string) => {
        eq?: (field: string, value: string) => {
          maybeSingle: () => Promise<{ data: { value: string } | null; error: null | Error }>;
        };
        maybeSingle?: () => Promise<{ data: { value: string } | null; error: null | Error }>;
      };
    };
  };
};

describe("tokenLogger", () => {
  describe("formatTokenCount", () => {
    it("should return exact count as string for values under 1000", () => {
      expect(formatTokenCount(0)).toBe("0");
      expect(formatTokenCount(1)).toBe("1");
      expect(formatTokenCount(500)).toBe("500");
      expect(formatTokenCount(999)).toBe("999");
    });

    it("should format values >= 1000 as kilotoken format (K)", () => {
      expect(formatTokenCount(1000)).toBe("1.0K");
      expect(formatTokenCount(1200)).toBe("1.2K");
      expect(formatTokenCount(45200)).toBe("45.2K");
      expect(formatTokenCount(100000)).toBe("100.0K");
      expect(formatTokenCount(999999)).toBe("1000.0K");
    });

    it("should format values >= 1000000 as megatoken format (M)", () => {
      expect(formatTokenCount(1000000)).toBe("1.0M");
      expect(formatTokenCount(1200000)).toBe("1.2M");
      expect(formatTokenCount(5500000)).toBe("5.5M");
      expect(formatTokenCount(10000000)).toBe("10.0M");
      expect(formatTokenCount(100000000)).toBe("100.0M");
    });

    it("should have 1 decimal place for K and M formats", () => {
      expect(formatTokenCount(12345)).toBe("12.3K");
      expect(formatTokenCount(1234567)).toBe("1.2M");
    });

    it("should handle edge cases", () => {
      expect(formatTokenCount(1500)).toBe("1.5K");
      expect(formatTokenCount(10500)).toBe("10.5K");
      expect(formatTokenCount(1500000)).toBe("1.5M");
    });

    it("should return string type always", () => {
      expect(typeof formatTokenCount(0)).toBe("string");
      expect(typeof formatTokenCount(500)).toBe("string");
      expect(typeof formatTokenCount(50000)).toBe("string");
      expect(typeof formatTokenCount(5000000)).toBe("string");
    });

    it("should correctly round decimal values", () => {
      expect(formatTokenCount(1111)).toBe("1.1K"); // 1.111 -> 1.1
      expect(formatTokenCount(1199)).toBe("1.2K"); // 1.199 -> 1.2
      expect(formatTokenCount(1111111)).toBe("1.1M"); // 1.111 -> 1.1
    });
  });

  describe("getFunctionDisplayName", () => {
    it("should return mapped name for generate_email", () => {
      expect(getFunctionDisplayName("generate_email")).toBe("Genera Email");
    });

    it("should return mapped name for generate_outreach", () => {
      expect(getFunctionDisplayName("generate_outreach")).toBe(
        "Genera Outreach"
      );
    });

    it("should return mapped name for improve_email", () => {
      expect(getFunctionDisplayName("improve_email")).toBe("Migliora Email");
    });

    it("should return mapped name for classify_email", () => {
      expect(getFunctionDisplayName("classify_email")).toBe("Classifica Email");
    });

    it("should return mapped name for ai_assistant", () => {
      expect(getFunctionDisplayName("ai_assistant")).toBe("Assistente AI");
    });

    it("should return original name for unknown function names", () => {
      expect(getFunctionDisplayName("unknown_function")).toBe("unknown_function");
      expect(getFunctionDisplayName("custom_function")).toBe("custom_function");
      expect(getFunctionDisplayName("my_feature")).toBe("my_feature");
    });

    it("should be case-sensitive", () => {
      expect(getFunctionDisplayName("Generate_Email")).toBe("Generate_Email");
      expect(getFunctionDisplayName("GENERATE_EMAIL")).toBe("GENERATE_EMAIL");
    });

    it("should handle empty string", () => {
      expect(getFunctionDisplayName("")).toBe("");
    });

    it("should return string always", () => {
      expect(typeof getFunctionDisplayName("generate_email")).toBe("string");
      expect(typeof getFunctionDisplayName("unknown")).toBe("string");
    });

    it("all mapped values should be non-empty strings", () => {
      const functions = [
        "generate_email",
        "generate_outreach",
        "improve_email",
        "classify_email",
        "ai_assistant",
      ];
      functions.forEach((fn) => {
        const display = getFunctionDisplayName(fn);
        expect(display).toBeTruthy();
        expect(display.length).toBeGreaterThan(0);
      });
    });
  });

  describe("getMaxTokensForFunction", () => {
    let mockSupabase: MockSupabaseClient;

    beforeEach(() => {
      // Create a mock Supabase client
      mockSupabase = {
        from: vi.fn((table: string) => ({
          select: vi.fn(() => ({
            eq: vi.fn((field: string, value: string) => ({
              eq: vi.fn((field: string, value: string) => ({
                maybeSingle: vi.fn(),
              })),
              maybeSingle: vi.fn(),
            })),
          })),
        })),
      } as unknown as MockSupabaseClient;
    });

    it("should return default value when no setting is found", async () => {
      const mockChain = {
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockEq = vi.fn().mockReturnValue(mockChain);
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const supabase = { from: mockFrom } as unknown as MockSupabaseClient;

      const result = await getMaxTokensForFunction(
        supabase,
        "user-123",
        "ai_max_tokens_generate_email",
        4096
      );

      expect(result).toBe(4096);
    });

    it("should return setting value when found", async () => {
      const mockChain = {
        maybeSingle: vi.fn().mockResolvedValue({
          data: { value: "2048" },
          error: null,
        }),
      };

      const mockEq = vi.fn().mockReturnValue(mockChain);
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const supabase = { from: mockFrom } as unknown as MockSupabaseClient;

      const result = await getMaxTokensForFunction(
        supabase,
        "user-123",
        "ai_max_tokens_generate_email",
        4096
      );

      expect(result).toBe(2048);
    });

    it("should return default value when setting value is invalid", async () => {
      const mockChain = {
        maybeSingle: vi.fn().mockResolvedValue({
          data: { value: "not-a-number" },
          error: null,
        }),
      };

      const mockEq = vi.fn().mockReturnValue(mockChain);
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const supabase = { from: mockFrom } as unknown as MockSupabaseClient;

      const result = await getMaxTokensForFunction(
        supabase,
        "user-123",
        "ai_max_tokens_generate_email",
        4096
      );

      expect(result).toBe(4096);
    });

    it("should return default value when setting value is zero or negative", async () => {
      const mockChainZero = {
        maybeSingle: vi.fn().mockResolvedValue({
          data: { value: "0" },
          error: null,
        }),
      };

      const mockEqZero = vi.fn().mockReturnValue(mockChainZero);
      const mockSelectZero = vi.fn().mockReturnValue({ eq: mockEqZero });
      const mockFromZero = vi.fn().mockReturnValue({ select: mockSelectZero });

      const supabaseZero = { from: mockFromZero } as unknown as MockSupabaseClient;

      const resultZero = await getMaxTokensForFunction(
        supabaseZero,
        "user-123",
        "ai_max_tokens_generate_email",
        4096
      );

      expect(resultZero).toBe(4096);

      // Test negative
      const mockChainNeg = {
        maybeSingle: vi.fn().mockResolvedValue({
          data: { value: "-100" },
          error: null,
        }),
      };

      const mockEqNeg = vi.fn().mockReturnValue(mockChainNeg);
      const mockSelectNeg = vi.fn().mockReturnValue({ eq: mockEqNeg });
      const mockFromNeg = vi.fn().mockReturnValue({ select: mockSelectNeg });

      const supabaseNeg = { from: mockFromNeg } as unknown as MockSupabaseClient;

      const resultNeg = await getMaxTokensForFunction(
        supabaseNeg,
        "user-123",
        "ai_max_tokens_generate_email",
        4096
      );

      expect(resultNeg).toBe(4096);
    });

    it("should handle query errors gracefully", async () => {
      const mockChain = {
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: null, error: new Error("Query failed") }),
      };

      const mockEq = vi.fn().mockReturnValue(mockChain);
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const supabase = { from: mockFrom } as unknown as MockSupabaseClient;

      const result = await getMaxTokensForFunction(
        supabase,
        "user-123",
        "ai_max_tokens_generate_email",
        4096
      );

      expect(result).toBe(4096);
    });

    it("should handle promise rejections gracefully", async () => {
      const mockChain = {
        maybeSingle: vi
          .fn()
          .mockRejectedValue(new Error("Network error")),
      };

      const mockEq = vi.fn().mockReturnValue(mockChain);
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const supabase = { from: mockFrom } as unknown as MockSupabaseClient;

      const result = await getMaxTokensForFunction(
        supabase,
        "user-123",
        "ai_max_tokens_generate_email",
        4096
      );

      expect(result).toBe(4096);
    });

    it("should return number type always", async () => {
      const mockChain = {
        maybeSingle: vi.fn().mockResolvedValue({
          data: { value: "8192" },
          error: null,
        }),
      };

      const mockEq = vi.fn().mockReturnValue(mockChain);
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const supabase = { from: mockFrom } as unknown as MockSupabaseClient;

      const result = await getMaxTokensForFunction(
        supabase,
        "user-123",
        "ai_max_tokens_generate_email",
        4096
      );

      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("should work with different setting keys", async () => {
      const mockChain = {
        maybeSingle: vi.fn().mockResolvedValue({
          data: { value: "1024" },
          error: null,
        }),
      };

      const mockEq = vi.fn().mockReturnValue(mockChain);
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const supabase = { from: mockFrom } as unknown as MockSupabaseClient;

      const keys = [
        "ai_max_tokens_generate_email",
        "ai_max_tokens_generate_outreach",
        "ai_max_tokens_improve_email",
        "ai_max_tokens_classify_email",
        "ai_max_tokens_ai_assistant",
      ];

      for (const key of keys) {
        const result = await getMaxTokensForFunction(
          supabase,
          "user-123",
          key,
          4096
        );
        expect(result).toBe(1024);
      }
    });

    it("should work with different default values", async () => {
      const mockChain = {
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockEq = vi.fn().mockReturnValue(mockChain);
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const supabase = { from: mockFrom } as unknown as MockSupabaseClient;

      const defaults = [512, 1024, 2048, 4096, 8192];

      for (const defaultVal of defaults) {
        const result = await getMaxTokensForFunction(
          supabase,
          "user-123",
          "ai_max_tokens_generate_email",
          defaultVal
        );
        expect(result).toBe(defaultVal);
      }
    });

    it("should parse integer strings correctly", async () => {
      const testCases = [
        { value: "512", expected: 512 },
        { value: "1024", expected: 1024 },
        { value: "2048", expected: 2048 },
        { value: "4096", expected: 4096 },
        { value: "8192", expected: 8192 },
      ];

      for (const testCase of testCases) {
        const mockChain = {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { value: testCase.value },
            error: null,
          }),
        };

        const mockEq = vi.fn().mockReturnValue(mockChain);
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

        const supabase = { from: mockFrom } as unknown as MockSupabaseClient;

        const result = await getMaxTokensForFunction(
          supabase,
          "user-123",
          "ai_max_tokens_generate_email",
          4096
        );

        expect(result).toBe(testCase.expected);
      }
    });
  });

  describe("Integration Tests", () => {
    it("formatTokenCount and getFunctionDisplayName work together", () => {
      const tokenCount = 45200;
      const functionName = "generate_email";

      const formatted = formatTokenCount(tokenCount);
      const display = getFunctionDisplayName(functionName);

      expect(formatted).toBe("45.2K");
      expect(display).toBe("Genera Email");
    });
  });
});
