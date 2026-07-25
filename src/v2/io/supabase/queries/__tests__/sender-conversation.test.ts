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
  const b: Record<string, unknown> = {};
  b.select = (cols: string) => { call.select = cols; return b; };
  b.order = (col: string, opts: { ascending: boolean }) => { call.order = { column: col, ascending: opts.ascending }; return b; };
  b.eq = (col: string, val: unknown) => { call.eq = { column: col, value: val }; return b; };
  b.or = (expr: string) => { call.or = expr; return b; };
  b.limit = (n: number) => { call.limit = n; return b; };
  b.then = (resolve: (v: unknown) => unknown) => resolve({ data: error ? null : rows, error });
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "message_intelligence_v") return buildBuilder(table, viewRows, viewError);
      return buildBuilder(table, legacyRows, legacyError);
    },
  },
}));

import { fetchSenderConversation } from "../channel-messages";

describe("fetchSenderConversation (B4.4 — SSOT unica, fallback interno)", () => {
  beforeEach(() => {
    viewRows = []; viewError = null; legacyRows = []; legacyError = null;
    calls = [];
  });

  it("senderEmail vuoto/null → [] senza toccare il DB", async () => {
    const r1 = await fetchSenderConversation(null);
    const r2 = await fetchSenderConversation("");
    expect(r1._tag).toBe("Ok");
    expect(r2._tag).toBe("Ok");
    expect(calls).toHaveLength(0);
  });

  it("view OK: legge dalla view, NON chiama legacy, filtri/ordine/limit/alias/or corretti", async () => {
    viewRows = [{
      id: "m1", subject: "s", email_date: "2026-07-20", direction: "inbound",
      channel: "email", from_address: "a@b.com", to_address: "me@x.com",
      body_text: "b", body_html: "<p>b</p>",
    }];
    const r = await fetchSenderConversation("a@b.com", 20);
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") {
      expect(r.value).toHaveLength(1);
      expect(r.value[0].body_html).toBe("<p>b</p>");
      expect(r.value[0].to_address).toBe("me@x.com");
    }
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("message_intelligence_v");
    expect(calls[0].select).toContain("id:message_id");
    expect(calls[0].select).toContain("body_html");
    expect(calls[0].eq).toEqual({ column: "channel", value: "email" });
    expect(calls[0].or).toBe("from_address.ilike.%a@b.com%,to_address.ilike.%a@b.com%");
    expect(calls[0].order).toEqual({ column: "email_date", ascending: false });
    expect(calls[0].limit).toBe(20);
  });

  it("view Err → fallback trasparente su channel_messages (stessi filtri/ordine/limit)", async () => {
    viewError = { message: "boom" };
    legacyRows = [{
      id: "l1", subject: null, email_date: null, direction: "outbound",
      channel: "email", from_address: "a@b.com", to_address: null,
      body_text: null, body_html: null,
    }];
    const r = await fetchSenderConversation("a@b.com");
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") expect(r.value).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(calls[0].table).toBe("message_intelligence_v");
    expect(calls[1].table).toBe("channel_messages");
    expect(calls[1].eq).toEqual({ column: "channel", value: "email" });
    expect(calls[1].or).toBe("from_address.ilike.%a@b.com%,to_address.ilike.%a@b.com%");
    expect(calls[1].order).toEqual({ column: "email_date", ascending: false });
    expect(calls[1].limit).toBe(20);
  });

  it("view Err + legacy Err → propaga Err", async () => {
    viewError = { message: "view down" };
    legacyError = { message: "legacy down" };
    const r = await fetchSenderConversation("a@b.com");
    expect(r._tag).toBe("Err");
    expect(calls).toHaveLength(2);
  });
});