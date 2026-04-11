import { describe, it, expect } from "vitest";
import { asEnrichment, getRealLogoUrl } from "@/lib/partnerUtils";

describe("partnerUtils", () => {
  describe("asEnrichment", () => {
    it("returns null for falsy input", () => {
      expect(asEnrichment(null)).toBeNull();
      expect(asEnrichment(undefined)).toBeNull();
      expect(asEnrichment("")).toBeNull();
    });

    it("returns null for non-object", () => {
      expect(asEnrichment(42)).toBeNull();
      expect(asEnrichment("string")).toBeNull();
    });

    it("casts object to EnrichmentData", () => {
      const data = { deep_search_at: "2024-01-01" };
      const result = asEnrichment(data);
      expect(result).toEqual(data);
      expect(result?.deep_search_at).toBe("2024-01-01");
    });
  });

  describe("getRealLogoUrl", () => {
    it("returns null for null/undefined", () => {
      expect(getRealLogoUrl(null)).toBeNull();
      expect(getRealLogoUrl(undefined)).toBeNull();
    });

    it("returns URL as-is", () => {
      expect(getRealLogoUrl("https://example.com/logo.png")).toBe("https://example.com/logo.png");
    });

    it("returns null for empty string", () => {
      expect(getRealLogoUrl("")).toBeNull();
    });
  });
});
