/**
 * Contratto "schema non disponibile".
 *
 * Ripristina (e rafforza) la copertura persa quando i test che interrogavano
 * relazioni inesistenti sono stati rimossi: qui si verifica il comportamento
 * onesto atteso — nessuna query di rete, fallback esplicito in lettura,
 * fail-closed in scrittura — per ogni relazione assente dallo schema live.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    functions: { invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) },
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  },
}));
vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import {
  ABSENT_RELATIONS,
  SchemaUnavailableError,
  isSchemaUnavailableError,
  unavailableRead,
  unavailableWrite,
} from "@/data/_shared/unavailableSchema";
import {
  findRAProspects,
  findRAProspectById,
  findRAContacts,
  findRAInteractions,
  findRAJobs,
  upsertRAProspect,
  insertRAJob,
  updateRAJob,
  updateRALeadStatus,
  deleteRAProspects,
} from "@/data/reportAziende";
import { fetchRaDashboardStats } from "@/data/raDashboard";
import { fetchEvalBatchRuns } from "@/data/funnemailEval";
import {
  reassignActivitiesContact,
  reassignEmailsContact,
} from "@/data/contactMergeQueries";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("unavailableSchema — primitive", () => {
  it("unavailableRead ritorna il fallback senza toccare il client", () => {
    expect(unavailableRead("ra_prospects", [])).toEqual([]);
    expect(unavailableRead("ra_prospects", { total: 0 })).toEqual({ total: 0 });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("unavailableWrite fallisce in modo chiuso con errore riconoscibile", () => {
    let caught: unknown;
    try {
      unavailableWrite("ra_prospects");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SchemaUnavailableError);
    expect(isSchemaUnavailableError(caught)).toBe(true);
    expect((caught as SchemaUnavailableError).relation).toBe("ra_prospects");
    expect((caught as Error).message).toContain("ra_prospects");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("isSchemaUnavailableError è falso per errori generici", () => {
    expect(isSchemaUnavailableError(new Error("boom"))).toBe(false);
    expect(isSchemaUnavailableError(null)).toBe(false);
  });

  it("l'elenco delle relazioni assenti non contiene duplicati", () => {
    expect(new Set(ABSENT_RELATIONS).size).toBe(ABSENT_RELATIONS.length);
  });
});

describe("Report Aziende — relazioni ra_* assenti", () => {
  it("findRAProspects ritorna pagina vuota senza query", async () => {
    const page = await findRAProspects({});
    expect(page.items).toEqual([]);
    expect(page.totalCount).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("findRAProspectById ritorna null senza query", async () => {
    expect(await findRAProspectById("x")).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("findRAContacts / findRAInteractions / findRAJobs ritornano liste vuote", async () => {
    expect(await findRAContacts("p1")).toEqual([]);
    expect(await findRAInteractions("p1")).toEqual([]);
    expect(await findRAJobs()).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("tutte le scritture ra_* falliscono con SchemaUnavailableError", async () => {
    await expect(upsertRAProspect({ ragione_sociale: "ACME" } as never)).rejects.toBeInstanceOf(
      SchemaUnavailableError,
    );
    await expect(insertRAJob({} as never)).rejects.toBeInstanceOf(SchemaUnavailableError);
    await expect(updateRAJob("j1", {})).rejects.toBeInstanceOf(SchemaUnavailableError);
    await expect(updateRALeadStatus("p1", "nuovo" as never)).rejects.toBeInstanceOf(
      SchemaUnavailableError,
    );
    await expect(deleteRAProspects(["p1"])).rejects.toBeInstanceOf(SchemaUnavailableError);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("fetchRaDashboardStats ritorna statistiche azzerate senza query", async () => {
    const stats = await fetchRaDashboardStats();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(Object.values(stats).every((v) => typeof v !== "undefined")).toBe(true);
  });
});

describe("Funnemail eval — funnemail_eval_batch_runs assente", () => {
  it("fetchEvalBatchRuns ritorna lista vuota senza query", async () => {
    expect(await fetchEvalBatchRuns()).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("Merge contatti — colonne/relazioni assenti", () => {
  it("reassignActivitiesContact segnala la colonna assente senza query", async () => {
    const res = await reassignActivitiesContact("a", "b");
    expect(res.error?.message).toContain("activities.contact_id");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("reassignEmailsContact segnala la relazione assente senza query", async () => {
    const res = await reassignEmailsContact("a", "b");
    expect(res.error?.message).toContain("emails");
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
