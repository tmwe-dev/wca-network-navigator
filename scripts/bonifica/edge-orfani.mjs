#!/usr/bin/env node
/**
 * Bonifica - Lente 1 (edge functions).
 * Determina quali edge functions sono raggiungibili da:
 *  - frontend (supabase.functions.invoke('name') o URL /functions/v1/name)
 *  - altre edge functions (fetch verso /functions/v1/name o invoke)
 *  - config/cron dichiarati nel repo (config.toml, sql di cron, docs esclusi)
 * Output: elenco funzioni senza alcun chiamante nel repo.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FN_DIR = "supabase/functions";

const functions = readdirSync(FN_DIR).filter(
  (d) => !d.startsWith("_") && !d.startsWith(".") && statSync(join(FN_DIR, d)).isDirectory(),
);

const SCAN_DIRS = ["src", "supabase/functions", "supabase/migrations", "scripts"];
const EXT = /\.(ts|tsx|js|jsx|mjs|sql|toml|json)$/;

/** @type {string[]} */
const files = [];
function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
      walk(p);
    } else if (EXT.test(e.name)) {
      files.push(p);
    }
  }
}
SCAN_DIRS.forEach(walk);
if (statSync("supabase/config.toml", { throwIfNoEntry: false })) files.push("supabase/config.toml");

const contents = files.map((f) => ({ f, txt: readFileSync(f, "utf8") }));

/** @type {Record<string, {file:string, kind:string}[]>} */
const callers = {};
for (const name of functions) {
  const patterns = [
    new RegExp(`invoke\\(\\s*["'\`]${name}["'\`]`),
    new RegExp(`/functions/v1/${name}(["'\`/?]|$)`, "m"),
    new RegExp(`["'\`]${name}["'\`]\\s*(,|\\))`),
  ];
  const hits = [];
  for (const { f, txt } of contents) {
    if (f.startsWith(join(FN_DIR, name) + "/")) continue; // self
    if (patterns[0].test(txt)) hits.push({ file: f, kind: "invoke" });
    else if (patterns[1].test(txt)) hits.push({ file: f, kind: "url" });
    else if (f.endsWith(".sql") && patterns[2].test(txt)) hits.push({ file: f, kind: "sql" });
  }
  callers[name] = hits;
}

/** Snapshot letti dal DB (rigenerabili), usati come prova positiva di vita. */
function loadSnapshot(file) {
  try {
    return JSON.parse(readFileSync(`.lovable/bonifica/${file}`, "utf8"));
  } catch {
    return [];
  }
}
const cronInvoked = loadSnapshot("edge-cron-invoked.json");
const trafficObserved = loadSnapshot("edge-traffic-observed.json");

const repoCalled = functions.filter((n) => callers[n].length > 0);
const cronOnly = functions.filter((n) => callers[n].length === 0 && cronInvoked.includes(n));
const trafficOnly = functions.filter(
  (n) => callers[n].length === 0 && !cronInvoked.includes(n) && trafficObserved.includes(n),
);
const orphans = functions.filter(
  (n) => callers[n].length === 0 && !cronInvoked.includes(n) && !trafficObserved.includes(n),
);

console.log(`Edge functions totali: ${functions.length}`);
console.log(`Chiamate dal repo: ${repoCalled.length}`);
console.log(`Solo da cron DB: ${cronOnly.length}`);
console.log(`Solo da traffico osservato: ${trafficOnly.length}`);
console.log(`Senza chiamanti noti (candidati orfani): ${orphans.length}\n`);
cronOnly.forEach((n) => console.log(`  [cron] ${n}`));
trafficOnly.forEach((n) => console.log(`  [traffico] ${n}`));
console.log("");
orphans.forEach((n) => console.log(`  [orfano?] ${n}`));


