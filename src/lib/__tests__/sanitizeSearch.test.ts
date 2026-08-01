import { describe, it, expect } from "vitest";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";

describe("sanitizeSearchTerm", () => {
  it("removes PostgREST special characters", () => {
    expect(sanitizeSearchTerm("hello(world)")).toBe("helloworld");
    expect(sanitizeSearchTerm("a,b.c\\d")).toBe("abcd");
    expect(sanitizeSearchTerm("test*%_")).toBe("test");
  });

  it("leaves normal text intact", () => {
    expect(sanitizeSearchTerm("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(sanitizeSearchTerm("")).toBe("");
  });
});
