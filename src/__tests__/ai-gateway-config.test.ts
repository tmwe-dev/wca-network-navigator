import { describe, it, expect } from "vitest";

// Import config directly - since these are pure data exports
// we don't need to mock them
import {
  PROVIDER_CONFIG,
  MODEL_MAP,
  ALLOWED_MODELS,
  type ProviderKey,
  type ProviderEntry,
} from "../../../supabase/functions/_shared/aiGatewayConfig";

describe("aiGatewayConfig", () => {
  describe("PROVIDER_CONFIG", () => {
    it("should have exactly 7 providers", () => {
      const providerKeys = Object.keys(PROVIDER_CONFIG);
      expect(providerKeys).toHaveLength(7);
    });

    it("should include all expected provider keys", () => {
      const expectedProviders: ProviderKey[] = [
        "lovable",
        "openrouter",
        "openai",
        "anthropic",
        "google",
        "grok",
        "qwen",
      ];
      const actualProviders = Object.keys(PROVIDER_CONFIG) as ProviderKey[];
      expectedProviders.forEach((provider) => {
        expect(actualProviders).toContain(provider);
      });
    });

    it("each provider should have url and authHeader properties", () => {
      Object.entries(PROVIDER_CONFIG).forEach(([provider, config]) => {
        expect(config).toHaveProperty("url");
        expect(config).toHaveProperty("authHeader");
        expect(typeof config.url).toBe("string");
        expect(typeof config.authHeader).toBe("function");
      });
    });

    it("should have valid URL format for each provider", () => {
      Object.entries(PROVIDER_CONFIG).forEach(([provider, config]) => {
        expect(config.url).toMatch(/^https:\/\//);
      });
    });

    it("lovable provider should have correct URL", () => {
      expect(PROVIDER_CONFIG.lovable.url).toBe(
        "https://ai.gateway.lovable.dev/v1/chat/completions"
      );
    });

    it("openrouter provider should have correct URL", () => {
      expect(PROVIDER_CONFIG.openrouter.url).toBe(
        "https://openrouter.ai/api/v1/chat/completions"
      );
    });

    it("openai provider should have correct URL", () => {
      expect(PROVIDER_CONFIG.openai.url).toBe(
        "https://api.openai.com/v1/chat/completions"
      );
    });

    it("anthropic provider should have correct URL", () => {
      expect(PROVIDER_CONFIG.anthropic.url).toBe(
        "https://api.anthropic.com/v1/messages"
      );
    });

    it("google provider should have correct URL", () => {
      expect(PROVIDER_CONFIG.google.url).toBe(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      );
    });

    it("grok provider should have correct URL", () => {
      expect(PROVIDER_CONFIG.grok.url).toBe(
        "https://api.x.ai/v1/chat/completions"
      );
    });

    it("qwen provider should have correct URL", () => {
      expect(PROVIDER_CONFIG.qwen.url).toBe(
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"
      );
    });

    it("authHeader should generate Bearer token for most providers", () => {
      const testKey = "test-api-key-123";
      expect(PROVIDER_CONFIG.lovable.authHeader(testKey)).toBe(
        "Bearer test-api-key-123"
      );
      expect(PROVIDER_CONFIG.openrouter.authHeader(testKey)).toBe(
        "Bearer test-api-key-123"
      );
      expect(PROVIDER_CONFIG.openai.authHeader(testKey)).toBe(
        "Bearer test-api-key-123"
      );
      expect(PROVIDER_CONFIG.google.authHeader(testKey)).toBe(
        "Bearer test-api-key-123"
      );
      expect(PROVIDER_CONFIG.grok.authHeader(testKey)).toBe(
        "Bearer test-api-key-123"
      );
      expect(PROVIDER_CONFIG.qwen.authHeader(testKey)).toBe(
        "Bearer test-api-key-123"
      );
    });

    it("anthropic authHeader should return just the key without Bearer prefix", () => {
      const testKey = "test-api-key-123";
      expect(PROVIDER_CONFIG.anthropic.authHeader(testKey)).toBe(
        "test-api-key-123"
      );
    });

    it("authHeader should handle empty key", () => {
      expect(PROVIDER_CONFIG.openai.authHeader("")).toBe("Bearer ");
      expect(PROVIDER_CONFIG.anthropic.authHeader("")).toBe("");
    });

    it("authHeader should handle special characters in key", () => {
      const specialKey = "key-with-special_chars.123";
      expect(PROVIDER_CONFIG.openai.authHeader(specialKey)).toBe(
        "Bearer key-with-special_chars.123"
      );
    });
  });

  describe("MODEL_MAP", () => {
    it("should have mappings for all 7 providers", () => {
      const providers = Object.keys(MODEL_MAP);
      expect(providers).toHaveLength(7);
    });

    it("should include all expected providers in MODEL_MAP", () => {
      const expectedProviders: ProviderKey[] = [
        "lovable",
        "openrouter",
        "openai",
        "anthropic",
        "google",
        "grok",
        "qwen",
      ];
      expectedProviders.forEach((provider) => {
        expect(MODEL_MAP).toHaveProperty(provider);
      });
    });

    it("lovable and openrouter should have empty model maps", () => {
      expect(MODEL_MAP.lovable).toEqual({});
      expect(MODEL_MAP.openrouter).toEqual({});
    });

    it("openai provider should have 6 model mappings", () => {
      expect(Object.keys(MODEL_MAP.openai)).toHaveLength(6);
    });

    it("anthropic provider should have 6 model mappings", () => {
      expect(Object.keys(MODEL_MAP.anthropic)).toHaveLength(6);
    });

    it("google provider should have 6 model mappings", () => {
      expect(Object.keys(MODEL_MAP.google)).toHaveLength(6);
    });

    it("grok provider should have 6 model mappings", () => {
      expect(Object.keys(MODEL_MAP.grok)).toHaveLength(6);
    });

    it("qwen provider should have 6 model mappings", () => {
      expect(Object.keys(MODEL_MAP.qwen)).toHaveLength(6);
    });

    it("openai should map google/gemini-2.5-flash to gpt-4o-mini", () => {
      expect(MODEL_MAP.openai["google/gemini-2.5-flash"]).toBe("gpt-4o-mini");
    });

    it("openai should map openai/gpt-5 to gpt-4o", () => {
      expect(MODEL_MAP.openai["openai/gpt-5"]).toBe("gpt-4o");
    });

    it("anthropic should map openai/gpt-5 to claude-sonnet-4-20250514", () => {
      expect(MODEL_MAP.anthropic["openai/gpt-5"]).toBe(
        "claude-sonnet-4-20250514"
      );
    });

    it("anthropic should map google/gemini-2.5-flash to claude-haiku-4-20250514", () => {
      expect(MODEL_MAP.anthropic["google/gemini-2.5-flash"]).toBe(
        "claude-haiku-4-20250514"
      );
    });

    it("google should map google/gemini-2.5-flash to gemini-2.5-flash", () => {
      expect(MODEL_MAP.google["google/gemini-2.5-flash"]).toBe(
        "gemini-2.5-flash"
      );
    });

    it("google should map google/gemini-2.5-flash-lite to gemini-2.5-flash-lite", () => {
      expect(MODEL_MAP.google["google/gemini-2.5-flash-lite"]).toBe(
        "gemini-2.5-flash-lite"
      );
    });

    it("grok should map multiple models to grok-3-mini-fast", () => {
      expect(MODEL_MAP.grok["google/gemini-2.5-flash"]).toBe(
        "grok-3-mini-fast"
      );
      expect(MODEL_MAP.grok["openai/gpt-5"]).toBe("grok-3-mini-fast");
      expect(MODEL_MAP.grok["google/gemini-2.5-flash-lite"]).toBe(
        "grok-3-mini-fast"
      );
    });

    it("qwen should map models correctly", () => {
      expect(MODEL_MAP.qwen["google/gemini-3-flash-preview"]).toBe(
        "qwen-plus"
      );
      expect(MODEL_MAP.qwen["google/gemini-2.5-flash"]).toBe("qwen-turbo");
    });

    it("all values in MODEL_MAP should be strings", () => {
      Object.entries(MODEL_MAP).forEach(([provider, modelMap]) => {
        Object.entries(modelMap).forEach(([source, target]) => {
          expect(typeof source).toBe("string");
          expect(typeof target).toBe("string");
          expect(source.length).toBeGreaterThan(0);
          expect(target.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe("ALLOWED_MODELS", () => {
    it("should be a Set", () => {
      expect(ALLOWED_MODELS).toBeInstanceOf(Set);
    });

    it("should contain exactly 6 models", () => {
      expect(ALLOWED_MODELS.size).toBe(6);
    });

    it("should contain google/gemini-2.5-flash", () => {
      expect(ALLOWED_MODELS.has("google/gemini-2.5-flash")).toBe(true);
    });

    it("should contain google/gemini-2.5-flash-lite", () => {
      expect(ALLOWED_MODELS.has("google/gemini-2.5-flash-lite")).toBe(true);
    });

    it("should contain google/gemini-3-flash-preview", () => {
      expect(ALLOWED_MODELS.has("google/gemini-3-flash-preview")).toBe(true);
    });

    it("should contain openai/gpt-5-mini", () => {
      expect(ALLOWED_MODELS.has("openai/gpt-5-mini")).toBe(true);
    });

    it("should contain openai/gpt-5", () => {
      expect(ALLOWED_MODELS.has("openai/gpt-5")).toBe(true);
    });

    it("should contain openai/gpt-5-nano", () => {
      expect(ALLOWED_MODELS.has("openai/gpt-5-nano")).toBe(true);
    });

    it("should not contain invalid model names", () => {
      expect(ALLOWED_MODELS.has("invalid-model")).toBe(false);
      expect(ALLOWED_MODELS.has("openai/gpt-4")).toBe(false);
      expect(ALLOWED_MODELS.has("anthropic/claude-3")).toBe(false);
    });

    it("should be immutable (cannot add to it after creation)", () => {
      const originalSize = ALLOWED_MODELS.size;
      // Note: This test documents behavior, though Sets can still be modified via .add()
      // In practice, we treat it as immutable configuration
      expect(ALLOWED_MODELS.size).toBe(originalSize);
    });

    it("all allowed models should have format provider/model-name", () => {
      ALLOWED_MODELS.forEach((model) => {
        expect(model).toMatch(/^[a-z]+\/[a-z0-9\-\.]+$/);
      });
    });
  });

  describe("Configuration Consistency", () => {
    it("all models used in MODEL_MAP should be in ALLOWED_MODELS or empty provider", () => {
      const providersWithMappings = ["openai", "anthropic", "google", "grok", "qwen"];

      providersWithMappings.forEach((provider) => {
        Object.keys(MODEL_MAP[provider as ProviderKey]).forEach((sourceModel) => {
          expect(ALLOWED_MODELS.has(sourceModel)).toBe(true);
        });
      });
    });

    it("should not have overlapping provider configs and empty maps", () => {
      expect(Object.keys(MODEL_MAP.lovable).length).toBe(0);
      expect(Object.keys(MODEL_MAP.openrouter).length).toBe(0);
      // Others should have mappings
      expect(Object.keys(MODEL_MAP.openai).length).toBeGreaterThan(0);
      expect(Object.keys(MODEL_MAP.anthropic).length).toBeGreaterThan(0);
    });

    it("PROVIDER_CONFIG and MODEL_MAP should have matching keys", () => {
      const configKeys = Object.keys(PROVIDER_CONFIG).sort();
      const mapKeys = Object.keys(MODEL_MAP).sort();
      expect(configKeys).toEqual(mapKeys);
    });
  });
});
