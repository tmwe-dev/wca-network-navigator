import { describe, it, expect } from "vitest";
import {
  getCountryFlag,
  getYearsMember,
  formatPartnerType,
  formatServiceCategory,
  getServiceColor,
  getServiceIconName,
  getServiceIconColor,
  resolveCountryCode,
  getPartnerTypeIconName,
  getPriorityColor,
} from "./countries";

// ── getCountryFlag ───────────────────────────────────────────────

describe("getCountryFlag", () => {
  it("returns flag emoji for a valid 2-letter code", () => {
    const flag = getCountryFlag("IT");
    // Italian flag: regional indicators I + T
    expect(flag).toBeTruthy();
    expect(flag.length).toBeGreaterThan(0);
  });

  it("handles lowercase country codes", () => {
    const flag = getCountryFlag("us");
    // Should still produce a valid flag since toUpperCase is applied
    expect(flag).toBeTruthy();
  });

  it("returns globe emoji for empty string", () => {
    expect(getCountryFlag("")).toBe("🌍");
  });

  it("returns globe emoji for invalid length codes", () => {
    expect(getCountryFlag("A")).toBe("🌍");
    expect(getCountryFlag("ABC")).toBe("🌍");
  });

  it("returns globe emoji for null/undefined input", () => {
    expect(getCountryFlag(null as any)).toBe("🌍");
    expect(getCountryFlag(undefined as any)).toBe("🌍");
  });
});

// ── getYearsMember ───────────────────────────────────────────────

describe("getYearsMember", () => {
  it("returns 0 for null input", () => {
    expect(getYearsMember(null)).toBe(0);
  });

  it("calculates years from a past date", () => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    fiveYearsAgo.setMonth(fiveYearsAgo.getMonth() - 1); // ensure full 5 years
    const result = getYearsMember(fiveYearsAgo.toISOString());
    expect(result).toBe(5);
  });

  it("returns 0 for a very recent date", () => {
    const recent = new Date().toISOString();
    expect(getYearsMember(recent)).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(getYearsMember("")).toBe(0);
  });
});

// ── formatPartnerType ────────────────────────────────────────────

describe("formatPartnerType", () => {
  it("formats snake_case to Title Case", () => {
    expect(formatPartnerType("freight_forwarder")).toBe("Freight Forwarder");
  });

  it("returns 'Partner' for null input", () => {
    expect(formatPartnerType(null)).toBe("Partner");
  });

  it("handles single word", () => {
    expect(formatPartnerType("carrier")).toBe("Carrier");
  });
});

// ── formatServiceCategory ────────────────────────────────────────

describe("formatServiceCategory", () => {
  it("formats snake_case to UPPER CASE words", () => {
    expect(formatServiceCategory("air_freight")).toBe("AIR FREIGHT");
  });

  it("handles single word", () => {
    expect(formatServiceCategory("warehousing")).toBe("WAREHOUSING");
  });
});

// ── getServiceColor ──────────────────────────────────────────────

describe("getServiceColor", () => {
  it("returns a consistent muted class for any category", () => {
    const result = getServiceColor("air_freight");
    expect(result).toContain("bg-muted");
  });
});

// ── getServiceIconName ───────────────────────────────────────────

describe("getServiceIconName", () => {
  it("returns correct icon for known services", () => {
    expect(getServiceIconName("air_freight")).toBe("Plane");
    expect(getServiceIconName("ocean_fcl")).toBe("Ship");
    expect(getServiceIconName("road_freight")).toBe("Truck");
    expect(getServiceIconName("dangerous_goods")).toBe("AlertTriangle");
    expect(getServiceIconName("warehousing")).toBe("Warehouse");
  });

  it("returns 'Box' for unknown services", () => {
    expect(getServiceIconName("unknown_service")).toBe("Box");
  });
});

// ── getServiceIconColor ──────────────────────────────────────────

describe("getServiceIconColor", () => {
  it("returns correct color for known services", () => {
    expect(getServiceIconColor("air_freight")).toBe("text-sky-400");
    expect(getServiceIconColor("dangerous_goods")).toBe("text-red-500");
  });

  it("returns slate for unknown services", () => {
    expect(getServiceIconColor("unknown")).toBe("text-slate-500");
  });
});

// ── resolveCountryCode ───────────────────────────────────────────

describe("resolveCountryCode", () => {
  it("resolves common aliases", () => {
    expect(resolveCountryCode("USA")).toBe("US");
    expect(resolveCountryCode("uae")).toBe("AE");
    expect(resolveCountryCode("UK")).toBe("GB");
  });

  it("resolves full country names", () => {
    expect(resolveCountryCode("Germany")).toBe("DE");
    expect(resolveCountryCode("france")).toBe("FR");
    expect(resolveCountryCode("Saudi Arabia")).toBe("SA");
  });

  it("resolves 2-letter ISO codes directly", () => {
    expect(resolveCountryCode("IT")).toBe("IT");
    expect(resolveCountryCode("de")).toBe("DE");
  });

  it("returns null for empty input", () => {
    expect(resolveCountryCode("")).toBeNull();
  });

  it("returns null for unresolvable input", () => {
    expect(resolveCountryCode("Narnia")).toBeNull();
  });

  it("handles whitespace and casing", () => {
    expect(resolveCountryCode("  United States  ")).toBe("US");
    expect(resolveCountryCode("JAPAN")).toBe("JP");
  });

  it("resolves alternate names", () => {
    expect(resolveCountryCode("Holland")).toBe("NL");
    expect(resolveCountryCode("Czechia")).toBe("CZ");
    expect(resolveCountryCode("Burma")).toBe("MM");
  });
});

// ── getPartnerTypeIconName ───────────────────────────────────────

describe("getPartnerTypeIconName", () => {
  it("returns correct icons for known types", () => {
    expect(getPartnerTypeIconName("freight_forwarder")).toBe("Truck");
    expect(getPartnerTypeIconName("carrier")).toBe("Ship");
    expect(getPartnerTypeIconName("3pl")).toBe("Warehouse");
  });

  it("returns 'Box' for null", () => {
    expect(getPartnerTypeIconName(null)).toBe("Box");
  });

  it("returns 'Box' for unknown type", () => {
    expect(getPartnerTypeIconName("unknown")).toBe("Box");
  });
});

// ── getPriorityColor ─────────────────────────────────────────────

describe("getPriorityColor", () => {
  it("returns destructive for high priority", () => {
    expect(getPriorityColor("high")).toContain("destructive");
  });

  it("returns warning for medium priority", () => {
    expect(getPriorityColor("medium")).toContain("warning");
  });

  it("returns muted for low priority", () => {
    expect(getPriorityColor("low")).toContain("muted");
  });

  it("returns muted for null", () => {
    expect(getPriorityColor(null)).toContain("muted");
  });
});
