#!/usr/bin/env node
/**
 * Lint ratchet — gate CI deterministico.
 *
 * `eslint . --max-warnings 0` era già rosso (385 warning) e veniva ignorato:
 * un gate sempre rosso non è un gate. Qui il budget è esplicito per regola:
 * la CI fallisce se una regola supera il budget o se compare un errore.
 * I budget scendono a ogni batch di bonifica, mai salgono senza decisione.
 *
 * Uso: node scripts/lint-ratchet.mjs
 */
import { execFileSync } from "node:child_process";

// Budget misurati al 2026-08-01 (segmento C: import inutilizzati azzerati).
// Vedi docs/audit/lint-gates-2026-08-02.md
export const BUDGET = {
  "no-restricted-imports": 470,
  "unused-imports/no-unused-vars": 0,
  "@typescript-eslint/no-explicit-any": 240,
  "unused-imports/no-unused-imports": 0,
  "@typescript-eslint/no-unsafe-function-type": 0,
  "tmwe/no-direct-ai-invoke": 0,
  "no-empty": 0,
  "no-useless-escape": 0,
  "prefer-const": 0,
  "tmwe/no-direct-bulk-op": 0,
  "no-case-declarations": 0,
  "no-var": 0,
  "no-control-regex": 0,
  "no-regex-spaces": 0,
  "no-useless-catch": 0,
};

/**
 * Valuta i risultati ESLint contro un budget.
 * Pura e testabile: non esegue processi, non stampa, non esce.
 *
 * @param {Array} results output `eslint -f json`
 * @param {Record<string, number>} budget
 * @returns {{ errors: string[], warnings: Record<string, number>, failures: string[], improvements: string[], total: number, budgetTotal: number, ok: boolean }}
 */
export function evaluateRatchet(results, budget = BUDGET) {
  const warnings = {};
  const errors = [];

  for (const file of results) {
    for (const message of file.messages) {
      const rule = message.ruleId ?? "PARSE_ERROR";
      if (message.severity === 2) {
        errors.push(`${file.filePath}:${message.line} ${rule} — ${message.message}`);
      } else {
        warnings[rule] = (warnings[rule] ?? 0) + 1;
      }
    }
  }

  const failures = [];

  if (errors.length > 0) {
    failures.push(`${errors.length} errori ESLint (budget: 0)`);
    for (const line of errors.slice(0, 25)) failures.push(`  ${line}`);
  }

  for (const [rule, count] of Object.entries(warnings).sort((a, b) => b[1] - a[1])) {
    const allowed = budget[rule];
    if (allowed === undefined) {
      failures.push(`regola non prevista dal ratchet: ${rule} (${count}) — aggiungi un budget consapevole`);
    } else if (count > allowed) {
      failures.push(`regressione ${rule}: ${count} > budget ${allowed}`);
    }
  }

  const improvements = [];
  for (const [rule, allowed] of Object.entries(budget)) {
    const count = warnings[rule] ?? 0;
    if (count < allowed) {
      improvements.push(`migliorata ${rule}: ${count} < budget ${allowed} — abbassa il budget`);
    }
  }

  const total = Object.values(warnings).reduce((a, b) => a + b, 0);
  const budgetTotal = Object.values(budget).reduce((a, b) => a + b, 0);

  return { errors, warnings, failures, improvements, total, budgetTotal, ok: failures.length === 0 };
}

function main() {
  const raw = execFileSync(
    "npx",
    ["eslint", ".", "--max-warnings", "999999", "-f", "json"],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );

  const results = JSON.parse(raw);
  const { errors, failures, improvements, total, budgetTotal } = evaluateRatchet(results, BUDGET);

  for (const line of improvements) process.stdout.write(`${line}\n`);

  process.stdout.write(`\nESLint: 0 errori attesi, ${errors.length} trovati. Warning ${total} / budget ${budgetTotal}.\n`);

  if (failures.length > 0) {
    process.stderr.write(`\nLINT RATCHET FALLITO:\n${failures.join("\n")}\n`);
    process.exit(1);
  }

  process.stdout.write("LINT RATCHET OK\n");
}

// Eseguito come CLI (non quando importato dai test).
if (process.argv[1] && process.argv[1].endsWith("lint-ratchet.mjs")) {
  main();
}
