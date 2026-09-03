/**
 * Batch B — test di esecuzione reale per i tool "analisi" e "KB".
 * Mock solo sul confine I/O: invokeEdge, invokeAi, supabase client, DAL kbEntries,
 * mutations kb-entries, promptTests.runTests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeEdgeMock = vi.fn();
const invokeAiMock = vi.fn();

vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: (...args: unknown[]) => invokeEdgeMock(...args),
}));
vi.mock("@/lib/ai/invokeAi", () => ({
  invokeAi: (...args: unknown[]) => invokeAiMock(...args),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

const findKbEntryRefMock = vi.fn();
const updateKbEntryFieldsMock = vi.fn();
const softDeleteKbEntryMock = vi.fn();
vi.mock("@/data/kbEntries", () => ({
  findKbEntryRef: (...args: unknown[]) => findKbEntryRefMock(...args),
  updateKbEntryFields: (...args: unknown[]) => updateKbEntryFieldsMock(...args),
  softDeleteKbEntry: (...args: unknown[]) => softDeleteKbEntryMock(...args),
  insertKbEntryReturningRow: vi.fn(),
  updateKbEntryRow: vi.fn(),
  deleteKbEntry: vi.fn(),
}));

const createKbEntryMutationMock = vi.fn();
vi.mock("@/v2/io/supabase/mutations/kb-entries", () => ({
  createKbEntry: (...args: unknown[]) => createKbEntryMutationMock(...args),
}));

const runTestsMock = vi.fn();
vi.mock("@/data/promptTests", () => ({
  runTests: (...args: unknown[]) => runTestsMock(...args),
}));

import { analyzePartnerTool } from "../analyzePartner";
import { optimusAnalyzeTool } from "../optimusAnalyze";
import { analyzeEmailEditTool } from "../analyzeEmailEdit";
import { analyzeImportStructureTool } from "../analyzeImportStructure";
import { suggestEmailGroupsTool } from "../suggestEmailGroups";
import { exportAuditCsvTool } from "../exportAuditCsv";
import { kbIngestDocumentTool } from "../kbIngestDocument";
import { updateKbEntryTool, deleteKbEntryTool } from "../kbAdmin";
import { createKbEntryTool } from "../createKbEntry";
import { countryKbGeneratorTool } from "../countryKbGenerator";
import { runPromptTestTool } from "../runPromptTest";
import { harmonizeProposalChatTool } from "../harmonizeProposalChat";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analyzePartnerTool", () => {
  it("match positivo/negativo", () => {
    expect(analyzePartnerTool.match("analizza partner Rossi Srl")).toBe(true);
    expect(analyzePartnerTool.match("elenca partner attivi")).toBe(false);
  });

  it("execute happy path costruisce report da sections", async () => {
    invokeAiMock.mockResolvedValueOnce({ sections: [{ heading: "SWOT", body: "forte" }] });
    const res = await analyzePartnerTool.execute("analizza partner 11111111-1111-1111-1111-111111111111", {});
    expect(res.kind).toBe("report");
    if (res.kind === "report") {
      expect(res.sections[0].heading).toBe("SWOT");
      expect(res.meta?.count).toBe(1);
    }
    expect(invokeAiMock).toHaveBeenCalledWith(
      "analyze-partner",
      expect.objectContaining({ body: expect.objectContaining({ partnerId: "11111111-1111-1111-1111-111111111111" }) }),
    );
  });

  it("execute con risposta vuota non lancia e produce sezione di fallback", async () => {
    invokeAiMock.mockResolvedValueOnce({});
    const res = await analyzePartnerTool.execute("analizza partner senza id", {});
    expect(res.kind).toBe("report");
    if (res.kind === "report") {
      expect(res.sections.length).toBe(1);
      expect(res.sections[0].heading).toBe("Analisi");
    }
  });
});

describe("optimusAnalyzeTool", () => {
  it("match positivo/negativo", () => {
    expect(optimusAnalyzeTool.match("fammi un'analisi strategica della rete")).toBe(true);
    expect(optimusAnalyzeTool.match("crea un contatto nuovo")).toBe(false);
  });

  it("execute happy path con insights", async () => {
    invokeEdgeMock.mockResolvedValueOnce({ insights: [{ heading: "Trend", body: "crescita" }] });
    const res = await optimusAnalyzeTool.execute("analisi strategica rete", {});
    expect(res.kind).toBe("report");
  });

  it("execute senza insights/summary ritorna result senza throw", async () => {
    invokeEdgeMock.mockResolvedValueOnce({});
    const res = await optimusAnalyzeTool.execute("optimus analisi", {});
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toMatch(/Nessun insight/);
  });
});

describe("analyzeEmailEditTool", () => {
  it("match positivo/negativo", () => {
    expect(analyzeEmailEditTool.match("analizza email modificata dall'operatore rispetto alla bozza AI")).toBe(true);
    expect(analyzeEmailEditTool.match("invia una email a Mario")).toBe(false);
  });

  it("execute happy path con changes", async () => {
    invokeEdgeMock.mockResolvedValueOnce({ summary: "ok", changes: [{ kind: "tono", before: "a", after: "b" }] });
    const res = await analyzeEmailEditTool.execute("analizza modifica email ai vs operatore", {});
    expect(res.kind).toBe("report");
    if (res.kind === "report") expect(res.sections.length).toBe(2);
  });

  it("execute con error dal backend non lancia", async () => {
    invokeEdgeMock.mockResolvedValueOnce({ error: "boom" });
    const res = await analyzeEmailEditTool.execute("analizza modifica email ai vs operatore", {});
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toBe("boom");
  });
});

describe("analyzeImportStructureTool", () => {
  it("match positivo/negativo", () => {
    expect(analyzeImportStructureTool.match("analizza struttura import del file")).toBe(true);
    expect(analyzeImportStructureTool.match("mandami un report vendite")).toBe(false);
  });

  it("execute happy path con colonne rilevate", async () => {
    invokeEdgeMock.mockResolvedValueOnce({
      rowCount: 42,
      columns: [{ name: "email", type: "string", sample: "a@b.com" }],
      mapping: { email: "contact.email" },
    });
    const res = await analyzeImportStructureTool.execute("analizza struttura import file.csv", {});
    expect(res.kind).toBe("table");
    if (res.kind === "table") expect(res.rows.length).toBe(1);
  });

  it("execute con dati vuoti ritorna result senza throw", async () => {
    invokeEdgeMock.mockResolvedValueOnce({});
    const res = await analyzeImportStructureTool.execute("analizza struttura import", {});
    expect(res.kind).toBe("result");
  });
});

describe("suggestEmailGroupsTool", () => {
  it("match positivo/negativo", () => {
    expect(suggestEmailGroupsTool.match("suggerisci gruppi email per l'inbox")).toBe(true);
    expect(suggestEmailGroupsTool.match("elimina il partner Rossi")).toBe(false);
  });

  it("execute happy path", async () => {
    invokeAiMock.mockResolvedValueOnce({ groups: [{ label: "Spam", pattern: "*.promo", count: 5 }] });
    const res = await suggestEmailGroupsTool.execute("suggerisci gruppi email", {});
    expect(res.kind).toBe("table");
    if (res.kind === "table") expect(res.rows.length).toBe(1);
  });

  it("execute senza gruppi ritorna result", async () => {
    invokeAiMock.mockResolvedValueOnce({ groups: [] });
    const res = await suggestEmailGroupsTool.execute("raggruppa email inbox", {});
    expect(res.kind).toBe("result");
  });
});

describe("exportAuditCsvTool", () => {
  it("match positivo/negativo", () => {
    expect(exportAuditCsvTool.match("esporta audit log in CSV")).toBe(true);
    expect(exportAuditCsvTool.match("che tempo fa oggi")).toBe(false);
  });

  it("execute happy path", async () => {
    invokeEdgeMock.mockResolvedValueOnce({ url: "https://x/audit.csv", rows: 100 });
    const res = await exportAuditCsvTool.execute("esporta audit CSV", {});
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("audit.csv");
  });

  it("execute con errore non lancia", async () => {
    invokeEdgeMock.mockResolvedValueOnce({ error: "no data" });
    const res = await exportAuditCsvTool.execute("scarica audit log", {});
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.title).toBe("Export fallito");
  });
});

describe("kbIngestDocumentTool", () => {
  it("match positivo/negativo", () => {
    expect(kbIngestDocumentTool.match("indicizza il documento nella knowledge base")).toBe(true);
    expect(kbIngestDocumentTool.match("crea un nuovo partner")).toBe(false);
  });

  it("execute senza conferma ritorna approval", async () => {
    const res = await kbIngestDocumentTool.execute('ingest "manuale.pdf" tags: A,B', {});
    expect(res.kind).toBe("approval");
  });

  it("execute confermato senza contentBase64 chiede upload, senza throw", async () => {
    const res = await kbIngestDocumentTool.execute("ingest kb", {
      confirmed: true,
      payload: { fileName: "manuale.pdf" },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toMatch(/pagina Knowledge Base/);
    expect(invokeEdgeMock).not.toHaveBeenCalled();
  });

  it("execute confermato con contentBase64 chiama invokeEdge e ritorna esito", async () => {
    invokeEdgeMock.mockResolvedValueOnce({ chunks_created: 3, total_chars: 900 });
    const res = await kbIngestDocumentTool.execute("ingest kb", {
      confirmed: true,
      payload: { fileName: "manuale.pdf", contentBase64: "AAAA", mimeType: "application/pdf", tags: ["x"] },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("3 chunk");
  });

  it("execute confermato con errore edge non lancia", async () => {
    invokeEdgeMock.mockResolvedValueOnce({ error: "parse failed" });
    const res = await kbIngestDocumentTool.execute("ingest kb", {
      confirmed: true,
      payload: { fileName: "manuale.pdf", contentBase64: "AAAA" },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.title).toBe("Ingest fallito");
  });
});

describe("updateKbEntryTool / deleteKbEntryTool", () => {
  it("match positivo/negativo", () => {
    expect(updateKbEntryTool.match("aggiorna entry kb Vietnam")).toBe(true);
    expect(updateKbEntryTool.match("elenca le entry kb")).toBe(false);
    expect(deleteKbEntryTool.match("elimina voce kb obsoleta")).toBe(true);
    expect(deleteKbEntryTool.match("aggiorna voce kb Vietnam")).toBe(false);
  });

  it("update senza conferma ritorna approval", async () => {
    const res = await updateKbEntryTool.execute("aggiorna entry kb Vietnam", {
      payload: { entry_id: "Vietnam", updates: { title: "Nuovo" } },
    });
    expect(res.kind).toBe("approval");
  });

  it("update confermato happy path", async () => {
    findKbEntryRefMock.mockResolvedValueOnce({ id: "kb-1", title: "Vietnam" });
    const res = await updateKbEntryTool.execute("aggiorna entry kb", {
      confirmed: true,
      payload: { entry_id: "Vietnam", updates: { title: "Nuovo" } },
    });
    expect(res.kind).toBe("result");
    expect(updateKbEntryFieldsMock).toHaveBeenCalledWith("kb-1", { title: "Nuovo" });
  });

  it("update confermato con entry non trovata lancia errore gestito", async () => {
    findKbEntryRefMock.mockResolvedValueOnce(null);
    await expect(
      updateKbEntryTool.execute("aggiorna entry kb", {
        confirmed: true,
        payload: { entry_id: "Fantasia", updates: { title: "x" } },
      }),
    ).rejects.toThrow(/non trovata/);
  });

  it("delete confermato happy path", async () => {
    findKbEntryRefMock.mockResolvedValueOnce({ id: "kb-2", title: "Old entry" });
    const res = await deleteKbEntryTool.execute("elimina entry kb", {
      confirmed: true,
      payload: { entry_id: "Old entry" },
    });
    expect(res.kind).toBe("result");
    expect(softDeleteKbEntryMock).toHaveBeenCalledWith("kb-2");
  });
});

describe("createKbEntryTool", () => {
  it("match positivo/negativo", () => {
    expect(createKbEntryTool.match("aggiungi una nuova voce alla kb")).toBe(true);
    expect(createKbEntryTool.match("cancella un contatto")).toBe(false);
  });

  it("execute senza conferma ritorna approval", async () => {
    const res = await createKbEntryTool.execute('nuova kb titolo "Regole export"', {});
    expect(res.kind).toBe("approval");
  });

  it("execute confermato happy path", async () => {
    createKbEntryMutationMock.mockResolvedValueOnce({ _tag: "Ok", value: { title: "Regole export" } });
    const res = await createKbEntryTool.execute("nuova kb", {
      confirmed: true,
      payload: { title: "Regole export", content: "..." },
    });
    expect(res.kind).toBe("result");
  });

  it("execute confermato con errore result lancia in modo gestito (non throw non gestito)", async () => {
    createKbEntryMutationMock.mockResolvedValueOnce({ _tag: "Err", error: { message: "insert failed" } });
    await expect(
      createKbEntryTool.execute("nuova kb", { confirmed: true, payload: { title: "x" } }),
    ).rejects.toThrow("insert failed");
  });
});

describe("countryKbGeneratorTool", () => {
  it("match positivo/negativo", () => {
    expect(countryKbGeneratorTool.match("genera scheda paese Vietnam")).toBe(true);
    expect(countryKbGeneratorTool.match("aggiorna il partner Rossi")).toBe(false);
  });

  it("execute senza conferma ritorna approval con paese estratto", async () => {
    const res = await countryKbGeneratorTool.execute("genera scheda paese per il Vietnam", {});
    expect(res.kind).toBe("approval");
  });

  it("execute confermato senza country ritorna result senza chiamare edge", async () => {
    const res = await countryKbGeneratorTool.execute("genera scheda paese", { confirmed: true, payload: {} });
    expect(res.kind).toBe("result");
    expect(invokeEdgeMock).not.toHaveBeenCalled();
  });

  it("execute confermato happy path", async () => {
    invokeEdgeMock.mockResolvedValueOnce({ kb_entry_id: "kb-99" });
    const res = await countryKbGeneratorTool.execute("genera scheda paese", {
      confirmed: true,
      payload: { country: "Vietnam" },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("kb-99");
  });

  it("execute confermato con errore edge non lancia", async () => {
    invokeEdgeMock.mockResolvedValueOnce({ error: "quota exceeded" });
    const res = await countryKbGeneratorTool.execute("genera scheda paese", {
      confirmed: true,
      payload: { country: "Vietnam" },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.title).toBe("Generazione fallita");
  });
});

describe("runPromptTestTool", () => {
  it("match positivo/negativo", () => {
    expect(runPromptTestTool.match("esegui test del prompt onboarding")).toBe(true);
    expect(runPromptTestTool.match("crea un nuovo prompt")).toBe(false);
  });

  it("execute senza conferma ritorna approval", async () => {
    const res = await runPromptTestTool.execute("esegui test prompt", {});
    expect(res.kind).toBe("approval");
  });

  it("execute confermato happy path", async () => {
    runTestsMock.mockResolvedValueOnce({
      runs: [{}, {}],
      summary: { total: 2, passed: 2, failed: 0, error: 0, skipped: 0 },
    });
    const res = await runPromptTestTool.execute("esegui test prompt", {
      confirmed: true,
      payload: { prompt_id: "p1" },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("2 test");
  });

  it("execute confermato senza summary calcola fallback senza throw", async () => {
    runTestsMock.mockResolvedValueOnce({ runs: [{}] });
    const res = await runPromptTestTool.execute("lancia test prompt", { confirmed: true, payload: {} });
    expect(res.kind).toBe("result");
  });
});

describe("harmonizeProposalChatTool", () => {
  it("match positivo/negativo", () => {
    expect(harmonizeProposalChatTool.match("armonizza la proposta della chat")).toBe(true);
    expect(harmonizeProposalChatTool.match("elimina la proposta")).toBe(false);
  });

  it("execute senza conferma ritorna approval con chatId estratto", async () => {
    const res = await harmonizeProposalChatTool.execute(
      "armonizza proposta chat 22222222-2222-2222-2222-222222222222",
      {},
    );
    expect(res.kind).toBe("approval");
  });

  it("execute confermato senza chat_id ritorna result senza chiamare edge", async () => {
    const res = await harmonizeProposalChatTool.execute("armonizza proposta", { confirmed: true, payload: {} });
    expect(res.kind).toBe("result");
    expect(invokeEdgeMock).not.toHaveBeenCalled();
  });

  it("execute confermato happy path", async () => {
    invokeEdgeMock.mockResolvedValueOnce({ proposal_id: "prop-1", summary: "Consolidata" });
    const res = await harmonizeProposalChatTool.execute("armonizza proposta", {
      confirmed: true,
      payload: { chat_id: "22222222-2222-2222-2222-222222222222" },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toBe("Consolidata");
  });

  it("execute confermato con errore edge non lancia", async () => {
    invokeEdgeMock.mockResolvedValueOnce({ error: "chat vuota" });
    const res = await harmonizeProposalChatTool.execute("armonizza proposta", {
      confirmed: true,
      payload: { chat_id: "22222222-2222-2222-2222-222222222222" },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.title).toBe("Armonizzazione fallita");
  });
});
