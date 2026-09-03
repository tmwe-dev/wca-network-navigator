import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "@/v2/core/domain/result";

vi.mock("@/v2/io/supabase/queries/agents", () => ({
  fetchAgents: vi.fn(),
}));
vi.mock("@/v2/io/supabase/queries/activities", () => ({
  fetchActivities: vi.fn(),
}));

import { fetchAgents } from "@/v2/io/supabase/queries/agents";
import { fetchActivities } from "@/v2/io/supabase/queries/activities";
import { agentReportTool } from "../agentReport";

describe("agentReportTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("match: riconosce prompt su report/performance agenti", () => {
    expect(agentReportTool.match("dammi il report settimanale degli agenti")).toBe(true);
    expect(agentReportTool.match("performance agent")).toBe(true);
  });

  it("match: non riconosce prompt scorrelati", () => {
    expect(agentReportTool.match("elenco partner")).toBe(false);
  });

  it("execute: happy path aggrega attività per agente", async () => {
    vi.mocked(fetchAgents).mockResolvedValue(ok([{ id: "a1", name: "Agente Bot" } as any]));
    vi.mocked(fetchActivities).mockResolvedValue(
      ok([
        { id: "1", executedByAgentId: "a1", title: "Invio email", status: "completed", createdAt: new Date().toISOString() } as any,
      ]),
    );
    const res = await agentReportTool.execute("report agenti", undefined);
    expect(res.kind).toBe("timeline");
    if (res.kind !== "timeline") throw new Error("expected timeline");
    expect(res.events).toHaveLength(1);
    expect(res.events[0].agent).toBe("Agente Bot");
    expect(res.kpis.find((k) => k.label === "Attività totali")?.value).toBe("1");
  });

  it("execute: attività senza agente assegnato mostra 'Manuale'", async () => {
    vi.mocked(fetchAgents).mockResolvedValue(ok([]));
    vi.mocked(fetchActivities).mockResolvedValue(
      ok([{ id: "1", executedByAgentId: null, title: "Task manuale", status: "pending", createdAt: new Date().toISOString() } as any]),
    );
    const res = await agentReportTool.execute("report agenti", undefined);
    expect(res.kind).toBe("timeline");
    if (res.kind !== "timeline") throw new Error("expected timeline");
    expect(res.events[0].agent).toBe("Manuale");
  });

  it("execute: errore su fetchAgents ritorna ToolResult di errore", async () => {
    vi.mocked(fetchAgents).mockResolvedValue(err({ code: "DATABASE_ERROR", message: "agents down" } as any));
    const res = await agentReportTool.execute("report agenti", undefined);
    expect(res.kind).toBe("result");
    if (res.kind !== "result") throw new Error("expected result");
    expect(res.status).toBe("error");
    expect(res.message).toContain("agents down");
  });

  it("execute: errore su fetchActivities ritorna ToolResult di errore", async () => {
    vi.mocked(fetchAgents).mockResolvedValue(ok([]));
    vi.mocked(fetchActivities).mockResolvedValue(err({ code: "DATABASE_ERROR", message: "activities down" } as any));
    const res = await agentReportTool.execute("report agenti", undefined);
    expect(res.kind).toBe("result");
    if (res.kind !== "result") throw new Error("expected result");
    expect(res.status).toBe("error");
    expect(res.message).toContain("activities down");
  });
});
