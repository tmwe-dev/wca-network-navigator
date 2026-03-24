import { describe, it, expect } from "vitest";
import { resolveCountryCode, getCountryFlag } from "@/lib/countries";

describe("Country Resolution (ISO 3166)", () => {
  it("resolves standard country codes", () => {
    expect(resolveCountryCode("Italy")).toBe("IT");
    expect(resolveCountryCode("United States of America")).toBe("US");
    expect(resolveCountryCode("Germany")).toBe("DE");
  });

  it("resolves country codes case-insensitively", () => {
    expect(resolveCountryCode("italy")).toBe("IT");
    expect(resolveCountryCode("GERMANY")).toBe("DE");
  });

  it("passes through valid 2-letter codes", () => {
    expect(resolveCountryCode("IT")).toBe("IT");
    expect(resolveCountryCode("US")).toBe("US");
  });

  it("returns null for unknown countries", () => {
    expect(resolveCountryCode("Narnia")).toBeNull();
    expect(resolveCountryCode("")).toBeNull();
  });

  it("generates correct flag emoji", () => {
    const flag = getCountryFlag("IT");
    expect(flag).toBe("🇮🇹");
  });

  it("handles edge cases", () => {
    expect(getCountryFlag("US")).toBe("🇺🇸");
    expect(getCountryFlag("GB")).toBe("🇬🇧");
  });
});
