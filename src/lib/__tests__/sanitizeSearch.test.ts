import { describe, it, expect } from "vitest";
import { sanitizeSearch } from "@/lib/sanitizeSearch";
describe("sanitizeSearch", () => {
  it("trims whitespace", () => {
    expect(sanitizeSearch("  hello  ")).toBe("hello");
  });
  it("handles empty string", () => {
    expect(sanitizeSearch("")).toBe("");
  });
  it("handles null/undefined gracefully", () => {
    expect(sanitizeSearch(null as never)).toBeFalsy();
  });
});
