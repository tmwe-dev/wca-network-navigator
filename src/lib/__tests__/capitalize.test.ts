import { describe, it, expect } from "vitest";
import { capitalize } from "@/lib/capitalize";
describe("capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });
  it("handles empty string", () => {
    expect(capitalize("")).toBe("");
  });
  it("handles single char", () => {
    expect(capitalize("a")).toBe("A");
  });
  it("preserves rest of string", () => {
    expect(capitalize("hELLO")).toBe("HELLO");
  });
});
