import { describe, it, expect } from "vitest";
import { estimateTokens, getContextBudget, assembleContext, type ContextBlock } from "./tokenBudget.ts";

describe("estimateTokens", () => {
  it("stima ~1 token ogni 4 caratteri", () => {
    expect(estimateTokens("ciao")).toBe(1);
    expect(estimateTokens("a".repeat(100))).toBe(25);
  });

  it("ritorna 0 per stringa vuota", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("ritorna 0 per input falsy", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("arrotonda per eccesso", () => {
    expect(estimateTokens("ab")).toBe(1); // 2/4 = 0.5 → ceil = 1
    expect(estimateTokens("abcde")).toBe(2); // 5/4 = 1.25 → ceil = 2
  });
});

describe("getContextBudget", () => {
  it("cap a 32000 per modelli con finestra grande (Gemini)", () => {
    expect(getContextBudget("google/gemini-2.5-flash")).toBe(32_000);
    expect(getContextBudget("google/gemini-3-flash-preview")).toBe(32_000);
  });

  it("calcola 30% della finestra per modelli GPT", () => {
    // 128_000 * 0.30 = 38_400 → capped at 32_000
    expect(getContextBudget("openai/gpt-5-mini")).toBe(32_000);
  });

  it("usa fallback 128k per modelli sconosciuti", () => {
    const budget = getContextBudget("modello-inventato");
    expect(budget).toBe(32_000); // 128_000 * 0.30 = 38_400 → cap 32_000
  });
});

describe("assembleContext", () => {
  it("include blocchi per priorità fino al budget", () => {
    const blocks: ContextBlock[] = [
      { key: "a", content: "testo corto", priority: 100 },
      { key: "b", content: "testo medio con più parole", priority: 50 },
    ];
    const result = assembleContext(blocks, 1000);
    expect(result.text).toContain("testo corto");
    expect(result.text).toContain("testo medio");
    expect(result.stats.included).toContain("a");
    expect(result.stats.included).toContain("b");
  });

  it("ordina per priorità — blocchi ad alta priorità prima", () => {
    const blocks: ContextBlock[] = [
      { key: "low", content: "low priority", priority: 10 },
      { key: "high", content: "high priority", priority: 100 },
    ];
    const result = assembleContext(blocks, 10000);
    const highIdx = result.text.indexOf("high priority");
    const lowIdx = result.text.indexOf("low priority");
    expect(highIdx).toBeLessThan(lowIdx);
  });

  it("esclude blocchi a bassa priorità quando il budget è esaurito", () => {
    const blocks: ContextBlock[] = [
      { key: "high", content: "a".repeat(4000), priority: 100 },
      { key: "low", content: "b".repeat(4000), priority: 10, minTokens: 1500 },
    ];
    // Budget = 1100 tokens → high uses 1000, only 100 left → low needs minTokens 1500 → dropped
    const result = assembleContext(blocks, 1100);
    expect(result.stats.included).toContain("high");
    expect(result.stats.dropped).toContain("low");
  });

  it("tronca blocchi quando budget parzialmente disponibile", () => {
    const blocks: ContextBlock[] = [
      { key: "main", content: "a".repeat(2000), priority: 100 },
      { key: "extra", content: "b".repeat(2000), priority: 50, minTokens: 100 },
    ];
    // Budget = 700 → main uses 500, 200 left → extra truncated (minTokens 100 < 200)
    const result = assembleContext(blocks, 700);
    expect(result.stats.included).toContain("main");
    expect(result.stats.truncated).toContain("extra");
  });

  it("ignora blocchi con contenuto vuoto", () => {
    const blocks: ContextBlock[] = [
      { key: "empty", content: "", priority: 100 },
      { key: "whitespace", content: "   ", priority: 90 },
      { key: "valid", content: "contenuto reale", priority: 50 },
    ];
    const result = assembleContext(blocks, 10000);
    expect(result.stats.included).toContain("valid");
    expect(result.stats.included).not.toContain("empty");
  });
});
