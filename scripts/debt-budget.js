#!/usr/bin/env node
/**
 * Debt Budget Enforcer
 *
 * Counts `any`, `eslint-disable`, and `console.*` occurrences in src/
 * and fails if any count exceeds the baseline defined below.
 *
 * Usage: node scripts/debt-budget.js
 * CI:    runs as a blocking step — new debt = blocked PR.
 */

import { execSync } from "node:child_process";

// ── Baseline: update ONLY when you intentionally reduce debt ──
// Snapshot 2026-04-28 (post Sprint 3 partial) — ratchet-down only.
// Never raise these numbers. To reduce: lower after a successful migration PR.
const BASELINE = {
  any: 440,
  eslintDisable: 73,
  console: 81,
};

function count(pattern) {
  try {
    const out = execSync(
      `grep -rE ${JSON.stringify(pattern)} src --include="*.ts" --include="*.tsx" | wc -l`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    return parseInt(out.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

const results = {
  any: count(":\\s*any\\b|<any>|as any\\b"),
  eslintDisable: count("eslint-disable"),
  console: count("\\bconsole\\.(log|warn|error|info|debug)"),
};

let failed = false;

console.log("\n📊 Debt Budget Check\n");
console.log("  Metric           Current  Baseline  Status");
console.log("  ────────────────  ───────  ────────  ──────");

for (const [key, baseline] of Object.entries(BASELINE)) {
  const current = results[key];
  const delta = current - baseline;
  const status = delta > 0 ? `❌ +${delta} NEW` : delta < 0 ? `✅ −${Math.abs(delta)} reduced` : "✅ OK";
  if (delta > 0) failed = true;
  console.log(`  ${key.padEnd(18)} ${String(current).padStart(7)}  ${String(baseline).padStart(8)}  ${status}`);
}

console.log("");

if (failed) {
  console.error("🚫 Debt budget exceeded! Reduce occurrences before merging.\n");
  process.exit(1);
} else {
  console.log("✅ All metrics within budget.\n");
}
