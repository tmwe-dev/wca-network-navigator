#!/usr/bin/env node
/**
 * Baseline scorecard generato a macchina (F0).
 *
 * Nessun punteggio scritto a mano: ogni numero qui deriva da un comando
 * eseguito in questo processo. Output: docs/audit/baseline-<sha>.json
 *
 * Uso:
 *   node scripts/baseline-scorecard.mjs            # metriche statiche veloci
 *   node scripts/baseline-scorecard.mjs --full     # include lint/test/build
 */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FULL = process.argv.includes("--full");
const sh = (cmd, opts = {}) => {
  try {
    return execSync(cmd, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
  } catch (error) {
    return { failed: true, code: error.status ?? null, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? "") };
  }
};

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (["node_modules", "dist", "coverage", ".git"].includes(entry)) continue;
      walk(p, test, out);
    } else if (test(p)) out.push(p);
  }
  return out;
}
const loc = (files) => files.reduce((n, f) => n + readFileSync(f, "utf8").split("\n").length, 0);

const isCode = (p) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(p);
const srcFiles = walk("src", isCode);
const edgeFiles = walk("supabase/functions", isCode);
const sqlFiles = walk("supabase/migrations", (p) => p.endsWith(".sql"));
const testFiles = srcFiles.filter((f) => /\.(test|spec)\.tsx?$/.test(f));

const report = {
  generatedAt: new Date().toISOString(),
  commit: sh("git rev-parse HEAD"),
  toolchain: {
    node: process.version,
    npm: sh("npm -v"),
    enginesDeclared: JSON.parse(readFileSync("package.json", "utf8")).engines ?? null,
  },
  repo: {
    trackedFiles: Number(sh("git ls-files | wc -l")),
    srcFiles: srcFiles.length,
    srcLoc: loc(srcFiles),
    testFiles: testFiles.length,
    edgeFunctions: existsSync("supabase/functions")
      ? readdirSync("supabase/functions").filter((d) => existsSync(join("supabase/functions", d, "index.ts"))).length
      : 0,
    edgeLoc: loc(edgeFiles),
    migrations: sqlFiles.length,
    sqlLoc: loc(sqlFiles),
  },
  dependencies: (() => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const root = lock.packages[""] ?? {};
    const problems = [];
    for (const kind of ["dependencies", "devDependencies"]) {
      for (const [name, range] of Object.entries(pkg[kind] ?? {})) {
        if (!(name in (root[kind] ?? {}))) problems.push({ kind, name, range, issue: "missing-in-lock-root" });
        else if (root[kind][name] !== range) problems.push({ kind, name, range, lock: root[kind][name], issue: "version-mismatch" });
        if (!lock.packages[`node_modules/${name}`]) problems.push({ kind, name, range, issue: "missing-installed-entry" });
      }
    }
    return {
      lockfileVersion: lock.lockfileVersion,
      direct: Object.keys(pkg.dependencies ?? {}).length,
      dev: Object.keys(pkg.devDependencies ?? {}).length,
      problems,
    };
  })(),
  types: (() => {
    const out = sh("node scripts/ts-safety-metrics.mjs");
    return typeof out === "string" ? out.split("\n").slice(0, 40) : out;
  })(),
};

if (FULL) {
  const lintRaw = sh("npx eslint . --max-warnings 999999 -f json");
  if (typeof lintRaw === "string") {
    const results = JSON.parse(lintRaw);
    const byRule = {};
    let errors = 0;
    for (const file of results) {
      for (const m of file.messages) {
        const rule = m.ruleId ?? "PARSE_ERROR";
        if (m.severity === 2) errors++;
        byRule[rule] = (byRule[rule] ?? 0) + 1;
      }
    }
    report.lint = {
      errors,
      warnings: Object.values(byRule).reduce((a, b) => a + b, 0) - errors,
      byRule: Object.fromEntries(Object.entries(byRule).sort((a, b) => b[1] - a[1])),
    };
  } else report.lint = { failed: true, code: lintRaw.code };

  const typecheck = sh("npm run typecheck");
  report.typecheck = typecheck.failed ? { ok: false, code: typecheck.code } : { ok: true };

  const test = sh("npx vitest run --reporter=basic 2>&1");
  const testOut = typeof test === "string" ? test : test.stdout + test.stderr;
  report.tests = {
    ok: typeof test === "string",
    summary: (testOut.match(/Test Files.*|Tests\s+\d.*/g) ?? []).slice(-2),
  };

  const build = sh("npm run build 2>&1");
  const buildOut = typeof build === "string" ? build : build.stdout + build.stderr;
  report.build = {
    ok: typeof build === "string",
    warnings: (buildOut.match(/^.*(warning|WARN).*$/gim) ?? []).length,
    largestChunks: (buildOut.match(/dist\/assets\/[^\s]+\s+[\d.]+ kB/g) ?? [])
      .map((l) => {
        const [, file, size] = l.match(/(dist\/assets\/[^\s]+)\s+([\d.]+) kB/) ?? [];
        return { file, kb: Number(size) };
      })
      .sort((a, b) => b.kb - a.kb)
      .slice(0, 10),
  };
}

const out = `docs/audit/baseline-${String(report.commit).slice(0, 10)}.json`;
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
console.log(`\n→ scritto ${out}`);
