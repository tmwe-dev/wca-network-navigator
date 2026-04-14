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
} from "@/lib/countries";

describe("getCountryFlag", () => {
  it("returns correct flag emoji for IT", () => {
    expect(getCountryFlag("IT")).toBe("🇮🇹");
  });
  it("returns correct flag emoji for US", () => {
    expect(getCountryFlag("US")).toBe("🇺🇸");
  });
  it("handles lowercase input", () => {
    expect(getCountryFlag("gb")).toBe("🇬🇧");
  });
  it("returns globe for empty string", () => {
    expect(getCountryFlag("")).toBe("🌍");
  });
  it("returns globe for invalid length", () => {
    expect(getCountryFlag("ABC")).toBe("🌍");
    expect(getCountryFlag("A")).toBe("🌍");
  });
  it("returns globe for null-ish input", () => {
    expect(getCountryFlag(null as unknown as string)).toBe("🌍");
    expect(getCountryFlag(undefined as unknown as string)).toBe("🌍");
  });
});

describe("getYearsMember", () => {
  it("returns 0 for null", () => {
    expect(getYearsMember(null)).toBe(0);
  });
  it("returns positive years for past date", () => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    expect(getYearsMember(fiveYearsAgo.toISOString())).toBeGreaterThanOrEqual(4);
    expect(getYearsMember(fiveYearsAgo.toISOString())).toBeLessThanOrEqual(5);
  });
  it("returns 0 for recent date", () => {
    expect(getYearsMember(new Date().toISOString())).toBe(0);
  });
});

describe("formatPartnerType", () => {
  it("formats underscore-separated type", () => {
    expect(formatPartnerType("freight_forwarder")).toBe("Freight Forwarder");
  });
  it("returns 'Partner' for null", () => {
    expect(formatPartnerType(null)).toBe("Partner");
  });
  it("handles single word", () => {
    expect(formatPartnerType("carrier")).toBe("Carrier");
  });
});

describe("formatServiceCategory", () => {
  it("formats and uppercases", () => {
    expect(formatServiceCategory("air_freight")).toBe("AIR FREIGHT");
  });
  it("handles single word", () => {
    expect(formatServiceCategory("nvocc")).toBe("NVOCC");
  });
});

describe("getServiceIconName", () => {
  it("maps air_freight to Plane", () => {
    expect(getServiceIconName("air_freight")).toBe("Plane");
  });
  it("returns Box for unknown category", () => {
    expect(getServiceIconName("unknown_service")).toBe("Box");
  });
});

describe("getServiceIconColor", () => {
  it("returns specific color for air_freight", () => {
    expect(getServiceIconColor("air_freight")).toContain("sky");
  });
  it("returns slate fallback for unknown", () => {
    expect(getServiceIconColor("xyz")).toContain("slate");
  });
});

describe("resolveCountryCode", () => {
  it("resolves common alias 'uae' → AE", () => {
    expect(resolveCountryCode("uae")).toBe("AE");
  });
  it("resolves 'usa' → US", () => {
    expect(resolveCountryCode("usa")).toBe("US");
  });
  it("resolves 'United Kingdom' → GB", () => {
    expect(resolveCountryCode("United Kingdom")).toBe("GB");
  });
  it("returns null for empty string", () => {
    expect(resolveCountryCode("")).toBeNull();
  });
  it("returns null for gibberish", () => {
    expect(resolveCountryCode("xyznonexistent")).toBeNull();
  });
  it("handles 2-letter code directly", () => {
    const result = resolveCountryCode("IT");
    expect(result).toBe("IT");
  });
});

describe("getPriorityColor", () => {
  it("returns destructive for high", () => {
    expect(getPriorityColor("high")).toContain("destructive");
  });
  it("returns muted for null", () => {
    expect(getPriorityColor(null)).toContain("muted");
  });
  it("returns muted for unknown", () => {
    expect(getPriorityColor("unknown")).toContain("muted");
  });
});
