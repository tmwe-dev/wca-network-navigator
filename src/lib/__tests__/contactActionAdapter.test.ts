import { describe, it, expect } from "vitest";
import { adaptImportedContact, adaptBusinessCard } from "@/lib/contactActionAdapter";

describe("contactActionAdapter", () => {
  describe("adaptImportedContact", () => {
    it("maps basic fields correctly", () => {
      const c = { id: "1", name: "John", company_name: "Acme", email: "j@acme.com" };
      const result = adaptImportedContact(c);
      expect(result.id).toBe("1");
      expect(result.name).toBe("John");
      expect(result.company).toBe("Acme");
      expect(result.email).toBe("j@acme.com");
    });

    it("prefers contact_alias over name", () => {
      const c = { id: "1", name: "John", contact_alias: "Johnny" };
      expect(adaptImportedContact(c).name).toBe("Johnny");
    });

    it("prefers company_alias over company_name", () => {
      const c = { id: "1", company_name: "Acme", company_alias: "ACME Corp" };
      expect(adaptImportedContact(c).company).toBe("ACME Corp");
    });

    it("handles missing enrichment_data", () => {
      const c = { id: "1" };
      const result = adaptImportedContact(c);
      expect(result.linkedinUrl).toBe("");
    });

    it("extracts linkedin from enrichment_data", () => {
      const c = { id: "1", enrichment_data: { linkedin_url: "https://linkedin.com/in/john" } };
      expect(adaptImportedContact(c).linkedinUrl).toBe("https://linkedin.com/in/john");
    });

    it("sets sourceType to imported_contact", () => {
      expect(adaptImportedContact({ id: "1" }).sourceType).toBe("imported_contact");
    });

    it("includes email in channels when present", () => {
      const c = { id: "1", email: "a@b.com" };
      expect(adaptImportedContact(c).channels).toContain("email");
    });

    it("defaults empty strings for missing fields", () => {
      const r = adaptImportedContact({ id: "1" });
      expect(r.name).toBe("");
      expect(r.company).toBe("");
      expect(r.email).toBe("");
    });
  });

  describe("adaptBusinessCard", () => {
    it("maps card fields correctly", () => {
      const card = { id: "c1", contact_name: "Jane", company_name: "Corp", email: "j@corp.com" };
      const r = adaptBusinessCard(card);
      expect(r.name).toBe("Jane");
      expect(r.company).toBe("Corp");
      expect(r.sourceType).toBe("business_card");
    });

    it("includes whatsapp channel when mobile present", () => {
      const card = { id: "c1", mobile: "+1234" };
      expect(adaptBusinessCard(card).channels).toContain("whatsapp");
    });
  });
});
