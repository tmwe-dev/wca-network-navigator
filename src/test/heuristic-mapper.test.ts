import { describe, it, expect } from "vitest";
import { autoMapColumns, mappingsToDict } from "@/lib/import/heuristicMapper";
import { normalizeExtensionResult } from "@/lib/download/extractProfile";

describe("heuristicMapper.autoMapColumns", () => {
  it("mappa headers italiani comuni", () => {
    const headers = ["Azienda", "Email", "Telefono", "Cellulare", "Nazione", "Nome"];
    const mappings = autoMapColumns(headers, []);
    const dict = mappingsToDict(mappings);
    expect(dict["Azienda"]).toBe("company_name");
    expect(dict["Email"]).toBe("email");
    expect(dict["Telefono"]).toBe("phone");
    expect(dict["Cellulare"]).toBe("mobile");
    expect(dict["Nazione"]).toBe("country");
    expect(dict["Nome"]).toBe("name");
  });

  it("mappa headers inglesi comuni", () => {
    const headers = ["Company Name", "Email Address", "Phone", "Mobile", "Country", "First Name"];
    const dict = mappingsToDict(autoMapColumns(headers, []));
    expect(dict["Company Name"]).toBe("company_name");
    expect(dict["Email Address"]).toBe("email");
    expect(dict["Phone"]).toBe("phone");
    expect(dict["Mobile"]).toBe("mobile");
    expect(dict["Country"]).toBe("country");
    expect(dict["First Name"]).toBe("name");
  });

  it("non mappa headers ignoti (targetColumn vuoto)", () => {
    const mappings = autoMapColumns(["XYZ123", "Random Stuff"], []);
    expect(mappings.every((m) => m.targetColumn === "")).toBe(true);
  });

  it("usa la transformation corretta per ogni target", () => {
    const mappings = autoMapColumns(
      ["Email", "Telefono", "Nazione", "Nome", "Cellulare"],
      []
    );
    const byTarget = Object.fromEntries(mappings.map((m) => [m.targetColumn, m.transformation]));
    expect(byTarget.email).toBe("extract_email");
    expect(byTarget.phone).toBe("normalize_phone");
    expect(byTarget.mobile).toBe("normalize_phone");
    expect(byTarget.country).toBe("parse_country");
    expect(byTarget.name).toBe("capitalize");
  });

  it("non riusa lo stesso target due volte", () => {
    const headers = ["Email", "E-Mail", "Mail"];
    const mappings = autoMapColumns(headers, []);
    const targets = mappings.map((m) => m.targetColumn).filter(Boolean);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("popola sourceIndex e sourceColumn correttamente", () => {
    const headers = ["A", "Email", "C"];
    const mappings = autoMapColumns(headers, []);
    expect(mappings).toHaveLength(3);
    expect(mappings[1].sourceColumn).toBe("Email");
    expect(mappings[1].sourceIndex).toBe(1);
  });

  it("confidence > 0 sui match e 0 sui non-match", () => {
    const mappings = autoMapColumns(["Email", "Pippo"], []);
    expect(mappings[0].confidence).toBeGreaterThan(0);
    expect(mappings[1].confidence).toBe(0);
  });
});

describe("heuristicMapper.mappingsToDict", () => {
  it("ritorna solo mapping con targetColumn non vuoto", () => {
    const dict = mappingsToDict([
      { sourceColumn: "A", sourceIndex: 0, targetColumn: "name", confidence: 90, transformation: "capitalize" },
      { sourceColumn: "B", sourceIndex: 1, targetColumn: "", confidence: 0, transformation: "none" },
    ]);
    expect(dict).toEqual({ A: "name" });
  });

  it("dict vuoto su array vuoto", () => {
    expect(mappingsToDict([])).toEqual({});
  });
});

describe("normalizeExtensionResult", () => {
  it("ritorna shape di errore su input null/undefined", () => {
    const r = normalizeExtensionResult(null);
    expect(r.success).toBe(false);
    expect(r.state).toBe("bridge_error");
    expect(r.errorCode).toBe("EXT_BRIDGE_ERROR");
    expect(r.companyName).toBeNull();
    expect(r.contacts).toEqual([]);
  });

  it("normalizza state da raw.success se manca", () => {
    expect(normalizeExtensionResult({ success: true }).state).toBe("ok");
    expect(normalizeExtensionResult({ success: false }).state).toBe("not_loaded");
  });

  it("preserva state esplicito", () => {
    expect(normalizeExtensionResult({ state: "login_required" }).state).toBe("login_required");
  });

  it("usa htmlLength da raw o calcola da profileHtml.length", () => {
    expect(normalizeExtensionResult({ profileHtml: "abcde" }).htmlLength).toBe(5);
    expect(normalizeExtensionResult({ htmlLength: 100, profileHtml: "x" }).htmlLength).toBe(100);
  });

  it("default contacts/profile a array/oggetto vuoti", () => {
    const r = normalizeExtensionResult({});
    expect(r.contacts).toEqual([]);
    expect(r.profile).toEqual({});
    expect(r.debug).toEqual({});
  });

  it("propaga companyName, errorCode, error", () => {
    const r = normalizeExtensionResult({
      companyName: "Acme",
      errorCode: "X",
      error: "boom",
    });
    expect(r.companyName).toBe("Acme");
    expect(r.errorCode).toBe("X");
    expect(r.error).toBe("boom");
  });
});
