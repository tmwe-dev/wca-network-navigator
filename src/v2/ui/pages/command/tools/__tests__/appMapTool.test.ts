import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertMock = vi.fn();

vi.mock("@/data/appMapKb", () => ({
  upsertAppMapKbEntry: (...args: unknown[]) => upsertMock(...args),
  APP_MAP_TITLE: "Mappa Applicazione (pagine, campi, funzioni)",
}));

import { appMapTool } from "../appMapTool";

describe("appMapTool", () => {
  beforeEach(() => {
    upsertMock.mockReset();
  });

  describe("match", () => {
    it.each([
      "mappa del software",
      "mappa applicazione",
      "struttura del software",
      "elenco delle pagine",
      "quali pagine ci sono",
    ])("riconosce: %s", (p) => {
      expect(appMapTool.match(p)).toBe(true);
    });

    it.each(["vai al cockpit", "quanti partner abbiamo", "invia una mail"])("NON riconosce: %s", (p) => {
      expect(appMapTool.match(p)).toBe(false);
    });
  });

  describe("execute", () => {
    it("sincronizza KB con successo (created) e produce report", async () => {
      upsertMock.mockResolvedValue("created");
      const res = await appMapTool.execute("mappa del software");
      expect(res.kind).toBe("report");
      expect(upsertMock).toHaveBeenCalledTimes(1);
      if (res.kind === "report") {
        expect(res.sections[0].heading).toBe("Sincronizzazione KB");
        expect(res.sections[0].body).toContain("creata");
        expect(res.meta?.count).toBeGreaterThan(0);
      }
    });

    it("sincronizza KB con successo (updated)", async () => {
      upsertMock.mockResolvedValue("updated");
      const res = await appMapTool.execute("mappa applicazione");
      if (res.kind === "report") {
        expect(res.sections[0].body).toContain("aggiornata");
      }
    });

    it("gestisce errore di sincronizzazione KB senza far fallire il tool", async () => {
      upsertMock.mockRejectedValue(new Error("network down"));
      const res = await appMapTool.execute("mappa del software");
      expect(res.kind).toBe("report");
      if (res.kind === "report") {
        expect(res.sections[0].body).toContain("non riuscita");
        expect(res.sections[0].body).toContain("network down");
      }
    });
  });
});
