import { describe, it, expect } from "vitest";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";

describe("sanitizeSearchTerm", () => {
  it("removes parentheses", () => {
    expect(sanitizeSearchTerm("test(1)")).toBe("test1");
  });
  it("removes commas and dots", () => {
    expect(sanitizeSearchTerm("a,b.c")).toBe("abc");
  });
  it("removes wildcards and underscores", () => {
    expect(sanitizeSearchTerm("test%_*")).toBe("test");
  });
  it("preserves normal text", () => {
    expect(sanitizeSearchTerm("hello world")).toBe("hello world");
  });
  it("removes backslashes", () => {
    expect(sanitizeSearchTerm("a\\b")).toBe("ab");
  });
  it("handles empty string", () => {
    expect(sanitizeSearchTerm("")).toBe("");
  });
});
