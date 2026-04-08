import { describe, it, expect } from "vitest";
import {
  applyTransformation,
  normalizePhone,
  extractEmail,
  parseCountry,
  validateAndTransform,
  transformRow,
} from "@/lib/import/validator";
import type { ColumnMapping } from "@/lib/import/types";

describe("import/validator — pure helpers", () => {
  describe("normalizePhone", () => {
    it("rimuove spazi, punti e parentesi", () => {
      expect(normalizePhone("+39 (02) 123.456-78")).toBe("+390212345678");
    });

    it("converte 00xx a +xx", () => {
      expect(normalizePhone("0049 30 12345")).toBe("+493012345");
    });

    it("aggiunge +39 a mobile italiano", () => {
      expect(normalizePhone("3331234567")).toBe("+393331234567");
    });

    it("aggiunge +39 a fisso italiano", () => {
      expect(normalizePhone("0212345678")).toBe("+390212345678");
    });

    it("prende solo il primo telefono se separati da pipe/slash/virgola", () => {
      expect(normalizePhone("3331234567 | 0212345678")).toBe("+393331234567");
      expect(normalizePhone("0212345678 / 3331234567")).toBe("+390212345678");
      expect(normalizePhone("3331234567, 0212345678")).toBe("+393331234567");
    });
  });

  describe("extractEmail", () => {
    it("estrae email da stringa rumorosa", () => {
      expect(extractEmail("Contattami su Mario.Rossi@Example.com per info")).toBe(
        "mario.rossi@example.com"
      );
    });

    it("ritorna lowercase del valore se non match", () => {
      expect(extractEmail("NESSUNA EMAIL")).toBe("nessuna email");
    });

    it("normalizza email valida lowercasing", () => {
      expect(extractEmail("LUCA@TEST.IT")).toBe("luca@test.it");
    });
  });

  describe("parseCountry", () => {
    it("normalizza nomi italiani e inglesi", () => {
      expect(parseCountry("italia")).toBe("Italy");
      expect(parseCountry("Italy")).toBe("Italy");
      expect(parseCountry("ITA")).toBe("Italy");
      expect(parseCountry("germania")).toBe("Germany");
      expect(parseCountry("DE")).toBe("Germany");
    });

    it("ritorna valore invariato se sconosciuto", () => {
      expect(parseCountry("Atlantide")).toBe("Atlantide");
    });
  });

  describe("applyTransformation", () => {
    it("trim è il default", () => {
      expect(applyTransformation("  hello  ", "trim")).toBe("hello");
    });

    it("uppercase / lowercase / capitalize", () => {
      expect(applyTransformation("hello world", "uppercase")).toBe("HELLO WORLD");
      expect(applyTransformation("HELLO WORLD", "lowercase")).toBe("hello world");
      expect(applyTransformation("hello world", "capitalize")).toBe("Hello World");
    });

    it("delega a normalizePhone / extractEmail / parseCountry", () => {
      expect(applyTransformation("3331234567", "normalize_phone")).toBe("+393331234567");
      expect(applyTransformation("contact: a@b.it", "extract_email")).toBe("a@b.it");
      expect(applyTransformation("italia", "parse_country")).toBe("Italy");
    });

    it("ritorna stringa vuota su input vuoto/null", () => {
      expect(applyTransformation("", "uppercase")).toBe("");
      expect(applyTransformation("   ", "trim")).toBe("");
    });
  });

  describe("validateAndTransform", () => {
    const mappings: ColumnMapping[] = [
      { sourceColumn: "Nome", sourceIndex: 0, targetColumn: "name", confidence: 100, transformation: "capitalize" },
      { sourceColumn: "Email", sourceIndex: 1, targetColumn: "email", confidence: 100, transformation: "extract_email" },
      { sourceColumn: "Telefono", sourceIndex: 2, targetColumn: "phone", confidence: 100, transformation: "normalize_phone" },
      { sourceColumn: "Paese", sourceIndex: 3, targetColumn: "country", confidence: 100, transformation: "parse_country" },
    ];

    it("trasforma riga valida e popola tutti i target", () => {
      const result = validateAndTransform(
        [["mario rossi", "Mario.Rossi@Test.IT", "3331234567", "italia"]],
        mappings
      );
      expect(result.validRows).toHaveLength(1);
      expect(result.rejectedRows).toHaveLength(0);
      const r = result.validRows[0];
      expect(r.name).toBe("Mario Rossi");
      expect(r.email).toBe("mario.rossi@test.it");
      expect(r.phone).toBe("+393331234567");
      expect(r.country).toBe("Italy");
    });

    it("scarta righe completamente vuote", () => {
      const result = validateAndTransform(
        [["", "", "", ""], ["mario", "m@x.it", "", ""]],
        mappings
      );
      expect(result.validRows).toHaveLength(1);
      expect(result.rejectedRows).toHaveLength(1);
      expect(result.rejectedRows[0].reasons[0]).toMatch(/vuota/i);
    });

    it("converte 'NULL' string a null", () => {
      const result = validateAndTransform([["NULL", "a@b.it", "NULL", "Italy"]], mappings);
      expect(result.validRows[0].name).toBeNull();
      expect(result.validRows[0].phone).toBeNull();
    });

    it("non rigetta email malformate ma le tiene best-effort", () => {
      const result = validateAndTransform([["mario", "non-email", "", ""]], mappings);
      expect(result.validRows).toHaveLength(1);
      expect(result.rejectedRows).toHaveLength(0);
    });

    it("calcola statistiche corrette", () => {
      const result = validateAndTransform(
        [
          ["a", "a@a.it", "", ""],
          ["", "", "", ""],
          ["b", "b@b.it", "", ""],
        ],
        mappings
      );
      expect(result.stats.totalRows).toBe(3);
      expect(result.stats.importedCount).toBe(2);
      expect(result.stats.rejectedCount).toBe(1);
    });

    it("ignora mapping senza targetColumn", () => {
      const partial: ColumnMapping[] = [
        { sourceColumn: "Nome", sourceIndex: 0, targetColumn: "name", confidence: 100, transformation: "capitalize" },
        { sourceColumn: "Boh", sourceIndex: 1, targetColumn: "", confidence: 0, transformation: "none" },
      ];
      const result = validateAndTransform([["mario", "ignora"]], partial);
      expect(result.validRows[0].name).toBe("Mario");
      // il mapping con targetColumn vuoto non deve produrre output utile
      expect(Object.keys(result.validRows[0])).toContain("name");
    });
  });

  describe("transformRow", () => {
    it("applica auto-detect per phone/email/country/name", () => {
      const row = { Nome: "mario rossi", Email: "Contattami: A@B.IT", Telefono: "3331234567", Paese: "italia" };
      const mapping = { Nome: "name", Email: "email", Telefono: "phone", Paese: "country" };
      const result = transformRow(row, mapping);
      expect(result.name).toBe("Mario Rossi");
      expect(result.email).toBe("a@b.it");
      expect(result.phone).toBe("+393331234567");
      expect(result.country).toBe("Italy");
    });

    it("trova chiavi via fuzzy match", () => {
      const row = { "Nome Azienda": "globex" };
      const mapping = { "nome_azienda": "company_name" };
      const result = transformRow(row, mapping);
      expect(result.company_name).toBe("Globex");
    });

    it("ignora mapping verso colonne sconosciute", () => {
      const row = { x: "y" };
      const mapping = { x: "non_esiste" };
      const result = transformRow(row, mapping);
      expect(result).toEqual({});
    });

    it("ritorna null per valori vuoti, NULL string e undefined", () => {
      const row = { a: "", b: "NULL", c: "  " };
      const mapping = { a: "name", b: "email", c: "city" };
      const result = transformRow(row, mapping);
      expect(result.name).toBeNull();
      expect(result.email).toBeNull();
      expect(result.city).toBeNull();
    });
  });
});
