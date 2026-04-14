import { describe, it, expect, vi } from "vitest";
import {
  toWhatsAppNumber,
  extractSeniority,
  getLastName,
  extractDomainKeyword,
  delay,
} from "./useDeepSearchHelpers";

describe("toWhatsAppNumber", () => {
  it("strips non-digit chars except leading +", () => {
    expect(toWhatsAppNumber("+39 333-123-4567")).toBe("393331234567");
  });
  it("strips leading + and spaces", () => {
    expect(toWhatsAppNumber("+1 (555) 123-4567")).toBe("15551234567");
  });
  it("returns empty for empty input", () => {
    expect(toWhatsAppNumber("")).toBe("");
  });
  it("handles already clean number", () => {
    expect(toWhatsAppNumber("393331234567")).toBe("393331234567");
  });
  it("strips letters from mixed input", () => {
    expect(toWhatsAppNumber("abc123def456")).toBe("123456");
  });
  it("handles null-ish input gracefully", () => {
    expect(toWhatsAppNumber(null as unknown as string)).toBe("");
  });
});

describe("extractSeniority", () => {
  it("extracts seniority from CEO title", () => {
    const result = extractSeniority("CEO at Acme Corp");
    expect(result).not.toBeNull();
    expect(result!.seniority).toMatch(/C-Level|executive|senior/i);
    expect(result!.linkedin_title).toBe("CEO at Acme Corp");
  });
  it("extracts from Director title", () => {
    const result = extractSeniority("Director of Sales");
    expect(result).not.toBeNull();
    expect(result!.seniority).toMatch(/director|senior|management/i);
  });
  it("returns null for undefined", () => {
    expect(extractSeniority(undefined)).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(extractSeniority("")).toBeNull();
  });
  it("handles generic title", () => {
    const result = extractSeniority("Employee");
    // May return null or a low-seniority result
    if (result) {
      expect(result.linkedin_title).toBe("Employee");
    }
  });
});

describe("getLastName", () => {
  it("returns last word from full name", () => {
    expect(getLastName("John Smith")).toBe("Smith");
  });
  it("returns single name when only one word", () => {
    expect(getLastName("Madonna")).toBe("Madonna");
  });
  it("returns last word from three-part name", () => {
    expect(getLastName("Maria De Rossi")).toBe("Rossi");
  });
  it("returns empty for empty input", () => {
    expect(getLastName("")).toBe("");
  });
  it("handles leading/trailing spaces", () => {
    expect(getLastName("  John Doe  ")).toBe("Doe");
  });
});

describe("extractDomainKeyword", () => {
  it("extracts domain from business email", () => {
    const result = extractDomainKeyword("info@acmecorp.com");
    expect(result).toBe("acmecorp");
  });
  it("returns null for personal email", () => {
    expect(extractDomainKeyword("user@gmail.com")).toBeNull();
  });
  it("returns null for null input", () => {
    expect(extractDomainKeyword(null)).toBeNull();
  });
  it("returns null for undefined", () => {
    expect(extractDomainKeyword(undefined)).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(extractDomainKeyword("")).toBeNull();
  });
  it("strips TLD from domain", () => {
    const result = extractDomainKeyword("info@logistics-global.com");
    expect(result).toMatch(/logistics/);
  });
});

describe("delay", () => {
  it("resolves after specified ms", async () => {
    vi.useFakeTimers();
    const p = delay(100);
    vi.advanceTimersByTime(100);
    await expect(p).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
