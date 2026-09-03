import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/data/agentMissions", () => ({
  findAgentMissionsOverview: vi.fn(),
}));

import { findAgentMissionsOverview } from "@/data/agentMissions";
import { listMissionsTool } from "../listMissions";

describe("listMissionsTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("match: riconosce prompt su missioni/autopilot", () => {
    expect(listMissionsTool.match("elenco missioni")).toBe(true);
    expect(listMissionsTool.match("stato delle missioni autopilot")).toBe(true);
  });

  it("match: esclude prompt di comando (avvia/ferma)", () => {
    expect(listMissionsTool.match("avvia la missione Malta")).toBe(false);
    expect(listMissionsTool.match("ferma la missione X")).toBe(false);
  });

  it("execute: happy path con missioni", async () => {
    vi.mocked(findAgentMissionsOverview).mockResolvedValue({
      rows: [
        {
          id: "1",
          title: "Espansione Malta",
          goal_type: "leads",
          status: "running",
          autopilot: true,
          kpi_target: 100,
          kpi_current: 40,
          budget: 1000,
          budget_consumed: 200,
        },
      ],
      count: 1,
    });
    const res = await listMissionsTool.execute("missioni", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows[0].title).toBe("Espansione Malta");
    expect(res.rows[0].autopilot).toBe("on");
  });

  it("execute: nessuna missione ritorna result empty", async () => {
    vi.mocked(findAgentMissionsOverview).mockResolvedValue({ rows: [], count: 0 });
    const res = await listMissionsTool.execute("missioni", undefined);
    expect(res.kind).toBe("result");
    if (res.kind !== "result") throw new Error("expected result");
    expect(res.status).toBe("empty");
  });

  it("execute: errore DB gestito senza throw", async () => {
    vi.mocked(findAgentMissionsOverview).mockRejectedValue(new Error("conn refused"));
    const res = await listMissionsTool.execute("missioni", undefined);
    expect(res.kind).toBe("result");
    if (res.kind !== "result") throw new Error("expected result");
    expect(res.status).toBe("error");
  });
});
