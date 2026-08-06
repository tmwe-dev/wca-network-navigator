#!/usr/bin/env node
/**
 * audit-edge-usage — Fase 3 del piano di consolidamento.
 *
 * Per ogni Edge Function presente in supabase/functions/ cerca una prova di
 * utilizzo reale:
 *   - functions.invoke("nome") o invokeAi/invokeEdge con quel nome nel frontend
 *   - riferimento testuale al nome dentro una migrazione (cron / pg_net)
 *   - riferimento dentro un'altra Edge Function (chiamata function-to-function)
 *
 * NON cancella nulla: produce solo l'inventario da cui decidere.
 * Output: docs/audit/edge-usage.md
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const FN_DIR = join(ROOT, "supabase", "functions");

function walk(dir, exts, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
      walk(p, exts, out);
    } else if (exts.includes(extname(e.name))) {
      out.push(p);
    }
  }
  return out;
}

const functions = readdirSync(FN_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
  .map((e) => e.name)
  .sort();

const srcFiles = walk(join(ROOT, "src"), [".ts", ".tsx"]);
const migFiles = walk(join(ROOT, "supabase", "migrations"), [".sql"]);
const fnFiles = walk(FN_DIR, [".ts"]);

function loadAll(files) {
  return files.map((f) => ({ f, text: readFileSync(f, "utf8") }));
}
const src = loadAll(srcFiles);
const migs = loadAll(migFiles);
const fns = loadAll(fnFiles);

function sizeOf(name) {
  let bytes = 0;
  for (const f of fnFiles) {
    if (f.includes(`/functions/${name}/`)) bytes += statSync(f).size;
  }
  return bytes;
}

const rows = [];
for (const name of functions) {
  const needle = `"${name}"`;
  const needle2 = `'${name}'`;
  const frontend = src.filter((s) => s.text.includes(needle) || s.text.includes(needle2)).length;
  const cron = migs.filter((m) => m.text.includes(name)).length;
  const peer = fns.filter(
    (s) => !s.f.includes(`/functions/${name}/`) && (s.text.includes(needle) || s.text.includes(needle2)),
  ).length;
  rows.push({ name, frontend, cron, peer, kb: Math.round(sizeOf(name) / 1024) });
}

const orphans = rows.filter((r) => r.frontend === 0 && r.cron === 0 && r.peer === 0);

const lines = [];
lines.push("# Inventario Edge Functions — prova di utilizzo");
lines.push("");
lines.push(`Generato da \`scripts/audit-edge-usage.mjs\`. Funzioni totali: **${functions.length}**.`);
lines.push("");
lines.push(
  "Colonne: chiamate dal frontend, riferimenti nelle migrazioni (cron/pg_net), riferimenti da altre funzioni, peso in KB.",
);
lines.push("");
lines.push(`## Senza alcun chiamante rilevato: ${orphans.length}`);
lines.push("");
lines.push("Candidate allo spegnimento controllato. Nessuna cancellazione senza periodo di osservazione dei log.");
lines.push("");
lines.push("| Funzione | KB |");
lines.push("| --- | ---: |");
for (const r of orphans) lines.push(`| ${r.name} | ${r.kb} |`);
lines.push("");
lines.push("## Inventario completo");
lines.push("");
lines.push("| Funzione | Frontend | Migrazioni | Altre funzioni | KB |");
lines.push("| --- | ---: | ---: | ---: | ---: |");
for (const r of rows.sort((a, b) => b.kb - a.kb)) {
  lines.push(`| ${r.name} | ${r.frontend} | ${r.cron} | ${r.peer} | ${r.kb} |`);
}

mkdirSync(join(ROOT, "docs", "audit"), { recursive: true });
writeFileSync(join(ROOT, "docs", "audit", "edge-usage.md"), lines.join("\n") + "\n");
console.log(`Edge functions: ${functions.length}; senza chiamanti: ${orphans.length}`);
console.log("Report: docs/audit/edge-usage.md");
