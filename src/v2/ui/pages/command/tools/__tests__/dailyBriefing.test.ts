import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/invokeAi", () => ({
  invokeAi: vi.fn(),
}));

import { invokeAi } from "@/lib/ai/invokeAi";
import { dailyBriefingTool } from "../dailyBriefing";

describe("dailyBriefingTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("match: riconosce prompt su briefing/agenda oggi", () => {
    expect(dailyBriefingTool.match("dammi il briefing di oggi")).toBe(true);
    expect(dailyBriefingTool.match("cosa devo fare oggi?")).toBe(true);
  });

  it("match: non riconosce prompt scorrelati", () => {
    expect(dailyBriefingTool.match("elenco partner Malta")).toBe(false);
  });

  it("execute: happy path costruisce le sezioni dal payload edge", async () => {
    vi.mocked(invokeAi).mockResolvedValue({
      summary: "Tutto ok",
      highlights: ["cosa 1", "cosa 2"],
      kpi: { partner: 5 },
    } as any);
    const res = await dailyBriefingTool.execute("briefing", undefined);
    expect(res.kind).toBe("report");
    if (res.kind !== "report") throw new Error("expected report");
    expect(res.sections.length).toBeGreaterThanOrEqual(3);
    expect(res.sections[0].heading).toBe("Sintesi");
  });

  it("execute: risposta con errore non lancia e ritorna result di errore", async () => {
    vi.mocked(invokeAi).mockResolvedValue({ error: "servizio non disponibile" } as any);
    const res = await dailyBriefingTool.execute("briefing", undefined);
    expect(res.kind).toBe("result");
    if (res.kind !== "result") throw new Error("expected result");
    expect(res.message).toContain("servizio non disponibile");
  });

  it("execute: risposta nulla non lancia", async () => {
    vi.mocked(invokeAi).mockResolvedValue(undefined as any);
    const res = await dailyBriefingTool.execute("briefing", undefined);
    expect(res.kind).toBe("result");
  });
});
