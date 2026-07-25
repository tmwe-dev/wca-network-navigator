/**
 * DAL — raDashboard tests (D3)
 * Verifica query/filtri/ordine/mapping ateco + equivalenza semantica errori.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type BuilderReturn = { count?: number | null; data?: unknown; error?: unknown };

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

const untypedMock = vi.fn();
vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (table: string) => untypedMock(table),
}));

import { fetchRaDashboardStats } from "../raDashboard";

describe("DAL — fetchRaDashboardStats", () => {
  const callsSeq: string[][] = [];
  const tables: string[] = [];

  beforeEach(() => {
    untypedMock.mockReset();
    callsSeq.length = 0;
    tables.length = 0;
  });

  function setup(seq: BuilderReturn[]) {
    let i = 0;
    untypedMock.mockImplementation((t: string) => {
      tables.push(t);
      const calls: string[] = [];
      callsSeq.push(calls);
      return makeBuilder(seq[i++], calls);
    });
  }

  it("aggrega count + data, mappa top ateco (max 5, ordinato desc), null → 0/[]", async () => {
    setup([
      { count: 100, error: null }, // total
      { count: 60, error: null },  // withEmail
      { count: 20, error: null },  // withPec
      { count: 40, error: null },  // withPhone
      { data: [{ id: "p1" }, { id: "p2" }], error: null }, // recentProspects
      { data: [{ id: "j1" }], error: null }, // activeJobs
      {
        data: [
          { codice_ateco: "62.01", descrizione_ateco: "Software" },
          { codice_ateco: "62.01", descrizione_ateco: "Software" },
          { codice_ateco: "62.01", descrizione_ateco: "Software" },
          { codice_ateco: "46.19", descrizione_ateco: "Commercio" },
          { codice_ateco: "46.19", descrizione_ateco: "Commercio" },
          { codice_ateco: "70.22", descrizione_ateco: "Consulenza" },
          { codice_ateco: null, descrizione_ateco: "Skip" }, // scartato
          { codice_ateco: "10.11", descrizione_ateco: null }, // usa code come descrizione
          { codice_ateco: "10.11", descrizione_ateco: null },
          { codice_ateco: "43.21", descrizione_ateco: "Impianti" },
          { codice_ateco: "68.20", descrizione_ateco: "Immobiliare" },
        ],
        error: null,
      },
    ]);

    const out = await fetchRaDashboardStats();

    expect(out.totalProspects).toBe(100);
    expect(out.withEmail).toBe(60);
    expect(out.withPec).toBe(20);
    expect(out.withPhone).toBe(40);
    expect(out.recentProspects).toHaveLength(2);
    expect(out.activeJobs).toHaveLength(1);

    // Top 5 ateco, ordinato desc per count
    expect(out.topAteco.length).toBe(5);
    expect(out.topAteco[0]).toEqual({ code: "62.01", description: "Software", count: 3 });
    expect(out.topAteco[1]).toEqual({ code: "46.19", description: "Commercio", count: 2 });
    // "10.11" con descrizione null → usa codice come descrizione
    const ateco1011 = out.topAteco.find((a) => a.code === "10.11");
    expect(ateco1011).toEqual({ code: "10.11", description: "10.11", count: 2 });
    // ateco null è scartato
    expect(out.topAteco.find((a) => a.code === null as unknown as string)).toBeUndefined();

    // Ordine tabelle e query
    expect(tables).toEqual([
      "ra_prospects", "ra_prospects", "ra_prospects", "ra_prospects",
      "ra_prospects", "ra_scraping_jobs", "ra_prospects",
    ]);

    // Filtri specifici preservati
    const c0 = callsSeq[0].join(" ");
    const c1 = callsSeq[1].join(" ");
    const c2 = callsSeq[2].join(" ");
    const c3 = callsSeq[3].join(" ");
    const c4 = callsSeq[4].join(" ");
    const c5 = callsSeq[5].join(" ");
    const c6 = callsSeq[6].join(" ");
    expect(c0).toContain('select("*",{"count":"exact","head":true})');
    expect(c1).toContain('not("email","is",null)');
    expect(c2).toContain('not("pec","is",null)');
    expect(c3).toContain('not("phone","is",null)');
    expect(c4).toContain('order("created_at",{"ascending":false})');
    expect(c4).toContain('limit(10)');
    expect(c5).toContain('in("status",["pending","running"])');
    expect(c5).toContain('order("created_at",{"ascending":false})');
    expect(c5).toContain('limit(5)');
    expect(c6).toContain('select("codice_ateco, descrizione_ateco")');
  });

  it("equivalenza semantica errori — null/undefined count/data silenziati a 0/[] senza throw", async () => {
    setup([
      { count: null, error: new Error("RLS") }, // total → 0, error silenziato
      { count: null, error: null },
      { count: null, error: null },
      { count: null, error: null },
      { data: null, error: new Error("net") }, // recent → []
      { data: null, error: null },              // jobs → []
      { data: null, error: null },              // ateco → []
    ]);

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
  });
});

describe("D3 guardrail — useRADashboard non deve reintrodurre bypass", () => {
  it("hook consuma solo la DAL", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/hooks/useRADashboard.ts", "utf8");
    expect(src).not.toMatch(/untypedFrom\(/);
    expect(src).not.toMatch(/supabase\.from\(/);
    expect(src).not.toMatch(/supabase\.rpc\(/);
    expect(src).toMatch(/fetchRaDashboardStats/);
  });
});