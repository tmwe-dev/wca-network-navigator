import { describe, it, expect, vi, beforeEach } from "vitest";

const findDestinationsMock = vi.fn();
const navigateToPathMock = vi.fn();

vi.mock("@/v2/search/appMap", () => ({
  findDestinations: (...args: unknown[]) => findDestinationsMock(...args),
}));
vi.mock("@/v2/navigation/navBridge", () => ({
  navigateToPath: (...args: unknown[]) => navigateToPathMock(...args),
}));

import { navigateToTool } from "../navigateTo";

describe("navigateToTool", () => {
  beforeEach(() => {
    findDestinationsMock.mockReset();
    navigateToPathMock.mockReset();
  });

  describe("match", () => {
    it.each([
      "vai al cockpit",
      "apri la pagina blacklist",
      "portami alla dashboard",
      "dove trovo i biglietti da visita",
      "come ci arrivo alla firma",
      "naviga verso la kb",
    ])("riconosce: %s", (p) => {
      expect(navigateToTool.match(p)).toBe(true);
    });

    it.each(["mostrami i partner di Malta", "quanti contatti abbiamo", "invia una mail a Mario"])(
      "NON riconosce: %s",
      (p) => {
        expect(navigateToTool.match(p)).toBe(false);
      },
    );
  });

  describe("execute", () => {
    it("nessuna destinazione trovata → result empty", async () => {
      findDestinationsMock.mockReturnValue([]);
      const res = await navigateToTool.execute("vai su xyz");
      expect(res.kind).toBe("result");
      if (res.kind === "result") {
        expect(res.status).toBe("empty");
      }
      expect(navigateToPathMock).not.toHaveBeenCalled();
    });

    it("match univoco (score doppio) → naviga e ritorna result ok", async () => {
      findDestinationsMock.mockReturnValue([
        { path: "/v2/cockpit", label: "Cockpit", hint: "Pipeline outreach", score: 10 },
        { path: "/v2/other", label: "Other", hint: "altro", score: 2 },
      ]);
      const res = await navigateToTool.execute("vai al cockpit");
      expect(navigateToPathMock).toHaveBeenCalledWith("/v2/cockpit");
      expect(res.kind).toBe("result");
      if (res.kind === "result") {
        expect(res.status).toBe("ok");
        expect(res.title).toContain("Cockpit");
      }
    });

    it("singolo match → sempre univoco anche senza secondo elemento", async () => {
      findDestinationsMock.mockReturnValue([{ path: "/v2/kb", label: "KB", hint: "Knowledge base", score: 5 }]);
      const res = await navigateToTool.execute("vai alla kb");
      expect(navigateToPathMock).toHaveBeenCalledWith("/v2/kb");
      expect(res.kind).toBe("result");
    });

    it("match ambiguo (score simile) → ritorna tabella di alternative, non naviga", async () => {
      findDestinationsMock.mockReturnValue([
        { path: "/v2/a", label: "A", hint: "hint a", score: 5 },
        { path: "/v2/b", label: "B", hint: "hint b", score: 4 },
      ]);
      const res = await navigateToTool.execute("vai a qualcosa di ambiguo");
      expect(navigateToPathMock).not.toHaveBeenCalled();
      expect(res.kind).toBe("table");
      if (res.kind === "table") {
        expect(res.rows.length).toBe(2);
      }
    });
  });
});
