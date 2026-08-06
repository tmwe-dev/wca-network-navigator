#!/usr/bin/env node
// Metriche type-safety su perimetro fisso: src/** (esclusi test)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (["node_modules", "dist", "coverage", ".git"].includes(e)) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e) && !/\.(test|spec)\.tsx?$/.test(e) && !/\.d\.ts$/.test(e)) out.push(p);
  }
  return out;
}
const files = walk("src").filter((f) => !f.includes("/__tests__/") && !f.startsWith("src/test/"));
const pats = {
  untypedFrom: /\buntypedFrom\s*\(/g,
  asNever: /\bas never\b/g,
  asUnknownAs: /\bas unknown as\b/g,
  // Copre anche `any` in posizione generica (`Record<string, any>`,
  // `Promise<any>`, `Array<Record<string, any>>`): il pattern precedente
  // (`:\s*any`) li mancava tutti e riportava 11 invece del valore reale.
  explicitAny: /(:\s*any\b|<\s*any\s*>|\bas any\b|any\[\]|<[^>\n]*\bany\b[^>\n]*>)/g,
  tsIgnore: /@ts-(ignore|expect-error|nocheck)/g,
  eslintDisable: /eslint-disable/g,
};
const totals = Object.fromEntries(Object.keys(pats).map((k) => [k, 0]));
const perFile = [];
for (const f of files) {
  const s = readFileSync(f, "utf8");
  const row = { file: f };
  let sum = 0;
  for (const [k, re] of Object.entries(pats)) {
    const n = (s.match(re) || []).length;
    totals[k] += n;
    row[k] = n;
    if (k !== "eslintDisable") sum += n;
  }
  if (sum) perFile.push({ ...row, sum });
}
perFile.sort((a, b) => b.sum - a.sum);
console.log(JSON.stringify({ files: files.length, totals }, null, 2));
if (process.argv.includes("--top")) {
  console.log("\nTOP 25:");
  for (const r of perFile.slice(0, 25))
    console.log(
      `${String(r.sum).padStart(4)}  uf=${r.untypedFrom} nev=${r.asNever} uk=${r.asUnknownAs} any=${r.explicitAny}  ${r.file}`,
    );
}
