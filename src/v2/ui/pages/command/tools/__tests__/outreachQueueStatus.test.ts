import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "@/v2/core/domain/result";

vi.mock("@/v2/io/supabase/queries/outreach-queue", () => ({
  fetchOutreachQueue: vi.fn(),
}));

import { fetchOutreachQueue } from "@/v2/io/supabase/queries/outreach-queue";
import { outreachQueueStatusTool } from "../outreachQueueStatus";

describe("outreachQueueStatusTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("match: riconosce prompt sulla coda outreach", () => {
    expect(outreachQueueStatusTool.match("mostrami la coda outreach")).toBe(true);
    expect(outreachQueueStatusTool.match("cosa è in attesa?")).toBe(true);
  });

  it("match: esclude prompt su campagne/email/componi", () => {
    expect(outreachQueueStatusTool.match("stato campagne outreach")).toBe(false);
    expect(outreachQueueStatusTool.match("componi una email")).toBe(false);
  });

  it("execute: happy path con righe mappate", async () => {
    vi.mocked(fetchOutreachQueue).mockResolvedValue(
      ok([
        { position: 1, recipientName: "Mario Rossi", recipientEmail: "m@x.it", status: "pending", subject: "Ciao" } as any,
      ]),
    );
    const res = await outreachQueueStatusTool.execute("coda outreach", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows).toEqual([
      { position: 1, contactName: "Mario Rossi", status: "pending", subject: "Ciao" },
    ]);
  });

  it("execute: su errore ritorna tabella vuota senza throw", async () => {
    vi.mocked(fetchOutreachQueue).mockResolvedValue(err({ code: "DATABASE_ERROR", message: "boom" } as any));
    const res = await outreachQueueStatusTool.execute("coda outreach", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows).toEqual([]);
    expect(res.meta?.count).toBe(0);
  });
});
