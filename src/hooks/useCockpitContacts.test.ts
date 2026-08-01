import { describe, it, expect } from "vitest";
import { inferLanguage, inferChannels, computePriority } from "./useCockpitContacts";

describe("inferLanguage", () => {
  it("returns italiano for IT", () => {
    expect(inferLanguage("IT")).toBe("italiano");
  });
  it("returns français for FR", () => {
    expect(inferLanguage("FR")).toBe("français");
  });
  it("returns english for unknown country", () => {
    expect(inferLanguage("ZZ")).toBe("english");
  });
  it("returns english for null", () => {
    expect(inferLanguage(null)).toBe("english");
  });
  it("handles lowercase input", () => {
    expect(inferLanguage("de")).toBe("deutsch");
  });
  it("handles whitespace-padded input", () => {
    expect(inferLanguage("  ES  ")).toBe("español");
  });
  it("returns português for BR", () => {
    expect(inferLanguage("BR")).toBe("português");
  });
});

describe("inferChannels", () => {
  it("returns email + linkedin for email-only contact", () => {
    const ch = inferChannels("test@example.com", null, null);
    expect(ch).toContain("email");
    expect(ch).toContain("linkedin");
    expect(ch).not.toContain("whatsapp");
  });
  it("returns whatsapp + sms + linkedin for phone-only contact", () => {
    const ch = inferChannels(null, "+39123456", null);
    expect(ch).toContain("whatsapp");
    expect(ch).toContain("sms");
    expect(ch).toContain("linkedin");
    expect(ch).not.toContain("email");
  });
  it("returns all channels for full contact", () => {
    const ch = inferChannels("a@b.com", "+123", "+456");
    expect(ch).toContain("email");
    expect(ch).toContain("whatsapp");
    expect(ch).toContain("linkedin");
  });
  it("returns only linkedin for empty contact", () => {
    const ch = inferChannels(null, null, null);
    expect(ch).toEqual(["linkedin"]);
  });
  it("includes whatsapp for mobile-only contact", () => {
    const ch = inferChannels(null, null, "+39333");
    expect(ch).toContain("whatsapp");
  });
});

describe("computePriority", () => {
  it("returns 1 for no contact info", () => {
    expect(computePriority(null, null, null)).toBe(1);
  });
  it("returns 4 for email only", () => {
    expect(computePriority("a@b.com", null, null)).toBe(4);
  });
  it("returns 3 for phone only", () => {
    expect(computePriority(null, "+123", null)).toBe(3);
  });
  it("returns 6 for email + phone (capped at 10)", () => {
    expect(computePriority("a@b.com", "+123", null)).toBe(6);
  });
  it("caps at 10 even with all fields", () => {
    expect(computePriority("a@b.com", "+123", "+456")).toBeLessThanOrEqual(10);
  });
});
