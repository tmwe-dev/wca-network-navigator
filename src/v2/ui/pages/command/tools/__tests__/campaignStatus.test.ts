import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "@/v2/core/domain/result";

vi.mock("@/v2/io/supabase/queries/campaigns", () => ({
  fetchCampaignJobs: vi.fn(),
}));

import { fetchCampaignJobs } from "@/v2/io/supabase/queries/campaigns";
import { campaignStatusTool } from "../campaignStatus";

describe("campaignStatusTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("match: riconosce prompt su campagne/flusso", () => {
    expect(campaignStatusTool.match("stato delle campagne attive")).toBe(true);
    expect(campaignStatusTool.match("lancia una campagna")).toBe(true);
  });

  it("match: non riconosce prompt scorrelati", () => {
    expect(campaignStatusTool.match("elenco missioni")).toBe(false);
  });

  it("execute: happy path raggruppa job per batch", async () => {
    vi.mocked(fetchCampaignJobs).mockResolvedValue(
      ok([
        { batchId: "batch-1234-5678", status: "completed", countryName: "Malta", jobType: "email" } as any,
        { batchId: "batch-1234-5678", status: "pending", countryName: "Malta", jobType: "email" } as any,
      ]),
    );
    const res = await campaignStatusTool.execute("stato campagne", undefined);
    expect(res.kind).toBe("flow");
    if (res.kind !== "flow") throw new Error("expected flow");
    expect(res.nodes.length).toBeGreaterThan(0);
    expect(res.title).toContain("1 batch");
  });

  it("execute: nessun job ritorna nodo 'Nessuna campagna trovata'", async () => {
    vi.mocked(fetchCampaignJobs).mockResolvedValue(ok([]));
    const res = await campaignStatusTool.execute("stato campagne", undefined);
    expect(res.kind).toBe("flow");
    if (res.kind !== "flow") throw new Error("expected flow");
    expect(res.nodes[0].label).toBe("Nessuna campagna trovata");
  });

  it("execute: errore DAL propaga throw esplicito", async () => {
    vi.mocked(fetchCampaignJobs).mockResolvedValue(err({ code: "DATABASE_ERROR", message: "jobs down" } as any));
    await expect(campaignStatusTool.execute("stato campagne", undefined)).rejects.toThrow("jobs down");
  });
});
