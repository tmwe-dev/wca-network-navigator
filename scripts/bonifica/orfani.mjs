#!/usr/bin/env node
/**
 * orfani.mjs — Lente 1 (raggiungibilità statica) del Protocollo Bonifica.
 *
 * Costruisce il grafo degli import a partire dagli entry point reali
 * (index.html -> src/main.tsx) e segnala i file src/ mai raggiunti.
 *
 * NON cancella nulla: produce solo un elenco di *candidati* orfani,
 * che entrano in quarantena (Fase 4) e non in asportazione diretta.
 *
 * Uso:  node scripts/bonifica/orfani.mjs [--json]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const EXTS = [".ts", ".tsx", ".js", ".jsx"];
const ENTRIES = ["src/main.tsx", "src/App.tsx"];

/** Tutti i file sorgente sotto src/ (esclusi test e storie). */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}

function resolveSpecifier(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // pacchetto npm
  const candidates = [
    base,
    ...EXTS.map((e) => base + e),
    ...EXTS.map((e) => path.join(base, "index" + e)),
  ];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

const IMPORT_RE =
  /(?:import|export)\s[^'"`]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s*["']([^"']+)["']/g;

function importsOf(file) {
  const code = fs.readFileSync(file, "utf8");
  const out = [];
  for (const m of code.matchAll(IMPORT_RE)) {
    const spec = m[1] || m[2] || m[3];
    if (spec) out.push(spec);
  }
  return out;
}

const all = walk(SRC).filter((f) => !/\.(test|spec)\.[tj]sx?$/.test(f));
const reached = new Set();
const queue = ENTRIES.map((e) => path.join(ROOT, e)).filter((f) => fs.existsSync(f));
queue.forEach((f) => reached.add(f));

while (queue.length) {
  const file = queue.pop();
  for (const spec of importsOf(file)) {
    const target = resolveSpecifier(spec, file);
    if (target && !reached.has(target)) {
      reached.add(target);
      queue.push(target);
    }
  }
}

const orphans = all.filter((f) => !reached.has(f)).map((f) => path.relative(ROOT, f)).sort();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ total: all.length, reached: reached.size, orphans }, null, 2));
} else {
  console.log(`File sorgente: ${all.length}`);
  console.log(`Raggiunti dagli entry point: ${reached.size}`);
  console.log(`Candidati orfani (Lente 1): ${orphans.length}`);
  console.log("--- ATTENZIONE: candidati, NON verdetti. Servono anche Lente 2 e Lente 3. ---");
  for (const o of orphans) console.log(o);
}
