/**
 * Batch F — matrice di routing: verifica quale tool viene selezionato dal registry
 * per una vasta gamma di prompt italiani reali. Nessuna chiamata AI reale
 * (il planner @/v2/io/edge/aiAssistant è mockato).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/v2/io/edge/aiAssistant", () => ({
  decideToolFromPrompt: vi.fn().mockResolvedValue({ _tag: "Ok", value: { toolId: "none" } }),
}));

import { resolveTool } from "../registry";

async function expectTool(prompt: string, toolId: string | null) {
  const tool = await resolveTool(prompt);
  expect([prompt, tool?.id ?? null]).toEqual([prompt, toolId]);
}

describe("Batch F — routing matrix", () => {
  it("naviga verso pagine dell'app", async () => {
    await expectTool("vai alla pagina contatti", "navigate-to");
    await expectTool("apri la sezione partner", "navigate-to");
    await expectTool("portami alla dashboard campagne", "navigate-to");
    await expectTool("dove si trova la blacklist", "navigate-to");
    await expectTool("come arrivo alla pagina biglietti da visita", "navigate-to");
  });

  it("mappa del software", async () => {
    await expectTool("elenco pagine dell'applicazione", "app-map");
    await expectTool("qual è la struttura del software", "app-map");
  });

  it("query dati partner/contatti", async () => {
    await expectTool("mostra i partner attivi in Italia", "ai-query");
    await expectTool("quanti contatti abbiamo in Germania", "ai-query");
    await expectTool("cerca il contatto Mario Rossi", "ai-query");
    await expectTool("elenca gli ultimi partner aggiunti", "ai-query");
    await expectTool("visualizza i dettagli del partner Radiant", "ai-query");
  });

  it("deep search contatti/partner", async () => {
    await expectTool("trova contatto Luca Bianchi", "deep-search-contact");
    await expectTool("deep search contatto Mario", "deep-search-contact");
    await expectTool("approfondisci partner Acme come azienda", "deep-search-partner");
  });

  it("conteggi paese / analisi", async () => {
    await expectTool("quanti partner ci sono per ogni paese", "wca-country-counts");
    await expectTool("dammi un'analisi strategica cross-partner", "optimus-analyze");
    await expectTool("analizza partner con id fittizio", "analyze-partner");
  });

  it("knowledge base", async () => {
    await expectTool("cerca nella knowledge base come configurare le campagne", "search-kb");
    await expectTool("come si fa a creare una campagna email", "search-kb");
    await expectTool("dammi la guida per l'onboarding partner", "search-kb");
    await expectTool("workflow per la gestione delle campagne", "search-kb");
    // Bug trovato e corretto: "voce KB" faceva scattare search-kb invece di create-kb-entry.
    await expectTool("crea una nuova voce KB su onboarding", "create-kb-entry");
    await expectTool("aggiorna entry kb sul processo di onboarding", "update-kb-entry");
    await expectTool("elimina la voce kb obsoleta", "delete-kb-entry");
    await expectTool("ingest del documento manuale.pdf nella kb", "kb-ingest-document");
    await expectTool("genera scheda kb per il paese Malta", "country-kb-generator");
  });

  it("inbox email", async () => {
    await expectTool("mostra la posta in arrivo", "read-inbox");
    await expectTool("quali email non lette ho", "read-inbox");
    await expectTool("elenca i messaggi ricevuti oggi", "read-inbox");
    await expectTool("applica le regole email alla inbox", "apply-email-rules");
    await expectTool("crea una cartella email chiamata Fatture", "manage-email-folders");
    await expectTool("suggerisci gruppi email per i contatti inattivi", "suggest-email-groups");
    await expectTool("analizza la modifica email rispetto alla versione ai originale", "analyze-email-edit");
    await expectTool("segna il messaggio come letto", "mark-message");
  });

  it("agenda e attività", async () => {
    await expectTool("mostra la mia agenda di oggi", "list-agenda");
    await expectTool("cosa devo fare oggi", "daily-briefing");
    await expectTool("programma un'attività per la chiamata di domani", "schedule-activity");
    await expectTool("sposta l'attività al 2024-06-01", "reschedule-activity");
    await expectTool("completa l'attività di follow up", "close-activity");
  });

  it("missioni", async () => {
    await expectTool("elenca le missioni autopilot", "list-missions");
    await expectTool("quante missioni sono attive", "list-missions");
    await expectTool("avvia la missione Malta Q1", "launch-mission");
    await expectTool("metti in pausa la missione Malta", "mission-control");
  });

  it("outreach e campagne", async () => {
    await expectTool("programma outreach per i nuovi partner", "enqueue-outreach");
    await expectTool("mostra lo stato della coda di outreach", "outreach-queue");
    await expectTool("cancella l'outreach per Mario Rossi", "cancel-outreach-item");
    await expectTool("crea la campagna Malta Q1", "create-campaign");
    await expectTool("mostra lo stato delle campagne attive", "campaign-status");
    await expectTool("prepara un batch di follow up per i clienti inattivi", "followup-batch");
    await expectTool("dammi il report settimanale degli agenti", "agent-report");
  });

  it("invii diretti (whatsapp/linkedin/email)", async () => {
    await expectTool("invia un messaggio whatsapp a +391234567890", "send-whatsapp");
    await expectTool("manda un messaggio linkedin a Mario", "send-linkedin");
    await expectTool("invia subito questa email a mario@acme.com", "compose-email");
  });

  it("scraping e enrichment", async () => {
    await expectTool("scrape il sito https://acme.com", "scrape-website");
    await expectTool("estrai i dati dal sito https://beta.com", "scrape-website");
    await expectTool("scrapa il sito del partner Acme", "scrape-partner-website");
    // Bug trovato e corretto: la regex di scrape-partner-website catturava anche i prospect.
    await expectTool("analizza il sito del prospect Beta", "scrape-prospect-website");
    await expectTool("scrape il sito aziendale https://acme.com", "scrape-website");
    await expectTool("cerca il profilo linkedin di Mario Rossi", "linkedin-profile-api");
    await expectTool("arricchisci il prospect di Beta dal sito web", "enrich-prospect-from-website");
    await expectTool("arricchisci i dati e i siti dei partner trovati nell'ultima ricerca", "batch-enrich-partners");
  });

  it("browser automation", async () => {
    await expectTool("compila il form di iscrizione con i dati del contatto", "browser-fill-form");
    await expectTool("invia il form precedentemente compilato", "browser-auto-complete");
    await expectTool("naviga il sito https://esempio.com ed estrai il testo", "browser-navigate-extract");
  });

  it("introspezione campi", async () => {
    await expectTool("quali sono i valori del campo status dei partner", "field-values");
    await expectTool("elenca i valori distinti del campo country", "field-values");
  });

  it("dashboard e health check", async () => {
    await expectTool("mostra la dashboard", "dashboard-snapshot");
    await expectTool("dammi un riepilogo del sistema", "dashboard-snapshot");
    await expectTool("esegui un health check del sistema", "health-check");
    await expectTool("è tutto ok con le integrazioni", "health-check");
    await expectTool("dammi il briefing di oggi", "daily-briefing");
  });

  it("scritture CRM e admin", async () => {
    await expectTool("crea un nuovo contatto per Mario Rossi", "create-contact");
    await expectTool("aggiorna contatto con nuovo telefono", "update-contact");
    await expectTool("crea partner Acme Corp", "create-partner");
    await expectTool("cambia stato del partner Acme a qualificato", "update-partner-status");
    await expectTool("crea agente Sales Bot", "create-agent");
    await expectTool("calcola lead score dei contatti", "calculate-lead-scores");
    await expectTool("deduplica contatti duplicati", "deduplicate-contacts");
    await expectTool("deduplica partner duplicati", "deduplicate-partners");
    await expectTool("ricalcola il quality score dei partner", "recalculate-partner-quality");
    await expectTool("collega il contatto al partner Acme", "link-contact-partner");
    await expectTool("aggiungi il partner Acme alla blacklist", "blacklist-add");
    await expectTool("rimuovi il partner Acme dalla blacklist", "blacklist-remove");
    await expectTool("disattiva l'agente Sales Bot", "toggle-agent");
    await expectTool("aggiorna il tono dell'agente Sales Bot", "update-agent-persona");
    await expectTool("ripristina il contatto cancellato", "restore-contact");
    await expectTool("esegui il test del prompt di onboarding", "run-prompt-test");
    await expectTool("sincronizza i biglietti da visita dal feed", "sync-business-cards");
    await expectTool("leggi il biglietto da visita nell'immagine", "parse-business-card");
    await expectTool("esegui pending action in sospeso", "pending-action-executor");
    await expectTool("armonizza la proposta della chat con il cliente", "harmonize-proposal-chat");
    await expectTool("riproduci gli eventi domain degli ultimi 3 giorni", "replay-domain-events");
    await expectTool("esporta l'audit log delle azioni in csv", "export-audit-csv");
    await expectTool("analizza la struttura del file import.csv", "analyze-import-structure");
  });

  it("smalltalk → nessun tool (fallback AI mockato a 'none')", async () => {
    await expectTool("ciao come stai", null);
    await expectTool("grazie mille per l'aiuto", null);
    await expectTool("buongiorno", null);
  });
});
