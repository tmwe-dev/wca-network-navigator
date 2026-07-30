/**
 * Guard architetturali sul Data Access Layer.
 *
 * 1) Nessuna write senza filtro dentro `src/data/**`:
 *    ogni `.update(...)` / `.delete()` deve essere seguito, nella stessa
 *    catena, da almeno un filtro (`eq/neq/in/match/filter/gt/lt/gte/lte/is/like/ilike/or/contains`).
 *    Motivo: `updateAddressRuleUnfiltered` aggiornava l'INTERA tabella.
 *
 * 2) Ratchet sui bypass DAL: `supabase.from()/.rpc()/.storage` fuori dalle
 *    directory autorizzate non può crescere rispetto alla baseline.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const FILTERS = /\.(eq|neq|in|match|filter|gt|gte|lt|lte|is|like|ilike|or|not|contains|overlaps|textSearch)\s*\(/;

describe("Guard DAL — nessuna write senza filtro", () => {
  const dalFiles = walk(path.join(ROOT, "src/data"));

  it("ogni update/delete nel DAL ha almeno un filtro", () => {
    const offenders: string[] = [];
    for (const file of dalFiles) {
      const src = readFileSync(file, "utf8");
      // Statement = dal token .update(/.delete( fino al `;` di chiusura.
      const re = /\.(update|delete)\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const rest = src.slice(m.index, src.indexOf(";", m.index) + 1 || undefined);
        if (!FILTERS.test(rest)) {
          const line = src.slice(0, m.index).split("\n").length;
          offenders.push(`${path.relative(ROOT, file)}:${line} → .${m[1]}() senza filtro`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("nessuna funzione DAL esposta con suffisso Unfiltered", () => {
    const offenders = dalFiles.filter((f) => /export\s+async\s+function\s+\w*Unfiltered/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});

describe("Guard DAL — ratchet bypass", () => {
  /**
   * Allowlist tecnica: bootstrap client generato, il DAL stesso, i test e i
   * moduli IO v2 che *sono* il layer dati (src/v2/io/supabase/**).
   * Auth/session (`supabase.auth`) e realtime (`supabase.channel`) NON sono
   * query DAL e restano legittimi nei layer applicativi.
   */
  const ALLOW = [
    "src/data/",              // DAL v1 canonico
    "src/v2/io/supabase/",    // DAL v2 (queries/ + mutations/): È il layer dati, non un bypass
    "src/integrations/supabase/", // client generato (bootstrap)
    "src/test/",
    "src/lib/supabaseUntyped", // helper untyped centralizzato
    "src/lib/typedSupabase",   // helper typed centralizzato
  ];
  /**
   * Baseline REALE al commit c262919, misurata con censimento MULTILINEA
   * (le misure precedenti — 152/188 — usavano un regex single-line e
   * sottostimavano di ~4x, perché `supabase\n  .from(...)` non veniva contato).
   * Può solo scendere.
   */
  const BASELINE = 630;

  it("il numero di bypass non cresce rispetto alla baseline", () => {
    const files = walk(path.join(ROOT, "src")).filter((f) => {
      const rel = path.relative(ROOT, f).replace(/\\/g, "/");
      if (ALLOW.some((a) => rel.startsWith(a))) return false;
      return !/\.(test|spec)\.tsx?$/.test(rel) && !rel.includes("/__tests__/");
    });
    let count = 0;
    for (const f of files) {
      const src = readFileSync(f, "utf8")
        // Esclude commenti: evita falsi positivi sui doc-block che *citano*
        // `supabase.from()` per spiegare di non usarlo.
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      const matches = src.match(/supabase\s*\.\s*(from|rpc|storage)\b/g);
      count += matches?.length ?? 0;
    }
    expect(count).toBeLessThanOrEqual(BASELINE);
  });
});
