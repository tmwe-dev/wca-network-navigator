import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "@/v2/core/domain/result";

vi.mock("@/v2/io/supabase/queries/dashboard", () => ({
  fetchDashboardCounts: vi.fn(),
}));

import { fetchDashboardCounts } from "@/v2/io/supabase/queries/dashboard";
import { dashboardSnapshotTool } from "../dashboardSnapshot";

describe("dashboardSnapshotTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("match: riconosce prompt su dashboard/panoramica", () => {
    expect(dashboardSnapshotTool.match("mostrami la dashboard")).toBe(true);
    expect(dashboardSnapshotTool.match("dammi un riepilogo generale")).toBe(true);
    expect(dashboardSnapshotTool.match("qual è lo stato del sistema?")).toBe(true);
  });

  it("match: esclude prompt di health check/diagnostica", () => {
    expect(dashboardSnapshotTool.match("fai un health check")).toBe(false);
    expect(dashboardSnapshotTool.match("esegui una diagnostica")).toBe(false);
  });

  it("match: non riconosce prompt scorrelati", () => {
    expect(dashboardSnapshotTool.match("che tempo fa oggi")).toBe(false);
  });

  it("execute: happy path popola la tabella con i conteggi", async () => {
    vi.mocked(fetchDashboardCounts).mockResolvedValue(
      ok({ partners: 10, contacts: 20, pendingActivities: 3, activeAgents: 2, campaignJobs: 1, emailDrafts: 4 }),
    );
    const res = await dashboardSnapshotTool.execute("dashboard", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows).toHaveLength(6);
    expect(res.rows.find((r) => r.metric === "Partner WCA")?.value).toBe(10);
  });

  it("execute: su errore ritorna comunque zeri senza throw", async () => {
    vi.mocked(fetchDashboardCounts).mockResolvedValue(err({ code: "DATABASE_ERROR", message: "boom" } as any));
    const res = await dashboardSnapshotTool.execute("dashboard", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows.find((r) => r.metric === "Partner WCA")?.value).toBe(0);
  });
});
