#!/usr/bin/env node
/**
 * i18n coverage guard.
 * Garantisce parità di chiavi fra src/i18n/locales/*.json.
 * Esce con codice ≠0 se trova drift, così CI blocca regressioni.
 */
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("src/i18n/locales");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
if (files.length < 2) {
  console.log(`i18n-coverage: solo ${files.length} locale, skip.`);
  process.exit(0);
}

const flatten = (obj, prefix = "") => {
  const out = new Set();
  for (const [k, v] of Object.entries(obj ?? {})) {
    const nk = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const x of flatten(v, nk)) out.add(x);
    } else {
      out.add(nk);
    }
  }
  return out;
};

const locales = Object.fromEntries(
  files.map((f) => [
    path.basename(f, ".json"),
    flatten(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))),
  ]),
);

const all = new Set();
for (const keys of Object.values(locales)) for (const k of keys) all.add(k);

let drift = 0;
const report = [];
for (const [name, keys] of Object.entries(locales)) {
  const missing = [...all].filter((k) => !keys.has(k));
  const coverage = ((keys.size / all.size) * 100).toFixed(1);
  report.push(`  ${name}: ${keys.size}/${all.size} (${coverage}%)`);
  if (missing.length > 0) {
    drift += missing.length;
    report.push(`    missing: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? ` (+${missing.length - 10})` : ""}`);
  }
}

console.log(`i18n coverage report (${all.size} chiavi totali):`);
console.log(report.join("\n"));

if (drift > 0) {
  console.error(`\n❌ i18n drift: ${drift} chiavi mancanti totali.`);
  process.exit(1);
}
console.log("\n✅ i18n: parità completa fra locali.");