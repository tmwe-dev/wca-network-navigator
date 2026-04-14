import { describe, it, expect } from "vitest";
import { normalizePhone } from "./normalize";

describe("normalizePhone", () => {
  it("keeps well-formed international numbers", () => {
    expect(normalizePhone("+39 348 123 4567")).toBe("+393481234567");
  });

  it("handles leading 00", () => {
    expect(normalizePhone("0039 348 1234567")).toBe("+393481234567");
  });

  it("strips dashes and parentheses", () => {
    expect(normalizePhone("+1-(212)-555-0100")).toBe("+12125550100");
  });

  it("adds country prefix from defaultCountry", () => {
    expect(normalizePhone("348 123 4567", "IT")).toBe("+393481234567");
  });

  it("removes leading 0 for national numbers", () => {
    expect(normalizePhone("0348 123 4567", "IT")).toBe("+393481234567");
  });

  it("does not double-add country prefix", () => {
    expect(normalizePhone("393481234567", "IT")).toBe("+393481234567");
  });

  it("returns null for too-short numbers", () => {
    expect(normalizePhone("123")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(normalizePhone("")).toBeNull();
  });

  it("handles whatsapp: URI prefix", () => {
    expect(normalizePhone("whatsapp:+491701234567")).toBe("+491701234567");
  });

  it("handles tel: URI prefix", () => {
    expect(normalizePhone("tel:+442071234567")).toBe("+442071234567");
  });

  it("handles dots as separators", () => {
    expect(normalizePhone("+33.6.12.34.56.78")).toBe("+33612345678");
  });

  it("returns null for non-string input", () => {
    expect(normalizePhone(null as unknown as string)).toBeNull();
    expect(normalizePhone(undefined as unknown as string)).toBeNull();
  });
});
