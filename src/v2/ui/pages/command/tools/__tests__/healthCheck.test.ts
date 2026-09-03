import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: vi.fn(),
}));

import { invokeEdge } from "@/lib/api/invokeEdge";
import { healthCheckTool } from "../healthCheck";

describe("healthCheckTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("match: riconosce prompt su health check/diagnostica", () => {
    expect(healthCheckTool.match("fai un health check")).toBe(true);
    expect(healthCheckTool.match("è tutto ok?")).toBe(true);
  });

  it("match: non riconosce prompt scorrelati (dashboard generica)", () => {
    expect(healthCheckTool.match("mostrami la dashboard")).toBe(false);
  });

  it("execute: happy path costruisce le sezioni dallo stato e dai componenti", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({
      status: "ok",
      components: { db: { status: "ok" }, email: { status: "warning", detail: "quota bassa" } },
    } as any);
    const res = await healthCheckTool.execute("health check", undefined);
    expect(res.kind).toBe("report");
    if (res.kind !== "report") throw new Error("expected report");
    expect(res.sections[0].body).toBe("ok");
    expect(res.sections[1].body).toContain("email: warning — quota bassa");
  });

  it("execute: risposta con errore aggiunge sezione errore senza throw", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({ error: "edge non raggiungibile" } as any);
    const res = await healthCheckTool.execute("health check", undefined);
    expect(res.kind).toBe("report");
    if (res.kind !== "report") throw new Error("expected report");
    expect(res.sections.some((s) => s.heading === "Errore" && s.body === "edge non raggiungibile")).toBe(true);
  });

  it("execute: risposta nulla non lancia (fallback '—')", async () => {
    vi.mocked(invokeEdge).mockResolvedValue(undefined as any);
    const res = await healthCheckTool.execute("health check", undefined);
    expect(res.kind).toBe("report");
    if (res.kind !== "report") throw new Error("expected report");
    expect(res.sections[0].body).toBe("—");
  });
});
