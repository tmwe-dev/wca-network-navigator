import { describe, it, expect } from "vitest";
import {
  asEnrichment,
  asTerminalLog,
  toJson,
  getBranchCountries,
  sortPartners,
  getRealLogoUrl,
  type EnrichmentData,
  type TerminalLogEntry,
} from "@/lib/partnerUtils";

describe("asEnrichment", () => {
  it("returns null for null/undefined", () => {
    expect(asEnrichment(null)).toBeNull();
    expect(asEnrichment(undefined)).toBeNull();
  });

  it("returns null for non-object", () => {
    expect(asEnrichment("string")).toBeNull();
    expect(asEnrichment(123)).toBeNull();
  });

  it("returns typed object for valid data", () => {
    const data = { deep_search_at: "2024-01-01", tokens_used: { credits_consumed: 5 } };
    const result = asEnrichment(data);
    expect(result).not.toBeNull();
    expect(result!.deep_search_at).toBe("2024-01-01");
    expect(result!.tokens_used?.credits_consumed).toBe(5);
  });

  it("handles empty object", () => {
    const result = asEnrichment({});
    expect(result).not.toBeNull();
    expect(result!.deep_search_at).toBeUndefined();
  });
});

describe("asTerminalLog", () => {
  it("returns empty array for non-array", () => {
    expect(asTerminalLog(null)).toEqual([]);
    expect(asTerminalLog(undefined)).toEqual([]);
    expect(asTerminalLog("string")).toEqual([]);
    expect(asTerminalLog({})).toEqual([]);
  });

  it("returns typed array for valid data", () => {
    const entries: TerminalLogEntry[] = [
      { ts: "10:00:00", type: "INFO", msg: "Started" },
      { ts: "10:00:05", type: "ERROR", msg: "Failed" },
    ];
    const result = asTerminalLog(entries);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("INFO");
    expect(result[1].msg).toBe("Failed");
  });
});

describe("toJson", () => {
  it("converts arrays to Json type", () => {
    const result = toJson([1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });

  it("converts objects to Json type", () => {
    const result = toJson({ key: "value" });
    expect(result).toEqual({ key: "value" });
  });

  it("converts null to Json type", () => {
    const result = toJson(null);
    expect(result).toBeNull();
  });
});

describe("getRealLogoUrl", () => {
  it("returns null for falsy values", () => {
    expect(getRealLogoUrl(null)).toBeNull();
    expect(getRealLogoUrl(undefined)).toBeNull();
    expect(getRealLogoUrl("")).toBeNull();
  });

  it("returns URL as-is", () => {
    expect(getRealLogoUrl("https://example.com/logo.png")).toBe("https://example.com/logo.png");
  });
});

describe("getBranchCountries", () => {
  it("returns empty array for no branches", () => {
    expect(getBranchCountries({ branch_cities: null })).toEqual([]);
    expect(getBranchCountries({ branch_cities: undefined })).toEqual([]);
    expect(getBranchCountries({})).toEqual([]);
  });

  it("extracts unique countries excluding HQ country", () => {
    const partner = {
      country_code: "IT",
      branch_cities: [
        { country_code: "US", country_name: "United States" },
        { country_code: "DE", country_name: "Germany" },
        { country_code: "IT", country_name: "Italy" }, // Same as HQ — should be excluded
        { country_code: "US", country_name: "United States" }, // Duplicate — should be deduped
      ],
    };
    const result = getBranchCountries(partner);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.code === "US")).toBeTruthy();
    expect(result.find((r) => r.code === "DE")).toBeTruthy();
    expect(result.find((r) => r.code === "IT")).toBeFalsy();
  });

  it("handles branch_cities with country field instead of country_code", () => {
    const partner = {
      country_code: "IT",
      branch_cities: [{ country: "FR", country_name: "France" }],
    };
    const result = getBranchCountries(partner);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("FR");
  });
});

describe("sortPartners", () => {
  const partners = [
    { company_name: "Beta Corp", rating: 3, member_since: "2020-01-01", country_name: "Italy", branch_cities: [1, 2], partner_contacts: [] },
    { company_name: "Alpha Inc", rating: 5, member_since: "2015-06-15", country_name: "Germany", branch_cities: [], partner_contacts: [] },
    { company_name: "Gamma Ltd", rating: 1, member_since: "2022-03-10", country_name: "France", branch_cities: [1], partner_contacts: [] },
  ] as Record<string, unknown>[];

  it("sorts by name ascending", () => {
    const sorted = sortPartners(partners, "name_asc");
    expect((sorted[0] as { company_name: string }).company_name).toBe("Alpha Inc");
    expect((sorted[2] as { company_name: string }).company_name).toBe("Gamma Ltd");
  });

  it("sorts by name descending", () => {
    const sorted = sortPartners(partners, "name_desc");
    expect((sorted[0] as { company_name: string }).company_name).toBe("Gamma Ltd");
  });

  it("sorts by rating descending", () => {
    const sorted = sortPartners(partners, "rating_desc");
    expect((sorted[0] as { rating: number }).rating).toBe(5);
    expect((sorted[2] as { rating: number }).rating).toBe(1);
  });

  it("sorts by country ascending", () => {
    const sorted = sortPartners(partners, "country_asc");
    expect((sorted[0] as { country_name: string }).country_name).toBe("France");
  });

  it("sorts by branches descending", () => {
    const sorted = sortPartners(partners, "branches_desc");
    expect((sorted[0] as { company_name: string }).company_name).toBe("Beta Corp");
  });

  it("does not mutate original array", () => {
    const original = [...partners];
    sortPartners(partners, "name_asc");
    expect(partners).toEqual(original);
  });
});
