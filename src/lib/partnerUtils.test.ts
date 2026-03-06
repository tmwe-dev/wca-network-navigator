import { describe, it, expect } from "vitest";
import { getRealLogoUrl, getBranchCountries, sortPartners } from "./partnerUtils";
import type { Partner } from "@/hooks/usePartners";

// ── getRealLogoUrl ───────────────────────────────────────────────

describe("getRealLogoUrl", () => {
  it("returns the URL as-is when present", () => {
    expect(getRealLogoUrl("https://example.com/logo.png")).toBe("https://example.com/logo.png");
  });

  it("returns null for null input", () => {
    expect(getRealLogoUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(getRealLogoUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getRealLogoUrl("")).toBeNull();
  });
});

// ── getBranchCountries ───────────────────────────────────────────

describe("getBranchCountries", () => {
  it("returns unique branch countries excluding the partner's own country", () => {
    const partner = {
      country_code: "IT",
      branch_cities: [
        { country_code: "DE", country_name: "Germany" },
        { country_code: "FR", country_name: "France" },
        { country_code: "IT", country_name: "Italy" }, // should be excluded
      ],
    } as unknown as Partner;
    const result = getBranchCountries(partner);
    expect(result).toEqual([
      { code: "DE", name: "Germany" },
      { code: "FR", name: "France" },
    ]);
  });

  it("deduplicates countries by code", () => {
    const partner = {
      country_code: "IT",
      branch_cities: [
        { country_code: "DE", country_name: "Germany" },
        { country_code: "DE", country_name: "Germany" },
      ],
    } as unknown as Partner;
    expect(getBranchCountries(partner)).toHaveLength(1);
  });

  it("returns empty array when branch_cities is missing", () => {
    expect(getBranchCountries({} as unknown as Partner)).toEqual([]);
  });

  it("returns empty array when branch_cities is not an array", () => {
    expect(getBranchCountries({ branch_cities: "not an array" } as unknown as Partner)).toEqual([]);
  });

  it("returns empty array when branch_cities is null", () => {
    expect(getBranchCountries({ branch_cities: null } as unknown as Partner)).toEqual([]);
  });

  it("falls back to country field when country_code is missing on branch", () => {
    const partner = {
      country_code: "IT",
      branch_cities: [{ country: "DE", country_name: "Germany" }],
    } as unknown as Partner;
    expect(getBranchCountries(partner)).toEqual([{ code: "DE", name: "Germany" }]);
  });

  it("uses country code as name when country_name is missing", () => {
    const partner = {
      country_code: "IT",
      branch_cities: [{ country_code: "DE" }],
    } as unknown as Partner;
    expect(getBranchCountries(partner)).toEqual([{ code: "DE", name: "DE" }]);
  });

  it("skips branches without any country code", () => {
    const partner = {
      country_code: "IT",
      branch_cities: [{ city: "Berlin" }],
    } as unknown as Partner;
    expect(getBranchCountries(partner)).toEqual([]);
  });
});

// ── sortPartners ─────────────────────────────────────────────────

describe("sortPartners", () => {
  const partners = [
    { company_name: "Beta Corp", rating: 3, member_since: "2020-01-01", country_name: "Germany", branch_cities: [1, 2] },
    { company_name: "Alpha Inc", rating: 5, member_since: "2015-01-01", country_name: "France", branch_cities: [] },
    { company_name: "Gamma Ltd", rating: 1, member_since: "2023-06-01", country_name: "Austria", branch_cities: [1, 2, 3] },
  ] as unknown as Partner[];

  it("sorts by name ascending", () => {
    const sorted = sortPartners(partners, "name_asc");
    expect(sorted.map(p => p.company_name)).toEqual(["Alpha Inc", "Beta Corp", "Gamma Ltd"]);
  });

  it("sorts by name descending", () => {
    const sorted = sortPartners(partners, "name_desc");
    expect(sorted.map(p => p.company_name)).toEqual(["Gamma Ltd", "Beta Corp", "Alpha Inc"]);
  });

  it("sorts by rating descending", () => {
    const sorted = sortPartners(partners, "rating_desc");
    expect(sorted[0].company_name).toBe("Alpha Inc"); // rating 5
    expect(sorted[2].company_name).toBe("Gamma Ltd"); // rating 1
  });

  it("sorts by years membership descending", () => {
    const sorted = sortPartners(partners, "years_desc");
    // Alpha since 2015 has most years
    expect(sorted[0].company_name).toBe("Alpha Inc");
  });

  it("sorts by country ascending", () => {
    const sorted = sortPartners(partners, "country_asc");
    expect(sorted.map(p => p.country_name)).toEqual(["Austria", "France", "Germany"]);
  });

  it("sorts by branches descending", () => {
    const sorted = sortPartners(partners, "branches_desc");
    expect(sorted[0].company_name).toBe("Gamma Ltd"); // 3 branches
    expect(sorted[2].company_name).toBe("Alpha Inc"); // 0 branches
  });

  it("handles missing rating gracefully (defaults to 0)", () => {
    const data = [
      { company_name: "A", rating: null, country_name: "A" },
      { company_name: "B", rating: 5, country_name: "B" },
    ] as unknown as Partner[];
    const sorted = sortPartners(data, "rating_desc");
    expect(sorted[0].company_name).toBe("B");
  });

  it("handles missing branch_cities gracefully", () => {
    const data = [
      { company_name: "A", country_name: "A" },
      { company_name: "B", branch_cities: [1, 2, 3], country_name: "B" },
    ] as unknown as Partner[];
    const sorted = sortPartners(data, "branches_desc");
    expect(sorted[0].company_name).toBe("B");
  });

  it("does not mutate the original array", () => {
    const original = [...partners];
    sortPartners(partners, "name_asc");
    expect(partners.map(p => p.company_name)).toEqual(original.map(p => p.company_name));
  });

  it("returns a copy for unknown sort option", () => {
    const sorted = sortPartners(partners, "unknown" as any);
    expect(sorted).toHaveLength(partners.length);
  });
});
