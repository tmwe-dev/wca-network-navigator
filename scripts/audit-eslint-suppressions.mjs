#!/usr/bin/env node
// Conta e categorizza le soppressioni ESLint nel codice prod.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (["node_modules","__tests__","test","dist","coverage",".git",".lovable"].includes(e) || e.startsWith(".")) continue;
      walk(p, out);
    } else if (/\.(ts|tsx|js|mjs)$/.test(e) && !/\.(test|spec)\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}
const files = [...walk("src"), ...walk("supabase/functions")];
const byRule = new Map();
const byFile = new Map();
let total = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const re = /eslint-disable(?:-next-line|-line)?\s+([^\n*/]+)/g;
  let m; let count = 0;
  while ((m = re.exec(src))) {
    total++; count++;
    for (const rule of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
      byRule.set(rule, (byRule.get(rule) || 0) + 1);
    }
  }
  if (count) byFile.set(f, count);
}
const ruleRows = [...byRule.entries()].sort((a, b) => b[1] - a[1]);
const fileRows = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
const out = [
  "# ESLint Suppressions Audit",
  "",
  `Generato ${new Date().toISOString().slice(0, 10)}.`,
  `**Totale: ${total} soppressioni** in ${byFile.size} file (esclusi test).`,
  "",
  "## Per regola",
  "| Regola | Count |",
  "|--------|-------|",
  ...ruleRows.map(([r, n]) => `| \`${r}\` | ${n} |`),
  "",
  "## Top 30 file",
  "| File | Count |",
  "|------|-------|",
  ...fileRows.map(([f, n]) => `| \`${f}\` | ${n} |`),
];
writeFileSync("docs/audit/eslint-suppressions.md", out.join("\n"));
console.log(`Total: ${total} in ${byFile.size} files`);
