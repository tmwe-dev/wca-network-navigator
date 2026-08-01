/**
 * Type helpers — Unit tests
 */
import { describe, it, expect } from "vitest";
import { asEnrichmentData } from "@/lib/types/enrichmentData";
import { asSourceMeta } from "@/lib/types/sourceMeta";

describe("Type helpers", () => {
  describe("asEnrichmentData", () => {
    it("returns empty object for null/undefined", () => {
      expect(asEnrichmentData(null)).toEqual({});
      expect(asEnrichmentData(undefined)).toEqual({});
    });

    it("returns the object with typed access", () => {
      const data = { website: "https://example.com", phone: "+1234" };
      const result = asEnrichmentData(data);
      expect(result.website).toBe("https://example.com");
      expect(result.phone).toBe("+1234");
    });

    it("handles nested contact_profiles", () => {
      const data = {
        contact_profiles: {
          "abc": { name: "John", email: "john@example.com" }
        }
      };
      const result = asEnrichmentData(data);
      expect(result.contact_profiles?.abc?.name).toBe("John");
    });
  });

  describe("asSourceMeta", () => {
    it("returns empty object for null/undefined", () => {
      expect(asSourceMeta(null)).toEqual({});
      expect(asSourceMeta(undefined)).toEqual({});
    });

    it("returns typed access to common fields", () => {
      const data = { company_name: "Acme", contact_name: "John" };
      const result = asSourceMeta(data);
      expect(result.company_name).toBe("Acme");
      expect(result.contact_name).toBe("John");
    });
  });
});
