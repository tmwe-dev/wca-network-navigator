import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/data/activities", () => ({
  findOpenAgendaActivities: vi.fn(),
}));

import { findOpenAgendaActivities } from "@/data/activities";
import { listAgendaTool } from "../listAgenda";

describe("listAgendaTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("match: riconosce prompt su agenda/scadenze", () => {
    expect(listAgendaTool.match("cosa devo fare oggi?")).toBe(true);
    expect(listAgendaTool.match("mostra la mia agenda")).toBe(true);
  });

  it("match: non riconosce prompt scorrelati", () => {
    expect(listAgendaTool.match("stato campagne")).toBe(false);
  });

  it("execute: happy path con attività aperte", async () => {
    vi.mocked(findOpenAgendaActivities).mockResolvedValue({
      rows: [
        { id: "1", title: "Chiama Mario", description: null, due_date: "2024-01-01T09:00:00Z", status: "pending", priority: "high" },
      ],
      count: 1,
    });
    const res = await listAgendaTool.execute("agenda", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows[0].title).toBe("Chiama Mario");
    expect(res.selectable).toBe(true);
  });

  it("execute: agenda vuota ritorna result empty", async () => {
    vi.mocked(findOpenAgendaActivities).mockResolvedValue({ rows: [], count: 0 });
    const res = await listAgendaTool.execute("agenda", undefined);
    expect(res.kind).toBe("result");
    if (res.kind !== "result") throw new Error("expected result");
    expect(res.status).toBe("empty");
  });

  it("execute: errore DB gestito senza throw", async () => {
    vi.mocked(findOpenAgendaActivities).mockRejectedValue(new Error("timeout"));
    const res = await listAgendaTool.execute("agenda", undefined);
    expect(res.kind).toBe("result");
    if (res.kind !== "result") throw new Error("expected result");
    expect(res.status).toBe("error");
  });
});
