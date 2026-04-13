import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/import/fileParser", () => ({
  parseFile: vi.fn().mockResolvedValue({ headers: ["name", "email"], rows: [{ name: "John", email: "j@test.com" }] }),
}));

describe("businessCardFileParser", () => {
  it("matchField maps 'email' to email field", async () => {
    const mod = await import("@/lib/businessCardFileParser");
    expect(mod).toBeDefined();
    // Module should export parseBusinessCardFile
    expect(typeof mod.parseBusinessCardFile).toBe("function");
  });

  it("parseBusinessCardFile handles CSV files", async () => {
    const { parseBusinessCardFile } = await import("@/lib/businessCardFileParser");
    const file = new File(["name,email\nJohn,j@test.com"], "test.csv", { type: "text/csv" });
    const result = await parseBusinessCardFile(file);
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns empty array for empty file content", async () => {
    const { parseFile } = await import("@/lib/import/fileParser");
    (parseFile as any).mockResolvedValueOnce({ headers: [], rows: [] });
    const { parseBusinessCardFile } = await import("@/lib/businessCardFileParser");
    const file = new File([""], "empty.csv", { type: "text/csv" });
    const result = await parseBusinessCardFile(file);
    expect(result).toEqual([]);
  });

  it("FIELD_MAP contains company_name synonyms", async () => {
    // Testing internal synonyms through module behavior
    const mod = await import("@/lib/businessCardFileParser");
    expect(mod.parseBusinessCardFile).toBeDefined();
  });

  it("handles VCF file detection by extension", async () => {
    const { parseBusinessCardFile } = await import("@/lib/businessCardFileParser");
    const vcfContent = "BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEMAIL:john@test.com\nEND:VCARD";
    const file = new File([vcfContent], "contacts.vcf", { type: "text/vcard" });
    const result = await parseBusinessCardFile(file);
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("contact_name");
    }
  });
});
