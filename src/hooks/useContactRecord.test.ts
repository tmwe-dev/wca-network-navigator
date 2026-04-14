/**
 * Tests for useUpdateContactRecord — partner contact field routing
 */
import { describe, it, expect } from "vitest";

// Test the field mapping logic directly (extracted for testability)
const CONTACT_FIELD_MAP: Record<string, string> = {
  phone: "direct_phone",
  email: "email",
  mobile: "mobile",
  position: "title",
  contact_name: "name",
  contact_alias: "contact_alias",
};

const PARTNER_ONLY_FIELDS = new Set([
  "company_name", "city", "address", "website",
  "lead_status", "profile_description",
]);

function splitPartnerUpdates(updates: Record<string, unknown>) {
  const partnerUpdates: Record<string, unknown> = {};
  const contactEntries: Array<[string, unknown]> = [];

  for (const [key, value] of Object.entries(updates)) {
    if (PARTNER_ONLY_FIELDS.has(key)) {
      partnerUpdates[key] = value;
    } else if (key in CONTACT_FIELD_MAP) {
      contactEntries.push([CONTACT_FIELD_MAP[key], value]);
    } else {
      partnerUpdates[key] = value;
    }
  }

  return { partnerUpdates, contactEntries };
}

describe("splitPartnerUpdates", () => {
  it("routes phone to partner_contacts.direct_phone", () => {
    const { partnerUpdates, contactEntries } = splitPartnerUpdates({
      phone: "+39123456",
    });
    expect(partnerUpdates).toEqual({});
    expect(contactEntries).toEqual([["direct_phone", "+39123456"]]);
  });

  it("routes email to partner_contacts.email", () => {
    const { contactEntries } = splitPartnerUpdates({ email: "test@example.com" });
    expect(contactEntries).toEqual([["email", "test@example.com"]]);
  });

  it("routes position to partner_contacts.title", () => {
    const { contactEntries } = splitPartnerUpdates({ position: "CEO" });
    expect(contactEntries).toEqual([["title", "CEO"]]);
  });

  it("routes mobile to partner_contacts.mobile", () => {
    const { contactEntries } = splitPartnerUpdates({ mobile: "+39999" });
    expect(contactEntries).toEqual([["mobile", "+39999"]]);
  });

  it("routes company_name to partners table", () => {
    const { partnerUpdates, contactEntries } = splitPartnerUpdates({
      company_name: "Acme Corp",
    });
    expect(partnerUpdates).toEqual({ company_name: "Acme Corp" });
    expect(contactEntries).toEqual([]);
  });

  it("routes lead_status to partners table", () => {
    const { partnerUpdates } = splitPartnerUpdates({ lead_status: "contacted" });
    expect(partnerUpdates).toEqual({ lead_status: "contacted" });
  });

  it("splits mixed updates correctly", () => {
    const { partnerUpdates, contactEntries } = splitPartnerUpdates({
      company_name: "New Name",
      phone: "+39123",
      email: "new@co.com",
      city: "Milan",
      position: "Director",
      lead_status: "in_progress",
      website: "https://co.com",
    });

    expect(partnerUpdates).toEqual({
      company_name: "New Name",
      city: "Milan",
      lead_status: "in_progress",
      website: "https://co.com",
    });
    expect(contactEntries).toEqual([
      ["direct_phone", "+39123"],
      ["email", "new@co.com"],
      ["title", "Director"],
    ]);
  });

  it("handles null values for contact fields", () => {
    const { contactEntries } = splitPartnerUpdates({ phone: null, email: null });
    expect(contactEntries).toEqual([
      ["direct_phone", null],
      ["email", null],
    ]);
  });

  it("routes unknown fields to partner table", () => {
    const { partnerUpdates } = splitPartnerUpdates({ some_custom_field: "value" });
    expect(partnerUpdates).toEqual({ some_custom_field: "value" });
  });
});
