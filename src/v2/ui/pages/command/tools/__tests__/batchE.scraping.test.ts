/**
 * Batch E — test di esecuzione reale per i tool di scraping/enrichment/browser/deepsearch.
 * Mocking solo del confine I/O: invokeEdge, invokeEdgeRaw, supabase client, DAL @/data/*.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks confine I/O ──────────────────────────────────────────────────
vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: vi.fn(),
}));

vi.mock("@/v2/io/edge/client", () => ({
  invokeEdgeRaw: vi.fn(),
}));

const authGetSession = vi.fn();
const functionsInvoke = vi.fn();
const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => authGetSession(...args) },
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...args) },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock("@/data/commandScrapePartner", () => ({
  getCachedScrapePayload: vi.fn(),
  setCachedScrapePayload: vi.fn(),
  updatePartnerFields: vi.fn(),
  findPartnerBySearchTerm: vi.fn(),
}));

vi.mock("@/data/scrapeCache", () => ({
  upsertScrapeCacheEntry: vi.fn(),
}));

vi.mock("@/data/prospects", () => ({
  applyProspectEnrichment: vi.fn(),
  findProspectBySearchTerm: vi.fn(),
}));

vi.mock("@/data/prospectEnrichment", () => ({
  fetchProspectById: vi.fn(),
  updateProspect: vi.fn(),
}));

vi.mock("@/data/commandDeepSearchContact", () => ({
  findDeepSearchContacts: vi.fn(),
}));

vi.mock("@/v2/io/supabase/queries/partners", () => ({
  fetchPartnerById: vi.fn(),
}));

vi.mock("@/v2/io/supabase/mutations/partners", () => ({
  updatePartner: vi.fn(),
}));

vi.mock("@/v2/ui/pages/command/lib/lastQueryResultContext", () => ({
  getLastQueryResultContext: vi.fn(),
}));

import { invokeEdge } from "@/lib/api/invokeEdge";
import { invokeEdgeRaw } from "@/v2/io/edge/client";
import {
  getCachedScrapePayload,
  setCachedScrapePayload,
  updatePartnerFields,
  findPartnerBySearchTerm,
} from "@/data/commandScrapePartner";
import { upsertScrapeCacheEntry } from "@/data/scrapeCache";
import { applyProspectEnrichment, findProspectBySearchTerm } from "@/data/prospects";
import { fetchProspectById, updateProspect } from "@/data/prospectEnrichment";
import { findDeepSearchContacts } from "@/data/commandDeepSearchContact";
import { fetchPartnerById } from "@/v2/io/supabase/queries/partners";
import { updatePartner } from "@/v2/io/supabase/mutations/partners";
import { getLastQueryResultContext } from "@/v2/ui/pages/command/lib/lastQueryResultContext";

import { scrapeWebsiteTool } from "../scrapeWebsite";
import { scrapeCompanyWebsiteTool } from "../scrapeCompanyWebsite";
import { scrapeLinkedInProfileTool } from "../scrapeLinkedInProfile";
import { scrapePartnerTool } from "../scrapePartner";
import { scrapeProspectTool } from "../scrapeProspect";
import { enrichPartnerFromWebTool } from "../enrichPartnerFromWeb";
import { enrichPartnerFromWebsiteTool } from "../enrichPartnerFromWebsite";
import { enrichProspectFromWebsiteTool } from "../enrichProspectFromWebsite";
import { batchEnrichPartnersTool } from "../batchEnrichPartners";
import { browserAutoCompleteTool } from "../browserAutoComplete";
import { browserFillFormTool } from "../browserFillForm";
import { browserNavigateAndExtractTool } from "../browserNavigateAndExtract";
import { linkedinProfileApiTool } from "../linkedinProfileApi";
import { deepSearchContactTool } from "../deepSearchContact";
import { deepSearchPartnerTool } from "../deepSearchPartner";

const UUID = "11111111-2222-3333-4444-555555555555";

function ok<T>(value: T) {
  return { _tag: "Ok" as const, value };
}
function errR(message: string) {
  return { _tag: "Err" as const, error: { message } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════ scrapeWebsite ══════════════════════════
describe("scrapeWebsiteTool", () => {
  it("match positivo su 'scrape sito'", () => {
    expect(scrapeWebsiteTool.match("scrape questo sito https://acme.com")).toBe(true);
  });
  it("match positivo su 'analizza il sito'", () => {
    expect(scrapeWebsiteTool.match("puoi analizzare il sito https://foo.com")).toBe(true);
  });
  it("match negativo su prompt non pertinente", () => {
    expect(scrapeWebsiteTool.match("ciao come stai")).toBe(false);
  });

  it("execute senza URL ritorna result con messaggio", async () => {
    const res = await scrapeWebsiteTool.execute("scrape il sito per favore", {});
    expect(res.kind).toBe("result");
    expect((res as { message: string }).message).toMatch(/URL/i);
  });

  it("execute happy path produce un report con sezioni", async () => {
    (invokeEdge as ReturnType<typeof vi.fn>).mockResolvedValue({
      title: "Acme Inc",
      text: "Testo di prova",
      meta: { author: "Mario" },
      links: ["https://acme.com/a", "https://acme.com/b"],
    });
    const res = await scrapeWebsiteTool.execute("scrape sito https://acme.com", {});
    expect(res.kind).toBe("report");
    if (res.kind === "report") {
      expect(res.sections.some((s) => s.heading === "Titolo")).toBe(true);
      expect(res.meta?.count).toBeGreaterThan(0);
    }
  });

  it("execute con errore edge ritorna result senza throw", async () => {
    (invokeEdge as ReturnType<typeof vi.fn>).mockResolvedValue({ error: "sito irraggiungibile" });
    const res = await scrapeWebsiteTool.execute("scrape sito https://boom.com", {});
    expect(res.kind).toBe("result");
    expect((res as { message: string }).message).toBe("sito irraggiungibile");
  });
});

// ══════════════════════════ scrapeCompanyWebsite ══════════════════════════
describe("scrapeCompanyWebsiteTool", () => {
  it("match positivo", () => {
    expect(scrapeCompanyWebsiteTool.match("scrape il sito aziendale https://acme.com")).toBe(true);
  });
  it("match negativo", () => {
    expect(scrapeCompanyWebsiteTool.match("che tempo fa oggi")).toBe(false);
  });

  it("execute senza URL lancia errore", async () => {
    await expect(scrapeCompanyWebsiteTool.execute("scrape sito senza link", {})).rejects.toThrow(/URL/i);
  });

  it("execute non confermato ritorna approval", async () => {
    const res = await scrapeCompanyWebsiteTool.execute("scrape sito https://acme.com", {});
    expect(res.kind).toBe("approval");
  });

  it("execute confermato happy path ritorna report", async () => {
    (invokeEdgeRaw as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok({
        title: "Acme",
        description: "Desc",
        ogTitle: "OG",
        ogDescription: "OGDesc",
        emails: ["a@acme.com"],
        phones: ["+39123"],
        headings: ["H1"],
        links: [],
        rawText: "",
        length: 0,
      }),
    );
    const res = await scrapeCompanyWebsiteTool.execute("scrape sito https://acme.com", {
      confirmed: true,
      payload: { url: "https://acme.com" },
    });
    expect(res.kind).toBe("report");
    if (res.kind === "report") {
      expect(res.meta?.count).toBe(2);
    }
  });

  it("execute confermato con errore edge lancia errore", async () => {
    (invokeEdgeRaw as ReturnType<typeof vi.fn>).mockResolvedValue(errR("timeout"));
    await expect(
      scrapeCompanyWebsiteTool.execute("scrape sito https://acme.com", {
        confirmed: true,
        payload: { url: "https://acme.com" },
      }),
    ).rejects.toThrow(/timeout/);
  });
});

// ══════════════════════════ scrapeLinkedInProfile ══════════════════════════
describe("scrapeLinkedInProfileTool", () => {
  it("match positivo", () => {
    expect(scrapeLinkedInProfileTool.match("cerca linkedin di Mario Rossi")).toBe(true);
  });
  it("match negativo", () => {
    expect(scrapeLinkedInProfileTool.match("mandami un report vendite")).toBe(false);
  });

  it("execute non confermato ritorna approval", async () => {
    const res = await scrapeLinkedInProfileTool.execute("cerca linkedin di Mario", {});
    expect(res.kind).toBe("approval");
  });

  it("execute confermato senza utente lancia errore", async () => {
    authGetSession.mockResolvedValue({ data: { session: null } });
    await expect(
      scrapeLinkedInProfileTool.execute("cerca linkedin di Mario", { confirmed: true }),
    ).rejects.toThrow(/non autenticato/i);
  });

  it("execute confermato con utente ritorna result informativo", async () => {
    authGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    const res = await scrapeLinkedInProfileTool.execute("cerca linkedin di Mario", { confirmed: true });
    expect(res.kind).toBe("result");
  });
});

// ══════════════════════════ scrapePartner ══════════════════════════
describe("scrapePartnerTool", () => {
  it("match positivo", () => {
    expect(scrapePartnerTool.match("scrapa il sito del partner Acme")).toBe(true);
  });
  it("match negativo", () => {
    expect(scrapePartnerTool.match("elenca i partner attivi")).toBe(false);
  });

  it("execute senza searchTerm ritorna errore result", async () => {
    const res = await scrapePartnerTool.execute("scrapa il sito ", {});
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Errore");
  });

  it("execute con partner non trovato", async () => {
    (findPartnerBySearchTerm as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await scrapePartnerTool.execute("scrapa il sito del partner Fantasma", {});
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Partner Non Trovato");
  });

  it("execute con partner senza sito", async () => {
    (findPartnerBySearchTerm as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "p1",
      company_name: "Acme",
      website: null,
      email: null,
      phone: null,
    });
    const res = await scrapePartnerTool.execute("scrapa il sito del partner Acme", {});
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Nessun Sito");
  });

  it("execute happy path (cache miss) ritorna approval con dati estratti", async () => {
    (findPartnerBySearchTerm as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "p1",
      company_name: "Acme",
      website: "https://acme.com",
      email: null,
      phone: null,
    });
    (getCachedScrapePayload as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    functionsInvoke.mockResolvedValue({
      data: { emails: ["a@acme.com"], phones: ["+39111"], description: "Descrizione Acme" },
      error: null,
    });
    const res = await scrapePartnerTool.execute("scrapa il sito del partner Acme", {});
    expect(res.kind).toBe("approval");
    expect(setCachedScrapePayload).toHaveBeenCalled();
  });

  it("execute con errore scraping ritorna result senza throw", async () => {
    (findPartnerBySearchTerm as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "p1",
      company_name: "Acme",
      website: "https://acme.com",
      email: null,
      phone: null,
    });
    (getCachedScrapePayload as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    functionsInvoke.mockResolvedValue({ data: null, error: { message: "network fail" } });
    const res = await scrapePartnerTool.execute("scrapa il sito del partner Acme", {});
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Errore Scraping");
  });

  it("execute confermato applica update", async () => {
    (updatePartnerFields as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    const res = await scrapePartnerTool.execute("irrilevante", {
      confirmed: true,
      payload: { partnerId: "p1", email: "a@acme.com" },
    });
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Partner Aggiornato");
  });
});

// ══════════════════════════ scrapeProspect ══════════════════════════
describe("scrapeProspectTool", () => {
  it("match positivo", () => {
    expect(scrapeProspectTool.match("analizza il sito del prospect Beta")).toBe(true);
  });
  it("match negativo", () => {
    expect(scrapeProspectTool.match("elenca i prospect")).toBe(false);
  });

  it("execute con prospect non trovato", async () => {
    (findProspectBySearchTerm as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await scrapeProspectTool.execute("analizza il sito del prospect Fantasma", {});
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Prospect Non Trovato");
  });

  it("execute happy path ritorna approval", async () => {
    (findProspectBySearchTerm as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pr1",
      company_name: "Beta",
      website: "https://beta.com",
      email: null,
      phone: null,
    });
    (getCachedScrapePayload as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    functionsInvoke.mockResolvedValue({
      data: { emails: ["x@beta.com"], phones: [], description: "Beta descrizione" },
      error: null,
    });
    const res = await scrapeProspectTool.execute("analizza il sito del prospect Beta", {});
    expect(res.kind).toBe("approval");
    expect(upsertScrapeCacheEntry).toHaveBeenCalled();
  });

  it("execute confermato applica enrichment senza throw", async () => {
    (applyProspectEnrichment as ReturnType<typeof vi.fn>).mockResolvedValue({
      appliedFields: ["email"],
      ignoredFields: ["profile_description"],
    });
    const res = await scrapeProspectTool.execute("irrilevante", {
      confirmed: true,
      payload: { prospectId: "pr1", email: "x@beta.com", profile_description: "desc" },
    });
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Prospect Aggiornato");
  });

  it("execute confermato con errore DAL non fa throw", async () => {
    (applyProspectEnrichment as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("update fallito"));
    const res = await scrapeProspectTool.execute("irrilevante", {
      confirmed: true,
      payload: { prospectId: "pr1", email: "x@beta.com" },
    });
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Errore");
  });
});

// ══════════════════════════ enrichPartnerFromWeb ══════════════════════════
describe("enrichPartnerFromWebTool", () => {
  it("match positivo", () => {
    expect(enrichPartnerFromWebTool.match("arricchisci il partner Acme")).toBe(true);
  });
  it("match negativo", () => {
    expect(enrichPartnerFromWebTool.match("mostrami i partner")).toBe(false);
  });

  it("execute senza id lancia errore", async () => {
    await expect(enrichPartnerFromWebTool.execute("arricchisci il partner", {})).rejects.toThrow(/ID/i);
  });

  it("execute non confermato ritorna approval", async () => {
    const res = await enrichPartnerFromWebTool.execute(`arricchisci il partner ${UUID}`, {});
    expect(res.kind).toBe("approval");
  });

  it("execute confermato happy path aggiorna partner", async () => {
    (fetchPartnerById as ReturnType<typeof vi.fn>).mockResolvedValue(ok({ website: "https://acme.com" }));
    (invokeEdgeRaw as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok({ emails: ["a@acme.com"], phones: ["+391"], title: "Acme", description: "d" }),
    );
    (updatePartner as ReturnType<typeof vi.fn>).mockResolvedValue(ok({}));
    const res = await enrichPartnerFromWebTool.execute(`arricchisci il partner ${UUID}`, {
      confirmed: true,
      payload: { partnerId: UUID },
    });
    expect(res.kind).toBe("report");
    if (res.kind === "report") expect(res.meta?.count).toBe(2);
  });

  it("execute confermato senza website lancia errore", async () => {
    (fetchPartnerById as ReturnType<typeof vi.fn>).mockResolvedValue(ok({ website: null }));
    await expect(
      enrichPartnerFromWebTool.execute(`arricchisci il partner ${UUID}`, {
        confirmed: true,
        payload: { partnerId: UUID },
      }),
    ).rejects.toThrow(/sito web/i);
  });

  it("execute confermato con scrape fallito lancia errore", async () => {
    (fetchPartnerById as ReturnType<typeof vi.fn>).mockResolvedValue(ok({ website: "https://acme.com" }));
    (invokeEdgeRaw as ReturnType<typeof vi.fn>).mockResolvedValue(errR("scrape down"));
    await expect(
      enrichPartnerFromWebTool.execute(`arricchisci il partner ${UUID}`, {
        confirmed: true,
        payload: { partnerId: UUID },
      }),
    ).rejects.toThrow(/scrape down/i);
  });
});

// ══════════════════════════ enrichPartnerFromWebsite ══════════════════════════
describe("enrichPartnerFromWebsiteTool", () => {
  it("match positivo", () => {
    expect(enrichPartnerFromWebsiteTool.match("analizza il sito del partner Acme e arricchiscilo")).toBe(true);
  });
  it("match negativo", () => {
    expect(enrichPartnerFromWebsiteTool.match("cosa fai oggi")).toBe(false);
  });

  it("execute senza id lancia errore", async () => {
    await expect(enrichPartnerFromWebsiteTool.execute("arricchisci partner", {})).rejects.toThrow(/ID/i);
  });

  it("execute confermato happy path con dati vuoti non lancia", async () => {
    (fetchPartnerById as ReturnType<typeof vi.fn>).mockResolvedValue(ok({ website: "https://acme.com" }));
    (invokeEdgeRaw as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok({ emails: [], phones: [], title: "t", description: "", ogDescription: "", headings: [] }),
    );
    const res = await enrichPartnerFromWebsiteTool.execute(`arricchisci partner ${UUID}`, {
      confirmed: true,
      payload: { partnerId: UUID },
    });
    expect(res.kind).toBe("report");
    expect(updatePartner).not.toHaveBeenCalled();
  });
});

// ══════════════════════════ enrichProspectFromWebsite ══════════════════════════
describe("enrichProspectFromWebsiteTool", () => {
  it("match positivo", () => {
    expect(enrichProspectFromWebsiteTool.match("arricchisci il prospect Beta")).toBe(true);
  });
  it("match negativo", () => {
    expect(enrichProspectFromWebsiteTool.match("che ore sono")).toBe(false);
  });

  it("execute senza website lancia errore", async () => {
    (fetchProspectById as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { website: null }, error: null });
    await expect(
      enrichProspectFromWebsiteTool.execute(`arricchisci il prospect ${UUID}`, {
        confirmed: true,
        payload: { prospectId: UUID },
      }),
    ).rejects.toThrow(/sito web/i);
  });

  it("execute confermato happy path aggiorna prospect", async () => {
    (fetchProspectById as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { website: "https://beta.com", email: null, phone: null },
      error: null,
    });
    (invokeEdgeRaw as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok({ emails: ["x@beta.com"], phones: [], title: "Beta", description: "d", ogDescription: "" }),
    );
    (updateProspect as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    const res = await enrichProspectFromWebsiteTool.execute(`arricchisci il prospect ${UUID}`, {
      confirmed: true,
      payload: { prospectId: UUID },
    });
    expect(res.kind).toBe("report");
    expect(updateProspect).toHaveBeenCalledWith(UUID, { email: "x@beta.com" });
  });

  it("execute con prospect non trovato lancia errore", async () => {
    (fetchProspectById as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: "not found" } });
    await expect(
      enrichProspectFromWebsiteTool.execute(`arricchisci il prospect ${UUID}`, {
        confirmed: true,
        payload: { prospectId: UUID },
      }),
    ).rejects.toThrow(/not found/i);
  });
});

// ══════════════════════════ batchEnrichPartners ══════════════════════════
describe("batchEnrichPartnersTool", () => {
  it("match positivo", () => {
    expect(batchEnrichPartnersTool.match("arricchisci i dati dei partner di Malta")).toBe(true);
  });
  it("match negativo", () => {
    expect(batchEnrichPartnersTool.match("ciao mondo")).toBe(false);
  });

  it("execute senza contesto ritorna result vuoto", async () => {
    (getLastQueryResultContext as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const res = await batchEnrichPartnersTool.execute("arricchisci i dati dei partner", {});
    expect(res.kind).toBe("result");
    expect((res as { meta?: { count: number } }).meta?.count).toBe(0);
  });

  it("execute non confermato ritorna approval", async () => {
    (getLastQueryResultContext as ReturnType<typeof vi.fn>).mockReturnValue({
      partnerIds: ["p1", "p2"],
      selectionLabel: "partner di Malta",
      originalPrompt: "partner di Malta",
    });
    const res = await batchEnrichPartnersTool.execute("arricchisci i dati dei partner", {});
    expect(res.kind).toBe("approval");
  });

  it("execute confermato esegue batch (ok/skip/fail) senza throw", async () => {
    (fetchPartnerById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(ok({ company_name: "Acme", website: "https://acme.com" }))
      .mockResolvedValueOnce(ok({ company_name: "Beta", website: "" }))
      .mockResolvedValueOnce(errR("not found"));
    (invokeEdgeRaw as ReturnType<typeof vi.fn>).mockResolvedValueOnce(ok({}));
    const res = await batchEnrichPartnersTool.execute("irrilevante", {
      confirmed: true,
      payload: { partnerIds: ["p1", "p2", "p3"], selectionLabel: "partner di Malta" },
    });
    expect(res.kind).toBe("report");
    if (res.kind === "report") {
      expect(res.meta?.count).toBe(1);
      expect(res.sections[0].body).toMatch(/Completati.*1/);
      expect(res.sections[0].body).toMatch(/Saltati.*1/);
      expect(res.sections[0].body).toMatch(/Falliti.*1/);
    }
  });
});

// ══════════════════════════ browserAutoComplete ══════════════════════════
describe("browserAutoCompleteTool", () => {
  it("match positivo", () => {
    expect(browserAutoCompleteTool.match("invia il form")).toBe(true);
  });
  it("match negativo", () => {
    expect(browserAutoCompleteTool.match("mostrami i dati")).toBe(false);
  });

  it("execute senza conferma ritorna approval", async () => {
    const res = await browserAutoCompleteTool.execute("invia il form", {});
    expect(res.kind).toBe("approval");
  });

  it("execute confermato happy path", async () => {
    functionsInvoke.mockResolvedValue({ data: { finalUrl: "https://app/thanks" }, error: null });
    const res = await browserAutoCompleteTool.execute("invia il form", {
      confirmed: true,
      payload: { url: "https://app/form", formSelector: "#submit" },
    });
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Form Inviato");
  });

  it("execute confermato con errore edge non lancia", async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await browserAutoCompleteTool.execute("invia il form", {
      confirmed: true,
      payload: { url: "https://app/form", formSelector: "#submit" },
    });
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Errore Submit");
  });
});

// ══════════════════════════ browserFillForm ══════════════════════════
describe("browserFillFormTool", () => {
  it("match positivo", () => {
    expect(browserFillFormTool.match("compila il form nome Mario email mario@acme.com")).toBe(true);
  });
  it("match negativo", () => {
    expect(browserFillFormTool.match("scrivimi un riassunto")).toBe(false);
  });

  it("execute (non confermato) happy path ritorna approval con screenshot", async () => {
    authGetSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    functionsInvoke.mockResolvedValue({ data: { finalScreenshot: "abc123" }, error: null });
    const res = await browserFillFormTool.execute(
      "compila il form nome \"Mario\" email \"mario@acme.com\"",
      {},
    );
    expect(res.kind).toBe("approval");
  });

  it("execute con errore browser non lancia", async () => {
    authGetSession.mockResolvedValue({ data: { session: null } });
    functionsInvoke.mockResolvedValue({ data: null, error: { message: "browser offline" } });
    const res = await browserFillFormTool.execute("compila il form nome \"Mario\"", {});
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Errore Browser");
  });

  it("execute confermato invia il form", async () => {
    functionsInvoke.mockResolvedValue({ data: { finalUrl: "https://app/done" }, error: null });
    const res = await browserFillFormTool.execute("irrilevante", {
      confirmed: true,
      payload: { url: "https://app/form", formSelector: "#submit" },
    });
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Form Inviato");
  });
});

// ══════════════════════════ browserNavigateAndExtract ══════════════════════════
describe("browserNavigateAndExtractTool", () => {
  it("match positivo (con URL)", () => {
    expect(browserNavigateAndExtractTool.match("apri il sito https://acme.com")).toBe(true);
  });
  it("match negativo (senza URL)", () => {
    expect(browserNavigateAndExtractTool.match("apri il sito acme")).toBe(false);
  });
  it("match negativo generico", () => {
    expect(browserNavigateAndExtractTool.match("ciao")).toBe(false);
  });

  it("execute senza URL ritorna errore", async () => {
    const res = await browserNavigateAndExtractTool.execute("apri il sito", {});
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Errore");
  });

  it("execute happy path estrae testo", async () => {
    functionsInvoke.mockResolvedValue({
      data: { finalUrl: "https://acme.com", results: [{ type: "readText", text: "Ciao mondo" }] },
      error: null,
    });
    const res = await browserNavigateAndExtractTool.execute("apri il sito https://acme.com", {});
    expect(res.kind).toBe("report");
    if (res.kind === "report") {
      expect(res.sections.some((s) => s.body.includes("Ciao mondo"))).toBe(true);
    }
  });

  it("execute con browser non disponibile", async () => {
    functionsInvoke.mockResolvedValue({ data: { fallback: true }, error: null });
    const res = await browserNavigateAndExtractTool.execute("apri il sito https://acme.com", {});
    expect(res.kind).toBe("result");
    expect((res as { title: string }).title).toBe("Browser Non Disponibile");
  });
});

// ══════════════════════════ linkedinProfileApi ══════════════════════════
describe("linkedinProfileApiTool", () => {
  it("match positivo su url linkedin", () => {
    expect(linkedinProfileApiTool.match("https://www.linkedin.com/in/mariorossi")).toBe(true);
  });
  it("match positivo su 'profilo linkedin'", () => {
    expect(linkedinProfileApiTool.match("mostrami il profilo linkedin di Mario")).toBe(true);
  });
  it("match negativo", () => {
    expect(linkedinProfileApiTool.match("mostrami i partner")).toBe(false);
  });

  it("execute senza URL ritorna result", async () => {
    const res = await linkedinProfileApiTool.execute("profilo linkedin di Mario", {});
    expect(res.kind).toBe("result");
    expect((res as { message: string }).message).toMatch(/URL/i);
  });

  it("execute happy path ritorna report", async () => {
    (invokeEdge as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Mario Rossi",
      headline: "CEO",
      company: "Acme",
      location: "Milano",
      about: "About text",
      experience: [{ title: "CEO", company: "Acme", period: "2020-oggi" }],
    });
    const res = await linkedinProfileApiTool.execute("https://www.linkedin.com/in/mariorossi", {});
    expect(res.kind).toBe("report");
  });

  it("execute con errore edge non lancia", async () => {
    (invokeEdge as ReturnType<typeof vi.fn>).mockResolvedValue({ error: "non trovato" });
    const res = await linkedinProfileApiTool.execute("https://www.linkedin.com/in/mariorossi", {});
    expect(res.kind).toBe("result");
    expect((res as { message: string }).message).toBe("non trovato");
  });
});

// ══════════════════════════ deepSearchContact ══════════════════════════
describe("deepSearchContactTool", () => {
  it("match positivo", () => {
    expect(deepSearchContactTool.match("trova contatto Mario Rossi")).toBe(true);
  });
  it("match negativo", () => {
    expect(deepSearchContactTool.match("elenca i partner")).toBe(false);
  });

  it("execute happy path ritorna table", async () => {
    (findDeepSearchContacts as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "c1", name: "Mario", company_name: "Acme", email: "m@acme.com", deep_search_at: "2024-01-01" },
    ]);
    const res = await deepSearchContactTool.execute("trova contatto Mario", {});
    expect(res.kind).toBe("table");
    if (res.kind === "table") expect(res.rows).toHaveLength(1);
  });

  it("execute con dati vuoti non lancia", async () => {
    (findDeepSearchContacts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = await deepSearchContactTool.execute("deep search contatti", {});
    expect(res.kind).toBe("table");
    if (res.kind === "table") expect(res.rows).toHaveLength(0);
  });
});

// ══════════════════════════ deepSearchPartner ══════════════════════════
describe("deepSearchPartnerTool", () => {
  it("match positivo", () => {
    expect(deepSearchPartnerTool.match("approfondisci il partner Acme")).toBe(true);
  });
  it("match negativo", () => {
    expect(deepSearchPartnerTool.match("elenca contatti")).toBe(false);
  });

  it("execute happy path ritorna table", async () => {
    (invokeEdge as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [{ name: "Acme", city: "Milano", country: "Italia", website: "https://acme.com", score: 90, summary: "ok" }],
    });
    const res = await deepSearchPartnerTool.execute("approfondisci il partner Acme", {});
    expect(res.kind).toBe("table");
    if (res.kind === "table") expect(res.rows).toHaveLength(1);
  });

  it("execute con nessun risultato ritorna result", async () => {
    (invokeEdge as ReturnType<typeof vi.fn>).mockResolvedValue({ results: [] });
    const res = await deepSearchPartnerTool.execute("approfondisci il partner Fantasma", {});
    expect(res.kind).toBe("result");
  });
});
