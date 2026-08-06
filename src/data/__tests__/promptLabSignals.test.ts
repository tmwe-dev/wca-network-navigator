/**
 * Regressione: `supervisor_audit_log` non ha una colonna `action`.
 * Le query devono usare `action_category` / `action_detail`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Call {
  table: string;
  method: string;
  args: unknown[];
}
const calls: Call[] = [];

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ table, method, args });
      return builder;
    };
  for (const m of ["select", "gte", "lt", "or", "eq", "contains", "order", "limit"]) {
    builder[m] = record(m);
  }
  // Termina la catena come thenable con risultato vuoto.
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], count: 0, error: null });
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

describe("DAL — promptLabSignals", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("non referenzia mai la colonna inesistente `action`", async () => {
    const mod = await import("@/data/promptLabSignals");
    await mod.analyzeAndGenerateSignals("user-1");
    await mod.getRecentSignalCount("user-1");
    const auditCalls = calls.filter((c) => c.table === "supervisor_audit_log");
    expect(auditCalls.length).toBeGreaterThan(0);
    for (const c of auditCalls) {
      for (const arg of c.args) {
        if (typeof arg !== "string") continue;
        expect(arg).not.toMatch(/(^|[\s,(])action(\.|\s*$|,)/);
      }
    }
  });

  it("usa le categorie reali per email generate e inviate", async () => {
    const mod = await import("@/data/promptLabSignals");
    expect(mod.EMAIL_GENERATED_CATEGORY).toBe("email_drafted");
    expect(mod.EMAIL_SENT_CATEGORY).toBe("email_sent");
    expect(mod.ERROR_ACTION_FILTER).toContain("action_category.ilike");
    expect(mod.ERROR_ACTION_FILTER).toContain("action_detail.ilike");
    await mod.analyzeAndGenerateSignals("user-1");
    const eqCols = calls.filter((c) => c.method === "eq" && c.table === "supervisor_audit_log").map((c) => c.args[0]);
    expect(eqCols.every((c) => c === "action_category")).toBe(true);
  });

  it("legge action_payload (non `payload`) da ai_pending_actions", async () => {
    const mod = await import("@/data/promptLabSignals");
    await mod.analyzeAndGenerateSignals("user-1");
    const sel = calls.find((c) => c.table === "ai_pending_actions" && c.method === "select");
    expect(String(sel?.args[0])).toContain("action_payload");
  });
});
