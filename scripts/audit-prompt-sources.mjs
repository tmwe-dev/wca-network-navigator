#!/usr/bin/env node
/**
 * audit-prompt-sources.mjs — Fase 2 del piano di refactoring.
 *
 * Governance dei prompt (docs/architecture/prompt-kb-single-source.md):
 * il database è la sorgente autorevole; una costante di prompt nel codice è
 * ammessa SOLO come copia di emergenza e deve dichiararlo esplicitamente con
 * il marcatore `@fallback-of <tabella/riga>` nel commento IMMEDIATAMENTE
 * PRECEDENTE alla singola dichiarazione (non basta averlo altrove nel file).
 *
 * Riconosce prompt scritti come:
 *   const X_PROMPT = `...`            (template literal)
 *   const X_PROMPT = "..." + "..."    (stringa/concatenazione)
 *   const X_PROMPT = [...].join("\n") (array di righe)
 *   { systemPrompt: `...` }           (proprietà di oggetto)
 *
 * RATCHET: fallisce se il numero di prompt non dichiarati sale sopra il baseline.
 */
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "supabase/functions"];
const BASELINE_FILE = path.resolve("scripts/.prompt-sources-baseline.json");
const MARKER = /@fallback-of\s+\S+/;
const MIN_LEN = 200; // solo blocchi realmente sostanziosi
const LOOKBEHIND_LINES = 8;

// nomi (costanti o proprietà) che indicano un prompt / istruzione di sistema
const NAME_RE = /(prompt|system_message|systemmessage|doctrine|persona|instructions)/i;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", "dist", ".git"].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** Legge un literal stringa a partire da `i` (che punta a ' " o `). Ritorna [contenuto, indiceFine]. */
function readString(src, i) {
  const quote = src[i];
  let out = "";
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") {
      out += src[j + 1] ?? "";
      j += 2;
      continue;
    }
    if (c === quote) return [out, j + 1];
    out += c;
    j++;
  }
  return [out, j];
}

/**
 * Misura la lunghezza testuale del valore che inizia a `i`.
 * Gestisce literal singoli, concatenazioni con `+` e array `[...]` (anche `.join()`).
 */
function measureValue(src, i) {
  let len = 0;
  let j = i;
  let guard = 0;

  const skipWs = () => {
    while (j < src.length && /\s/.test(src[j])) j++;
  };

  skipWs();

  if (src[j] === "[") {
    // array/lista: conta solo se contiene almeno UNA stringa lunga (un vero prompt).
    // Liste di etichette UI brevi non sono prompt e non devono essere segnalate.
    let maxLen = 0;
    let depth = 0;
    while (j < src.length && guard++ < 200000) {
      const c = src[j];
      if (c === "[") {
        depth++;
        j++;
        continue;
      }
      if (c === "]") {
        depth--;
        j++;
        if (depth === 0) break;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        const [body, end] = readString(src, j);
        if (body.length > maxLen) maxLen = body.length;
        j = end;
        continue;
      }
      j++;
    }
    return maxLen;
  }

  while (j < src.length && guard++ < 200000) {
    skipWs();
    const c = src[j];
    if (c !== '"' && c !== "'" && c !== "`") break;
    const [body, end] = readString(src, j);
    len += body.length;
    j = end;
    skipWs();
    if (src[j] === "+") {
      j++;
      continue;
    }
    break;
  }
  return len;
}

function declaredAbove(src, declStart) {
  const before = src.slice(0, declStart).split("\n");
  const window = before.slice(Math.max(0, before.length - 1 - LOOKBEHIND_LINES)).join("\n");
  return MARKER.test(window);
}

const offenders = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, "utf8");
    // dichiarazioni di costanti/variabili e proprietà di oggetto
    const re = /(?:(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::[^=;\n]+)?=|\b([A-Za-z0-9_$]+)\s*:)\s*/g;
    let m;
    let count = 0;
    const names = [];
    while ((m = re.exec(src))) {
      const name = m[1] ?? m[2];
      if (!NAME_RE.test(name)) continue;
      const valueStart = m.index + m[0].length;
      const ch = src[valueStart];
      if (ch !== '"' && ch !== "'" && ch !== "`" && ch !== "[") continue;
      if (measureValue(src, valueStart) < MIN_LEN) continue;
      if (declaredAbove(src, m.index)) continue;
      count++;
      names.push(name);
    }
    if (count > 0) offenders.push({ file, count, names });
  }
}

offenders.sort((a, b) => b.count - a.count);
const total = offenders.reduce((a, o) => a + o.count, 0);

let baseline = Number.POSITIVE_INFINITY;
if (fs.existsSync(BASELINE_FILE)) {
  baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")).total;
}

console.log(`Prompt in codice senza marcatore @fallback-of: ${total} (baseline ${baseline})`);
for (const o of offenders.slice(0, 25)) console.log(`  ${o.file} (${o.count}) → ${o.names.join(", ")}`);
if (offenders.length > 25) console.log(`  ... e altri ${offenders.length - 25} file`);

if (!Number.isFinite(baseline)) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({ total, updatedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log("Baseline creato.");
  process.exit(0);
}
if (total > baseline) {
  console.error(`FAIL: nuovi prompt nel codice non dichiarati (${total} > ${baseline}).`);
  console.error("Crea il prompt nel database, oppure marca il fallback con `@fallback-of <tabella/riga>`");
  console.error("nel commento immediatamente sopra la singola costante.");
  process.exit(1);
}
if (total < baseline) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({ total, updatedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log(`Baseline abbassato a ${total}.`);
}
process.exit(0);
