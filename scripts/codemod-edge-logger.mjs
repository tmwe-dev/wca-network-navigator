#!/usr/bin/env node
/**
 * codemod-edge-logger.mjs — sostituisce console.* con createLogger nelle edge functions.
 * Trasformazione puramente meccanica: nessun cambio di comportamento oltre al formato log.
 */
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve("supabase/functions");
const targets = process.argv.slice(2).filter((a) => !a.startsWith("--"));

function splitArgs(s) {
  const out = [];
  let depth = 0, cur = "", q = null, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (q) {
      if (c === "\\") { cur += c + s[i + 1]; i += 2; continue; }
      if (c === q) q = null;
      cur += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { q = c; cur += c; i++; continue; }
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) depth--;
    if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function findCall(src, from) {
  const re = /console\.(log|info|warn|error|debug)\s*\(/g;
  re.lastIndex = from;
  const m = re.exec(src);
  if (!m) return null;
  let i = re.lastIndex, depth = 1, q = null;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (q) {
      if (c === "\\") { i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { q = c; i++; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    i++;
  }
  return { start: m.index, argStart: re.lastIndex, end: i, method: m[1] };
}

function msgExpr(a) {
  if (!a) return '""';
  return /^["'`]/.test(a) ? a : `String(${a})`;
}

function transform(src) {
  let out = src, pos = 0, changed = false;
  for (;;) {
    const call = findCall(out, pos);
    if (!call) break;
    const argsRaw = out.slice(call.argStart, call.end - 1);
    const args = splitArgs(argsRaw);
    let repl;
    const method = call.method === "log" || call.method === "debug" || call.method === "info" ? "info" : call.method;
    if (method === "error") {
      const msg = msgExpr(args[0]);
      const err = args[1] ?? "null";
      const rest = args.slice(2);
      repl = rest.length ? `log.error(${msg}, ${err}, { details: [${rest.join(", ")}] })` : `log.error(${msg}, ${err})`;
    } else {
      const msg = msgExpr(args[0]);
      const rest = args.slice(1);
      repl = rest.length ? `log.${method}(${msg}, { details: [${rest.join(", ")}] })` : `log.${method}(${msg})`;
    }
    out = out.slice(0, call.start) + repl + out.slice(call.end);
    pos = call.start + repl.length;
    changed = true;
  }
  return { out, changed };
}

function ensureLogger(src, name) {
  if (/createLogger\s*\(/.test(src)) return src;
  const importLine = `import { createLogger } from "../_shared/structuredLogger.ts";`;
  const decl = `\nconst log = createLogger("${name}");\n`;
  const lines = src.split("\n");
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s|^}\s*from\s/.test(lines[i])) last = i;
  }
  if (last === -1) return importLine + "\n" + decl + src;
  lines.splice(last + 1, 0, importLine, decl);
  return lines.join("\n");
}

let touched = 0;
for (const name of targets) {
  const dir = path.join(DIR, name);
  if (!fs.existsSync(dir)) { console.log(`skip ${name} (missing)`); continue; }
  let any = false;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".ts")) continue;
    const p = path.join(dir, f);
    const src = fs.readFileSync(p, "utf8");
    const { out, changed } = transform(src);
    if (!changed) continue;
    fs.writeFileSync(p, ensureLogger(out, name));
    any = true;
  }
  const entry = path.join(dir, "index.ts");
  if (fs.existsSync(entry)) {
    const src = fs.readFileSync(entry, "utf8");
    if (!/createLogger\s*\(/.test(src)) fs.writeFileSync(entry, ensureLogger(src, name));
  }
  if (any) touched++;
}
console.log(`✅ codemod applicato a ${touched}/${targets.length} funzioni`);
