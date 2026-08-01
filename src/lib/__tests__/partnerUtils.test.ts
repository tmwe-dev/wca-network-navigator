import { describe, it, expect } from "vitest";
import {
  asEnrichment,
  getRealLogoUrl,
  getEffectiveLogoUrl,
  getEnrichmentSnippet,
  sortPartners,
} from "@/lib/partnerUtils";

describe("partnerUtils", () => {
  describe("asEnrichment", () => {
    it("returns null for null input", () => {
      expect(asEnrichment(null)).toBeNull();
    });
    it("returns null for non-object", () => {
      expect(asEnrichment("string")).toBeNull();
    });
    it("returns object for valid data", () => {
      const d = { deep_search_at: "2024-01-01" };
      expect(asEnrichment(d)).toEqual(d);
    });
  });

  describe("getRealLogoUrl", () => {
    it("returns null for empty input", () => {
      expect(getRealLogoUrl(null)).toBeNull();
      expect(getRealLogoUrl(undefined)).toBeNull();
    });
    it("returns url as-is", () => {
      expect(getRealLogoUrl("https://logo.png")).toBe("https://logo.png");
    });
  });

  describe("getEffectiveLogoUrl", () => {
    it("prefers partner logo_url", () => {
      expect(getEffectiveLogoUrl({ logo_url: "a.png" })).toBe("a.png");
    });
    it("falls back to enrichment logo", () => {
      expect(getEffectiveLogoUrl({ enrichment_data: { logo_url: "b.png" } })).toBe("b.png");
    });
    it("returns null when no logo", () => {
      expect(getEffectiveLogoUrl({})).toBeNull();
    });
  });

  describe("getEnrichmentSnippet", () => {
    it("returns headline from ai_profile", () => {
      const p = { enrichment_data: { ai_profile: { headline: "Top firm" } } };
      expect(getEnrichmentSnippet(p)).toBe("Top firm");
    });
    it("returns null for no enrichment", () => {
      expect(getEnrichmentSnippet({})).toBeNull();
    });
  });

  describe("sortPartners", () => {
    const partners = [
      { company_name: "Beta", rating: 3, country_name: "Italy" },
      { company_name: "Alpha", rating: 5, country_name: "Germany" },
    ];
    it("sorts by name ascending", () => {
      const s = sortPartners(partners, "name_asc");
      expect(s[0].company_name).toBe("Alpha");
    });
    it("sorts by name descending", () => {
      const s = sortPartners(partners, "name_desc");
      expect(s[0].company_name).toBe("Beta");
    });
    it("sorts by rating descending", () => {
      const s = sortPartners(partners, "rating_desc");
      expect(s[0].rating).toBe(5);
    });
  });
});
