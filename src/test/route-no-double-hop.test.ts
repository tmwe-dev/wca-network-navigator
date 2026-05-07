/**
 * Phase 7 hardening — Smoke test routing canonical.
 *
 * Verifica statica (no React render) che:
 *  1. Ogni `<Route path="X" element={<Navigate to="Y" replace/>}/>` punti
 *     a un path che NON sia esso stesso un Navigate redirect (no double-hop).
 *  2. I caller hot-path su Campagne/Outreach (CommandPalette, useSmartSuggestions,
 *     useDashboardData, useCampaignData, useMissionBuilder) puntino a path
 *     canonical (non legacy che richiede redirect).
 *
 * Parser: regex statica su `src/v2/routes.tsx` — sufficiente per smoke check.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTES_FILE = resolve(__dirname, "../v2/routes.tsx");
const ROUTES_SRC = readFileSync(ROUTES_FILE, "utf8");

/** Estrae tutte le coppie (sourcePath, targetPath) da `<Navigate to="..."/>` dentro `<Route path="...">`. */
function extractRedirectMap(src: string): Map<string, string> {
  const map = new Map<string, string>();
  // Match: <Route path="X" element={<Navigate to="/v2/Y" replace />} />
  const re = /<Route\s+path="([^"]+)"\s+element=\{\s*<Navigate\s+to="([^"]+)"\s+replace\s*\/?>\s*\}\s*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const source = m[1].startsWith("/") ? m[1] : `/v2/${m[1]}`;
    map.set(source, m[2]);
  }
  return map;
}

const REDIRECTS = extractRedirectMap(ROUTES_SRC);

describe("Phase 7 — routing canonical no double-hop", () => {
  it("ha estratto un set non vuoto di redirect", () => {
    expect(REDIRECTS.size).toBeGreaterThan(10);
  });

  it("nessun redirect punta a un altro redirect (no double-hop)", () => {
    const offenders: string[] = [];
    for (const [source, target] of REDIRECTS) {
      // Normalizza il target rimuovendo querystring/hash
      const cleanTarget = target.split(/[?#]/)[0];
      if (REDIRECTS.has(cleanTarget)) {
        offenders.push(`${source} -> ${target} -> ${REDIRECTS.get(cleanTarget)}`);
      }
    }
    expect(offenders, `Double-hop redirect rilevati:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("i path canonical core non sono mai sorgente di redirect", () => {
    const canonical = [
      "/v2/cockpit",
      "/v2/inbox",
      "/v2/email",
      "/v2/email/forge",
      "/v2/cestinone",
      "/v2/agenda",
      "/v2/campaigns/jobs",
      "/v2/funnemail-inbox",
    ];
    for (const p of canonical) {
      expect(REDIRECTS.has(p), `${p} dovrebbe essere canonical, non un redirect`).toBe(false);
    }
  });

  it("i caller hot-path non puntano più al legacy /v2/outreach", () => {
    const hotpathFiles = [
      "src/v2/hooks/useSmartSuggestions.ts",
      "src/v2/hooks/useDashboardData.ts",
      "src/components/campaigns/useCampaignData.ts",
      "src/components/missions/builder/useMissionBuilder.ts",
      "src/components/CommandPalette.tsx",
    ];
    const offenders: string[] = [];
    for (const f of hotpathFiles) {
      const src = readFileSync(resolve(__dirname, "../../", f), "utf8");
      // Cerca "/v2/outreach" come stringa quotata (esclude commenti/doc che non lo usano qui)
      if (/["']\/v2\/outreach(?:["'/])/.test(src)) {
        offenders.push(f);
      }
    }
    expect(offenders, `File con riferimenti legacy /v2/outreach:\n${offenders.join("\n")}`).toEqual([]);
  });
});
