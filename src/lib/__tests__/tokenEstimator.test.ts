import { describe, it, expect } from "vitest";
import { estimateTokens } from "@/lib/tokenEstimator";

describe("estimateTokens", () => {
  it("estimates tokens for short text", () => {
    expect(estimateTokens("Hello world")).toBe(3); // 11 chars / 4 = 2.75 → ceil 3
  });

  it("estimates tokens for long text", () => {
    const longText = "a".repeat(400);
    expect(estimateTokens(longText)).toBe(100);
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("returns 0 for falsy input", () => {
    expect(estimateTokens(null as unknown as string)).toBe(0);
  });
});
