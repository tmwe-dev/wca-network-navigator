import { describe, it, expect } from "vitest";
import { adaptImportedContact, adaptBusinessCard } from "@/lib/contactActionAdapter";

describe("contactActionAdapter", () => {
  describe("adaptImportedContact", () => {
    it("mappa campi base e usa contact_alias prima di name", () => {
      const c = {
        id: "x1",
        contact_alias: "Mario Rossi",
        name: "Old Name",
        company_alias: "Acme Spa",
        company_name: "Acme",
        position: "CEO",
        country: "IT",
        email: "m@a.it",
        phone: "+39000",
        wca_partner_id: "p1",
        origin: "linkedin",
      };
      const r = adaptImportedContact(c);
      expect(r.id).toBe("x1");
      expect(r.queueId).toBe("x1");
      expect(r.name).toBe("Mario Rossi");
      expect(r.company).toBe("Acme Spa");
      expect(r.role).toBe("CEO");
      expect(r.country).toBe("IT");
      expect(r.email).toBe("m@a.it");
      expect(r.phone).toBe("+39000");
      expect(r.partnerId).toBe("p1");
      expect(r.origin).toBe("linkedin");
      expect(r.sourceType).toBe("imported_contact");
    });

    it("calcola channels in base ai dati presenti", () => {
      const r = adaptImportedContact({
        id: "1",
        email: "a@b.it",
        enrichment_data: { linkedin_url: "https://lk/x" },
        phone: "+39",
      });
      expect(r.channels).toContain("email");
      expect(r.channels).toContain("linkedin");
      expect(r.channels).toContain("whatsapp");
    });

    it("nessun channel se nessun canale disponibile", () => {
      const r = adaptImportedContact({ id: "1" });
      expect(r.channels).toEqual([]);
    });

    it("fallback su name e company_name se manca alias", () => {
      const r = adaptImportedContact({ id: "1", name: "X", company_name: "Y" });
      expect(r.name).toBe("X");
      expect(r.company).toBe("Y");
    });

    it("phone fallback su mobile", () => {
      const r = adaptImportedContact({ id: "1", mobile: "+39mob" });
      expect(r.phone).toBe("+39mob");
    });

    it("partnerId è null se wca_partner_id mancante", () => {
      const r = adaptImportedContact({ id: "1" });
      expect(r.partnerId).toBeNull();
    });

    it("origin di default è 'import'", () => {
      const r = adaptImportedContact({ id: "1" });
      expect(r.origin).toBe("import");
      expect(r.originDetail).toBe("import");
    });

    it("propaga linkedinUrl e enrichmentData", () => {
      const ed = { linkedin_url: "https://lk/test", extra: "x" };
      const r = adaptImportedContact({ id: "1", enrichment_data: ed });
      expect(r.linkedinUrl).toBe("https://lk/test");
      expect(r.enrichmentData).toEqual(ed);
    });
  });

  describe("adaptBusinessCard", () => {
    it("mappa campi base", () => {
      const card = {
        id: "bc1",
        contact_name: "Luca",
        company_name: "Cowork",
        position: "Founder",
        email: "luca@cowork.it",
        mobile: "+393331234567",
        matched_partner_id: "p2",
      };
      const r = adaptBusinessCard(card);
      expect(r.id).toBe("bc1");
      expect(r.name).toBe("Luca");
      expect(r.company).toBe("Cowork");
      expect(r.role).toBe("Founder");
      expect(r.email).toBe("luca@cowork.it");
      expect(r.phone).toBe("+393331234567");
      expect(r.partnerId).toBe("p2");
      expect(r.sourceType).toBe("business_card");
      expect(r.origin).toBe("bca");
      expect(r.originDetail).toBe("Biglietto da visita");
    });

    it("phone fallback su phone se mobile assente", () => {
      const r = adaptBusinessCard({ id: "1", phone: "+390212" });
      expect(r.phone).toBe("+390212");
    });

    it("channels solo email/whatsapp (no linkedin)", () => {
      const r = adaptBusinessCard({ id: "1", email: "a@b.it", mobile: "+39" });
      expect(r.channels).toEqual(["email", "whatsapp"]);
      expect(r.channels).not.toContain("linkedin");
    });

    it("partnerId null se matched_partner_id mancante", () => {
      const r = adaptBusinessCard({ id: "1" });
      expect(r.partnerId).toBeNull();
    });
  });
});
