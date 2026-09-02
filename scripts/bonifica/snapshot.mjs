#!/usr/bin/env node
/**
 * Bonifica Fase 0 — fotografia dello stato.
 *
 * Registra in `.lovable/bonifica/snapshot-YYYYMMDD.json`:
 * - SHA git corrente (se disponibile)
 * - conteggi file/righe per area
 * - dipendenze con versioni esatte (package.json)
 * - elenco edge functions e migrations
 *
 * Uso: `node scripts/bonifica/snapshot.mjs`
 * Il file prodotto è il riferimento contro cui si misura ogni batch di pulizia.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".lovable", "bonifica");
mkdirSync(outDir, { recursive: true });

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function countLines(dir, exts) {
  const out = sh(`find ${dir} -type f \\( ${exts.map((e) => `-name "*.${e}"`).join(" -o ")} \\) -print0 | xargs -0 wc -l 2>/dev/null | tail -1`);
  return out ? parseInt(out.split(/\s+/)[0], 10) || 0 : 0;
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

const edgeFunctions = readdirSync(join(root, "supabase", "functions"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "_shared")
  .map((d) => d.name)
  .sort();

const migrations = readdirSync(join(root, "supabase", "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();

const snapshot = {
  protocollo: "bonifica-v1.0",
  fase: "0-congelamento",
  created_at: new Date().toISOString(),
  git_sha: sh("git rev-parse HEAD"),
  git_status_porcelain_lines: (sh("git status --porcelain") || "").split("\n").filter(Boolean).length,
  files: {
    tracked_total: parseInt(sh("git ls-files | wc -l") || "0", 10),
    src_ts_tsx: parseInt(sh("find src -name '*.ts' -o -name '*.tsx' | wc -l") || "0", 10),
    edge_functions: edgeFunctions.length,
    db_migrations: migrations.length,
    unit_test_files: parseInt(sh("find src -name '*.test.*' | wc -l") || "0", 10),
    e2e_spec_files: parseInt(sh("find e2e -name '*.spec.*' 2>/dev/null | wc -l") || "0", 10),
  },
  lines: {
    src: countLines("src", ["ts", "tsx"]),
    edge_functions: countLines("supabase/functions", ["ts"]),
    migrations: countLines("supabase/migrations", ["sql"]),
  },
  dependencies: { ...pkg.dependencies },
  devDependencies: { ...pkg.devDependencies },
  edge_function_names: edgeFunctions,
  migration_head: migrations[migrations.length - 1] ?? null,
};

const out = join(outDir, `snapshot-${today}.json`);
writeFileSync(out, JSON.stringify(snapshot, null, 2));
console.log(`[bonifica] snapshot scritto: ${out}`);
console.log(`[bonifica] sha=${snapshot.git_sha} files=${snapshot.files.tracked_total} edge=${edgeFunctions.length} migrations=${migrations.length}`);
