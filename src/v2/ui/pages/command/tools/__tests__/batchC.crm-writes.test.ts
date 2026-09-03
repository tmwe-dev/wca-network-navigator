/**
 * Batch C — test di esecuzione reale per i tool CRM write / batch-ops.
 * Mock solo sul confine I/O: DAL @/data/*, @/lib/api/invokeEdge, @/lib/ai/invokeAi,
 * @/integrations/supabase/client. Nessuna rete reale, nessun invio reale.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

// ---------- DAL mocks ----------
vi.mock("@/data/contacts", () => ({
  createImportedContact: vi.fn(),
  updateContact: vi.fn(),
  updateLeadStatus: vi.fn(),
  deleteContacts: vi.fn(),
  getContactById: vi.fn(),
  linkContactToPartner: vi.fn(),
}));

vi.mock("@/data/partners", () => ({
  createPartner: vi.fn(),
  updatePartner: vi.fn(),
  getPartner: vi.fn(),
  deletePartnersByIds: vi.fn(),
}));

vi.mock("@/data/commandRestoreContact", () => ({
  restoreContactById: vi.fn(),
  restoreContactByTerm: vi.fn(),
}));

vi.mock("@/data/blacklist", () => ({
  insertBlacklistEntry: vi.fn(),
  deleteBlacklistByRef: vi.fn(),
}));

vi.mock("@/data/commandRefResolvers", () => ({
  resolvePartnerRefById: vi.fn(),
  resolvePartnerRefByTerm: vi.fn(),
  resolveContactRefById: vi.fn(),
  resolveContactRefByTerm: vi.fn(),
}));

vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
    })),
  },
}));

import * as contactsDal from "@/data/contacts";
import * as partnersDal from "@/data/partners";
import * as restoreDal from "@/data/commandRestoreContact";
import * as blacklistDal from "@/data/blacklist";
import * as refResolvers from "@/data/commandRefResolvers";
import { invokeEdge } from "@/lib/api/invokeEdge";

import { createContactTool } from "../createContact";
import { updateContactTool } from "../updateContact";
import { createPartnerTool } from "../createPartner";
import { updatePartnerStatusTool } from "../updatePartnerStatus";
import { linkContactPartnerTool } from "../linkContactPartner";
import { restoreContactTool } from "../restoreContact";
import { blacklistAddTool, blacklistRemoveTool } from "../blacklist";
import { deduplicateContactsTool } from "../deduplicateContacts";
import { deduplicatePartnersTool } from "../deduplicatePartners";
import { recalculatePartnerQualityTool } from "../recalculatePartnerQuality";
import { calculateLeadScoresTool } from "../calculateLeadScores";
import { syncBusinessCardsTool } from "../syncBusinessCards";
import { parseBusinessCardTool } from "../parseBusinessCard";

/* eslint-disable @typescript-eslint/no-explicit-any */
const contactRowAny = (o: Partial<Record<string, unknown>> = {}): any => contactRow(o);
const partnerRowAny = (o: Partial<Record<string, unknown>> = {}): any => partnerRow(o);
function contactRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: UUID_A,
    import_log_id: UUID_B,
    name: "Mario Rossi",
    company_name: "Acme Srl",
    email: "mario@acme.it",
    phone: null,
    mobile: null,
    position: null,
    city: null,
    country: "IT",
    origin: null,
    lead_status: "new",
    is_selected: false,
    is_transferred: false,
    wca_partner_id: null,
    wca_match_confidence: null,
    row_number: 1,
    interaction_count: 0,
    last_interaction_at: null,
    created_at: new Date().toISOString(),
    user_id: null,
    ...overrides,
  };
}

function partnerRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: UUID_A,
    company_name: "Acme Partner",
    wca_id: null,
    country_code: "IT",
    country_name: "Italia",
    city: "Milano",
    address: null,
    phone: null,
    mobile: null,
    fax: null,
    emergency_phone: null,
    email: null,
    website: null,
    member_since: null,
    membership_expires: null,
    profile_description: null,
    office_type: null,
    partner_type: null,
    has_branches: null,
    branch_cities: null,
    is_active: true,
    is_favorite: false,
    lead_status: "new",
    logo_url: null,
    rating: null,
    rating_details: null,
    enrichment_data: null,
    enriched_at: null,
    raw_profile_html: null,
    raw_profile_markdown: null,
    ai_parsed_at: null,
    company_alias: null,
    interaction_count: 0,
    last_interaction_at: null,
    converted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createContactTool", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(createContactTool.match("crea un nuovo contatto per Mario Rossi")).toBe(true);
    expect(createContactTool.match("aggiungi contatto")).toBe(true);
    expect(createContactTool.match("che tempo fa oggi")).toBe(false);
  });

  it("senza conferma ritorna approval con pendingPayload", async () => {
    const res = await createContactTool.execute("crea contatto", {
      payload: { name: "Mario Rossi", email: "mario@acme.it" },
    });
    expect(res.kind).toBe("approval");
    if (res.kind === "approval") {
      expect(res.toolId).toBe("create-contact");
      expect(res.pendingPayload.name).toBe("Mario Rossi");
    }
  });

  it("confermato: happy path crea il contatto", async () => {
    vi.mocked(contactsDal.createImportedContact).mockResolvedValue(contactRowAny());
    const res = await createContactTool.execute("crea contatto", {
      confirmed: true,
      payload: { name: "Mario Rossi", email: "mario@acme.it", import_log_id: UUID_B },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") {
      expect(res.message).toContain("Mario Rossi");
      expect(res.meta?.count).toBe(1);
    }
  });

  it("confermato: propaga errore DAL senza crash non gestito", async () => {
    vi.mocked(contactsDal.createImportedContact).mockRejectedValue(new Error("insert failed"));
    await expect(
      createContactTool.execute("crea contatto", { confirmed: true, payload: { name: "X" } }),
    ).rejects.toThrow("insert failed");
  });
});

describe("updateContactTool", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(updateContactTool.match("aggiorna contatto Mario")).toBe(true);
    expect(updateContactTool.match("modifica contatto")).toBe(true);
    expect(updateContactTool.match("crea un report")).toBe(false);
  });

  it("senza conferma ritorna approval", async () => {
    vi.mocked(refResolvers.resolveContactRefByTerm).mockResolvedValue({ id: UUID_A, name: "Mario Rossi" });
    const res = await updateContactTool.execute("aggiorna contatto", {
      payload: { contact_ref: "mario@acme.it", updates: { lead_status: "qualified" } },
    });
    expect(res.kind).toBe("approval");
  });

  it("confermato: happy path aggiorna", async () => {
    vi.mocked(refResolvers.resolveContactRefByTerm).mockResolvedValue({ id: UUID_A, name: "Mario Rossi" });
    vi.mocked(contactsDal.updateLeadStatus).mockResolvedValue(undefined as never);
    vi.mocked(contactsDal.getContactById).mockResolvedValue(contactRowAny({ lead_status: "qualified" }));
    const res = await updateContactTool.execute("aggiorna contatto", {
      confirmed: true,
      payload: { contact_ref: "mario@acme.it", updates: { lead_status: "qualified" } },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("Mario Rossi");
  });

  it("confermato senza updates: errore gestito (throw esplicito)", async () => {
    await expect(
      updateContactTool.execute("aggiorna contatto", {
        confirmed: true,
        payload: { contact_ref: "mario@acme.it", updates: {} },
      }),
    ).rejects.toThrow(/Nessuna modifica/);
  });

  it("confermato con ref non trovato: errore esplicito", async () => {
    vi.mocked(refResolvers.resolveContactRefByTerm).mockResolvedValue(null);
    await expect(
      updateContactTool.execute("aggiorna contatto", {
        confirmed: true,
        payload: { contact_ref: "sconosciuto@x.it", updates: { lead_status: "qualified" } },
      }),
    ).rejects.toThrow(/non trovato/);
  });
});

describe("createPartnerTool", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(createPartnerTool.match("crea partner Acme")).toBe(true);
    expect(createPartnerTool.match("aggiungi partner")).toBe(true);
    expect(createPartnerTool.match("mostrami i partner")).toBe(false);
  });

  it("senza conferma ritorna approval", async () => {
    const res = await createPartnerTool.execute("crea partner", {
      payload: { company_name: "Acme Partner" },
    });
    expect(res.kind).toBe("approval");
  });

  it("confermato: happy path", async () => {
    vi.mocked(partnersDal.createPartner).mockResolvedValue(partnerRowAny());
    const res = await createPartnerTool.execute("crea partner", {
      confirmed: true,
      payload: { company_name: "Acme Partner", country_name: "Italia" },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("Acme Partner");
  });

  it("confermato: errore DAL propagato", async () => {
    vi.mocked(partnersDal.createPartner).mockRejectedValue(new Error("db down"));
    await expect(
      createPartnerTool.execute("crea partner", { confirmed: true, payload: { company_name: "X" } }),
    ).rejects.toThrow("db down");
  });
});

