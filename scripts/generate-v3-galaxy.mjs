/**
 * Genera `src/v3/galaxy/graph.generated.ts` scansionando la sola V3.
 *
 * Nodi: pagine, hook, componenti UI, moduli dati (DAL), RPC e tabelle toccate.
 * Sinapsi: import reali tra file + chiamate rpc/from() nei moduli dati.
 *
 * Uso: node scripts/generate-v3-galaxy.mjs
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

const ROOT = process.cwd();
const ROOTS = ["src/v3", "src/data/v3"];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p) && !p.endsWith(".generated.ts")) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => {
  try {
    return walk(join(ROOT, r));
  } catch {
    return [];
  }
}).map((p) => relative(ROOT, p).replace(/\\/g, "/"));

/** Classificazione di un file V3. */
function classify(path) {
  if (path.startsWith("src/data/v3/")) return { kind: "dal", module: "dati" };
  if (path.startsWith("src/v3/app/")) return { kind: "app", module: "trasversale" };
  if (path.startsWith("src/v3/ui/")) return { kind: "ui", module: "design" };
  const m = /^src\/v3\/modules\/([^/]+)\/(.*)$/.exec(path);
  if (!m) return { kind: "ui", module: "trasversale" };
  const module = m[1] === "command" || m[1] === "impostazioni" ? "trasversale" : m[1];
  const rest = m[2];
  if (rest.startsWith("pages/")) return { kind: "pagina", module };
  if (/^use[A-Z]/.test(rest)) return { kind: "hook", module };
  return { kind: "logica", module };
}

function labelOf(path) {
  return path.split("/").pop().replace(/\.(tsx|ts)$/, "");
}

/** Risolve un import relativo o con alias @/ verso un file esistente della V3. */
const fileSet = new Set(files);
function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) base = relative(ROOT, resolve(dirname(join(ROOT, fromFile)), spec)).replace(/\\/g, "/");
  else return null;
  for (const cand of [base, base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"]) {
    if (fileSet.has(cand)) return cand;
  }
  return null;
}

const nodes = new Map();
const links = [];

function addNode(node) {
  const prev = nodes.get(node.id);
  if (prev) {
    nodes.set(node.id, { ...prev, weight: Math.max(prev.weight, node.weight) });
    return;
  }
  nodes.set(node.id, node);
}

const PATHS_BY_FILE = new Map();
for (const f of files) {
  const src = readFileSync(join(ROOT, f), "utf8");
  const { kind, module } = classify(f);
  const routeMatch = /path:\s*"(\/v3\/[^"]*)"/.exec(src);
  addNode({
    id: f,
    label: labelOf(f),
    kind,
    module,
    detail: `${f} · ${src.split("\n").length} righe`,
    weight: kind === "pagina" ? 1.6 : kind === "dal" ? 1.3 : 1,
    path: kind === "pagina" && routeMatch ? routeMatch[1] : undefined,
  });
  PATHS_BY_FILE.set(f, src);
}

for (const [f, src] of PATHS_BY_FILE) {
  const { module } = classify(f);
  for (const m of src.matchAll(/from\s+"([^"]+)"/g)) {
    const target = resolveImport(f, m[1]);
    if (target && target !== f) links.push({ from: f, to: target, relation: "usa" });
  }
  // RPC e tabelle toccate (solo nel livello dati)
  for (const m of src.matchAll(/\.rpc\(\s*"([a-zA-Z0-9_]+)"/g)) {
    const id = `rpc:${m[1]}`;
    addNode({ id, label: m[1], kind: "rpc", module: "backend", detail: `Funzione backend ${m[1]}()`, weight: 1.2 });
    links.push({ from: f, to: id, relation: "invoca" });
  }
  for (const m of src.matchAll(/\.from\(\s*"([a-zA-Z0-9_]+)"/g)) {
    const id = `tab:${m[1]}`;
    addNode({ id, label: m[1], kind: "tabella", module: "backend", detail: `Tabella ${m[1]}`, weight: 1.1 });
    links.push({ from: f, to: id, relation: "legge/scrive" });
  }
  for (const m of src.matchAll(/functions\.invoke\(\s*"([a-zA-Z0-9-_]+)"/g)) {
    const id = `fn:${m[1]}`;
    addNode({ id, label: m[1], kind: "rpc", module: "backend", detail: `Edge function ${m[1]}`, weight: 1.2 });
    links.push({ from: f, to: id, relation: "invoca" });
  }
  void module;
}

// deduplica link
const seen = new Set();
const uniqueLinks = links.filter((l) => {
  const k = `${l.from}|${l.to}|${l.relation}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

const nodeList = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));

const out = `/* eslint-disable */
/**
 * GENERATO AUTOMATICAMENTE — non modificare a mano.
 * Rigenera con: node scripts/generate-v3-galaxy.mjs
 */
import type { V3GalaxyNode, V3GalaxyLink } from "./types";

export const V3_GRAPH_NODES: readonly V3GalaxyNode[] = ${JSON.stringify(nodeList, null, 2)} as const;

export const V3_GRAPH_LINKS: readonly V3GalaxyLink[] = ${JSON.stringify(uniqueLinks, null, 2)} as const;

export const V3_GRAPH_GENERATED_AT = ${JSON.stringify(new Date().toISOString())};
`;

mkdirSync(join(ROOT, "src/v3/galaxy"), { recursive: true });
writeFileSync(join(ROOT, "src/v3/galaxy/graph.generated.ts"), out);
console.log(`V3 galaxy: ${nodeList.length} nodi, ${uniqueLinks.length} sinapsi`);
