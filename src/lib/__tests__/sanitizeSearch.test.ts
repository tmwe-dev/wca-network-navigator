import { describe, it, expect } from "vitest";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";

describe("sanitizeSearchTerm — extended", () => {
  it("removes SQL-like injection patterns", () => {
    expect(sanitizeSearchTerm("'; DROP TABLE partners; --")).toBe("' DROP TABLE partners --");
  });

  it("removes PostgREST wildcards", () => {
    expect(sanitizeSearchTerm("test%value_key*")).toBe("testvaluekey");
  });

  it("strips backslashes used for escaping", () => {
    expect(sanitizeSearchTerm('a\\b\\c')).toBe("abc");
  });

  it("removes parentheses from function calls", () => {
    expect(sanitizeSearchTerm("exec(cmd)")).toBe("execcmd");
  });

  it("preserves hyphens and spaces", () => {
    expect(sanitizeSearchTerm("hello-world test")).toBe("hello-world test");
  });

  it("handles unicode strings", () => {
    expect(sanitizeSearchTerm("café résumé")).toBe("café résumé");
  });

  it("handles CJK characters", () => {
    expect(sanitizeSearchTerm("日本語テスト")).toBe("日本語テスト");
  });

  it("handles very long input", () => {
    const long = "a".repeat(10000);
    expect(sanitizeSearchTerm(long)).toBe(long);
  });

  it("strips dots and commas", () => {
    expect(sanitizeSearchTerm("test.value,another")).toBe("testvalueanother");
  });

  it("handles mixed dangerous chars", () => {
    expect(sanitizeSearchTerm("a(b)c,d.e%f_g*h\\i")).toBe("abcdefghi");
  });
});
