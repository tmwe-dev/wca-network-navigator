/**
 * Tests: Domain Validators
 */
import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validateCountryCode,
  validateCompanyName,
  validateDateRange,
  validatePartnerInput,
} from "../../core/domain/validators";
import { isOk, isErr } from "../../core/domain/result";

describe("Validators", () => {
  describe("validateEmail", () => {
    it("accepts valid email", () => {
      const r = validateEmail("test@example.com");
      expect(isOk(r) && r.value).toBe("test@example.com");
    });

    it("trims and lowercases", () => {
      const r = validateEmail("  TEST@Example.COM  ");
      expect(isOk(r) && r.value).toBe("test@example.com");
    });

    it("rejects empty", () => {
      expect(isErr(validateEmail(""))).toBe(true);
    });

    it("rejects invalid format", () => {
      expect(isErr(validateEmail("not-an-email"))).toBe(true);
    });
  });

  describe("validateCountryCode", () => {
    it("accepts IT", () => {
      expect(isOk(validateCountryCode("IT"))).toBe(true);
    });

    it("uppercases lowercase", () => {
      const r = validateCountryCode("it");
      expect(isOk(r) && r.value).toBe("IT");
    });

    it("rejects 3-letter code", () => {
      expect(isErr(validateCountryCode("ITA"))).toBe(true);
    });
  });

  describe("validateCompanyName", () => {
    it("accepts valid name", () => {
      const r = validateCompanyName("Acme");
      expect(isOk(r) && r.value).toBe("Acme");
    });

    it("rejects single char", () => {
      expect(isErr(validateCompanyName("A"))).toBe(true);
    });
  });

  describe("validateDateRange", () => {
    it("accepts valid range", () => {
      const r = validateDateRange("2024-01-01", "2024-12-31");
      expect(isOk(r)).toBe(true);
    });

    it("rejects start >= end", () => {
      expect(isErr(validateDateRange("2024-12-31", "2024-01-01"))).toBe(true);
    });
  });

  describe("validatePartnerInput", () => {
    it("validates complete input", () => {
      const r = validatePartnerInput({
        companyName: "Acme Logistics",
        countryCode: "it",
        email: "info@acme.it",
      });
      expect(isOk(r)).toBe(true);
      if (isOk(r)) {
        expect(r.value.countryCode).toBe("IT");
        expect(r.value.email).toBe("info@acme.it");
      }
    });

    it("allows null email", () => {
      const r = validatePartnerInput({
        companyName: "Acme",
        countryCode: "US",
      });
      expect(isOk(r)).toBe(true);
      if (isOk(r)) expect(r.value.email).toBeNull();
    });

    it("rejects invalid country code", () => {
      const r = validatePartnerInput({
        companyName: "Acme",
        countryCode: "INVALID",
      });
      expect(isErr(r)).toBe(true);
    });
  });
});
