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
const BUDGET = {
  "no-restricted-imports": 477,
  "unused-imports/no-unused-vars": 275,
  "@typescript-eslint/no-explicit-any": 242,
  "unused-imports/no-unused-imports": 0,
  "@typescript-eslint/no-unsafe-function-type": 49,
  "tmwe/no-direct-ai-invoke": 36,
  "no-empty": 27,
  "no-useless-escape": 18,
  "prefer-const": 12,
  "tmwe/no-direct-bulk-op": 9,
  "no-case-declarations": 5,
  "no-var": 4,
  "no-control-regex": 3,
  "no-regex-spaces": 1,
  "no-useless-catch": 1,
};

const raw = execFileSync(
  "npx",
  ["eslint", ".", "--max-warnings", "999999", "-f", "json"],
  { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
);

const results = JSON.parse(raw);
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
  const budget = BUDGET[rule];
  if (budget === undefined) {
    failures.push(`regola non prevista dal ratchet: ${rule} (${count}) — aggiungi un budget consapevole`);
  } else if (count > budget) {
    failures.push(`regressione ${rule}: ${count} > budget ${budget}`);
  }
}

const total = Object.values(warnings).reduce((a, b) => a + b, 0);
const budgetTotal = Object.values(BUDGET).reduce((a, b) => a + b, 0);

for (const [rule, budget] of Object.entries(BUDGET)) {
  const count = warnings[rule] ?? 0;
  if (count < budget) {
    process.stdout.write(`migliorata ${rule}: ${count} < budget ${budget} — abbassa il budget\n`);
  }
}

process.stdout.write(`\nESLint: 0 errori attesi, ${errors.length} trovati. Warning ${total} / budget ${budgetTotal}.\n`);

if (failures.length > 0) {
  process.stderr.write(`\nLINT RATCHET FALLITO:\n${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("LINT RATCHET OK\n");
