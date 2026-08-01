import { describe, it, expect } from "vitest";
import { normalizeKey, isReimportCorrection } from "./useImportWizard";

describe("normalizeKey", () => {
  it("lowercases and removes accents", () => {
    expect(normalizeKey("Città")).toBe("citta");
  });
  it("replaces spaces and dashes with underscores", () => {
    expect(normalizeKey("Company Name")).toBe("company_name");
    expect(normalizeKey("company-name")).toBe("company_name");
  });
  it("removes special characters", () => {
    expect(normalizeKey("email@#$%")).toBe("email");
  });
  it("collapses multiple underscores", () => {
    expect(normalizeKey("a___b")).toBe("a_b");
  });
  it("trims leading/trailing underscores", () => {
    expect(normalizeKey("_name_")).toBe("name");
  });
  it("handles empty string", () => {
    expect(normalizeKey("")).toBe("");
  });
  it("handles complex Italian header", () => {
    expect(normalizeKey("Ragione Sociale")).toBe("ragione_sociale");
  });
  it("handles unicode accents", () => {
    expect(normalizeKey("résumé")).toBe("resume");
  });
});

describe("isReimportCorrection", () => {
  it("returns true when _import_id is present", () => {
    expect(isReimportCorrection(["Name", "_import_id", "Email"])).toBe(true);
  });
  it("returns true when motivo_errore is present", () => {
    expect(isReimportCorrection(["Name", "Motivo Errore"])).toBe(true);
  });
  it("returns false for normal headers", () => {
    expect(isReimportCorrection(["Company Name", "Email", "Phone"])).toBe(false);
  });
  it("returns false for empty headers", () => {
    expect(isReimportCorrection([])).toBe(false);
  });
  it("is case-insensitive via normalizeKey", () => {
    expect(isReimportCorrection(["NAME", "IMPORT_ID"])).toBe(true);
  });
});
