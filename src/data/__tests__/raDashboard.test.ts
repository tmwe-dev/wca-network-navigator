/**
 * DAL — raDashboard tests
 *
 * Le tabelle `ra_prospects` / `ra_scraping_jobs` non esistono in `public`.
 * Il contratto verificato è quindi: nessuna query emessa, stato neutro
 * restituito, nessun throw (React Query non deve andare in isError).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const supabaseFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => supabaseFrom(t) },
}));

import { fetchRaDashboardStats } from "../raDashboard";

describe("DAL — fetchRaDashboardStats", () => {
  beforeEach(() => supabaseFrom.mockReset());

  it("restituisce lo stato neutro senza interrogare relazioni inesistenti", async () => {
    const out = await fetchRaDashboardStats();

    expect(out).toEqual({
      totalProspects: 0,
      withEmail: 0,
      withPec: 0,
      withPhone: 0,
      topAteco: [],
      recentProspects: [],
      activeJobs: [],
    });
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it("non lancia mai: la dashboard RA resta navigabile", async () => {
    await expect(fetchRaDashboardStats()).resolves.toBeDefined();
  });
});

describe("guardrail — useRADashboard non deve reintrodurre bypass", () => {
  it("hook consuma solo la DAL", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/hooks/useRADashboard.ts", "utf8");
    expect(src).not.toMatch(/untypedFrom\(/);
    expect(src).not.toMatch(/supabase\.from\(/);
    expect(src).not.toMatch(/supabase\.rpc\(/);
    expect(src).toMatch(/fetchRaDashboardStats/);
  });
});
