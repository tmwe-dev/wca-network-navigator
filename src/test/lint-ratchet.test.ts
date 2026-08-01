/**
 * Test del gate lint-ratchet.
 *
 * Prova che il ratchet:
 *  - FALLISCE quando una regola supera il budget;
 *  - ACCETTA conteggi uguali o inferiori al budget;
 *  - FALLISCE su qualunque errore ESLint (budget errori = 0);
 *  - FALLISCE su una regola non prevista dal budget;
 *  - segnala i miglioramenti da consolidare abbassando il budget.
 */
import { describe, it, expect } from "vitest";
import { evaluateRatchet, BUDGET } from "../../scripts/lint-ratchet.mjs";

type LintMessage = { ruleId: string | null; severity: 1 | 2; line: number; message: string };
type LintFile = { filePath: string; messages: LintMessage[] };

function warnings(rule: string, count: number): LintFile {
  return {
    filePath: `/repo/src/fake-${rule.replace(/[^a-z]/gi, "")}.ts`,
    messages: Array.from({ length: count }, (_, i) => ({
      ruleId: rule,
      severity: 1 as const,
      line: i + 1,
      message: "warning sintetico",
    })),
  };
}

describe("lint ratchet", () => {
  const budget = { "demo/rule-a": 3, "demo/rule-b": 0 };

  it("accetta un conteggio uguale al budget", () => {
    const res = evaluateRatchet([warnings("demo/rule-a", 3)], budget);
    expect(res.ok).toBe(true);
    expect(res.failures).toEqual([]);
    expect(res.total).toBe(3);
  });

  it("accetta un conteggio inferiore al budget e segnala il miglioramento", () => {
    const res = evaluateRatchet([warnings("demo/rule-a", 1)], budget);
    expect(res.ok).toBe(true);
    expect(res.improvements.join(" ")).toContain("demo/rule-a");
  });

  it("rifiuta un conteggio superiore al budget", () => {
    const res = evaluateRatchet([warnings("demo/rule-a", 4)], budget);
    expect(res.ok).toBe(false);
    expect(res.failures.join(" ")).toContain("regressione demo/rule-a: 4 > budget 3");
  });

  it("rifiuta una regola a budget zero appena compare", () => {
    const res = evaluateRatchet([warnings("demo/rule-b", 1)], budget);
    expect(res.ok).toBe(false);
    expect(res.failures.join(" ")).toContain("demo/rule-b");
  });

  it("rifiuta qualunque errore ESLint", () => {
    const res = evaluateRatchet(
      [{ filePath: "/repo/src/x.ts", messages: [{ ruleId: "demo/rule-a", severity: 2, line: 1, message: "boom" }] }],
      budget,
    );
    expect(res.ok).toBe(false);
    expect(res.errors).toHaveLength(1);
    expect(res.failures[0]).toContain("errori ESLint");
  });

  it("rifiuta una regola non prevista dal budget", () => {
    const res = evaluateRatchet([warnings("demo/rule-sconosciuta", 1)], budget);
    expect(res.ok).toBe(false);
    expect(res.failures.join(" ")).toContain("regola non prevista dal ratchet");
  });

  it("il BUDGET reale non contiene valori negativi", () => {
    for (const [rule, value] of Object.entries(BUDGET)) {
      expect(typeof value, rule).toBe("number");
      expect(value, rule).toBeGreaterThanOrEqual(0);
    }
  });
});
