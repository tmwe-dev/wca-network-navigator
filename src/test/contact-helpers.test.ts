import { describe, it, expect } from "vitest";
import { clean, getContactQuality, sortContacts, formatPhone } from "@/components/contacts/contactHelpers";

describe("Contact Helpers", () => {
  describe("clean()", () => {
    it("returns null for empty/null values", () => {
      expect(clean(null)).toBeNull();
      expect(clean("")).toBeNull();
      expect(clean("   ")).toBeNull();
    });

    it("returns null for 'NULL' string", () => {
      expect(clean("NULL")).toBeNull();
      expect(clean("null")).toBeNull();
    });

    it("trims valid strings", () => {
      expect(clean("  hello  ")).toBe("hello");
    });
  });

  describe("getContactQuality()", () => {
    it("returns 'good' for complete contacts", () => {
      const c = { company_name: "Acme", name: "John", email: "j@a.com", phone: "+1234", country: "IT" };
      expect(getContactQuality(c)).toBe("good");
    });

    it("returns 'partial' for incomplete contacts", () => {
      const c = { company_name: "Acme", name: "John", email: null, phone: null, country: null };
      expect(getContactQuality(c)).toBe("partial");
    });

    it("returns 'poor' for minimal contacts", () => {
      const c = { company_name: null, name: "John", email: null, phone: null, country: null };
      expect(getContactQuality(c)).toBe("poor");
    });
  });

  describe("sortContacts()", () => {
    const contacts = [
      { company_name: "Zebra", name: "Alice", city: "Rome", created_at: "2024-01-01" },
      { company_name: "Acme", name: "Bob", city: "Milan", created_at: "2024-06-01" },
    ];

    it("sorts by company name", () => {
      const sorted = sortContacts(contacts, "company");
      expect(sorted[0].company_name).toBe("Acme");
    });

    it("sorts by name", () => {
      const sorted = sortContacts(contacts, "name");
      expect(sorted[0].name).toBe("Alice");
    });

    it("sorts by date descending", () => {
      const sorted = sortContacts(contacts, "date");
      expect(sorted[0].company_name).toBe("Acme"); // more recent
    });
  });

  describe("formatPhone()", () => {
    it("strips non-numeric chars except +", () => {
      expect(formatPhone("+1 (234) 567-890")).toBe("+1234567890");
    });
  });
});
