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
} from "@/lib/countries";

describe("countries helpers", () => {
  describe("getCountryFlag", () => {
    it("genera emoji bandiera da codice ISO 2 lettere", () => {
      expect(getCountryFlag("IT")).toBe("🇮🇹");
      expect(getCountryFlag("US")).toBe("🇺🇸");
      expect(getCountryFlag("de")).toBe("🇩🇪");
    });

    it("ritorna 🌍 su codice invalido o vuoto", () => {
      expect(getCountryFlag("")).toBe("🌍");
      expect(getCountryFlag("X")).toBe("🌍");
      expect(getCountryFlag("ITA")).toBe("🌍");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
      expect(getCountryFlag(null as any)).toBe("🌍");
    });
  });

  describe("getYearsMember", () => {
    it("ritorna 0 su null", () => {
      expect(getYearsMember(null)).toBe(0);
    });

    it("calcola anni di membership", () => {
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      const r = getYearsMember(tenYearsAgo.toISOString());
      expect(r).toBeGreaterThanOrEqual(9);
      expect(r).toBeLessThanOrEqual(10);
    });

    it("ritorna 0 su data futura", () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 5);
      expect(getYearsMember(future.toISOString())).toBeLessThanOrEqual(0);
    });
  });

  describe("formatPartnerType", () => {
    it("converte snake_case in Title Case", () => {
      expect(formatPartnerType("freight_forwarder")).toBe("Freight Forwarder");
      expect(formatPartnerType("customs_broker")).toBe("Customs Broker");
      expect(formatPartnerType("nvocc")).toBe("Nvocc");
    });

    it("ritorna 'Partner' su null", () => {
      expect(formatPartnerType(null)).toBe("Partner");
    });
  });

  describe("formatServiceCategory", () => {
    it("converte snake_case in UPPER CASE separato da spazi", () => {
      expect(formatServiceCategory("air_freight")).toBe("AIR FREIGHT");
      expect(formatServiceCategory("ocean_fcl")).toBe("OCEAN FCL");
      expect(formatServiceCategory("nvocc")).toBe("NVOCC");
    });
  });

  describe("getServiceColor", () => {
    it("ritorna sempre la palette muted unificata", () => {
      const c = getServiceColor("air_freight");
      expect(c).toContain("bg-muted");
      expect(c).toContain("border");
      expect(getServiceColor("any_other")).toBe(c);
    });
  });

  describe("getServiceIconName", () => {
    it("mappa categorie note alle icone lucide", () => {
      expect(getServiceIconName("air_freight")).toBe("Plane");
      expect(getServiceIconName("ocean_fcl")).toBe("Ship");
      expect(getServiceIconName("road_freight")).toBe("Truck");
      expect(getServiceIconName("rail_freight")).toBe("TrainFront");
      expect(getServiceIconName("dangerous_goods")).toBe("AlertTriangle");
      expect(getServiceIconName("warehousing")).toBe("Warehouse");
      expect(getServiceIconName("nvocc")).toBe("Anchor");
    });

    it("default 'Box' su categoria sconosciuta", () => {
      expect(getServiceIconName("unknown")).toBe("Box");
    });
  });

  describe("getServiceIconColor", () => {
    it("mappa categorie note ai colori tailwind", () => {
      expect(getServiceIconColor("air_freight")).toBe("text-sky-400");
      expect(getServiceIconColor("ocean_fcl")).toBe("text-blue-500");
      expect(getServiceIconColor("dangerous_goods")).toBe("text-red-500");
      expect(getServiceIconColor("pharma")).toBe("text-green-500");
    });

    it("default 'text-slate-500' su categoria sconosciuta", () => {
      expect(getServiceIconColor("xyz")).toBe("text-slate-500");
    });
  });

  describe("getPartnerTypeIconName", () => {
    it("mappa tipi noti", () => {
      expect(getPartnerTypeIconName("freight_forwarder")).toBe("Truck");
      expect(getPartnerTypeIconName("customs_broker")).toBe("FileCheck");
      expect(getPartnerTypeIconName("carrier")).toBe("Ship");
      expect(getPartnerTypeIconName("nvocc")).toBe("Anchor");
      expect(getPartnerTypeIconName("3pl")).toBe("Warehouse");
      expect(getPartnerTypeIconName("courier")).toBe("Package");
    });

    it("default 'Box' su null o sconosciuto", () => {
      expect(getPartnerTypeIconName(null)).toBe("Box");
      expect(getPartnerTypeIconName("unknown")).toBe("Box");
    });
  });

  describe("getPriorityColor", () => {
    it("ritorna classi corrispondenti per high/medium/low", () => {
      expect(getPriorityColor("high")).toContain("destructive");
      expect(getPriorityColor("medium")).toContain("warning");
      expect(getPriorityColor("low")).toContain("muted");
    });

    it("default su null o sconosciuto", () => {
      expect(getPriorityColor(null)).toContain("muted");
      expect(getPriorityColor("xyz")).toContain("muted");
    });
  });
});
