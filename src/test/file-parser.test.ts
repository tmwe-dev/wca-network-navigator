import { describe, it, expect } from "vitest";
import { parseFile } from "@/lib/import/fileParser";

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: "text/plain" });
}

describe("fileParser.parseFile", () => {
  describe("CSV", () => {
    it("auto-detect delimiter virgola e header", async () => {
      const csv = "name,email,phone\nMario,m@a.it,+39000\nLuca,l@b.it,+39111";
      const { parsed, options } = await parseFile(makeFile("data.csv", csv));
      expect(parsed.detectedFormat).toBe("csv");
      expect(parsed.headers).toEqual(["name", "email", "phone"]);
      expect(parsed.totalRows).toBe(2);
      expect(parsed.rows[0]).toEqual(["Mario", "m@a.it", "+39000"]);
      expect(options.delimiter).toBe(",");
      expect(options.hasHeader).toBe(true);
    });

    it("auto-detect punto e virgola", async () => {
      const csv = "a;b;c\n1;2;3\n4;5;6";
      const { options } = await parseFile(makeFile("x.csv", csv));
      expect(options.delimiter).toBe(";");
    });

    it("auto-detect tab", async () => {
      const csv = "a\tb\tc\nx\ty\tz";
      const { options } = await parseFile(makeFile("x.csv", csv));
      expect(options.delimiter).toBe("\t");
    });

    it("normalizza righe più corte/lunghe alla larghezza headers", async () => {
      const csv = "a,b,c\n1,2\n4,5,6,7";
      const { parsed } = await parseFile(makeFile("x.csv", csv), { delimiter: "," });
      expect(parsed.rows[0]).toEqual(["1", "2", ""]);
      expect(parsed.rows[1]).toEqual(["4", "5", "6"]);
    });

    it("filtra righe vuote", async () => {
      const csv = "a,b\n1,2\n,\n3,4";
      const { parsed } = await parseFile(makeFile("x.csv", csv));
      expect(parsed.totalRows).toBe(2);
    });

    it("dedup headers duplicati", async () => {
      const csv = "email,email,name\n1,2,3";
      const { parsed } = await parseFile(makeFile("x.csv", csv));
      expect(parsed.headers).toEqual(["email", "email_2", "name"]);
    });

    it("genera headers automatici se hasHeader override false", async () => {
      const csv = "1,2,3\n4,5,6";
      const { parsed } = await parseFile(makeFile("x.csv", csv), { hasHeader: false });
      expect(parsed.headers[0]).toContain("Colonna");
      expect(parsed.totalRows).toBe(2);
    });

    it("rispetta skipRows", async () => {
      const csv = "skip me\nname,email\nMario,m@a.it";
      const { parsed } = await parseFile(makeFile("x.csv", csv), { skipRows: 1, delimiter: "," });
      expect(parsed.headers).toEqual(["name", "email"]);
      expect(parsed.totalRows).toBe(1);
    });

    it("throw su file completamente vuoto", async () => {
      await expect(parseFile(makeFile("x.csv", ""))).rejects.toThrow();
    });

    it("sampleRows non eccede SAMPLE_SIZE (50)", async () => {
      const lines = ["name"];
      for (let i = 0; i < 200; i++) lines.push(`row${i}`);
      const { parsed } = await parseFile(makeFile("x.csv", lines.join("\n")));
      expect(parsed.totalRows).toBe(200);
      expect(parsed.sampleRows.length).toBeLessThanOrEqual(50);
    });
  });

  describe("TXT", () => {
    it("trattato come CSV ma con detectedFormat=txt", async () => {
      const { parsed } = await parseFile(makeFile("notes.txt", "a,b\n1,2"));
      expect(parsed.detectedFormat).toBe("txt");
    });
  });

  describe("JSON", () => {
    it("parsa array di oggetti", async () => {
      const json = JSON.stringify([
        { name: "Mario", email: "m@a.it" },
        { name: "Luca", email: "l@b.it" },
      ]);
      const { parsed } = await parseFile(makeFile("data.json", json));
      expect(parsed.detectedFormat).toBe("json");
      expect(parsed.headers).toEqual(["name", "email"]);
      expect(parsed.totalRows).toBe(2);
      expect(parsed.rows[0]).toEqual(["Mario", "m@a.it"]);
    });

    it("union di chiavi su record eterogenei", async () => {
      const json = JSON.stringify([
        { a: 1, b: 2 },
        { a: 3, c: 4 },
      ]);
      const { parsed } = await parseFile(makeFile("x.json", json));
      expect(parsed.headers.sort()).toEqual(["a", "b", "c"]);
      expect(parsed.totalRows).toBe(2);
    });

    it("estrae record da object con array nested", async () => {
      const json = JSON.stringify({ contacts: [{ name: "X" }, { name: "Y" }] });
      const { parsed } = await parseFile(makeFile("x.json", json));
      expect(parsed.totalRows).toBe(2);
    });

    it("singolo oggetto → 1 record", async () => {
      const json = JSON.stringify({ name: "Mario", role: "CEO" });
      const { parsed } = await parseFile(makeFile("x.json", json));
      expect(parsed.totalRows).toBe(1);
      expect(parsed.rows[0]).toContain("Mario");
    });

    it("serializza valori nested in stringa", async () => {
      const json = JSON.stringify([{ tags: ["a", "b"], meta: { x: 1 } }]);
      const { parsed } = await parseFile(makeFile("x.json", json));
      expect(parsed.rows[0][0]).toContain("a");
      expect(parsed.rows[0][1]).toContain("x");
    });

    it("throw su JSON malformato", async () => {
      await expect(parseFile(makeFile("x.json", "{ not json"))).rejects.toThrow();
    });

    it("throw su JSON senza record importabili", async () => {
      await expect(parseFile(makeFile("x.json", "[]"))).rejects.toThrow();
    });
  });
});
