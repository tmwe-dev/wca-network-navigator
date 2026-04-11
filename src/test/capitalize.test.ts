import { describe, it, expect } from "vitest";
import { capitalizeFirst } from "@/lib/capitalize";

describe("capitalizeFirst", () => {
  it("capitalizes first letter", () => {
    expect(capitalizeFirst("hello")).toBe("Hello");
  });
  it("returns empty string as-is", () => {
    expect(capitalizeFirst("")).toBe("");
  });
  it("handles single char", () => {
    expect(capitalizeFirst("a")).toBe("A");
  });
  it("keeps rest of string", () => {
    expect(capitalizeFirst("hELLO")).toBe("HELLO");
  });
});
