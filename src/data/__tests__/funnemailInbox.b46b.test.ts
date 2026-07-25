import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = {
  table: string;
  select?: string;
  eqs: Array<{ column: string; value: unknown }>;
  ins: Array<{ column: string; values: unknown[] }>;
  is?: { column: string; value: unknown };
  orders: Array<{ column: string; opts?: Record<string, unknown> }>;
  range?: { from: number; to: number };
  update?: unknown;
};

let calls: Call[] = [];
/** Per-table stub: rows + optional error. */
const tableStub: Record<string, { rows: unknown[]; error: { message: string; code?: string } | null }> = {};

function setTable(name: string, rows: unknown[] = [], error: { message: string; code?: string } | null = null) {
  tableStub[name] = { rows, error };
}

function makeBuilder(table: string) {
  const call: Call = { table, eqs: [], ins: [], orders: [] };
  calls.push(call);
  const stub = tableStub[table] ?? { rows: [], error: null };
  const result = { data: stub.error ? null : stub.rows, error: stub.error };
  const b: Record<string, unknown> = {};
  b.select = (cols: string) => { call.select = cols; return b; };
  b.eq = (col: string, val: unknown) => { call.eqs.push({ column: col, value: val }); return b; };
  b.in = (col: string, values: unknown[]) => { call.ins.push({ column: col, values }); return b; };
  b.is = (col: string, val: unknown) => { call.is = { column: col, value: val }; return b; };
  b.order = (col: string, opts?: Record<string, unknown>) => { call.orders.push({ column: col, opts }); return b; };
  b.range = (from: number, to: number) => { call.range = { from, to }; return b; };
  b.update = (payload: unknown) => { call.update = payload; return b; };
  b.limit = () => b;
  b.maybeSingle = () => Promise.resolve({ data: (stub.rows[0] as unknown) ?? null, error: stub.error });
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));
vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (table: string) => makeBuilder(table),
}));
vi.mock("@/lib/log", () => ({
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { listMailsByFolder, markFunnemailMessagesRead } from "@/data/funnemailInbox";

describe("B4.6b — funnemailInbox migration to message_intelligence_v", () => {
  beforeEach(() => {
    calls = [];
    for (const k of Object.keys(tableStub)) delete tableStub[k];
  });

  it("listMailsByFolder: primaria = view; nessuna chiamata a channel_messages su OK", async () => {
    setTable("funnemail_decisions", [
      { id: "d1", message_id: "ext-1", folder_slug: "rfq", from_address: "a@x.io", partner_id: null, created_at: "2026-01-01T00:00:00Z" },
    ]);
    setTable("message_intelligence_v", [
      { message_id_external: "ext-1", subject: "Ciao", from_address: "a@x.io", body_text: "hi", body_html: null, email_date: "2026-01-01T00:00:00Z", partner_id: null },
    ]);
    const out = await listMailsByFolder("rfq", 10);
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe("Ciao");
    const tables = calls.map((c) => c.table);
    expect(tables).toContain("message_intelligence_v");
    expect(tables).not.toContain("channel_messages");
    const viewCall = calls.find((c) => c.table === "message_intelligence_v")!;
    expect(viewCall.eqs).toEqual([
      { column: "channel", value: "email" },
      { column: "direction", value: "inbound" },
    ]);
    expect(viewCall.ins).toEqual([{ column: "message_id_external", values: ["ext-1"] }]);
  });

  it("listMailsByFolder: view Err → fallback trasparente su channel_messages con stessi filtri", async () => {
    setTable("funnemail_decisions", [
      { id: "d1", message_id: "ext-1", folder_slug: "rfq", from_address: "a@x.io", partner_id: null, created_at: "2026-01-01T00:00:00Z" },
    ]);
    setTable("message_intelligence_v", [], { message: "view down", code: "42P01" });
    setTable("channel_messages", [
      { message_id_external: "ext-1", subject: "FromLegacy", from_address: "a@x.io", body_text: null, body_html: null, email_date: null, partner_id: null },
    ]);
    const out = await listMailsByFolder("rfq", 10);
    expect(out[0].subject).toBe("FromLegacy");
    const tables = calls.map((c) => c.table);
    expect(tables.filter((t) => t === "message_intelligence_v")).toHaveLength(1);
    expect(tables.filter((t) => t === "channel_messages")).toHaveLength(1);
    const legacyCall = calls.find((c) => c.table === "channel_messages")!;
    expect(legacyCall.eqs).toEqual([
      { column: "channel", value: "email" },
      { column: "direction", value: "inbound" },
    ]);
    expect(legacyCall.ins).toEqual([{ column: "message_id_external", values: ["ext-1"] }]);
  });

  it("listMailsByFolder: view Err + legacy Err → propaga throw", async () => {
    setTable("funnemail_decisions", [
      { id: "d1", message_id: "ext-1", folder_slug: "rfq", from_address: null, partner_id: null, created_at: "2026-01-01T00:00:00Z" },
    ]);
    setTable("message_intelligence_v", [], { message: "view down" });
    setTable("channel_messages", [], { message: "legacy down" });
    await expect(listMailsByFolder("rfq", 10)).rejects.toBeDefined();
  });

  it("markFunnemailMessagesRead: SCRITTURA rimane su channel_messages, MAI su view", async () => {
    await markFunnemailMessagesRead(["m1", "m2"]);
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("channel_messages");
    expect(calls[0].update).toEqual({ read_at: expect.any(String) });
    expect(calls[0].ins).toEqual([{ column: "id", values: ["m1", "m2"] }]);
    // Non deve MAI toccare la view.
    expect(calls.some((c) => c.table === "message_intelligence_v")).toBe(false);
  });

  it("markFunnemailMessagesRead: no-op su lista vuota", async () => {
    await markFunnemailMessagesRead([]);
    expect(calls).toEqual([]);
  });
});