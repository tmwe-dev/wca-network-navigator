#!/usr/bin/env node
/**
 * gen-readme-stats.mjs — rigenera il blocco STATS del README con numeri reali.
 *
 * Fonti:
 *  - Edge functions: sottocartelle di supabase/functions (escluso _shared)
 *  - Migrazioni: file .sql in supabase/migrations
 *  - Vitest coverage: parsing di vitest.config.ts
 *  - Test files: file .test.ts/.test.tsx in src
 *
 * Uso:
 *   node scripts/gen-readme-stats.mjs         # aggiorna README.md
 *   node scripts/gen-readme-stats.mjs --check # exit 1 se README stale (per CI)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const README = "README.md";
const START = "<!-- STATS:START -->";
const END = "<!-- STATS:END -->";

function countMatchingFiles(dir, predicate) {
  let count = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(cur, e);
      let s;
      try {
        s = statSync(p);
      } catch {
        continue;
      }
      if (s.isDirectory()) stack.push(p);
      else if (predicate(p)) count++;
    }
  }
  return count;
}

function countDirectChildren(dir, predicate) {
  try {
    return readdirSync(dir).filter(predicate).length;
  } catch {
    return 0;
  }
}

function parseVitestThresholds() {
  const src = readFileSync("vitest.config.ts", "utf8");
  const m = src.match(/thresholds:\s*\{([\s\S]*?)\}/);
  if (!m) return { statements: "n/a", branches: "n/a", functions: "n/a", lines: "n/a" };
  const block = m[1];
  const pick = (name) => {
    const re = new RegExp(`${name}\\s*:\\s*(\\d+)`);
    const found = block.match(re);
    return found ? `${found[1]}%` : "n/a";
  };
  return {
    statements: pick("statements"),
    branches: pick("branches"),
    functions: pick("functions"),
    lines: pick("lines"),
  };
}

const edgeFunctions = countDirectChildren("supabase/functions", (e) => {
  try {
    return statSync(join("supabase/functions", e)).isDirectory() && e !== "_shared";
  } catch {
    return false;
  }
});
const migrations = countDirectChildren("supabase/migrations", (e) => e.endsWith(".sql"));
const testFiles = countMatchingFiles("src", (p) => /\.(test|spec)\.tsx?$/.test(p));
const cov = parseVitestThresholds();

const block = [
  START,
  `<!-- Generato automaticamente da scripts/gen-readme-stats.mjs — non editare a mano -->`,
  ``,
  `| Metrica | Valore reale |`,
  `|---------|--------------|`,
  `| Edge Functions | **${edgeFunctions}** |`,
  `| Migrazioni SQL | **${migrations}** |`,
  `| File test (\`*.test.{ts,tsx}\`) | **${testFiles}** |`,
  `| Coverage threshold — statements | **${cov.statements}** |`,
  `| Coverage threshold — branches | **${cov.branches}** |`,
  `| Coverage threshold — functions | **${cov.functions}** |`,
  `| Coverage threshold — lines | **${cov.lines}** |`,
  ``,
  `_Ultimo aggiornamento: ${new Date().toISOString().slice(0, 10)}_`,
  END,
].join("\n");

const current = readFileSync(README, "utf8");
const startIdx = current.indexOf(START);
const endIdx = current.indexOf(END);

let next;
if (startIdx === -1 || endIdx === -1) {
  // Inserisce il blocco subito dopo il titolo
  next = current.replace(/^(# .+\n)/, `$1\n${block}\n\n`);
} else {
  next = current.slice(0, startIdx) + block + current.slice(endIdx + END.length);
}

if (process.argv.includes("--check")) {
  if (next.trim() !== current.trim()) {
    console.error("[gen-readme-stats] README stale — rilancia `node scripts/gen-readme-stats.mjs`");
    process.exit(1);
  }
  console.log("[gen-readme-stats] README aggiornato ✓");
  process.exit(0);
}

writeFileSync(README, next);
console.log(
  `[gen-readme-stats] edge=${edgeFunctions} migrations=${migrations} tests=${testFiles} cov.stmt=${cov.statements}`,
);
