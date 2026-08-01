#!/usr/bin/env node
/**
 * Audit offline delle migrazioni SQL (nessuna connessione al DB).
 * Verifica: naming, timestamp duplicati, conflitti di ordinamento,
 * oggetti referenziati prima della creazione, search_path mancante su
 * funzioni SECURITY DEFINER, view SECURITY DEFINER, drift schema/tipi.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";
const TYPES = "src/integrations/supabase/types.ts";
const NAME_RX = /^\d{14}_[\w.-]+\.sql$/;

export function auditMigrations({ dir = DIR, typesFile = TYPES } = {}) {
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    : [];

  const badNames = files.filter((f) => !NAME_RX.test(f));

  // timestamp duplicati (prefisso numerico identico)
  const byPrefix = new Map();
  for (const f of files) {
    const p = (f.match(/^\d+/) || [""])[0];
    byPrefix.set(p, [...(byPrefix.get(p) || []), f]);
  }
  const duplicateTimestamps = [...byPrefix.entries()]
    .filter(([p, list]) => p && list.length > 1)
    .map(([prefix, list]) => ({ prefix, files: list }));

  // conflitti di ordinamento: prefissi di lunghezza diversa rendono
  // l'ordine lessicografico != ordine cronologico reale.
  const lengths = new Set(files.map((f) => (f.match(/^\d+/) || [""])[0].length));
  const orderingConflicts = files
    .filter((f) => (f.match(/^\d+/) || [""])[0].length !== 14)
    .map((f) => ({ file: f, reason: "prefisso non a 14 cifre: ordinamento ambiguo" }));

  // analisi contenuto
  const created = new Set();
  const referencedBeforeCreation = [];
  const definerFunctionsWithoutSearchPath = [];
  const securityDefinerViews = [];
  const tablesWithoutGrant = [];

  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    const stripped = sql.replace(/--[^\n]*/g, "");

    for (const m of stripped.matchAll(/create\s+(?:or\s+replace\s+)?(?:unlogged\s+|temp\s+|temporary\s+)?table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi)) {
      created.add(norm(m[1]));
    }
    for (const m of stripped.matchAll(/create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi)) {
      created.add(norm(m[1]));
    }
    for (const m of stripped.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)/gi)) {
      const t = norm(m[1]);
      if (t && !t.includes(".") && !created.has(t)) {
        referencedBeforeCreation.push({ file: f, object: t });
      }
    }

    for (const m of stripped.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w."]+)[\s\S]*?(?=\bcreate\s+(?:or\s+replace\s+)?function\b|$)/gi)) {
      const body = m[0];
      if (/security\s+definer/i.test(body) && !/set\s+search_path/i.test(body)) {
        definerFunctionsWithoutSearchPath.push({ file: f, fn: norm(m[1]) });
      }
    }

    for (const m of stripped.matchAll(/create\s+(?:or\s+replace\s+)?view\s+([\w."]+)([\s\S]{0,200})/gi)) {
      const opts = m[2];
      if (/security_definer\s*=\s*true/i.test(opts)) {
        securityDefinerViews.push({ file: f, view: norm(m[1]) });
      }
    }
    for (const m of stripped.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(public\.[\w"]+)/gi)) {
      const table = norm(m[1]);
      const t = `public.${table}`;
      const rest = stripped.slice(stripped.indexOf(m[0]));
      if (!new RegExp(`grant[\\s\\S]{0,400}?${table}`, "i").test(rest)) {
        tablesWithoutGrant.push({ file: f, table: t });
      }
    }
  }

  // drift: tabelle nei tipi generati vs tabelle create nelle migrazioni
  let typeTables = [];
  if (existsSync(typesFile)) {
    const t = readFileSync(typesFile, "utf8");
    const tablesBlock = t.slice(t.indexOf("Tables: {"));
    typeTables = [...tablesBlock.matchAll(/^      (\w+): \{$/gm)].map((m) => m[1]);
  }
  const createdTables = [...created].filter((c) => !c.includes("."));
  const missingInTypes = createdTables.filter((t) => !typeTables.includes(t));
  const missingInMigrations = typeTables.filter((t) => !createdTables.includes(t));

  return {
    totalMigrations: files.length,
    badNames,
    duplicateTimestamps,
    orderingConflicts,
    prefixLengths: [...lengths],
    referencedBeforeCreation,
    definerFunctionsWithoutSearchPath,
    securityDefinerViews,
    tablesWithoutGrant,
    schemaDrift: { typeTables: typeTables.length, createdTables: createdTables.length, missingInTypes, missingInMigrations },
  };
}

function norm(id) {
  // Schema-insensitive: le migrazioni storiche alternano `public.x` e `x`.
  return id.replace(/"/g, "").toLowerCase().replace(/^public\./, "");
}

if (process.argv[1] && process.argv[1].endsWith("audit-migrations.mjs")) {
  const r = auditMigrations();
  console.log(JSON.stringify(r, null, 2));
}
