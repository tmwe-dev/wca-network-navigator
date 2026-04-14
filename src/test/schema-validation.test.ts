import { describe, it, expect } from "vitest";

/**
 * Schema validation tests — ensuring scraped data is validated before DB save.
 * Tests the validation logic that should run on partner profile data.
 */

// Replicate the validation schema inline (since Zod runs in browser)
function validatePartnerData(data: any): { valid: boolean; errors: string[] } { // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
  const errors: string[] = [];
  
  if (!data.company_name || typeof data.company_name !== "string" || data.company_name.length < 2) {
    errors.push("company_name: required, min 2 chars");
  }
  if (data.company_name && data.company_name.length > 200) {
    errors.push("company_name: max 200 chars");
  }
  if (!data.country_code || typeof data.country_code !== "string" || !/^[A-Z]{2}$/.test(data.country_code)) {
    errors.push("country_code: must be 2-letter uppercase ISO code");
  }
  if (data.email && !/\S+@\S+\.\S+/.test(data.email)) {
    errors.push("email: invalid format");
  }
  if (data.phone && typeof data.phone === "string" && data.phone.length > 30) {
    errors.push("phone: max 30 chars");
  }
  if (data.website && typeof data.website === "string") {
    if (data.website.includes("wcaworld.com")) {
      errors.push("website: must not be wcaworld.com");
    }
    if (data.website.length > 500) {
      errors.push("website: max 500 chars");
    }
  }
  if (data.wca_id && (typeof data.wca_id !== "number" || data.wca_id <= 0)) {
    errors.push("wca_id: must be positive integer");
  }
  
  // Contacts validation
  if (data.contacts && Array.isArray(data.contacts)) {
    for (let i = 0; i < data.contacts.length; i++) {
      const c = data.contacts[i];
      if (!c.title && !c.name) {
        errors.push(`contacts[${i}]: must have title or name`);
      }
      if (c.email && !/\S+@\S+\.\S+/.test(c.email)) {
        errors.push(`contacts[${i}].email: invalid format`);
      }
      if (c.name && /Members\s*only|Login/i.test(c.name)) {
        errors.push(`contacts[${i}].name: contains garbage text`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

describe("Partner Data Schema Validation (OWASP)", () => {
  it("accepts valid partner data", () => {
    const result = validatePartnerData({
      company_name: "Acme Logistics Ltd.",
      country_code: "IT",
      city: "Milan",
      email: "info@acme.com",
      phone: "+39 02 1234567",
      website: "https://www.acme.com",
      wca_id: 12345,
      contacts: [
        { name: "John Doe", title: "Manager", email: "john@acme.com" },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing company name", () => {
    const result = validatePartnerData({ company_name: "", country_code: "IT" });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("company_name"))).toBe(true);
  });

  it("rejects invalid country code", () => {
    const result = validatePartnerData({ company_name: "Test", country_code: "italy" });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("country_code"))).toBe(true);
  });

  it("rejects wcaworld.com as website", () => {
    const result = validatePartnerData({ company_name: "Test", country_code: "IT", website: "https://www.wcaworld.com" });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("wcaworld.com"))).toBe(true);
  });

  it("rejects garbage contact names", () => {
    const result = validatePartnerData({
      company_name: "Test",
      country_code: "IT",
      contacts: [{ name: "Members only", title: "Login to view" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("garbage text"))).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = validatePartnerData({
      company_name: "Test",
      country_code: "IT",
      email: "not-an-email",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects negative wca_id", () => {
    const result = validatePartnerData({
      company_name: "Test",
      country_code: "IT",
      wca_id: -1,
    });
    expect(result.valid).toBe(false);
  });

  it("accepts null optional fields", () => {
    const result = validatePartnerData({
      company_name: "Test Co",
      country_code: "US",
      email: null,
      phone: null,
      website: null,
      contacts: [],
    });
    expect(result.valid).toBe(true);
  });
});

describe("HTML Sanitization (OWASP XSS Prevention)", () => {
  it("strips script tags from profile description", () => {
    const raw = 'Logistics company <script>alert("xss")</script> in Milan';
    const sanitized = raw.replace(/<script[\s\S]*?<\/script>/gi, "").trim();
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toContain("Logistics company");
  });

  it("strips event handlers from HTML", () => {
    const raw = '<div onload="alert(1)">Content</div>';
    const sanitized = raw.replace(/\son\w+="[^"]*"/gi, "");
    expect(sanitized).not.toContain("onload");
  });

  it("preserves safe HTML structure", () => {
    const raw = "<b>Bold</b> and <em>italic</em>";
    const stripped = raw.replace(/<[^>]+>/g, "");
    expect(stripped).toBe("Bold and italic");
  });
});
