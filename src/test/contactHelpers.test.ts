import { describe, it, expect } from "vitest";
import { clean, getContactQuality, sortContacts, formatPhone } from "@/components/contacts/contactHelpers";

describe("clean", () => {
  it("returns null for falsy values", () => {
    expect(clean(null)).toBeNull();
    expect(clean(undefined)).toBeNull();
    expect(clean("")).toBeNull();
  });

  it("returns null for NULL string", () => {
    expect(clean("NULL")).toBeNull();
    expect(clean("null")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(clean("  hello  ")).toBe("hello");
  });

  it("returns null for whitespace-only", () => {
    expect(clean("   ")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("strips non-numeric chars except +", () => {
    expect(formatPhone("+1 (234) 567-890")).toBe("+1234567890");
  });
});

describe("getContactQuality", () => {
  it("returns 'good' when 4+ fields filled", () => {
    expect(getContactQuality({
      company_name: "Acme", name: "John", email: "j@a.com", phone: "+123", country: "IT",
    })).toBe("good");
  });

  it("returns 'partial' when 2-3 fields filled", () => {
    expect(getContactQuality({ name: "John", email: "j@a.com" })).toBe("partial");
  });

  it("returns 'poor' when 0-1 fields filled", () => {
    expect(getContactQuality({})).toBe("poor");
    expect(getContactQuality({ name: "John" })).toBe("poor");
  });

  it("ignores empty and NULL strings", () => {
    expect(getContactQuality({ name: "", email: "NULL" })).toBe("poor");
  });
});

describe("sortContacts", () => {
  const contacts = [
    { name: "Charlie", company_name: "Zeta", city: "Rome", created_at: "2024-03-01" },
    { name: "Alice", company_name: "Alpha", city: "Berlin", created_at: "2024-01-01" },
    { name: "Bob", company_name: "Beta", city: "Paris", created_at: "2024-02-01" },
  ] as Record<string, unknown>[];

  it("sorts by name", () => {
    const sorted = sortContacts(contacts, "name");
    expect((sorted[0] as { name: string }).name).toBe("Alice");
    expect((sorted[2] as { name: string }).name).toBe("Charlie");
  });

  it("sorts by company", () => {
    const sorted = sortContacts(contacts, "company");
    expect((sorted[0] as { company_name: string }).company_name).toBe("Alpha");
  });

  it("sorts by city", () => {
    const sorted = sortContacts(contacts, "city");
    expect((sorted[0] as { city: string }).city).toBe("Berlin");
  });

  it("sorts by date (newest first)", () => {
    const sorted = sortContacts(contacts, "date");
    expect((sorted[0] as { name: string }).name).toBe("Charlie");
    expect((sorted[2] as { name: string }).name).toBe("Alice");
  });

  it("does not mutate original array", () => {
    const original = [...contacts];
    sortContacts(contacts, "name");
    expect(contacts).toEqual(original);
  });
});
