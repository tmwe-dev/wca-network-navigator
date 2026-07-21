import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
type Call = {
  table: string;
  select?: string;
  order?: { column: string; ascending: boolean };
  eq?: { column: string; value: unknown };
  or?: string;
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
  builder.or = (expr: string) => { call.or = expr; return builder; };
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

import { fetchRecipientHistory } from "../channel-messages";

describe("fetchRecipientHistory (B4.2 — SSOT unica, fallback interno)", () => {
  beforeEach(() => {
    viewRows = []; viewError = null; legacyRows = []; legacyError = null;
    calls = [];
  });

  it("nessun filtro → ritorna [] senza toccare il DB", async () => {
    const r = await fetchRecipientHistory({});
    expect(r._tag).toBe("Ok");
    expect(calls).toHaveLength(0);
  });

  it("view OK: legge dalla view, NON chiama legacy, filtri/ordine/limit/alias corretti (partnerId)", async () => {
    viewRows = [{ id: "m1", channel: "email", direction: "inbound", subject: "S", body_text: null, from_address: null, email_date: null, created_at: "2026-07-20T00:00:00Z" }];
    const r = await fetchRecipientHistory({ partnerId: "p-1" });
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") expect(r.value).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("message_intelligence_v");
    expect(calls[0].select).toContain("id:message_id");
    expect(calls[0].select).toContain("created_at:message_created_at");
    expect(calls[0].order).toEqual({ column: "message_created_at", ascending: false });
    expect(calls[0].eq).toEqual({ column: "partner_id", value: "p-1" });
    expect(calls[0].or).toBeUndefined();
    expect(calls[0].limit).toBe(10);
  });

  it("solo email: OR ILIKE su from_address/to_address, limit custom", async () => {
    await fetchRecipientHistory({ email: "a@b.com", limit: 25 });
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("message_intelligence_v");
    expect(calls[0].eq).toBeUndefined();
    expect(calls[0].or).toBe("from_address.ilike.a@b.com,to_address.ilike.a@b.com");
    expect(calls[0].limit).toBe(25);
  });

  it("partnerId ha precedenza su email", async () => {
    await fetchRecipientHistory({ partnerId: "p-1", email: "a@b.com" });
    expect(calls[0].eq).toEqual({ column: "partner_id", value: "p-1" });
    expect(calls[0].or).toBeUndefined();
  });

  it("view Err → fallback trasparente su channel_messages con filtri/ordine/limit legacy", async () => {
    viewError = { message: "boom" };
    legacyRows = [{ id: "l1", channel: "email", direction: "outbound", subject: null, body_text: null, from_address: null, email_date: null, created_at: "2026-07-20T00:00:00Z" }];
    const r = await fetchRecipientHistory({ partnerId: "p-1" });
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") expect(r.value).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(calls[0].table).toBe("message_intelligence_v");
    expect(calls[1].table).toBe("channel_messages");
    expect(calls[1].order).toEqual({ column: "created_at", ascending: false });
    expect(calls[1].eq).toEqual({ column: "partner_id", value: "p-1" });
    expect(calls[1].limit).toBe(10);
  });

  it("view Err + legacy Err → ritorna Err (propaga)", async () => {
    viewError = { message: "view down" };
    legacyError = { message: "legacy down" };
    const r = await fetchRecipientHistory({ partnerId: "p-1" });
    expect(r._tag).toBe("Err");
    expect(calls).toHaveLength(2);
  });
});