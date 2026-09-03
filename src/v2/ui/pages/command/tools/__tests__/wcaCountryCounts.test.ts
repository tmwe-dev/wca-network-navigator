import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: vi.fn(),
}));

import { invokeEdge } from "@/lib/api/invokeEdge";
import { wcaCountryCountsTool } from "../wcaCountryCounts";

describe("wcaCountryCountsTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("match: riconosce prompt su conteggi/distribuzione per paese", () => {
    expect(wcaCountryCountsTool.match("quanti partner per paese")).toBe(true);
    expect(wcaCountryCountsTool.match("dammi la distribuzione partner per country")).toBe(true);
  });

  it("match: non riconosce prompt scorrelati", () => {
    expect(wcaCountryCountsTool.match("elenco partner Malta")).toBe(false);
  });

  it("execute: happy path costruisce la tabella dei conteggi", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({
      counts: [{ country: "Malta", total: 10, active: 5, new_30d: 2 }],
    } as any);
    const res = await wcaCountryCountsTool.execute("conteggi partner per paese", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows[0].country).toBe("Malta");
  });

  it("execute: nessun dato ritorna result senza throw", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({ counts: [] } as any);
    const res = await wcaCountryCountsTool.execute("conteggi partner per paese", undefined);
    expect(res.kind).toBe("result");
    if (res.kind !== "result") throw new Error("expected result");
    expect(res.message).toBe("Nessun dato disponibile.");
  });

  it("execute: risposta undefined non lancia", async () => {
    vi.mocked(invokeEdge).mockResolvedValue(undefined as any);
    const res = await wcaCountryCountsTool.execute("conteggi partner per paese", undefined);
    expect(res.kind).toBe("result");
  });
});
