#!/usr/bin/env node
/**
 * Audit dei confini di modulo — REPORT NON BLOCCANTE.
 *
 * Misura tre contatori di accoppiamento:
 *  1. cycles     : file in src/components|hooks|data|lib che importano @/v2/**
 *  2. rawDbAccess: file fuori dal DAL (src/data, src/v2/io) che usano .from(
 *  3. crossModule: import da src/v2/** verso moduli verticali legacy (escluso il Core)
 *
 * Esce sempre con codice 0: serve a tracciare una baseline, non a bloccare la CI.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** Cartelle considerate Core Platform: import liberi. */
const CORE_LEGACY = ["components/ui", "lib/utils", "lib/log", "lib/queryKeys", "lib/records"];

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__" || entry === "tests") continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

const files = walk(SRC);
const cycles = [];
const rawDbAccess = [];
const crossModule = new Map();

for (const file of files) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  const code = readFileSync(file, "utf8");
  const isLegacy = /^src\/(components|hooks|data|lib)\//.test(rel);
  const isV2 = rel.startsWith("src/v2/");
  const isDal = rel.startsWith("src/data/") || rel.startsWith("src/v2/io/");

  if (isLegacy && /from\s+["']@\/v2\//.test(code)) cycles.push(rel);
  if (!isDal && /\.from\(/.test(code)) rawDbAccess.push(rel);

  if (isV2) {
    for (const m of code.matchAll(/from\s+["']@\/((?:components|hooks|data|lib)\/[\w./-]+)["']/g)) {
      const target = m[1];
      if (CORE_LEGACY.some((c) => target === c || target.startsWith(`${c}/`))) continue;
      const bucket = target.split("/").slice(0, 2).join("/");
      crossModule.set(bucket, (crossModule.get(bucket) ?? 0) + 1);
    }
  }
}

const crossTotal = [...crossModule.values()].reduce((a, b) => a + b, 0);

console.log("=== Module boundary audit (report only) ===");
console.log(`Cicli legacy -> @/v2        : ${cycles.length}`);
console.log(`Accessi DB fuori dal DAL    : ${rawDbAccess.length}`);
console.log(`Import v2 -> legacy verticale: ${crossTotal}`);
console.log("\nTop sorgenti cross-module:");
for (const [bucket, count] of [...crossModule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(count).padStart(4)}  ${bucket}`);
}

if (process.argv.includes("--list")) {
  console.log("\nCicli:");
  cycles.forEach((f) => console.log(`  ${f}`));
  console.log("\nAccessi DB fuori dal DAL:");
  rawDbAccess.forEach((f) => console.log(`  ${f}`));
}

process.exit(0);