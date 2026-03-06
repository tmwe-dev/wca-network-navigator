import { describe, it, expect } from "vitest";
import {
  applyTransformation,
  normalizePhone,
  extractEmail,
  parseCountry,
  validateAndTransform,
  transformRow,
} from "./validator";
import type { ColumnMapping } from "./types";

// ── applyTransformation ──────────────────────────────────────────

describe("applyTransformation", () => {
  it("trims whitespace for 'trim' transformation", () => {
    expect(applyTransformation("  hello  ", "trim")).toBe("hello");
  });

  it("converts to uppercase", () => {
    expect(applyTransformation("hello world", "uppercase")).toBe("HELLO WORLD");
  });

  it("converts to lowercase", () => {
    expect(applyTransformation("HELLO WORLD", "lowercase")).toBe("hello world");
  });

  it("capitalizes each word", () => {
    expect(applyTransformation("john doe", "capitalize")).toBe("John Doe");
  });

  it("delegates to normalizePhone for 'normalize_phone'", () => {
    expect(applyTransformation("333 1234567", "normalize_phone")).toBe("+393331234567");
  });

  it("delegates to extractEmail for 'extract_email'", () => {
    expect(applyTransformation("Name <john@example.com>", "extract_email")).toBe("john@example.com");
  });

  it("delegates to parseCountry for 'parse_country'", () => {
    expect(applyTransformation("italia", "parse_country")).toBe("Italy");
  });

  it("returns empty string for empty/null input", () => {
    expect(applyTransformation("", "trim")).toBe("");
    expect(applyTransformation("   ", "uppercase")).toBe("");
  });

  it("handles null-ish values without crashing", () => {
    expect(applyTransformation(null as any, "trim")).toBe("");
    expect(applyTransformation(undefined as any, "trim")).toBe("");
  });

  it("trims by default for 'none' transformation", () => {
    expect(applyTransformation("  hi  ", "none")).toBe("hi");
  });

  it("falls through to trimmed value for unknown transformation", () => {
    expect(applyTransformation("  test  ", "unknown_transform" as any)).toBe("test");
  });
});

// ── normalizePhone ───────────────────────────────────────────────

describe("normalizePhone", () => {
  it("removes spaces, dashes, dots, and parentheses", () => {
    expect(normalizePhone("+39 (02) 1234-567")).toBe("+39021234567");
  });

  it("converts 00xx prefix to +xx", () => {
    expect(normalizePhone("0039021234567")).toBe("+39021234567");
  });

  it("adds +39 prefix to Italian mobile numbers (3xx)", () => {
    expect(normalizePhone("3331234567")).toBe("+393331234567");
  });

  it("adds +39 prefix to Italian landline numbers (0xx)", () => {
    expect(normalizePhone("021234567")).toBe("+39021234567");
  });

  it("leaves numbers with + prefix unchanged (beyond cleanup)", () => {
    expect(normalizePhone("+1 555 123 4567")).toBe("+15551234567");
  });

  it("handles already clean numbers", () => {
    expect(normalizePhone("+393331234567")).toBe("+393331234567");
  });
});

// ── extractEmail ─────────────────────────────────────────────────

describe("extractEmail", () => {
  it("extracts email from surrounding text", () => {
    expect(extractEmail("Contact: john@example.com for info")).toBe("john@example.com");
  });

  it("extracts email from angle brackets", () => {
    expect(extractEmail("John Doe <john@example.com>")).toBe("john@example.com");
  });

  it("lowercases the extracted email", () => {
    expect(extractEmail("JOHN@EXAMPLE.COM")).toBe("john@example.com");
  });

  it("returns lowercased input when no valid email is found", () => {
    expect(extractEmail("not-an-email")).toBe("not-an-email");
  });

  it("handles email with plus addressing", () => {
    expect(extractEmail("john+tag@example.com")).toBe("john+tag@example.com");
  });

  it("handles email with dots and dashes in domain", () => {
    expect(extractEmail("user@sub.domain-name.co.uk")).toBe("user@sub.domain-name.co.uk");
  });
});

