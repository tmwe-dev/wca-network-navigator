import { describe, it, expect } from "vitest";
import { getEmailDomain, isLinkedInProfileUrl, normalizeLinkedInProfileUrl, cleanGoogleLinkedInTitle } from "@/lib/linkedinSearch";

vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

describe("linkedinSearch", () => {
  it("getEmailDomain extracts domain from email", () => {
    expect(getEmailDomain("john@acme.com")).toBe("acme.com");
  });

  it("getEmailDomain returns null for invalid email", () => {
    expect(getEmailDomain(null)).toBeNull();
    expect(getEmailDomain("")).toBeNull();
  });

  it("isLinkedInProfileUrl detects /in/ paths", () => {
    expect(isLinkedInProfileUrl("https://www.linkedin.com/in/john-doe")).toBe(true);
    expect(isLinkedInProfileUrl("https://google.com")).toBe(false);
  });

  it("normalizeLinkedInProfileUrl cleans URL", () => {
    const result = normalizeLinkedInProfileUrl("https://www.linkedin.com/in/john-doe?trk=abc");
    expect(result).toContain("/in/john-doe");
  });

  it("cleanGoogleLinkedInTitle strips LinkedIn prefix", () => {
    const result = cleanGoogleLinkedInTitle("John Doe - CEO - LinkedIn");
    expect(result).not.toContain("LinkedIn");
    expect(result).toContain("John");
  });
});
