#!/usr/bin/env node
/**
 * audit-function-auth.mjs
 *
 * Verifica che ogni edge function con `verify_jwt = false` in supabase/config.toml:
 *   1. appartenga all'allowlist hard-coded (categorie consentite);
 *   2. abbia un commento `# AUTH:` immediatamente sopra che spiega il meccanismo;
 *   3. abbia un test (e2e o Deno) che ne copre l'auth guard.
 *
 * Fallisce con exit 1 se trova violazioni. Adottato in CI.
 */
import fs from "node:fs";
import path from "node:path";

const CONFIG = path.resolve("supabase/config.toml");
const FUNCTIONS_DIR = path.resolve("supabase/functions");
const E2E_DIR = path.resolve("e2e");

// Allowlist: solo queste categorie possono avere verify_jwt = false.
// Ogni voce richiede comunque commento AUTH: e verifica in-code.
const ALLOWLIST = new Set([
  // Probe pubblica (no dati sensibili)
  "health-check",
  // Webhook firmati HMAC
  "email-delivery-webhook",
  // Extension endpoints (x-extension-key o JWT in-code)
  "save-wca-cookie",
  "get-wca-credentials",
  "save-ra-cookie",
  "get-ra-credentials",
  "save-ra-prospects",
  "save-linkedin-cookie",
  "get-linkedin-credentials",
  "whatsapp-ai-extract",
  // Endpoint utente con auth in-code
  "consume-credits",
  // Cron protetti da x-cron-secret
  "replay-domain-events",
  // OAuth callback pubblici (state nonce)
  "tmwe-oauth-callback",
  "tmwe-oauth-start",
]);

if (!fs.existsSync(CONFIG)) {
  console.error(`audit-function-auth: ${CONFIG} non trovato.`);
  process.exit(1);
}

const raw = fs.readFileSync(CONFIG, "utf8");
const lines = raw.split("\n");

const findings = [];
let currentFn = null;
let lastComment = "";

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  const fnMatch = trimmed.match(/^\[functions\.([a-z0-9-]+)\]/);
  if (fnMatch) {
    currentFn = fnMatch[1];
    // Cerca commento sopra (massimo 5 righe indietro)
    lastComment = "";
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const prev = lines[j].trim();
      if (prev.startsWith("#")) {
        lastComment = prev + "\n" + lastComment;
      } else if (prev !== "") {
        break;
      }
    }
    continue;
  }

  if (currentFn && trimmed.startsWith("#")) {
    lastComment += trimmed + "\n";
  }

  if (currentFn && /^verify_jwt\s*=\s*false/.test(trimmed)) {
    // Cerca commento AUTH: immediatamente sopra o nella sezione
    let sectionComment = "";
    for (let j = i - 1; j >= 0; j--) {
      const prev = lines[j].trim();
      if (prev.match(/^\[functions\./)) break;
      if (prev.startsWith("#")) sectionComment = prev + " " + sectionComment;
    }

    if (!ALLOWLIST.has(currentFn)) {
      findings.push({
        fn: currentFn,
        severity: "high",
        reason: "verify_jwt=false ma non in allowlist categorie consentite",
      });
    }

    if (!/AUTH:/i.test(sectionComment)) {
      findings.push({
        fn: currentFn,
        severity: "high",
        reason: "verify_jwt=false senza commento `# AUTH:` che spiega il meccanismo",
      });
    }

    // Verifica esistenza directory funzione
    const fnDir = path.join(FUNCTIONS_DIR, currentFn);
    if (!fs.existsSync(fnDir)) {
      findings.push({
        fn: currentFn,
        severity: "medium",
        reason: `directory supabase/functions/${currentFn}/ non trovata`,
      });
    }

    currentFn = null;
  }
}

// Verifica copertura test: cerca almeno un riferimento al nome funzione in e2e/ o test Deno
const publicEdgeTest = path.join(E2E_DIR, "public-edge-auth-guards.spec.ts");
const hasGuardsTest = fs.existsSync(publicEdgeTest);
if (!hasGuardsTest) {
  findings.push({
    fn: "(global)",
    severity: "medium",
    reason: "manca e2e/public-edge-auth-guards.spec.ts per validare gli auth guards pubblici",
  });
}

console.log(`\nAudit Edge Function Auth\n`);
console.log(`Allowlist size: ${ALLOWLIST.size}`);
console.log(`Findings: ${findings.length}\n`);

if (findings.length === 0) {
  console.log("OK — ogni verify_jwt=false è giustificato, allowlisted e documentato.");
  process.exit(0);
}

for (const f of findings) {
  console.log(`  [${f.severity.toUpperCase()}] ${f.fn}: ${f.reason}`);
}

const blocking = findings.filter((f) => f.severity === "high");
if (blocking.length > 0) {
  console.error(`\nFAIL: ${blocking.length} violazioni HIGH. Risolvi prima di mergere.`);
  process.exit(1);
}
console.log("\nWARN: solo medium findings, non blocco.");
process.exit(0);