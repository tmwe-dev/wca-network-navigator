#!/usr/bin/env node
/**
 * audit-edge-contract.mjs — Fase 3 §10 del piano di refactoring.
 *
 * Misura quante edge functions rispettano il contratto condiviso:
 *   - CORS      → import da `_shared/cors.ts` (o riesporto locale) e gestione OPTIONS
 *   - AUTH      → authGuard / internalAuth / cronGuard / extensionAuth condivisi
 *   - ERRORI    → handleEdgeError (contratto errore unico)
 *   - LOGGING   → structuredLogger (niente console.* grezzo)
 *
 * Non riscrive nulla: è un RATCHET. Il numero di funzioni non conformi
 * non può salire; scende a ogni lotto di uniformazione.
 * Fallisce (exit 1) se una categoria peggiora rispetto al baseline.
 */
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve("supabase/functions");

// Baseline misurato il 2026-08-06. Abbassare SOLO dopo aver uniformato funzioni.
const BASELINE = {
  cors: 0,
  auth: 58,
  error: 132,
  logging: 139,
};

// Funzioni server-to-server / redirect OAuth: non servite al browser,
// quindi l'assenza di CORS è corretta e non conta come violazione.
const NO_CORS_NEEDED = new Set(["mcp", "replay-domain-events", "tmwe-oauth-callback", "record-e2e-run"]);

function readFn(name) {
  const entry = path.join(DIR, name, "index.ts");
  if (!fs.existsSync(entry)) return null;
  let src = fs.readFileSync(entry, "utf8");
  // include i moduli locali della funzione (es. ./shared.ts) nel controllo
  for (const f of fs.readdirSync(path.join(DIR, name))) {
    if (f !== "index.ts" && f.endsWith(".ts")) {
      src += "\n" + fs.readFileSync(path.join(DIR, name, f), "utf8");
    }
  }
  return src;
}

const names = fs
  .readdirSync(DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name)
  .sort();

const offenders = { cors: [], auth: [], error: [], logging: [] };

for (const name of names) {
  const src = readFn(name);
  if (!src) continue;

  const hasCors = /_shared\/cors|getCorsHeaders|corsPreflight/.test(src);
  if (!hasCors && !NO_CORS_NEEDED.has(name)) offenders.cors.push(name);

  const hasAuth =
    /_shared\/(authGuard|internalAuth|cronGuard|cronGate|extensionAuth|mailboxAccessGuard)|authenticateRequest|requireAuth/.test(
      src,
    );
  if (!hasAuth) offenders.auth.push(name);

  const hasError = /handleEdgeError/.test(src);
  if (!hasError) offenders.error.push(name);

  const hasLogger = /structuredLogger|createLogger|edgeLogger/.test(src);
  if (!hasLogger) offenders.logging.push(name);
}

const LABELS = {
  cors: "CORS condiviso",
  auth: "Auth guard condiviso",
  error: "Contratto errore (handleEdgeError)",
  logging: "Logger strutturato",
};

console.log(`\n📐 Edge Function Contract Audit — ${names.length} funzioni\n`);
console.log("  Requisito                            Non conformi  Baseline  Stato");
console.log("  ───────────────────────────────────  ────────────  ────────  ──────");

let failed = false;
for (const key of Object.keys(BASELINE)) {
  const current = offenders[key].length;
  const base = BASELINE[key];
  const delta = current - base;
  const status = delta > 0 ? `❌ +${delta}` : delta < 0 ? `✅ −${Math.abs(delta)}` : "✅ OK";
  if (delta > 0) failed = true;
  console.log(`  ${LABELS[key].padEnd(35)} ${String(current).padStart(12)}  ${String(base).padStart(8)}  ${status}`);
}

if (process.argv.includes("--list")) {
  for (const key of Object.keys(offenders)) {
    console.log(`\n— ${LABELS[key]} (${offenders[key].length}):`);
    console.log(offenders[key].join(", ") || "nessuna");
  }
}

if (failed) {
  console.error(
    "\n🚫 Regressione sul contratto edge: nuove funzioni fuori standard. Usa i moduli in supabase/functions/_shared/.\n",
  );
  process.exit(1);
}
console.log("\n✅ Nessuna regressione sul contratto edge.\n");
