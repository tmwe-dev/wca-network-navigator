/**
 * Genera src/v2/galaxy/synapses.generated.ts leggendo il codice reale:
 *  - tabelle toccate da ogni edge function (.from("tabella"))
 *  - invocazioni funzione → funzione (functions.invoke / /functions/v1/<nome>)
 *  - funzioni invocate da ogni pagina (rotta → componente → import diretti)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FN_DIR = path.join(ROOT, "supabase/functions");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const fnNames = fs
  .readdirSync(FN_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "_shared")
  .map((e) => e.name);

const fnTables = {};
const fnCalls = {};

const SHARED = path.join(FN_DIR, "_shared");

/** File di _shared importati (transitivamente) da un file di edge function. */
function sharedDeps(file, seen = new Set()) {
  if (!fs.existsSync(file) || seen.has(file)) return seen;
  seen.add(file);
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const target = path.resolve(path.dirname(file), m[1]);
    const cand = [target, target + ".ts", path.join(target, "index.ts")].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    if (cand && cand.startsWith(SHARED)) sharedDeps(cand, seen);
  }
  return seen;
}

for (const fn of fnNames) {
  const own = walk(path.join(FN_DIR, fn));
  const shared = new Set();
  for (const f of own) for (const d of sharedDeps(f)) if (d.startsWith(SHARED)) shared.add(d);
  const files = [...own, ...shared];
  const tables = new Set();
  const calls = new Set();
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/\.from\(\s*["'`]([a-z0-9_]+)["'`]/g)) tables.add(m[1]);
    for (const m of src.matchAll(/functions\.invoke\(\s*["'`]([a-z0-9-]+)["'`]/g)) calls.add(m[1]);
    for (const m of src.matchAll(/\/functions\/v1\/([a-z0-9-]+)/g)) calls.add(m[1]);
  }
  calls.delete(fn);
  fnTables[fn] = [...tables].sort();
  fnCalls[fn] = [...calls].filter((c) => fnNames.includes(c)).sort();
}

// --- pagine → funzioni -------------------------------------------------
const routesSrc = fs.readFileSync(path.join(ROOT, "src/v2/routes.tsx"), "utf8");
const compFile = new Map();
for (const m of routesSrc.matchAll(/const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>[\s\S]{0,120}?import\(\s*["'](.+?)["']\s*\)/g)) {
  compFile.set(m[1], m[2]);
}
const routeComp = [];
for (const m of routesSrc.matchAll(/path=["']([^"']+)["'][\s\S]{0,200}?element=\{(?:<|guardedPage\()\s*(\w+)/g)) {
  const raw = m[1];
  routeComp.push([raw.startsWith("/") ? raw : `/v2/${raw}`, m[2]]);
}

function resolve(spec, fromFile) {
  const base = spec.startsWith("@/")
    ? path.join(ROOT, "src", spec.slice(2))
    : path.resolve(path.dirname(fromFile), spec);
  for (const c of [base + ".tsx", base + ".ts", path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function invokedBy(file, depth) {
  if (!file || depth < 0 || !fs.existsSync(file)) return new Set();
  const src = fs.readFileSync(file, "utf8");
  const found = new Set();
  for (const m of src.matchAll(/functions\.invoke\(\s*["'`]([a-z0-9-]+)["'`]/g)) found.add(m[1]);
  if (depth > 0) {
    for (const m of src.matchAll(/from\s+["'](@\/[^"']+|\.[^"']+)["']/g)) {
      const r = resolve(m[1], file);
      if (r && r.includes(`${path.sep}src${path.sep}`)) for (const f of invokedBy(r, depth - 1)) found.add(f);
    }
  }
  return found;
}

const pageCalls = {};
for (const [routePath, comp] of routeComp) {
  const spec = compFile.get(comp);
  if (!spec) continue;
  const file = resolve(spec, path.join(ROOT, "src/v2/routes.tsx"));
  const calls = [...invokedBy(file, 2)].filter((c) => fnNames.includes(c)).sort();
  if (calls.length) pageCalls[routePath] = calls;
}

const out = `/** GENERATO da scripts/gen-galaxy-synapses.mjs — non modificare a mano. */
export const FN_TABLES: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(fnTables, null, 2)} as const;

export const FN_CALLS: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(fnCalls, null, 2)} as const;

export const PAGE_CALLS: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(pageCalls, null, 2)} as const;
`;
fs.writeFileSync(path.join(ROOT, "src/v2/galaxy/synapses.generated.ts"), out);

const tableCount = new Set(Object.values(fnTables).flat()).size;
const callCount = Object.values(fnCalls).flat().length;
console.log(
  `funzioni=${fnNames.length} tabelle=${tableCount} chiamate fn→fn=${callCount} pagine con invoke=${Object.keys(pageCalls).length}`,
);
const orch = Object.entries(fnCalls)
  .filter(([, v]) => v.length >= 3)
  .sort((a, b) => b[1].length - a[1].length);
console.log("orchestratori:", orch.map(([k, v]) => `${k}(${v.length})`).join(", "));
