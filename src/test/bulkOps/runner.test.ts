import { describe, it, expect, vi, beforeEach } from "vitest";

const created: Array<Record<string, unknown>> = [];
const updated: Array<Record<string, unknown>> = [];
const events: Array<Record<string, unknown>> = [];

vi.mock("@/data/bulkJobs", () => ({
  createBulkJob: vi.fn(async (input: Record<string, unknown>) => {
    const row = { id: "job-1", ...input };
    created.push(row);
    return row;
  }),
  updateBulkJob: vi.fn(async (id: string, patch: Record<string, unknown>) => {
    updated.push({ id, ...patch });
  }),
  appendBulkJobEvent: vi.fn(async (jobId: string, ev: string, payload: Record<string, unknown>) => {
    events.push({ jobId, ev, payload });
  }),
  getBulkJob: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: "user-1" } } } }) } },
}));

vi.mock("@/v2/services/bulkOps/registry", () => ({
  getEntry: () => ({
    scope: "enrich.base",
    itemId: (i: { id: string }) => i.id,
    continueOnError: true,
    handler: async (i: { id: string }) => {
      if (i.id === "fail") throw new Error("boom");
      return { ok: true };
    },
  }),
  listScopes: () => ["enrich.base"],
}));

import { runBulkOp } from "@/v2/services/bulkOps/runner";

describe("bulkOps — runner", () => {
  beforeEach(() => { created.length = 0; updated.length = 0; events.length = 0; });

  it("crea il job, esegue gli item, marca completato", async () => {
    const r = await runBulkOp("enrich.base" as never, [{ id: "a" }, { id: "b" }]);
    expect(r.successCount).toBe(2);
    expect(r.errorCount).toBe(0);
    expect(created.length).toBe(1);
    expect(events.find((e) => e.ev === "job_started")).toBeTruthy();
    expect(events.find((e) => e.ev === "job_completed")).toBeTruthy();
    expect(updated[updated.length - 1].status).toBe("completed");
  });

  it("conta errori e marca completed_with_errors", async () => {
    const r = await runBulkOp("enrich.base" as never, [{ id: "a" }, { id: "fail" }]);
    expect(r.successCount).toBe(1);
    expect(r.errorCount).toBe(1);
    expect(updated[updated.length - 1].status).toBe("completed_with_errors");
  });
});