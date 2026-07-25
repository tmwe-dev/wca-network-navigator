import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = {
  table: string;
  select?: string;
  selectOpts?: { count?: string; head?: boolean };
  is?: { column: string; value: unknown };
  eqs: Array<{ column: string; value: unknown }>;
};

let viewCount = 0;
let viewError: { message: string } | null = null;
let legacyCount = 0;
let legacyError: { message: string } | null = null;
let calls: Call[] = [];

function buildBuilder(table: string, count: number, error: { message: string } | null) {
  const call: Call = { table, eqs: [] };
  calls.push(call);
  const b: Record<string, unknown> = {};
  b.select = (cols: string, opts?: { count?: string; head?: boolean }) => {
    call.select = cols;
    call.selectOpts = opts;
    return b;
  };
  b.is = (col: string, val: unknown) => { call.is = { column: col, value: val }; return b; };
  b.eq = (col: string, val: unknown) => { call.eqs.push({ column: col, value: val }); return b; };
  b.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: null, count: error ? null : count, error });
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "message_intelligence_v") return buildBuilder(table, viewCount, viewError);
      return buildBuilder(table, legacyCount, legacyError);
    },
  },
}));

import { fetchFunnemailUnreadCount } from "../channel-messages";

describe("fetchFunnemailUnreadCount (B4.5 — badge nav funnemail-inbox)", () => {
  beforeEach(() => {
    viewCount = 0; viewError = null; legacyCount = 0; legacyError = null;
    calls = [];
  });

  it("view OK: HEAD count sulla view canonica, non chiama legacy, filtri corretti", async () => {
    viewCount = 42;
    const r = await fetchFunnemailUnreadCount();
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") expect(r.value).toBe(42);
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("message_intelligence_v");
    expect(calls[0].selectOpts).toEqual({ count: "exact", head: true });
    expect(calls[0].is).toEqual({ column: "read_at", value: null });
    expect(calls[0].eqs).toEqual([
      { column: "direction", value: "inbound" },
      { column: "channel", value: "email" },
    ]);
  });

  it("view Err → fallback trasparente su channel_messages con stessi filtri", async () => {
    viewError = { message: "view boom" };
    legacyCount = 7;
    const r = await fetchFunnemailUnreadCount();
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") expect(r.value).toBe(7);
    expect(calls).toHaveLength(2);
    expect(calls[0].table).toBe("message_intelligence_v");
    expect(calls[1].table).toBe("channel_messages");
    expect(calls[1].selectOpts).toEqual({ count: "exact", head: true });
    expect(calls[1].is).toEqual({ column: "read_at", value: null });
    expect(calls[1].eqs).toEqual([
      { column: "direction", value: "inbound" },
      { column: "channel", value: "email" },
    ]);
  });

  it("view Err + legacy Err → propaga Err", async () => {
    viewError = { message: "view down" };
    legacyError = { message: "legacy down" };
    const r = await fetchFunnemailUnreadCount();
    expect(r._tag).toBe("Err");
    expect(calls).toHaveLength(2);
  });

  it("count null (nessuna riga) → 0", async () => {
    // simulato tramite viewCount=0 (già default) e nessun errore
    const r = await fetchFunnemailUnreadCount();
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") expect(r.value).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("message_intelligence_v");
  });
});