describe("updatePartnerStatusTool", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(updatePartnerStatusTool.match("marca partner Acme come qualificato")).toBe(true);
    expect(updatePartnerStatusTool.match("cambia stato partner Acme")).toBe(true);
    expect(updatePartnerStatusTool.match("crea contatto")).toBe(false);
  });

  it("senza conferma ritorna approval", async () => {
    vi.mocked(refResolvers.resolvePartnerRefByTerm).mockResolvedValue({ id: UUID_A, company_name: "Acme Partner" });
    const res = await updatePartnerStatusTool.execute("aggiorna partner", {
      payload: { partner_ref: "Acme Partner", lead_status: "qualified" },
    });
    expect(res.kind).toBe("approval");
  });

  it("confermato: happy path", async () => {
    vi.mocked(refResolvers.resolvePartnerRefByTerm).mockResolvedValue({ id: UUID_A, company_name: "Acme Partner" });
    vi.mocked(partnersDal.updatePartner).mockResolvedValue(undefined as never);
    vi.mocked(partnersDal.getPartner).mockResolvedValue(partnerRowAny({ lead_status: "qualified" }));
    const res = await updatePartnerStatusTool.execute("aggiorna partner", {
      confirmed: true,
      payload: { partner_ref: "Acme Partner", lead_status: "qualified" },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("qualified");
  });

  it("confermato senza nuovo stato: errore esplicito", async () => {
    await expect(
      updatePartnerStatusTool.execute("aggiorna partner", {
        confirmed: true,
        payload: { partner_ref: "Acme Partner", lead_status: "" },
      }),
    ).rejects.toThrow(/Nuovo stato mancante/);
  });
});

describe("linkContactPartnerTool", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(linkContactPartnerTool.match("collega contatto Mario a partner Acme")).toBe(true);
    expect(linkContactPartnerTool.match("associa il contatto al partner Acme")).toBe(true);
    expect(linkContactPartnerTool.match("crea partner")).toBe(false);
  });

  it("senza conferma ritorna approval", async () => {
    const res = await linkContactPartnerTool.execute("collega", {
      payload: { contact_id: UUID_A, partner_id: UUID_B },
    });
    expect(res.kind).toBe("approval");
  });

  it("confermato: happy path", async () => {
    vi.mocked(refResolvers.resolveContactRefById).mockResolvedValue({ id: UUID_A, name: "Mario Rossi" });
    vi.mocked(refResolvers.resolvePartnerRefById).mockResolvedValue({ id: UUID_B, company_name: "Acme Partner" });
    vi.mocked(contactsDal.linkContactToPartner).mockResolvedValue(undefined as never);
    const res = await linkContactPartnerTool.execute("collega", {
      confirmed: true,
      payload: { contact_id: UUID_A, partner_id: UUID_B },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("Mario Rossi");
    expect(contactsDal.linkContactToPartner).toHaveBeenCalledWith(UUID_A, UUID_B);
  });

  it("confermato senza riferimenti: errore esplicito", async () => {
    await expect(
      linkContactPartnerTool.execute("collega", { confirmed: true, payload: {} }),
    ).rejects.toThrow(/Servono sia contatto che partner/);
  });
});

describe("restoreContactTool", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(restoreContactTool.match("ripristina contatto Mario")).toBe(true);
    expect(restoreContactTool.match("recupera contatto")).toBe(true);
    expect(restoreContactTool.match("elimina contatto")).toBe(false);
  });

  it("senza conferma ritorna approval", async () => {
    const res = await restoreContactTool.execute("ripristina contatto", {
      payload: { contact_ref: "mario@acme.it" },
    });
    expect(res.kind).toBe("approval");
  });

  it("confermato: happy path via id", async () => {
    vi.mocked(restoreDal.restoreContactById).mockResolvedValue({ error: null, count: 1 });
    const res = await restoreContactTool.execute("ripristina contatto", {
      confirmed: true,
      payload: { contact_id: UUID_A },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.meta?.count).toBe(1);
  });

  it("confermato: errore DAL propagato", async () => {
    vi.mocked(restoreDal.restoreContactByTerm).mockResolvedValue({ error: { message: "boom" }, count: null });
    await expect(
      restoreContactTool.execute("ripristina contatto", {
        confirmed: true,
        payload: { contact_ref: "mario@acme.it" },
      }),
    ).rejects.toThrow("boom");
  });
});

