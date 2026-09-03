import { describe, it, expect, vi, beforeEach } from "vitest";

const planQueryMock = vi.fn();
const executeQueryPlanMock = vi.fn();
const findAnythingMock = vi.fn();

vi.mock("@/v2/io/edge/aiQueryPlanner", () => ({
  planQuery: (...args: unknown[]) => planQueryMock(...args),
}));
vi.mock("../../lib/safeQueryExecutor", async () => {
  const actual = await vi.importActual<typeof import("../../lib/safeQueryExecutor")>("../../lib/safeQueryExecutor");
  return {
    ...actual,
    executeQueryPlan: (...args: unknown[]) => executeQueryPlanMock(...args),
  };
});
vi.mock("../../lib/crossEntityFallback", () => ({
  extractSearchTerm: () => "acme",
  findAnything: (...args: unknown[]) => findAnythingMock(...args),
  summarizeDetail: () => "dettaglio",
}));

import { aiQueryTool, getLastSuccessfulQueryPlan, clearLastSuccessfulQueryPlan } from "../aiQueryTool";
import { ok, err } from "@/v2/core/domain/result";

function basicPlan(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    table: "partners",
    columns: [],
    filters: [],
    limit: 50,
    ...overrides,
  };
}

describe("aiQueryTool", () => {
  beforeEach(() => {
    planQueryMock.mockReset();
    executeQueryPlanMock.mockReset();
    findAnythingMock.mockReset();
    clearLastSuccessfulQueryPlan();
  });

  describe("match", () => {
    it.each([
      "mostra i partner di Malta",
      "quanti contatti abbiamo",
      "cerca Radiant",
      "elenco delle attività di oggi",
      "trova prospect in Germania",
      "lista messaggi recenti",
    ])("riconosce query di lettura: %s", (p) => {
      expect(aiQueryTool.match(p)).toBe(true);
    });

    it.each([
      "crea un nuovo contatto",
      "aggiorna il partner Acme",
      "elimina il contatto Mario",
      "scrapa il sito acme.com",
      "arricchisci i dati del partner",
      "dedup i contatti",
      "componi una email per Mario",
      "invia una mail a Mario Rossi",
      "vai al cockpit",
    ])("NON riconosce azioni: %s", (p) => {
      expect(aiQueryTool.match(p)).toBe(false);
    });

    it("cattura lookup nudo di nome proprio breve", () => {
      expect(aiQueryTool.match("Radiant")).toBe(true);
      expect(aiQueryTool.match("Mario Rossi")).toBe(true);
    });

    it("non cattura prompt vuoto", () => {
      expect(aiQueryTool.match("")).toBe(false);
    });
  });

  describe("execute", () => {
    it("planner irraggiungibile → result error", async () => {
      planQueryMock.mockResolvedValue(err({ message: "network fail" }));
      const res = await aiQueryTool.execute("mostra partner");
      expect(res.kind).toBe("result");
      if (res.kind === "result") {
        expect(res.status).toBe("error");
        expect(res.title).toContain("irraggiungibile");
      }
    });

    it("planner rate-limited (errore con testo 429) → result rate-limited", async () => {
      planQueryMock.mockResolvedValue(err({ message: "429 troppe richieste" }));
      const res = await aiQueryTool.execute("mostra partner");
      if (res.kind === "result") {
        expect(res.status).toBe("rate-limited");
      }
    });

    it("plan INVALID per rate limit nella rationale → result rate-limited", async () => {
      planQueryMock.mockResolvedValue(
        ok({ plans: [{ table: "INVALID", filters: [], limit: 50, rationale: "openai rate limit riprova tra 10s" }] }),
      );
      const res = await aiQueryTool.execute("mostra partner");
      if (res.kind === "result") {
        expect(res.status).toBe("rate-limited");
      }
    });

    it("SMALLTALK → result ok conversazionale", async () => {
      planQueryMock.mockResolvedValue(ok({ plans: [{ table: "SMALLTALK", filters: [], limit: 50, rationale: "Ciao!" }] }));
      const res = await aiQueryTool.execute("ciao");
      expect(res.kind).toBe("result");
      if (res.kind === "result") {
        expect(res.status).toBe("ok");
        expect(res.message).toBe("Ciao!");
      }
    });

    it("INVALID non-rate-limit → result unsupported", async () => {
      planQueryMock.mockResolvedValue(
        ok({ plans: [{ table: "INVALID", filters: [], limit: 50, rationale: "Richiesta non è una query" }] }),
      );
      const res = await aiQueryTool.execute("fammi un caffè");
      if (res.kind === "result") {
        expect(res.status).toBe("unsupported");
      }
    });

    it("piano singolo con successo → kind table e salva ultimo piano", async () => {
      planQueryMock.mockResolvedValue(ok({ plans: [basicPlan({ title: "Partner trovati" })] }));
      executeQueryPlanMock.mockResolvedValue({
        rows: [{ id: "1", company_name: "Acme" }],
        count: 1,
        table: "partners",
        columnsUsed: ["id", "company_name"],
      });
      const res = await aiQueryTool.execute("mostra i partner");
      expect(res.kind).toBe("table");
      if (res.kind === "table") {
        expect(res.title).toBe("Partner trovati");
        expect(res.rows[0].company_name).toBe("Acme");
        expect(res.selectable).toBe(true);
      }
      expect(getLastSuccessfulQueryPlan()?.table).toBe("partners");
    });

    it("piano singolo con errore esecuzione → result error", async () => {
      planQueryMock.mockResolvedValue(ok({ plans: [basicPlan()] }));
      executeQueryPlanMock.mockRejectedValue(new Error("colonna inesistente"));
      const res = await aiQueryTool.execute("mostra i partner");
      expect(res.kind).toBe("result");
      if (res.kind === "result") {
        expect(res.status).toBe("error");
        expect(res.message).toContain("colonna inesistente");
      }
    });

    it("zero risultati → rete di sicurezza cross-entity con match trovati", async () => {
      planQueryMock.mockResolvedValue(ok({ plans: [basicPlan()] }));
      executeQueryPlanMock.mockResolvedValue({ rows: [], count: 0, table: "partners", columnsUsed: ["id"] });
      findAnythingMock.mockResolvedValue({
        term: "acme",
        matches: [{ id: "1", source: "partners", label: "Acme Corp", matched_on: "company_name", detail: {} }],
        partial: false,
      });
      const res = await aiQueryTool.execute("cerca acme");
      expect(res.kind).toBe("table");
      if (res.kind === "table") {
        expect(res.title).toContain("Ricerca trasversale");
        expect(res.rows.length).toBe(1);
      }
    });

    it("zero risultati e nessun match trasversale → table vuota standard", async () => {
      planQueryMock.mockResolvedValue(ok({ plans: [basicPlan()] }));
      executeQueryPlanMock.mockResolvedValue({ rows: [], count: 0, table: "partners", columnsUsed: ["id"] });
      findAnythingMock.mockResolvedValue(null);
      const res = await aiQueryTool.execute("cerca acme");
      expect(res.kind).toBe("table");
      if (res.kind === "table") {
        expect(res.rows.length).toBe(0);
      }
    });

    it("piani multipli → kind multi con conteggio aggregato", async () => {
      planQueryMock.mockResolvedValue(
        ok({ plans: [basicPlan({ table: "partners" }), basicPlan({ table: "imported_contacts" })] }),
      );
      executeQueryPlanMock
        .mockResolvedValueOnce({ rows: [{ id: "1" }], count: 1, table: "partners", columnsUsed: ["id"] })
        .mockResolvedValueOnce({ rows: [{ id: "2" }, { id: "3" }], count: 2, table: "imported_contacts", columnsUsed: ["id"] });
      const res = await aiQueryTool.execute("mostra partner e contatti");
      expect(res.kind).toBe("multi");
      if (res.kind === "multi") {
        expect(res.parts.length).toBe(2);
        expect(res.meta?.count).toBe(3);
      }
    });
  });
});
