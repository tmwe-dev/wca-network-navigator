import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
let viewRows: Row[] = [];
let viewError: { message: string } | null = null;
let legacyRows: Row[] = [];
let legacyError: { message: string } | null = null;
let lastFromTable = "";
let lastLimit = 0;
let lastOrder: { column: string; ascending: boolean } | null = null;
let lastEq: { column: string; value: unknown } | null = null;
let lastOr: string | null = null;
let lastSelect = "";

function buildBuilder(rows: Row[], error: { message: string } | null) {
  const builder: Record<string, unknown> = {};
  builder.select = (cols: string) => { lastSelect = cols; return builder; };
  builder.order = (col: string, opts: { ascending: boolean }) => { lastOrder = { column: col, ascending: opts.ascending }; return builder; };
  builder.eq = (col: string, val: unknown) => { lastEq = { column: col, value: val }; return builder; };
  builder.or = (expr: string) => { lastOr = expr; return builder; };
  builder.limit = (n: number) => { lastLimit = n; return builder; };
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: error ? null : rows, error });
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      lastFromTable = table;
      if (table === "message_intelligence_v") return buildBuilder(viewRows, viewError);
      return buildBuilder(legacyRows, legacyError);
    },
  },
}));

import {
  fetchRecipientHistoryFromView,
  fetchRecipientHistory,
} from "../channel-messages";

describe("fetchRecipientHistoryFromView (B4.2)", () => {
  beforeEach(() => {
    viewRows = []; viewError = null; legacyRows = []; legacyError = null;
    lastFromTable = ""; lastLimit = 0; lastOrder = null; lastEq = null; lastOr = null; lastSelect = "";
  });

  it("no filtri → ritorna array vuoto senza query", async () => {
    const r = await fetchRecipientHistoryFromView({});
    expect(r._tag).toBe("Ok");
    expect(lastFromTable).toBe("");
  });

  it("con partnerId: legge dalla view canonica con eq partner_id, order desc, limit 10 default", async () => {
    viewRows = [{ id: "m1", channel: "email", direction: "inbound", subject: "S", body_text: null, from_address: null, email_date: null, created_at: "2026-07-20T00:00:00Z" }];
    const r = await fetchRecipientHistoryFromView({ partnerId: "p-1" });
    expect(lastFromTable).toBe("message_intelligence_v");
    expect(lastLimit).toBe(10);
    expect(lastOrder).toEqual({ column: "message_created_at", ascending: false });
    expect(lastEq).toEqual({ column: "partner_id", value: "p-1" });
    expect(lastOr).toBeNull();
    expect(lastSelect).toContain("id:message_id");
    expect(lastSelect).toContain("created_at:message_created_at");
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") expect(r.value).toHaveLength(1);
  });

  it("con email (senza partnerId): OR ILIKE su from_address/to_address", async () => {
    viewRows = [];
    await fetchRecipientHistoryFromView({ email: "a@b.com", limit: 25 });
    expect(lastFromTable).toBe("message_intelligence_v");
    expect(lastEq).toBeNull();
    expect(lastOr).toBe("from_address.ilike.a@b.com,to_address.ilike.a@b.com");
    expect(lastLimit).toBe(25);
  });

  it("partnerId ha precedenza su email (come nel consumer legacy)", async () => {
    await fetchRecipientHistoryFromView({ partnerId: "p-1", email: "a@b.com" });
    expect(lastEq).toEqual({ column: "partner_id", value: "p-1" });
    expect(lastOr).toBeNull();
  });

  it("view Err → il chiamante può fare fallback", async () => {
    viewError = { message: "boom" };
    const r = await fetchRecipientHistoryFromView({ partnerId: "p-1" });
    expect(r._tag).toBe("Err");
  });
});

describe("fetchRecipientHistory (legacy fallback)", () => {
  beforeEach(() => {
    viewRows = []; viewError = null; legacyRows = []; legacyError = null;
    lastFromTable = ""; lastLimit = 0; lastOrder = null; lastEq = null; lastOr = null; lastSelect = "";
  });

  it("legge da channel_messages con ordine created_at desc e limit 10", async () => {
    legacyRows = [{ id: "l1", channel: "email", direction: "outbound", subject: null, body_text: null, from_address: null, email_date: null, created_at: "2026-07-20T00:00:00Z" }];
    const r = await fetchRecipientHistory({ partnerId: "p-1" });
    expect(lastFromTable).toBe("channel_messages");
    expect(lastOrder).toEqual({ column: "created_at", ascending: false });
    expect(lastLimit).toBe(10);
    expect(r._tag).toBe("Ok");
  });
});