describe("blacklistAddTool / blacklistRemoveTool", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(blacklistAddTool.match('aggiungi "Acme Srl" alla blacklist')).toBe(true);
    expect(blacklistRemoveTool.match('rimuovi "Acme Srl" dalla blacklist')).toBe(true);
    expect(blacklistAddTool.match("crea contatto")).toBe(false);
  });

  it("blacklist-add senza conferma ritorna approval", async () => {
    const res = await blacklistAddTool.execute('aggiungi "Acme Srl" alla blacklist', {
      payload: { company_name: "Acme Srl" },
    });
    expect(res.kind).toBe("approval");
  });

  it("blacklist-add confermato: happy path", async () => {
    vi.mocked(refResolvers.resolvePartnerRefByTerm).mockResolvedValue(null);
    vi.mocked(blacklistDal.insertBlacklistEntry).mockResolvedValue(undefined as never);
    const res = await blacklistAddTool.execute('aggiungi "Acme Srl" alla blacklist', {
      confirmed: true,
      payload: { company_name: "Acme Srl" },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("Acme Srl");
  });

  it("blacklist-add confermato senza riferimento: errore esplicito", async () => {
    await expect(
      blacklistAddTool.execute("aggiungi alla blacklist", { confirmed: true, payload: {} }),
    ).rejects.toThrow(/Riferimento partner\/azienda mancante/);
  });

  it("blacklist-remove confermato: happy path", async () => {
    vi.mocked(blacklistDal.deleteBlacklistByRef).mockResolvedValue(2);
    const res = await blacklistRemoveTool.execute('rimuovi "Acme Srl" dalla blacklist', {
      confirmed: true,
      payload: { company_name: "Acme Srl" },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.meta?.count).toBe(2);
  });
});

describe("deduplicateContactsTool (via invokeAi -> invokeEdge)", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(deduplicateContactsTool.match("deduplica i contatti")).toBe(true);
    expect(deduplicateContactsTool.match("trova duplicati")).toBe(true);
    expect(deduplicateContactsTool.match("crea partner")).toBe(false);
  });

  it("senza conferma ritorna approval", async () => {
    const res = await deduplicateContactsTool.execute("deduplica contatti", {});
    expect(res.kind).toBe("approval");
  });

  it("confermato: happy path (edge mocked)", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({ merged: 3, scanned: 100 });
    const res = await deduplicateContactsTool.execute("deduplica contatti", { confirmed: true });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("3");
  });

  it("dati vuoti dall'edge: nessun throw, messaggio con 0", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({});
    const res = await deduplicateContactsTool.execute("deduplica contatti", { confirmed: true });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("0");
  });
});

describe("deduplicatePartnersTool", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(deduplicatePartnersTool.match("deduplica i partner")).toBe(true);
    expect(deduplicatePartnersTool.match("fondi le aziende duplicate")).toBe(true);
    expect(deduplicatePartnersTool.match("ciao")).toBe(false);
  });

  it("senza conferma ritorna approval", async () => {
    const res = await deduplicatePartnersTool.execute("deduplica partner", {});
    expect(res.kind).toBe("approval");
  });

  it("confermato: happy path", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({ merged: 5, reviewed: 40 });
    const res = await deduplicatePartnersTool.execute("deduplica partner", { confirmed: true });
    expect(res.kind).toBe("result");
    if (res.kind === "result") {
      expect(res.title).toBe("Deduplica completata");
      expect(res.meta?.count).toBe(5);
    }
  });

  it("errore edge: risultato 'result' con titolo di fallimento, nessun throw", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({ error: "timeout" });
    const res = await deduplicatePartnersTool.execute("deduplica partner", { confirmed: true });
    expect(res.kind).toBe("result");
    if (res.kind === "result") {
      expect(res.title).toBe("Deduplica fallita");
      expect(res.message).toBe("timeout");
    }
  });
});

