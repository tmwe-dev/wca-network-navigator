#!/usr/bin/env node
// Genera docs/edge-functions-catalog.md dal contenuto reale di supabase/functions/.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "supabase/functions";
const OUT = "docs/edge-functions-catalog.md";

const cfgPath = "supabase/config.toml";
const cfg = readFileSync(cfgPath, "utf8");
const jwtOff = new Set(
  [...cfg.matchAll(/\[functions\.([^\]]+)\][^\[]*verify_jwt\s*=\s*false/g)].map((m) => m[1]),
);

const entries = [];
for (const name of readdirSync(ROOT)) {
  const dir = join(ROOT, name);
  if (!statSync(dir).isDirectory()) continue;
  if (name.startsWith("_")) continue;
  const idx = join(dir, "index.ts");
  let firstDoc = "";
  try {
    const src = readFileSync(idx, "utf8");
    const m = src.match(/\/\*\*([\s\S]*?)\*\//);
    if (m) firstDoc = m[1].replace(/^\s*\*\s?/gm, "").trim().split("\n").slice(0, 3).join(" ");
    if (!firstDoc) {
      const line = src.match(/\/\/\s*(.+)/);
      if (line) firstDoc = line[1];
    }
  } catch { firstDoc = "(no index.ts)"; }
  entries.push({ name, jwtOff: jwtOff.has(name), doc: firstDoc.slice(0, 140) });
}
entries.sort((a, b) => a.name.localeCompare(b.name));

const lines = [
  "# Edge Functions Catalog",
  "",
  `Generato automaticamente — ${new Date().toISOString().slice(0, 10)} — do NOT edit a mano.`,
  `Esegui \`node scripts/gen-edge-catalog.mjs\` per rigenerare.`,
  "",
  `**Totale: ${entries.length} funzioni** — ${entries.filter(e => e.jwtOff).length} con \`verify_jwt=false\`.`,
  "",
  "| # | Funzione | JWT | Descrizione |",
  "|---|----------|-----|-------------|",
  ...entries.map((e, i) => `| ${i + 1} | \`${e.name}\` | ${e.jwtOff ? "❌ off" : "✅ on"} | ${e.doc || "—"} |`),
  "",
];
writeFileSync(OUT, lines.join("\n"));
console.log(`Wrote ${OUT} (${entries.length} functions)`);
