import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
type Call = {
  table: string;
  select?: string;
  order?: { column: string; ascending: boolean };
  eq?: { column: string; value: unknown };
  in?: { column: string; values: unknown[] };
  limit?: number;
};

let viewRows: Row[] = [];
let viewError: { message: string } | null = null;
let legacyRows: Row[] = [];
let legacyError: { message: string } | null = null;
let calls: Call[] = [];

function buildBuilder(table: string, rows: Row[], error: { message: string } | null) {
  const call: Call = { table };
  calls.push(call);
  const builder: Record<string, unknown> = {};
  builder.select = (cols: string) => { call.select = cols; return builder; };
  builder.order = (col: string, opts: { ascending: boolean }) => { call.order = { column: col, ascending: opts.ascending }; return builder; };
  builder.eq = (col: string, val: unknown) => { call.eq = { column: col, value: val }; return builder; };
  builder.in = (col: string, vals: unknown[]) => { call.in = { column: col, values: vals }; return builder; };
  builder.limit = (n: number) => { call.limit = n; return builder; };
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: error ? null : rows, error });
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "message_intelligence_v") return buildBuilder(table, viewRows, viewError);
      return buildBuilder(table, legacyRows, legacyError);
    },
  },
}));

import { fetchMessagesBySenders } from "../channel-messages";

describe("fetchMessagesBySenders (B4.3 — SSOT unica, fallback interno)", () => {
  beforeEach(() => {
    viewRows = []; viewError = null; legacyRows = []; legacyError = null;
    calls = [];
  });

  it("nessun mittente → ritorna [] senza toccare il DB", async () => {
    const r = await fetchMessagesBySenders([]);
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") expect(r.value).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("view OK: legge dalla view, NON chiama legacy, filtri/ordine/limit/alias corretti", async () => {
    viewRows = [{ id: "m1", email_date: "2026-07-20", direction: "inbound", from_address: "a@b.com", to_address: "me@x.com", subject: "s", body_text: "b" }];
    const r = await fetchMessagesBySenders(["a@b.com", "c@d.com"], 500);
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") expect(r.value).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("message_intelligence_v");
    expect(calls[0].select).toContain("id:message_id");
    expect(calls[0].eq).toEqual({ column: "channel", value: "email" });
    expect(calls[0].in).toEqual({ column: "from_address", values: ["a@b.com", "c@d.com"] });
    expect(calls[0].order).toEqual({ column: "email_date", ascending: false });
    expect(calls[0].limit).toBe(500);
  });

  it("view Err → fallback trasparente su channel_messages con filtri/ordine/limit legacy", async () => {
    viewError = { message: "boom" };
    legacyRows = [{ id: "l1", email_date: null, direction: "outbound", from_address: "a@b.com", to_address: null, subject: null, body_text: null }];
    const r = await fetchMessagesBySenders(["a@b.com"]);
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") expect(r.value).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(calls[0].table).toBe("message_intelligence_v");
    expect(calls[1].table).toBe("channel_messages");
    expect(calls[1].eq).toEqual({ column: "channel", value: "email" });
    expect(calls[1].in).toEqual({ column: "from_address", values: ["a@b.com"] });
    expect(calls[1].order).toEqual({ column: "email_date", ascending: false });
    expect(calls[1].limit).toBe(2000);
  });

  it("view Err + legacy Err → ritorna Err (propaga)", async () => {
    viewError = { message: "view down" };
    legacyError = { message: "legacy down" };
    const r = await fetchMessagesBySenders(["a@b.com"]);
    expect(r._tag).toBe("Err");
    expect(calls).toHaveLength(2);
  });
});