describe("recalculatePartnerQualityTool", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(recalculatePartnerQualityTool.match("ricalcola quality score partner")).toBe(true);
    expect(recalculatePartnerQualityTool.match("aggiorna il punteggio partner")).toBe(true);
    expect(recalculatePartnerQualityTool.match("elenco partner")).toBe(false);
  });

  it("senza conferma ritorna approval", async () => {
    const res = await recalculatePartnerQualityTool.execute("ricalcola quality score", {});
    expect(res.kind).toBe("approval");
  });

  it("confermato: happy path", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({ updated: 12 });
    const res = await recalculatePartnerQualityTool.execute("ricalcola quality score", { confirmed: true });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.meta?.count).toBe(12);
  });

  it("edge in errore: result con titolo fallito, nessun throw", async () => {
    vi.mocked(invokeEdge).mockRejectedValue(new Error("network"));
    await expect(
      recalculatePartnerQualityTool.execute("ricalcola quality score", { confirmed: true }),
    ).rejects.toThrow("network");
  });
});

describe("calculateLeadScoresTool (via invokeAi -> invokeEdge)", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(calculateLeadScoresTool.match("ricalcola lead score")).toBe(true);
    expect(calculateLeadScoresTool.match("calcola gli score")).toBe(true);
    expect(calculateLeadScoresTool.match("crea contatto")).toBe(false);
  });

  it("senza conferma ritorna approval", async () => {
    const res = await calculateLeadScoresTool.execute("ricalcola lead score", {});
    expect(res.kind).toBe("approval");
  });

  it("confermato: happy path", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({ updated: 42 });
    const res = await calculateLeadScoresTool.execute("ricalcola lead score", { confirmed: true });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("42");
  });
});

describe("syncBusinessCardsTool", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(syncBusinessCardsTool.match("sincronizza i biglietti da visita")).toBe(true);
    expect(syncBusinessCardsTool.match("importa business card")).toBe(true);
    expect(syncBusinessCardsTool.match("crea partner")).toBe(false);
  });

  it("senza conferma ritorna approval", async () => {
    const res = await syncBusinessCardsTool.execute("sync business card", {});
    expect(res.kind).toBe("approval");
  });

  it("confermato: happy path", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({ imported: 7, matched: 5 });
    const res = await syncBusinessCardsTool.execute("sync business card", { confirmed: true });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toContain("7");
  });

  it("errore edge: result con titolo fallito, nessun throw", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({ error: "feed offline" });
    const res = await syncBusinessCardsTool.execute("sync business card", { confirmed: true });
    expect(res.kind).toBe("result");
    if (res.kind === "result") {
      expect(res.title).toBe("Sync fallita");
      expect(res.message).toBe("feed offline");
    }
  });
});

describe("parseBusinessCardTool (via invokeAi -> invokeEdge)", () => {
  it("match() riconosce prompt positivi/negativi", () => {
    expect(parseBusinessCardTool.match("leggi il biglietto da visita")).toBe(true);
    expect(parseBusinessCardTool.match("business card ocr")).toBe(true);
    expect(parseBusinessCardTool.match("crea contatto")).toBe(false);
  });

  it("senza conferma ritorna approval con imageUrl estratto", async () => {
    const res = await parseBusinessCardTool.execute("leggi il biglietto da visita https://x.test/card.png", {});
    expect(res.kind).toBe("approval");
    if (res.kind === "approval") {
      expect(res.pendingPayload.imageUrl).toBe("https://x.test/card.png");
    }
  });

  it("confermato senza URL: nessun throw, messaggio esplicito", async () => {
    const res = await parseBusinessCardTool.execute("leggi biglietto", { confirmed: true, payload: {} });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toMatch(/URL pubblico/);
  });

  it("confermato: happy path estrae dati", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({ data: { name: "Mario Rossi", email: "mario@acme.it" } });
    const res = await parseBusinessCardTool.execute("leggi biglietto", {
      confirmed: true,
      payload: { imageUrl: "https://x.test/card.png" },
    });
    expect(res.kind).toBe("report");
    if (res.kind === "report") expect(res.sections[0].body).toContain("Mario Rossi");
  });

  it("edge in errore: nessun throw, result con messaggio d'errore", async () => {
    vi.mocked(invokeEdge).mockResolvedValue({ error: "ocr failure" });
    const res = await parseBusinessCardTool.execute("leggi biglietto", {
      confirmed: true,
      payload: { imageUrl: "https://x.test/card.png" },
    });
    expect(res.kind).toBe("result");
    if (res.kind === "result") expect(res.message).toBe("ocr failure");
  });
});
