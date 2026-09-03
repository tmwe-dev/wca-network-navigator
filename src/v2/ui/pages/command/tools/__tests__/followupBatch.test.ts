import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "@/v2/core/domain/result";

vi.mock("@/v2/io/supabase/queries/contacts", () => ({
  fetchContacts: vi.fn(),
}));

import { fetchContacts } from "@/v2/io/supabase/queries/contacts";
import { followupBatchTool } from "../followupBatch";

describe("followupBatchTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("match: riconosce prompt su follow-up/clienti inattivi", () => {
    expect(followupBatchTool.match("prepara un batch di follow-up per i clienti inattivi")).toBe(true);
    expect(followupBatchTool.match("clienti da ricontattare")).toBe(true);
  });

  it("match: esclude prompt su partner senza follow/inattiv", () => {
    expect(followupBatchTool.match("mostra i partner attivi")).toBe(false);
  });

  it("match: non riconosce prompt scorrelati", () => {
    expect(followupBatchTool.match("che tempo fa")).toBe(false);
  });

  it("execute: happy path filtra contatti inattivi >30gg", async () => {
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date().toISOString();
    vi.mocked(fetchContacts).mockResolvedValue(
      ok([
        { id: "1", name: "Mario Rossi", companyName: "ACME", email: "m@x.it", country: "IT", leadStatus: "new", lastInteractionAt: old, createdAt: old } as any,
        { id: "2", name: "Luigi Verdi", companyName: "Beta", email: "l@x.it", country: "IT", leadStatus: "new", lastInteractionAt: recent, createdAt: recent } as any,
      ]),
    );
    const res = await followupBatchTool.execute("clienti inattivi da ricontattare", undefined);
    expect(res.kind).toBe("card-grid");
    if (res.kind !== "card-grid") throw new Error("expected card-grid");
    expect(res.cards).toHaveLength(1);
    expect(res.cards[0].title).toBe("Mario Rossi");
  });

  it("execute: nessun contatto ritorna card-grid vuoto senza throw", async () => {
    vi.mocked(fetchContacts).mockResolvedValue(ok([]));
    const res = await followupBatchTool.execute("clienti inattivi", undefined);
    expect(res.kind).toBe("card-grid");
    if (res.kind !== "card-grid") throw new Error("expected card-grid");
    expect(res.cards).toHaveLength(0);
  });

  it("execute: errore DAL viene propagato come throw esplicito (non silenzioso)", async () => {
    vi.mocked(fetchContacts).mockResolvedValue(err({ code: "DATABASE_ERROR", message: "boom" } as any));
    await expect(followupBatchTool.execute("clienti inattivi", undefined)).rejects.toThrow("boom");
  });
});
