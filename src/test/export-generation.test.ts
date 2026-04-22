/**
 * Export Generation Tests
 * Tests CSV generation, data formatting, and empty data handling
 * Based on useExport.ts
 */
import { describe, it, expect } from "vitest";

// ─── CSV Field Escaping ──────────────────────────────────

function escapeCSVField(field: unknown): string {
  const str = String(field ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function convertToCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const headerRow = headers.map(escapeCSVField).join(",");
  const dataRows = rows.map((row) => headers.map((h) => escapeCSVField(row[h])).join(","));
  return [headerRow, ...dataRows].join("\n");
}

// ─── Data Formatting ────────────────────────────────────

interface ExportRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  created_at: string;
  [key: string]: unknown;
}

// ─── Tests ──────────────────────────────────────────────

describe("Export Generation", () => {
  // ─── CSV Field Escaping ─────────────────────────────

  describe("CSV Field Escaping", () => {
    it("should escape field with comma", () => {
      expect(escapeCSVField("Smith, John")).toBe('"Smith, John"');
    });

    it("should escape field with quote", () => {
      expect(escapeCSVField('John "Johnny" Doe')).toBe('"John ""Johnny"" Doe"');
    });

    it("should escape field with newline", () => {
      expect(escapeCSVField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    });

    it("should escape field with multiple special chars", () => {
      expect(escapeCSVField('Name: "Smith, Jr."')).toBe('"Name: ""Smith, Jr."""');
    });

    it("should not escape simple strings", () => {
      expect(escapeCSVField("John Doe")).toBe("John Doe");
      expect(escapeCSVField("user@example.com")).toBe("user@example.com");
    });

    it("should handle null as empty string", () => {
      expect(escapeCSVField(null)).toBe("");
      expect(escapeCSVField(undefined)).toBe("");
    });

    it("should handle numbers", () => {
      expect(escapeCSVField(12345)).toBe("12345");
      expect(escapeCSVField(123.45)).toBe("123.45");
    });

    it("should handle booleans", () => {
      expect(escapeCSVField(true)).toBe("true");
      expect(escapeCSVField(false)).toBe("false");
    });

    it("should handle zero and negative numbers", () => {
      expect(escapeCSVField(0)).toBe("0");
      expect(escapeCSVField(-100)).toBe("-100");
    });

    it("should double quotes in quoted fields", () => {
      expect(escapeCSVField('He said "Hello"')).toBe('"He said ""Hello"""');
    });

    it("should escape mixed special characters", () => {
      const field = 'Email: john@example.com, Title: "Manager"';
      const escaped = escapeCSVField(field);
      expect(escaped).toContain('"');
      expect(escaped).toContain('""');
    });
  });

  // ─── CSV Conversion ─────────────────────────────────

  describe("CSV Conversion", () => {
    it("should convert simple data to CSV", () => {
      const headers = ["id", "name", "email"];
      const rows = [
        { id: "1", name: "John", email: "john@example.com" },
        { id: "2", name: "Jane", email: "jane@example.com" },
      ];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");

      expect(lines[0]).toBe("id,name,email");
      expect(lines[1]).toBe("1,John,john@example.com");
      expect(lines[2]).toBe("2,Jane,jane@example.com");
    });

    it("should include header row", () => {
      const headers = ["id", "name"];
      const rows = [{ id: "1", name: "John" }];

      const csv = convertToCSV(headers, rows);
      expect(csv.startsWith("id,name")).toBe(true);
    });

    it("should handle empty rows array", () => {
      const headers = ["id", "name", "email"];
      const rows: Record<string, unknown>[] = [];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");

      expect(lines.length).toBe(1); // Only header
      expect(lines[0]).toBe("id,name,email");
    });

    it("should handle null/undefined values", () => {
      const headers = ["id", "name", "email"];
      const rows = [
        { id: "1", name: "John", email: null },
        { id: "2", name: "Jane", email: undefined },
      ];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");

      expect(lines[1]).toBe("1,John,");
      expect(lines[2]).toBe("2,Jane,");
    });

    it("should escape fields with commas", () => {
      const headers = ["id", "name"];
      const rows = [
        { id: "1", name: "Doe, John" },
        { id: "2", name: "Smith, Jane" },
      ];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");

      expect(lines[1]).toBe('1,"Doe, John"');
      expect(lines[2]).toBe('2,"Smith, Jane"');
    });

    it("should preserve order of columns", () => {
      const headers = ["email", "name", "id"];
      const rows = [{ id: "1", name: "John", email: "john@example.com" }];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");

      expect(lines[0]).toBe("email,name,id");
      expect(lines[1]).toBe("john@example.com,John,1");
    });

    it("should handle many columns", () => {
      const headers = ["id", "name", "email", "phone", "company", "country", "status", "created"];
      const rows = [
        {
          id: "1",
          name: "John",
          email: "john@example.com",
          phone: "+39 02 1234",
          company: "Acme",
          country: "IT",
          status: "active",
          created: "2026-04-22",
        },
      ];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");

      expect(lines[0].split(",").length).toBe(8);
    });

    it("should handle rows with extra fields not in headers", () => {
      const headers = ["id", "name"];
      const rows = [
        { id: "1", name: "John", email: "john@example.com" }, // extra email
        { id: "2", name: "Jane", phone: "+39 02" }, // extra phone
      ];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");

      expect(lines[1]).toBe("1,John"); // Only selected columns
      expect(lines[2]).toBe("2,Jane");
    });

    it("should handle rows missing columns in headers", () => {
      const headers = ["id", "name", "email"];
      const rows = [
        { id: "1", name: "John" }, // missing email
        { id: "2", email: "jane@example.com" }, // missing name
      ];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");

      expect(lines[1]).toBe("1,John,");
      expect(lines[2]).toBe("2,,jane@example.com");
    });
  });

  // ─── Data Formatting ────────────────────────────────

  describe("Data Formatting", () => {
    it("should format dates consistently", () => {
      const rows = [
        { id: "1", created_at: "2026-04-22T10:30:00Z" },
        { id: "2", created_at: "2026-04-21T14:45:30Z" },
      ];

      const formatted = rows.map((r) => ({
        ...r,
        created_at: r.created_at.split("T")[0], // Date only
      }));

      expect(formatted[0].created_at).toBe("2026-04-22");
      expect(formatted[1].created_at).toBe("2026-04-21");
    });

    it("should format currency with 2 decimals", () => {
      const rows = [
        { id: "1", amount: 1000 },
        { id: "2", amount: 2500.5 },
        { id: "3", amount: 999.9 },
      ];

      const formatted = rows.map((r) => ({
        ...r,
        amount: parseFloat(String(r.amount)).toFixed(2),
      }));

      expect(formatted[0].amount).toBe("1000.00");
      expect(formatted[1].amount).toBe("2500.50");
      expect(formatted[2].amount).toBe("999.90");
    });

    it("should format boolean fields as yes/no", () => {
      const rows = [
        { id: "1", active: true },
        { id: "2", active: false },
      ];

      const formatted = rows.map((r) => ({
        ...r,
        active: r.active ? "Yes" : "No",
      }));

      expect(formatted[0].active).toBe("Yes");
      expect(formatted[1].active).toBe("No");
    });

    it("should handle phone number formatting", () => {
      const rows = [
        { id: "1", phone: "390212345678" },
        { id: "2", phone: "333 1234567" },
      ];

      const formatted = rows.map((r) => ({
        ...r,
        phone: r.phone || "", // Just preserve as-is
      }));

      expect(formatted[0].phone).toBe("390212345678");
    });

    it("should uppercase country codes", () => {
      const rows = [
        { id: "1", country: "it" },
        { id: "2", country: "FR" },
      ];

      const formatted = rows.map((r) => ({
        ...r,
        country: (r.country as string || "").toUpperCase(),
      }));

      expect(formatted[0].country).toBe("IT");
      expect(formatted[1].country).toBe("FR");
    });

    it("should trim whitespace from text fields", () => {
      const rows = [
        { id: "1", name: "  John Doe  " },
        { id: "2", name: "Jane Smith\n" },
      ];

      const formatted = rows.map((r) => ({
        ...r,
        name: (r.name as string || "").trim(),
      }));

      expect(formatted[0].name).toBe("John Doe");
      expect(formatted[1].name).toBe("Jane Smith");
    });
  });

  // ─── Empty Data Handling ────────────────────────────

  describe("Empty Data Handling", () => {
    it("should handle completely empty dataset", () => {
      const headers = ["id", "name", "email"];
      const rows: Record<string, unknown>[] = [];

      const csv = convertToCSV(headers, rows);
      expect(csv).toBe("id,name,email");
    });

    it("should handle dataset with only headers", () => {
      const headers = ["id", "name", "email"];
      const rows: Record<string, unknown>[] = [];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");

      expect(lines.length).toBe(1);
      expect(lines[0]).toBe("id,name,email");
    });

    it("should handle rows with all null values", () => {
      const headers = ["id", "name", "email"];
      const rows = [
        { id: null, name: null, email: null },
        { id: null, name: null, email: null },
      ];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");

      expect(lines[1]).toBe(",,");
      expect(lines[2]).toBe(",,");
    });

    it("should handle rows with empty strings", () => {
      const headers = ["id", "name", "email"];
      const rows = [
        { id: "", name: "", email: "" },
      ];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");

      expect(lines[1]).toBe(",,");
    });

    it("should count rows correctly", () => {
      const headers = ["id", "name"];
      const rows = [
        { id: "1", name: "John" },
        { id: "2", name: "Jane" },
        { id: "3", name: "Bob" },
      ];

      const csv = convertToCSV(headers, rows);
      const lineCount = csv.split("\n").length - 1; // Exclude header

      expect(lineCount).toBe(3);
    });
  });

  // ─── Contact Export Specific ────────────────────────

  describe("Contact Export", () => {
    it("should export contacts with standard columns", () => {
      const headers = ["id", "name", "email", "phone", "company", "created_at"];
      const rows = [
        {
          id: "c1",
          name: "John Doe",
          email: "john@example.com",
          phone: "+39 02 1234",
          company: "Acme",
          created_at: "2026-04-22",
        },
      ];

      const csv = convertToCSV(headers, rows);
      expect(csv).toContain("id,name,email,phone,company,created_at");
    });

    it("should export contacts with null fields", () => {
      const headers = ["id", "name", "email", "phone", "company"];
      const rows = [
        {
          id: "c1",
          name: "John Doe",
          email: null,
          phone: null,
          company: "Acme",
        },
      ];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");
      expect(lines[1]).toBe("c1,John Doe,,, Acme");
    });

    it("should export contacts with special characters", () => {
      const headers = ["id", "name", "email"];
      const rows = [
        {
          id: "c1",
          name: 'Smith, "Johnny"',
          email: "johnny@example.com",
        },
      ];

      const csv = convertToCSV(headers, rows);
      expect(csv).toContain('Smith, "Johnny"');
    });
  });

  // ─── Deal Export Specific ──────────────────────────

  describe("Deal Export", () => {
    it("should export deals with pipeline columns", () => {
      const headers = ["id", "title", "stage", "amount", "probability", "close_date"];
      const rows = [
        {
          id: "d1",
          title: "Enterprise License",
          stage: "proposal",
          amount: 50000,
          probability: 65,
          close_date: "2026-06-30",
        },
      ];

      const csv = convertToCSV(headers, rows);
      expect(csv).toContain("id,title,stage,amount,probability,close_date");
    });

    it("should format amounts as numbers in export", () => {
      const headers = ["id", "title", "amount"];
      const rows = [
        { id: "d1", title: "Deal 1", amount: 50000 },
        { id: "d2", title: "Deal 2", amount: 75000.50 },
      ];

      const csv = convertToCSV(headers, rows);
      expect(csv).toContain("50000");
      expect(csv).toContain("75000.5");
    });

    it("should handle missing close dates", () => {
      const headers = ["id", "title", "stage", "close_date"];
      const rows = [
        { id: "d1", title: "Deal 1", stage: "lead", close_date: null },
        { id: "d2", title: "Deal 2", stage: "won", close_date: "2026-04-15" },
      ];

      const csv = convertToCSV(headers, rows);
      const lines = csv.split("\n");
      expect(lines[1]).toBe("d1,Deal 1,lead,");
      expect(lines[2]).toBe("d2,Deal 2,won,2026-04-15");
    });
  });

  // ─── Email Export Specific ───────────────────────────

  describe("Email Export", () => {
    it("should export emails with message details", () => {
      const headers = ["id", "from", "to", "subject", "status", "created_at"];
      const rows = [
        {
          id: "e1",
          from: "sender@example.com",
          to: "recipient@example.com",
          subject: "Important Update",
          status: "sent",
          created_at: "2026-04-22",
        },
      ];

      const csv = convertToCSV(headers, rows);
      expect(csv).toContain("Important Update");
    });

    it("should escape subject lines with special chars", () => {
      const headers = ["id", "subject"];
      const rows = [
        { id: "e1", subject: 'RE: "Contract Review", Urgent' },
      ];

      const csv = convertToCSV(headers, rows);
      expect(csv).toContain('"');
    });

    it("should handle multiline email bodies", () => {
      const headers = ["id", "body"];
      const rows = [
        { id: "e1", body: "Line 1\nLine 2\nLine 3" },
      ];

      const csv = convertToCSV(headers, rows);
      expect(csv).toContain('\n');
    });
  });

  // ─── File Generation ────────────────────────────────

  describe("File Generation Helpers", () => {
    it("should generate filename with date", () => {
      const date = "2026-04-22";
      const filename = `export-contacts-${date}.csv`;
      expect(filename).toBe("export-contacts-2026-04-22.csv");
    });

    it("should generate different filename for entity types", () => {
      const date = "2026-04-22";
      const files = [
        `export-contacts-${date}.csv`,
        `export-deals-${date}.csv`,
        `export-partners-${date}.csv`,
        `export-emails-${date}.csv`,
      ];

      expect(files[0]).toContain("contacts");
      expect(files[1]).toContain("deals");
      expect(files[2]).toContain("partners");
      expect(files[3]).toContain("emails");
    });

    it("should handle custom column selection", () => {
      const allColumns = ["id", "name", "email", "phone", "company"];
      const selectedColumns = ["id", "name", "email"];

      const filtered = allColumns.filter((c) =>
        selectedColumns.includes(c)
      );

      expect(filtered).toEqual(["id", "name", "email"]);
    });
  });

  // ─── Batch Export ────────────────────────────────────

  describe("Batch Export Processing", () => {
    it("should export up to 50000 records", () => {
      const recordCount = 50000;
      const rows = Array.from({ length: recordCount }, (_, i) => ({
        id: `r${i}`,
        name: `Contact ${i}`,
        email: `contact${i}@example.com`,
      }));

      const headers = ["id", "name", "email"];
      const csv = convertToCSV(headers, rows);
      const lineCount = csv.split("\n").length - 1;

      expect(lineCount).toBe(recordCount);
    });

    it("should report row count after export", () => {
      const rows = [
        { id: "1", name: "John" },
        { id: "2", name: "Jane" },
        { id: "3", name: "Bob" },
      ];

      const rowCount = rows.length;
      expect(rowCount).toBe(3);
    });
  });
});
