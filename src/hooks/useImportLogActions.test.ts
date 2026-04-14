import { describe, it, expect } from "vitest";
import { findField, FIELD_ALIASES } from "./useImportLogActions";

describe("findField", () => {
  it("finds company_name from ragione_sociale alias", () => {
    const row = { ragione_sociale: "Acme Srl" };
    expect(findField(row, FIELD_ALIASES.company_name)).toBe("Acme Srl");
  });
  it("finds first matching alias", () => {
    const row = { company: "Beta", azienda: "Gamma" };
    // "company" comes after "azienda" in aliases, so azienda should match first
    expect(findField(row, FIELD_ALIASES.company_name)).toBe("Gamma");
  });
  it("returns null when no alias matches", () => {
    const row = { unknown_field: "value" };
    expect(findField(row, FIELD_ALIASES.company_name)).toBeNull();
  });
  it("skips empty string values", () => {
    const row = { company_name: "", company: "Fallback" };
    expect(findField(row, FIELD_ALIASES.company_name)).toBe("Fallback");
  });
  it("skips null values", () => {
    const row = { company_name: null, azienda: "Found" };
    expect(findField(row, FIELD_ALIASES.company_name)).toBe("Found");
  });
  it("trims whitespace from values", () => {
    const row = { email: "  user@example.com  " };
    expect(findField(row, FIELD_ALIASES.email)).toBe("user@example.com");
  });
  it("finds email from e_mail alias", () => {
    const row = { e_mail: "test@test.com" };
    expect(findField(row, FIELD_ALIASES.email)).toBe("test@test.com");
  });
  it("returns null for empty row", () => {
    expect(findField({}, FIELD_ALIASES.phone)).toBeNull();
  });
});

describe("FIELD_ALIASES", () => {
  it("has all expected fields", () => {
    expect(Object.keys(FIELD_ALIASES)).toEqual(
      expect.arrayContaining(["company_name", "name", "email", "phone", "mobile", "country", "city"])
    );
  });
  it("each field has at least 2 aliases", () => {
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      expect(aliases.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("includes Italian aliases for company_name", () => {
    expect(FIELD_ALIASES.company_name).toContain("ragione_sociale");
    expect(FIELD_ALIASES.company_name).toContain("azienda");
  });
});
