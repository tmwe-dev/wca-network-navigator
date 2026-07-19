#!/usr/bin/env node
// Trova possibili duplicati tra src/v2 e src/ (v1) confrontando basename.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (e === "node_modules" || e.startsWith(".") || e === "__tests__" || e === "test") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e) && !/\.(test|spec|d)\.tsx?$/.test(e)) {
      out.push(p);
    }
  }
  return out;
}
const all = walk("src");
const v2 = all.filter((p) => p.includes("/v2/"));
const v1 = all.filter((p) => !p.includes("/v2/") && !p.includes("/standalone-globe/"));
const v2Names = new Map(v2.map((p) => [p.split("/").pop(), p]));
const dups = [];
for (const v of v1) {
  const base = v.split("/").pop();
  if (v2Names.has(base) && !/^(index|types|utils|constants)\.tsx?$/.test(base)) {
    dups.push({ base, v1: v, v2: v2Names.get(base) });
  }
}
dups.sort((a, b) => a.base.localeCompare(b.base));
const out = [
  "# V1/V2 Duplicati Candidati",
  "",
  `Generato ${new Date().toISOString().slice(0, 10)}. Basato su match esatto di basename.`,
  `**${dups.length} candidati** — verificare uno per uno prima di eliminare.`,
  "",
  "| File | V1 (legacy) | V2 (attuale) |",
  "|------|-------------|--------------|",
  ...dups.map((d) => `| \`${d.base}\` | \`${d.v1}\` | \`${d.v2}\` |`),
];
writeFileSync("docs/audit/v1-v2-duplicates.md", out.join("\n"));
console.log(`v1 files: ${v1.length}, v2 files: ${v2.length}, candidate duplicates: ${dups.length}`);
