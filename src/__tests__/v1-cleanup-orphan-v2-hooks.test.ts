/**
 * Batch V1 — guardrail no-reintroduction.
 *
 * I 3 hook V2 elencati erano orfani (zero import runtime in tutto `src/`
 * e `supabase/`) e sono stati rimossi. Se qualcuno li ricrea senza wire di
 * consumer reali, questo test fallisce e obbliga a riaprire l'analisi
 * v1→v2 nel piano.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const REMOVED = [
  "src/v2/hooks/useDownloadJobsV2.ts",
  "src/v2/hooks/useProspectsV2.ts",
  "src/v2/hooks/useActivitiesV2.ts",
] as const;

const REMOVED_SYMBOLS = ["useDownloadJobsV2", "useProspectsV2", "useActivitiesV2"] as const;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
}

describe("Batch V1 — orphan V2 hooks removed", () => {
  it.each(REMOVED)("%s must not be re-added", (path) => {
    expect(existsSync(path)).toBe(false);
  });

  it("removed hook symbols must not reappear in src/**", () => {
    const files = walk("src").filter((f) => !f.includes("__tests__") && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));
    // exclude this guardrail file itself
    const others = files.filter((f) => !f.endsWith("v1-cleanup-orphan-v2-hooks.test.ts"));
    const offenders: string[] = [];
    for (const f of others) {
      const src = readFileSync(f, "utf8");
      for (const sym of REMOVED_SYMBOLS) {
        // word-boundary match on identifier
        const re = new RegExp(`\\b${sym}\\b`);
        if (re.test(src)) {
          offenders.push(`${f} contiene ${sym}`);
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
