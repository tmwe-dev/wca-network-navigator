import { describe, it, expect } from "vitest";
import {
  extractDomain,
  buildGoogleFaviconUrl,
  COUNTRY_OPTIONS,
  type ContactFormData,
} from "./useAddContactForm";

describe("extractDomain", () => {
  it("extracts domain from full URL", () => {
    expect(extractDomain("https://www.example.com/page")).toBe("example.com");
  });
  it("strips www prefix", () => {
    expect(extractDomain("http://www.test.org")).toBe("test.org");
  });
  it("handles URL without protocol", () => {
    expect(extractDomain("acme.com")).toBe("acme.com");
  });
  it("returns empty for empty input", () => {
    expect(extractDomain("")).toBe("");
  });
  it("returns empty for invalid URL", () => {
    expect(extractDomain("not a url at all!!!")).toBe("");
  });
  it("handles subdomain", () => {
    expect(extractDomain("https://api.example.co.uk/v2")).toBe("api.example.co.uk");
  });
  it("handles IP address", () => {
    expect(extractDomain("http://192.168.1.1:8080")).toBe("192.168.1.1");
  });
});

describe("buildGoogleFaviconUrl", () => {
  it("builds correct favicon URL", () => {
    expect(buildGoogleFaviconUrl("example.com")).toBe(
      "https://www.google.com/s2/favicons?domain=example.com&sz=128"
    );
  });
  it("handles empty domain", () => {
    expect(buildGoogleFaviconUrl("")).toBe(
      "https://www.google.com/s2/favicons?domain=&sz=128"
    );
  });
  it("handles domain with subdomain", () => {
    expect(buildGoogleFaviconUrl("api.test.com")).toContain("domain=api.test.com");
  });
});

describe("COUNTRY_OPTIONS", () => {
  it("is a non-empty array", () => {
    expect(COUNTRY_OPTIONS.length).toBeGreaterThan(100);
  });
  it("contains common country codes", () => {
    expect(COUNTRY_OPTIONS).toContain("IT");
    expect(COUNTRY_OPTIONS).toContain("US");
    expect(COUNTRY_OPTIONS).toContain("GB");
    expect(COUNTRY_OPTIONS).toContain("DE");
    expect(COUNTRY_OPTIONS).toContain("CN");
  });
  it("all entries are 2-letter codes", () => {
    COUNTRY_OPTIONS.forEach((code) => {
      expect(code).toHaveLength(2);
      expect(code).toMatch(/^[A-Z]{2}$/);
    });
  });
  it("has no duplicates", () => {
    const unique = new Set(COUNTRY_OPTIONS);
    expect(unique.size).toBe(COUNTRY_OPTIONS.length);
  });
});

describe("ContactFormData type shape", () => {
  it("can create a valid empty form object", () => {
    const form: ContactFormData = {
      companyName: "", companyAlias: "", country: "", city: "", address: "",
      zipCode: "", companyPhone: "", companyEmail: "", website: "",
      contactName: "", contactAlias: "", position: "", contactEmail: "",
      contactPhone: "", contactMobile: "", origin: "", note: "",
      logoUrl: "", linkedinUrl: "",
    };
    expect(Object.keys(form)).toHaveLength(19);
    expect(form.companyName).toBe("");
  });
});