// ── parseCountry ─────────────────────────────────────────────────

describe("parseCountry", () => {
  it("normalizes Italian country names", () => {
    expect(parseCountry("italia")).toBe("Italy");
    expect(parseCountry("Germania")).toBe("Germany");
    expect(parseCountry("FRANCIA")).toBe("France");
  });

  it("normalizes ISO codes", () => {
    expect(parseCountry("it")).toBe("Italy");
    expect(parseCountry("de")).toBe("Germany");
    expect(parseCountry("us")).toBe("United States");
  });

  it("normalizes 3-letter codes", () => {
    expect(parseCountry("ita")).toBe("Italy");
    expect(parseCountry("deu")).toBe("Germany");
    expect(parseCountry("esp")).toBe("Spain");
  });

  it("returns original value for unknown countries", () => {
    expect(parseCountry("Narnia")).toBe("Narnia");
  });

  it("handles leading/trailing whitespace", () => {
    expect(parseCountry("  italy  ")).toBe("Italy");
  });

  it("handles multi-word country names", () => {
    expect(parseCountry("united kingdom")).toBe("United Kingdom");
    expect(parseCountry("stati uniti")).toBe("United States");
    expect(parseCountry("corea del sud")).toBe("South Korea");
  });
});

// ── validateAndTransform ─────────────────────────────────────────

describe("validateAndTransform", () => {
  const makeMappings = (pairs: [number, string, string][]): ColumnMapping[] =>
    pairs.map(([sourceIndex, sourceColumn, targetColumn]) => ({
      sourceColumn,
      sourceIndex,
      targetColumn,
      confidence: 100,
      transformation: "trim" as const,
    }));

  it("maps columns from source rows to target schema", () => {
    const mappings = makeMappings([[0, "Name", "company_name"], [1, "Email", "email"]]);
    const rows = [["Acme Corp", "info@acme.com"]];
    const result = validateAndTransform(rows, mappings);

    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].company_name).toBe("Acme Corp");
    expect(result.validRows[0].email).toBe("info@acme.com");
    expect(result.stats.totalRows).toBe(1);
    expect(result.stats.importedCount).toBe(1);
    expect(result.stats.rejectedCount).toBe(0);
  });

  it("rejects completely empty rows", () => {
    const mappings = makeMappings([[0, "Name", "company_name"]]);
    const rows = [[""], ["  "], [""]];
    const result = validateAndTransform(rows, mappings);

    expect(result.validRows).toHaveLength(0);
    expect(result.rejectedRows).toHaveLength(3);
    expect(result.stats.rejectedCount).toBe(3);
  });

  it("sets unmapped target columns to null", () => {
    const mappings = makeMappings([[0, "Name", "company_name"]]);
    const rows = [["Test Corp"]];
    const result = validateAndTransform(rows, mappings);

    expect(result.validRows[0].email).toBeNull();
    expect(result.validRows[0].phone).toBeNull();
    expect(result.validRows[0].city).toBeNull();
  });

  it("cleans 'NULL' string values to null", () => {
    const mappings = makeMappings([[0, "Name", "company_name"], [1, "City", "city"]]);
    const rows = [["Test Corp", "NULL"]];
    const result = validateAndTransform(rows, mappings);

    expect(result.validRows[0].company_name).toBe("Test Corp");
    expect(result.validRows[0].city).toBeNull();
  });

  it("normalizes phone and mobile fields", () => {
    const mappings = makeMappings([[0, "Name", "company_name"], [1, "Phone", "phone"], [2, "Mobile", "mobile"]]);
    const rows = [["Test", "02 1234567", "333 1234567"]];
    const result = validateAndTransform(rows, mappings);

    expect(result.validRows[0].phone).toBe("+39021234567");
    expect(result.validRows[0].mobile).toBe("+393331234567");
  });

  it("handles rows with missing source columns gracefully", () => {
    const mappings = makeMappings([[0, "Name", "company_name"], [5, "Phone", "phone"]]);
    const rows = [["Test Corp"]]; // only index 0 exists
    const result = validateAndTransform(rows, mappings);

    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].company_name).toBe("Test Corp");
    expect(result.validRows[0].phone).toBeNull();
  });

  it("skips mappings without a targetColumn", () => {
    const mappings: ColumnMapping[] = [
      { sourceColumn: "Junk", sourceIndex: 0, targetColumn: "", confidence: 0, transformation: "trim" },
      { sourceColumn: "Name", sourceIndex: 1, targetColumn: "company_name", confidence: 100, transformation: "trim" },
    ];
    const rows = [["junk data", "Real Name"]];
    const result = validateAndTransform(rows, mappings);

    expect(result.validRows[0].company_name).toBe("Real Name");
  });

  it("returns correct stats for mixed valid/rejected rows", () => {
    const mappings = makeMappings([[0, "Name", "company_name"]]);
    const rows = [["Valid"], [""], ["Also Valid"], ["  "]];
    const result = validateAndTransform(rows, mappings);

    expect(result.stats.totalRows).toBe(4);
    expect(result.stats.importedCount).toBe(2);
    expect(result.stats.rejectedCount).toBe(2);
  });
});

