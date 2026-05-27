import { describe, it, expect } from "vitest";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
describe("DAL — wcaCountries", () => {
  it("has 200+ countries", () => expect(WCA_COUNTRIES.length).toBeGreaterThan(200));
  it("codes are 2 letters", () => {
    for (const c of WCA_COUNTRIES) expect(c.code).toMatch(/^[A-Z]{2}$/);
  });
  it("lat/lng numeric", () => {
    for (const c of WCA_COUNTRIES) {
      expect(typeof c.lat).toBe("number");
      expect(typeof c.lng).toBe("number");
    }
  });
  it("codes unique", () => {
    const codes = WCA_COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
