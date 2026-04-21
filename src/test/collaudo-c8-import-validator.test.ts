/**
 * COLLAUDO Catena 1 — Anagrafiche: Import Validator (REAL IMPORTS)
 *
 * Verifica che:
 * - normalizePhone gestisca numeri italiani e internazionali
 * - extractEmail estragga email da testo sporco
 * - parseCountry mappi italiano/inglese/codici ISO
 * - applyTransformation applichi tutte le trasformazioni
 * - validateAndTransform accetti righe valide, rifiuti solo righe vuote
 * - La filosofia "best-effort, never reject for format" sia rispettata
 *
 * IMPORTA CODICE REALE: src/lib/import/validator.ts
 */
import { describe, it, expect } from "vitest";
import {
  applyTransformation,
  normalizePhone,
  extractEmail,
  parseCountry,
  validateAndTransform,
} from "@/lib/import/validator";

// ══════════════════════════════════════════════════════════
// TEST 1: normalizePhone
// ══════════════════════════════════════════════════════════

describe("Collaudo C1 — normalizePhone", () => {

  it("C1.P1 — Italian mobile (3xx) gets +39 prefix", () => {
    expect(normalizePhone("3401234567")).toBe("+393401234567");
  });

  it("C1.P2 — Italian landline (0xx) gets +39 prefix", () => {
    expect(normalizePhone("0212345678")).toBe("+390212345678");
  });

  it("C1.P3 — already prefixed +39 stays unchanged", () => {
    expect(normalizePhone("+393401234567")).toBe("+393401234567");
  });

  it("C1.P4 — international 00xx converted to +xx", () => {
    expect(normalizePhone("004915123456789")).toBe("+4915123456789");
  });

  it("C1.P5 — spaces and formatting stripped", () => {
    expect(normalizePhone("+39 340 123 4567")).toBe("+393401234567");
  });

  it("C1.P6 — parentheses and dashes stripped", () => {
    expect(normalizePhone("(02) 1234-5678")).toBe("+390212345678");
  });

  it("C1.P7 — multiple numbers: takes first candidate", () => {
    expect(normalizePhone("3401234567 | 3509876543")).toBe("+393401234567");
  });

  it("C1.P8 — pipe-separated: takes first", () => {
    expect(normalizePhone("3401234567 / 06123456")).toBe("+393401234567");
  });

  it("C1.P9 — semicolon-separated: takes first", () => {
    expect(normalizePhone("3401234567; 3509876543")).toBe("+393401234567");
  });

  it("C1.P10 — dots as separators stripped", () => {
    expect(normalizePhone("340.123.4567")).toBe("+393401234567");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 2: extractEmail
// ══════════════════════════════════════════════════════════

describe("Collaudo C1 — extractEmail", () => {

  it("C1.E1 — plain email returned lowercase", () => {
    expect(extractEmail("USER@Example.COM")).toBe("user@example.com");
  });

  it("C1.E2 — email extracted from surrounding text", () => {
    expect(extractEmail("Contact me at john@company.it please")).toBe("john@company.it");
  });

  it("C1.E3 — email with subdomain works", () => {
    expect(extractEmail("test@mail.company.co.uk")).toBe("test@mail.company.co.uk");
  });

  it("C1.E4 — email with + alias", () => {
    expect(extractEmail("user+tag@gmail.com")).toBe("user+tag@gmail.com");
  });

  it("C1.E5 — no valid email returns lowercase input", () => {
    expect(extractEmail("not an email")).toBe("not an email");
  });

  it("C1.E6 — email with dots in local part", () => {
    expect(extractEmail("first.last@domain.com")).toBe("first.last@domain.com");
  });

  it("C1.E7 — email with hyphens", () => {
    expect(extractEmail("first-last@my-domain.com")).toBe("first-last@my-domain.com");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 3: parseCountry
// ══════════════════════════════════════════════════════════

describe("Collaudo C1 — parseCountry", () => {

  it("C1.C1 — Italian name → English", () => {
    expect(parseCountry("Italia")).toBe("Italy");
    expect(parseCountry("Germania")).toBe("Germany");
    expect(parseCountry("Francia")).toBe("France");
    expect(parseCountry("Spagna")).toBe("Spain");
  });

  it("C1.C2 — case insensitive", () => {
    expect(parseCountry("ITALIA")).toBe("Italy");
    expect(parseCountry("italia")).toBe("Italy");
    expect(parseCountry("ItAlIa")).toBe("Italy");
  });

  it("C1.C3 — ISO codes map correctly", () => {
    expect(parseCountry("IT")).toBe("Italy");
    expect(parseCountry("DE")).toBe("Germany");
    expect(parseCountry("FR")).toBe("France");
    expect(parseCountry("US")).toBe("United States");
    expect(parseCountry("UK")).toBe("United Kingdom");
  });

  it("C1.C4 — English names pass through", () => {
    expect(parseCountry("Italy")).toBe("Italy");
    expect(parseCountry("Germany")).toBe("Germany");
  });

  it("C1.C5 — unknown country returns original value", () => {
    expect(parseCountry("Narnia")).toBe("Narnia");
    expect(parseCountry("Unknown")).toBe("Unknown");
  });

  it("C1.C6 — 3-letter codes work", () => {
    expect(parseCountry("ITA")).toBe("Italy");
    expect(parseCountry("DEU")).toBe("Germany");
    expect(parseCountry("FRA")).toBe("France");
    expect(parseCountry("ESP")).toBe("Spain");
  });

  it("C1.C7 — compound Italian names work", () => {
    expect(parseCountry("Regno Unito")).toBe("United Kingdom");
    expect(parseCountry("Stati Uniti")).toBe("United States");
    expect(parseCountry("Emirati Arabi")).toBe("United Arab Emirates");
    expect(parseCountry("Arabia Saudita")).toBe("Saudi Arabia");
    expect(parseCountry("Corea del Sud")).toBe("South Korea");
  });

  it("C1.C8 — trims whitespace", () => {
    expect(parseCountry("  Italia  ")).toBe("Italy");
  });

  it("C1.C9 — Asian countries", () => {
    expect(parseCountry("Cina")).toBe("China");
    expect(parseCountry("Giappone")).toBe("Japan");
    expect(parseCountry("Singapore")).toBe("Singapore");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 4: applyTransformation
// ══════════════════════════════════════════════════════════

describe("Collaudo C1 — applyTransformation", () => {

  it("C1.T1 — trim removes whitespace", () => {
    expect(applyTransformation("  hello  ", "trim")).toBe("hello");
  });

  it("C1.T2 — uppercase", () => {
    expect(applyTransformation("hello", "uppercase")).toBe("HELLO");
  });

  it("C1.T3 — lowercase", () => {
    expect(applyTransformation("HELLO", "lowercase")).toBe("hello");
  });

  it("C1.T4 — capitalize each word", () => {
    expect(applyTransformation("john doe smith", "capitalize")).toBe("John Doe Smith");
  });

  it("C1.T5 — normalize_phone delegates to normalizePhone", () => {
    expect(applyTransformation("3401234567", "normalize_phone")).toBe("+393401234567");
  });

  it("C1.T6 — extract_email delegates to extractEmail", () => {
    expect(applyTransformation("Contact: USER@test.com", "extract_email")).toBe("user@test.com");
  });

  it("C1.T7 — parse_country delegates to parseCountry", () => {
    expect(applyTransformation("Italia", "parse_country")).toBe("Italy");
  });

  it("C1.T8 — unknown transformation returns trimmed value", () => {
    expect(applyTransformation("  hello  ", "unknown" as any)).toBe("hello");
  });

  it("C1.T9 — empty input returns empty string", () => {
    expect(applyTransformation("", "uppercase")).toBe("");
  });

  it("C1.T10 — null/undefined input returns empty string", () => {
    expect(applyTransformation(null as any, "trim")).toBe("");
    expect(applyTransformation(undefined as any, "trim")).toBe("");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 5: validateAndTransform — Filosofia "best-effort"
// ══════════════════════════════════════════════════════════

describe("Collaudo C1 — validateAndTransform Philosophy", () => {

  const makeMappings = (targets: string[]) =>
    targets.map((t, i) => ({
      sourceColumn: `col${i}`,
      sourceIndex: i,
      targetColumn: t,
      confidence: 100,
      transformation: "trim" as const,
    }));

  it("C1.V1 — valid row with company_name and email is accepted", () => {
    const mappings = makeMappings(["company_name", "email"]);
    const result = validateAndTransform([["Acme Corp", "test@acme.com"]], mappings);
    expect(result.stats.importedCount).toBe(1);
    expect(result.stats.rejectedCount).toBe(0);
    expect(result.validRows[0].company_name).toBe("Acme Corp");
    expect(result.validRows[0].email).toBe("test@acme.com");
  });

  it("C1.V2 — completely empty row is rejected", () => {
    const mappings = makeMappings(["company_name", "email"]);
    const result = validateAndTransform([["", ""]], mappings);
    expect(result.stats.rejectedCount).toBe(1);
    expect(result.rejectedRows[0].reasons[0]).toContain("vuota");
  });

  it("C1.V3 — row with only spaces is rejected", () => {
    const mappings = makeMappings(["company_name", "email"]);
    const result = validateAndTransform([["   ", "   "]], mappings);
    expect(result.stats.rejectedCount).toBe(1);
  });

  it("C1.V4 — invalid email format is NOT rejected (best-effort)", () => {
    const mappings = makeMappings(["company_name", "email"]);
    const result = validateAndTransform([["Acme", "not-an-email"]], mappings);
    // Best-effort: keeps the row even with bad email
    expect(result.stats.importedCount).toBe(1);
    expect(result.stats.rejectedCount).toBe(0);
  });

  it("C1.V5 — NULL string values are converted to null", () => {
    const mappings = makeMappings(["company_name", "email", "phone"]);
    const result = validateAndTransform([["Acme", "test@test.com", "NULL"]], mappings);
    expect(result.validRows[0].phone).toBeNull();
    // But row is still valid because it has other data
    expect(result.stats.importedCount).toBe(1);
  });

  it("C1.V6 — unmapped target columns get null", () => {
    const mappings = makeMappings(["company_name"]);
    const result = validateAndTransform([["Acme"]], mappings);
    expect(result.validRows[0].company_name).toBe("Acme");
    expect(result.validRows[0].email).toBeNull();
    expect(result.validRows[0].phone).toBeNull();
    expect(result.validRows[0].country).toBeNull();
  });

  it("C1.V7 — phone values are auto-normalized", () => {
    const mappings = makeMappings(["company_name", "phone"]);
    const result = validateAndTransform([["Acme", "3401234567"]], mappings);
    // Phone gets normalized even with "trim" transformation
    // because validateAndTransform runs normalizePhone on phone/mobile fields
    expect(result.validRows[0].phone).toBe("+393401234567");
  });

  it("C1.V8 — multiple rows: mixed valid and empty", () => {
    const mappings = makeMappings(["company_name", "email"]);
    const rows = [
      ["Acme", "a@b.com"],
      ["", ""],
      ["Beta", "b@c.com"],
      ["   ", "  "],
    ];
    const result = validateAndTransform(rows, mappings);
    expect(result.stats.totalRows).toBe(4);
    expect(result.stats.importedCount).toBe(2);
    expect(result.stats.rejectedCount).toBe(2);
  });

  it("C1.V9 — stats totals are consistent", () => {
    const mappings = makeMappings(["company_name"]);
    const rows = Array.from({ length: 10 }, (_, i) => [i % 3 === 0 ? "" : `Company ${i}`]);
    const result = validateAndTransform(rows, mappings);
    expect(result.stats.totalRows).toBe(rows.length);
    expect(result.stats.importedCount + result.stats.rejectedCount).toBe(result.stats.totalRows);
  });
});

// ══════════════════════════════════════════════════════════
// TEST 6: Regression — edge cases pericolosi
// ══════════════════════════════════════════════════════════

describe("Collaudo C1 — Import Edge Cases", () => {

  it("C1.X1 — very long company name is accepted (no truncation at import)", () => {
    const longName = "A".repeat(500);
    const mappings = [{
      sourceColumn: "col0", sourceIndex: 0,
      targetColumn: "company_name", confidence: 100,
      transformation: "trim" as const,
    }];
    const result = validateAndTransform([[longName]], mappings);
    expect(result.stats.importedCount).toBe(1);
    expect(result.validRows[0].company_name).toBe(longName);
  });

  it("C1.X2 — special characters in company name preserved", () => {
    const mappings = [{
      sourceColumn: "col0", sourceIndex: 0,
      targetColumn: "company_name", confidence: 100,
      transformation: "trim" as const,
    }];
    const result = validateAndTransform([["O'Brien & Co. (Italia) S.r.l."]], mappings);
    expect(result.validRows[0].company_name).toBe("O'Brien & Co. (Italia) S.r.l.");
  });

  it("C1.X3 — email extraction fixes bad format", () => {
    const mappings = [{
      sourceColumn: "col0", sourceIndex: 0,
      targetColumn: "email", confidence: 100,
      transformation: "extract_email" as const,
    }];
    const result = validateAndTransform([["Email: john@acme.it (commerciale)"]], mappings);
    expect(result.validRows[0].email).toBe("john@acme.it");
  });
});