// ── transformRow ─────────────────────────────────────────────────

describe("transformRow", () => {
  it("maps and transforms a row object using column mapping", () => {
    const row = { "Company Name": "acme corp", Email: "INFO@ACME.COM" };
    const mapping = { "Company Name": "company_name", Email: "email" };
    const result = transformRow(row, mapping);

    expect(result.company_name).toBe("Acme Corp"); // capitalize
    expect(result.email).toBe("info@acme.com"); // extract_email lowercases
  });

  it("returns null for empty or whitespace-only values", () => {
    const row = { Name: "", Phone: "   " };
    const mapping = { Name: "name", Phone: "phone" };
    const result = transformRow(row, mapping);

    expect(result.name).toBeNull();
    expect(result.phone).toBeNull();
  });

  it("treats 'NULL' string as null", () => {
    const row = { Name: "NULL", City: "null" };
    const mapping = { Name: "name", City: "city" };
    const result = transformRow(row, mapping);

    expect(result.name).toBeNull();
    expect(result.city).toBeNull();
  });

  it("skips mappings to non-target columns", () => {
    const row = { Name: "Test", Junk: "data" };
    const mapping = { Name: "name", Junk: "not_a_real_column" };
    const result = transformRow(row, mapping);

    expect(result.name).toBe("Test");
    expect(result).not.toHaveProperty("not_a_real_column");
  });

  it("uses fuzzy key matching for row keys", () => {
    const row = { "Company-Name": "Acme" };
    const mapping = { company_name: "company_name" };
    const result = transformRow(row, mapping);

    expect(result.company_name).toBe("Acme");
  });

  it("auto-detects phone normalization for phone/mobile targets", () => {
    const row = { Tel: "333 1234567" };
    const mapping = { Tel: "phone" };
    const result = transformRow(row, mapping);

    expect(result.phone).toBe("+393331234567");
  });

  it("auto-detects country parsing for country target", () => {
    const row = { Paese: "italia" };
    const mapping = { Paese: "country" };
    const result = transformRow(row, mapping);

    expect(result.country).toBe("Italy");
  });

  it("uses heuristic mapping transformation when provided", () => {
    const row = { Name: "john doe" };
    const mapping = { Name: "name" };
    const heuristic: ColumnMapping[] = [
      { sourceColumn: "Name", sourceIndex: 0, targetColumn: "name", confidence: 100, transformation: "uppercase" },
    ];
    const result = transformRow(row, mapping, heuristic);

    expect(result.name).toBe("JOHN DOE");
  });
});
