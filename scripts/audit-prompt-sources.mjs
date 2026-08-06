#!/usr/bin/env node
/**
 * audit-prompt-sources.mjs — Fase 2 del piano di refactoring.
 *
 * Governance dei prompt (docs/architecture/prompt-kb-single-source.md):
 * il database è la sorgente autorevole; una costante di prompt nel codice è
 * ammessa SOLO come copia di emergenza e deve dichiararlo esplicitamente con
 * il marcatore `@fallback-of <tabella/riga>` nei commenti del file.
 *
 * Questo script è un RATCHET: conta le costanti di prompt non dichiarate come
 * fallback e fallisce se il numero sale sopra il baseline.
 */
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "supabase/functions"];
const BASELINE_FILE = path.resolve("scripts/.prompt-sources-baseline.json");
const MARKER = /@fallback-of\s+\S+/;
// nome che indica un prompt/istruzione di sistema
const NAME = /(PROMPT|SYSTEM_MESSAGE|DOCTRINE|PERSONA|INSTRUCTIONS)/;
const MIN_LEN = 200; // solo blocchi realmente sostanziosi

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", "dist", ".git"].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const offenders = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, "utf8");
    const declared = MARKER.test(src);
    const re = /(?:const|let)\s+([A-Za-z0-9_]+)\s*(?::[^=]+)?=\s*`([\s\S]*?)`/g;
    let m;
    let count = 0;
    while ((m = re.exec(src))) {
      const [, name, body] = m;
      if (!NAME.test(name.toUpperCase())) continue;
      if (body.length < MIN_LEN) continue;
      count++;
    }
    if (count > 0 && !declared) offenders.push({ file, count });
  }
}

const total = offenders.reduce((a, o) => a + o.count, 0);
let baseline = Number.POSITIVE_INFINITY;
if (fs.existsSync(BASELINE_FILE)) {
  baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")).total;
}

console.log(`Prompt in codice senza marcatore @fallback-of: ${total} (baseline ${baseline})`);
for (const o of offenders.slice(0, 25)) console.log(`  ${o.file} (${o.count})`);
if (offenders.length > 25) console.log(`  ... e altri ${offenders.length - 25} file`);

if (!Number.isFinite(baseline)) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({ total, updatedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log("Baseline creato.");
  process.exit(0);
}
if (total > baseline) {
  console.error(`FAIL: nuovi prompt nel codice non dichiarati (${total} > ${baseline}).`);
  console.error("Crea il prompt nel database, oppure marca il fallback con `@fallback-of <tabella/riga>`.");
  process.exit(1);
}
if (total < baseline) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({ total, updatedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log(`Baseline abbassato a ${total}.`);
}
process.exit(0);
