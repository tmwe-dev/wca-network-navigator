import { describe, it, expect } from "vitest";
import {
  getCountryFlag,
  getYearsMember,
  formatPartnerType,
  formatServiceCategory,
  getServiceColor,
  getServiceIconName,
  getServiceIconColor,
  getPartnerTypeIconName,
  getPriorityColor,
} from "./countries";

describe("countries", () => {
  describe("getCountryFlag", () => {
    it("returns flag emoji for valid 2-letter code", () => {
      expect(getCountryFlag("US")).toBe("🇺🇸");
      expect(getCountryFlag("IT")).toBe("🇮🇹");
    });

    it("handles lowercase codes", () => {
      expect(getCountryFlag("de")).toBe("🇩🇪");
    });

    it("returns globe for empty or invalid code", () => {
      expect(getCountryFlag("")).toBe("🌍");
      expect(getCountryFlag("ABC")).toBe("🌍");
    });
  });

  describe("getYearsMember", () => {
    it("returns 0 for null", () => {
      expect(getYearsMember(null)).toBe(0);
    });

    it("returns correct years for a past date", () => {
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      expect(getYearsMember(fiveYearsAgo.toISOString())).toBe(5);
    });
  });

  describe("formatPartnerType", () => {
    it("returns 'Partner' for null", () => {
      expect(formatPartnerType(null)).toBe("Partner");
    });

    it("formats underscore-separated words", () => {
      expect(formatPartnerType("freight_forwarder")).toBe("Freight Forwarder");
    });

    it("formats single word", () => {
      expect(formatPartnerType("carrier")).toBe("Carrier");
    });
  });

  describe("formatServiceCategory", () => {
    it("uppercases and joins with spaces", () => {
      expect(formatServiceCategory("air_freight")).toBe("AIR FREIGHT");
      expect(formatServiceCategory("ocean_lcl")).toBe("OCEAN LCL");
    });
  });

  describe("getServiceColor", () => {
    it("returns unified muted classes", () => {
      expect(getServiceColor("air_freight")).toContain("bg-muted");
      expect(getServiceColor("unknown")).toContain("bg-muted");
    });
  });

  describe("getServiceIconName", () => {
    it("maps known categories", () => {
      expect(getServiceIconName("air_freight")).toBe("Plane");
      expect(getServiceIconName("ocean_fcl")).toBe("Ship");
      expect(getServiceIconName("road_freight")).toBe("Truck");
    });

    it("returns Box for unknown category", () => {
      expect(getServiceIconName("unknown")).toBe("Box");
    });
  });

  describe("getServiceIconColor", () => {
    it("maps known categories to colors", () => {
      expect(getServiceIconColor("air_freight")).toBe("text-sky-400");
      expect(getServiceIconColor("ocean_fcl")).toBe("text-blue-500");
    });

    it("returns default for unknown", () => {
      expect(getServiceIconColor("unknown")).toBe("text-slate-500");
    });
  });

  describe("getPartnerTypeIconName", () => {
    it("maps known types", () => {
      expect(getPartnerTypeIconName("freight_forwarder")).toBe("Truck");
      expect(getPartnerTypeIconName("carrier")).toBe("Ship");
    });

    it("returns Box for null or unknown", () => {
      expect(getPartnerTypeIconName(null)).toBe("Box");
      expect(getPartnerTypeIconName("other")).toBe("Box");
    });
  });

  describe("getPriorityColor", () => {
    it("returns correct colors for each priority", () => {
      expect(getPriorityColor("high")).toContain("destructive");
      expect(getPriorityColor("medium")).toContain("warning");
      expect(getPriorityColor("low")).toContain("muted");
    });

    it("returns muted for null", () => {
      expect(getPriorityColor(null)).toContain("muted");
    });
  });
});
