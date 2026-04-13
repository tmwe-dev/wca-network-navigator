import { describe, it, expect } from "vitest";
import { capitalizeFirst } from "@/lib/capitalize";

describe("capitalizeFirst", () => {
  it("capitalizes first letter of lowercase string", () => {
    expect(capitalizeFirst("hello")).toBe("Hello");
  });

  it("leaves already capitalized string unchanged", () => {
    expect(capitalizeFirst("Hello")).toBe("Hello");
  });

  it("returns empty string for empty input", () => {
    expect(capitalizeFirst("")).toBe("");
  });

  it("handles single character", () => {
    expect(capitalizeFirst("a")).toBe("A");
  });
});
