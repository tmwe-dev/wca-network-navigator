import { describe, it, expect } from "vitest";
import {
  parseBusinessCardFile,
  isImageFile,
  isDataFile,
} from "@/lib/businessCardFileParser";

function makeFile(name: string, content: string, type = "text/plain"): File {
  return new File([content], name, { type });
}

describe("businessCardFileParser", () => {
  describe("isImageFile", () => {
    it("riconosce immagini per mime type", () => {
      expect(isImageFile(new File([""], "x.bin", { type: "image/jpeg" }))).toBe(true);
    });

    it("riconosce immagini per estensione", () => {
      expect(isImageFile(new File([""], "card.jpg"))).toBe(true);
      expect(isImageFile(new File([""], "card.HEIC"))).toBe(true);
      expect(isImageFile(new File([""], "card.png"))).toBe(true);
      expect(isImageFile(new File([""], "card.webp"))).toBe(true);
    });

    it("false su non-immagini", () => {
      expect(isImageFile(new File([""], "x.csv"))).toBe(false);
      expect(isImageFile(new File([""], "x.pdf"))).toBe(false);
    });
  });

  describe("isDataFile", () => {
    it("true su csv/xlsx/xls/json/vcf/txt", () => {
      expect(isDataFile(new File([""], "x.csv"))).toBe(true);
      expect(isDataFile(new File([""], "x.xlsx"))).toBe(true);
      expect(isDataFile(new File([""], "x.json"))).toBe(true);
      expect(isDataFile(new File([""], "x.vcf"))).toBe(true);
      expect(isDataFile(new File([""], "x.txt"))).toBe(true);
    });

    it("false su immagini", () => {
      expect(isDataFile(new File([""], "x.jpg"))).toBe(false);
    });
  });

  describe("parseBusinessCardFile - VCF", () => {
    it("parsa una vCard semplice", async () => {
      const vcf = `BEGIN:VCARD
VERSION:3.0
FN:Mario Rossi
ORG:Acme Spa
TITLE:CEO
EMAIL:m@acme.it
TEL;TYPE=CELL:+393331234567
TEL;TYPE=WORK:+390212345
NOTE:VIP customer
END:VCARD`;
      const r = await parseBusinessCardFile(makeFile("c.vcf", vcf));
      expect(r).toHaveLength(1);
      expect(r[0].contact_name).toBe("Mario Rossi");
      expect(r[0].company_name).toBe("Acme Spa");
      expect(r[0].position).toBe("CEO");
      expect(r[0].email).toBe("m@acme.it");
      expect(r[0].mobile).toBe("+393331234567");
      expect(r[0].phone).toBe("+390212345");
      expect(r[0].notes).toBe("VIP customer");
    });

    it("usa N se FN mancante", async () => {
      const vcf = `BEGIN:VCARD
N:Rossi;Mario;;;
EMAIL:m@a.it
END:VCARD`;
      const r = await parseBusinessCardFile(makeFile("c.vcf", vcf));
      expect(r[0].contact_name).toBe("Mario Rossi");
    });

    it("parsa più vCard nello stesso file", async () => {
      const vcf = `BEGIN:VCARD
FN:A
EMAIL:a@x.it
END:VCARD
BEGIN:VCARD
FN:B
EMAIL:b@x.it
END:VCARD`;
      const r = await parseBusinessCardFile(makeFile("c.vcf", vcf));
      expect(r).toHaveLength(2);
      expect(r[0].contact_name).toBe("A");
      expect(r[1].contact_name).toBe("B");
    });

    it("scarta vCard senza nome/azienda/email", async () => {
      const vcf = `BEGIN:VCARD
TEL:+39000
END:VCARD`;
      const r = await parseBusinessCardFile(makeFile("c.vcf", vcf));
      expect(r).toHaveLength(0);
    });

    it("popola raw_data con i campi originali", async () => {
      const vcf = `BEGIN:VCARD
FN:X
EMAIL:x@y.it
END:VCARD`;
      const r = await parseBusinessCardFile(makeFile("c.vcf", vcf));
      expect(r[0].raw_data).toBeDefined();
      expect(r[0].raw_data?.FN).toBe("X");
      expect(r[0].raw_data?.EMAIL).toBe("x@y.it");
    });
  });

  describe("parseBusinessCardFile - CSV", () => {
    it("mappa headers IT/EN a campi business card", async () => {
      const csv = "Nome,Azienda,Email,Cellulare\nMario,Acme,m@a.it,+39333";
      const r = await parseBusinessCardFile(makeFile("c.csv", csv));
      expect(r).toHaveLength(1);
      expect(r[0].contact_name).toBe("Mario");
      expect(r[0].company_name).toBe("Acme");
      expect(r[0].email).toBe("m@a.it");
      expect(r[0].mobile).toBe("+39333");
    });

    it("scarta righe senza nome/azienda/email", async () => {
      const csv = "Nome,Email\nMario,m@a.it\n,";
      const r = await parseBusinessCardFile(makeFile("c.csv", csv));
      expect(r).toHaveLength(1);
    });

    it("throw se nessuna colonna riconosciuta", async () => {
      const csv = "Pippo,Pluto\n1,2";
      await expect(parseBusinessCardFile(makeFile("c.csv", csv))).rejects.toThrow(/Nessuna colonna/);
    });

    it("popola raw_data con tutte le celle non vuote", async () => {
      const csv = "Nome,Email,Extra\nMario,m@a.it,xyz";
      const r = await parseBusinessCardFile(makeFile("c.csv", csv));
      expect(r[0].raw_data?.Extra).toBe("xyz");
    });
  });

  describe("parseBusinessCardFile - estensioni", () => {
    it("throw su estensione non supportata", async () => {
      await expect(
        parseBusinessCardFile(makeFile("c.pdf", "x"))
      ).rejects.toThrow(/non supportato/);
    });
  });
});
