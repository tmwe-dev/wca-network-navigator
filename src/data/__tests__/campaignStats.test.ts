/**
 * DAL — campaignStats tests (D2)
 * Verifica primary path, propagazione errori, filtri applicati.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type BuilderReturn = { count: number | null; error: unknown };

function makeBuilder(result: BuilderReturn, calls: string[]) {
  const proxy: unknown = new Proxy({}, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: BuilderReturn) => unknown) => resolve(result);
      }
      return (...args: unknown[]) => {
        calls.push(`${String(prop)}(${args.map((a) => JSON.stringify(a)).join(",")})`);
        return proxy;
      };
    },
  });
  return proxy;
}

const fromMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => fromMock(table) },
}));

import { fetchCampaignStatsCounts } from "../campaignStats";

describe("DAL — fetchCampaignStatsCounts", () => {
  beforeEach(() => fromMock.mockReset());

  it("aggrega i 3 count e normalizza null → 0 preservando i filtri originali", async () => {
    const seq: BuilderReturn[] = [
      { count: 10, error: null }, // sent (email_campaign_queue)
      { count: null, error: null }, // pending (email_campaign_queue)
      { count: 4, error: null }, // completed (email_drafts)
    ];
    const callsPerTable: Record<string, string[]> = {};
    let i = 0;
    fromMock.mockImplementation((t: string) => {
      const calls = (callsPerTable[`${t}#${i}`] = []);
      return makeBuilder(seq[i++], calls);
    });

    const out = await fetchCampaignStatsCounts();
    expect(out).toEqual({ sent: 10, pending: 0, completed: 4 });

    expect(fromMock).toHaveBeenNthCalledWith(1, "email_campaign_queue");
    expect(fromMock).toHaveBeenNthCalledWith(2, "email_campaign_queue");
    expect(fromMock).toHaveBeenNthCalledWith(3, "email_drafts");

    const c1 = callsPerTable["email_campaign_queue#0"].join(" ");
    const c2 = callsPerTable["email_campaign_queue#1"].join(" ");
    const c3 = callsPerTable["email_drafts#2"].join(" ");
    expect(c1).toContain('select("id",{"count":"exact","head":true})');
    expect(c1).toContain('eq("status","sent")');
    expect(c2).toContain('eq("status","pending")');
    expect(c3).toContain('eq("queue_status","completed")');
  });

  it("equivalenza D2.1 — response con error+count null → 0 per quel campo, altri count preservati", async () => {
    const err = new Error("RLS denied");
    const seq: BuilderReturn[] = [
      { count: null, error: err }, // sent: error valorizzato → deve silenziare a 0
      { count: 7, error: null },   // pending: preservato
      { count: 4, error: null },   // completed: preservato
    ];
    let i = 0;
    fromMock.mockImplementation(() => makeBuilder(seq[i++], []));
    // Non deve lanciare: semantica silenziosa preservata (inline originario).
    const out = await fetchCampaignStatsCounts();
    expect(out).toEqual({ sent: 0, pending: 7, completed: 4 });
  });
});

describe("D2 guardrail — useCampaignStatsV2 non deve reintrodurre supabase.from per gli stat count", () => {
  it("hook stat consuma solo la DAL", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/v2/hooks/useCampaignDraftsV2.ts", "utf8");
    // Il modulo contiene ancora writer (pause/resume) e query drafts: guardrail mirato al blocco stat.
    const statsBlock = src.match(/export function useCampaignStatsV2[\s\S]*?\n\}/);
    expect(statsBlock).not.toBeNull();
    expect(statsBlock![0]).not.toMatch(/supabase\.from\(/);
    expect(statsBlock![0]).toMatch(/fetchCampaignStatsCounts/);
  });
});