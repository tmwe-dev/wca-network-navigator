import { describe, it, expect } from "vitest";
import { estimateTokens } from "@/lib/tokenEstimator";

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates 'hello world' as ~3 tokens (11 chars / 4 = ceil 3)", () => {
    expect(estimateTokens("hello world")).toBe(3);
  });

  it("estimates 1000 words in a reasonable range", () => {
    const text = "word ".repeat(1000); // 5000 chars
    const tokens = estimateTokens(text);
    expect(tokens).toBe(1250); // 5000 / 4
    expect(tokens).toBeGreaterThan(500);
    expect(tokens).toBeLessThan(3000);
  });

  it("handles emoji and special characters without crashing", () => {
    const text = "Hello 🌍 world! Ça va? Über cool 日本語テスト";
    expect(() => estimateTokens(text)).not.toThrow();
    expect(estimateTokens(text)).toBeGreaterThan(0);
  });

  it("returns 1 for very short string", () => {
    expect(estimateTokens("ab")).toBe(1); // 2/4 = 0.5 → ceil = 1
  });

  it("rounds up correctly", () => {
    expect(estimateTokens("abcde")).toBe(2); // 5/4 = 1.25 → ceil = 2
  });
});
