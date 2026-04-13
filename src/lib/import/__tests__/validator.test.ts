import { describe, it, expect } from "vitest";
import { applyTransformation, normalizePhone } from "../validator";

describe("validator - applyTransformation", () => {
  it("trim removes whitespace", () => {
    expect(applyTransformation("  hello  ", "trim")).toBe("hello");
  });

  it("uppercase converts to upper case", () => {
    expect(applyTransformation("hello", "uppercase")).toBe("HELLO");
  });

  it("lowercase converts to lower case", () => {
    expect(applyTransformation("HELLO", "lowercase")).toBe("hello");
  });

  it("capitalize capitalizes first letter of each word", () => {
    expect(applyTransformation("hello world", "capitalize")).toBe("Hello World");
  });

  it("returns empty string for empty input", () => {
    expect(applyTransformation("", "trim")).toBe("");
    expect(applyTransformation("", "uppercase")).toBe("");
  });

  it("handles null-ish values gracefully", () => {
    expect(applyTransformation(undefined as any, "trim")).toBe("");
  });
});

describe("validator - normalizePhone", () => {
  it("normalizes Italian mobile starting with 3xx", () => {
    const result = normalizePhone("345 1234567");
    expect(result).toContain("+39");
    expect(result).toContain("345");
  });

  it("converts 00xx prefix to +xx", () => {
    const result = normalizePhone("0044 123456789");
    expect(result).toStartWith("+44");
  });

  it("handles already formatted phone", () => {
    const result = normalizePhone("+39 3451234567");
    expect(result).toBe("+393451234567");
  });

  it("strips parentheses and dashes", () => {
    const result = normalizePhone("(06) 123-4567");
    expect(result).toContain("061234567");
  });
});
