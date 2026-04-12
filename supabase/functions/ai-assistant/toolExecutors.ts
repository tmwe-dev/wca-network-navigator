/**
 * toolExecutors.ts — Tool execution handlers + dispatcher.
 * Extracted from ai-assistant/index.ts (lines 1383-2696).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { escapeLike } from "../_shared/sqlEscape.ts";
import { extractErrorMessage } from "../_shared/handleEdgeError.ts";

type SupabaseClient = ReturnType<typeof createClient>;

interface ReadHandlers { executeSearchPartners: Function; executeCountryOverview: Function; executeDirectoryStatus: Function; executeListJobs: Function; executePartnerDetail: Function; executeGlobalSummary: Function; executeCheckBlacklist: Function; executeListReminders: Function; executePartnersWithoutContacts: Function; executeSearchContacts: Function; executeGetContactDetail: Function; executeSearchProspects: Function; executeListActivities: Function; executeSearchBusinessCards: Function; executeCheckJobStatus: Function; }
interface WriteHandlers { executeUpdatePartner: Function; executeAddPartnerNote: Function; executeCreateReminder: Function; executeUpdateLeadStatus: Function; executeBulkUpdatePartners: Function; executeLinkBusinessCard: Function; executeCreateActivity: Function; executeUpdateActivity: Function; executeManagePartnerContact: Function; executeUpdateReminder: Function; executeDeleteRecords: Function; executeGenerateOutreach: Function; executeSendEmail: Function; executeDeepSearchPartner: Function; executeDeepSearchContact: Function; executeEnrichPartnerWebsite: Function; executeScanDirectory: Function; executeGenerateAliases: Function; }
interface EnterpriseHandlers { executeSaveMemory: Function; executeSearchMemory: Function; executeCreateWorkPlan: Function; executeExecutePlanStep: Function; executeGetActivePlans: Function; executeSaveAsTemplate: Function; executeSearchTemplates: Function; executeSaveKbRule: Function; executeSaveOperativePrompt: Function; executeListWorkflows: Function; executeStartWorkflow: Function; executeAdvanceWorkflowGate: Function; executeListPlaybooks: Function; executeApplyPlaybook: Function; executeUiAction: Function; executeSearchKb: Function; }

export interface ToolExecutorDeps {
  supabase: SupabaseClient;
  readH: ReadHandlers;
  writeH: WriteHandlers;
  entH: EnterpriseHandlers;
}

// ━━━ Procedures Knowledge Base ━━━

interface ProcedureStep { order: number; action: string; tool: string | null; }
interface Procedure { id: string; name: string; category: string; channels?: string[]; prerequisites: string[]; steps: ProcedureStep[]; tips: string[]; }

const PROCEDURES_DB: Record<string, Procedure> = {
  email_single: { id: "email_single", name: "Email Singola", category: "outreach", channels: ["email"], prerequisites: ["Profilo AI configurato", "Email destinatario valida", "Obiettivo definito"], steps: [{ order: 1, action: "Identifica destinatario", tool: "search_partners" }, { order: 2, action: "Recupera dati completi", tool: "get_partner_detail" }, { order: 3, action: "Verifica blacklist", tool: "check_blacklist" }, { order: 4, action: "Carica profilo AI e KB", tool: "search_memory" }, { order: 5, action: "Genera messaggio", tool: "generate_outreach" }, { order: 6, action: "Revisiona con utente", tool: null }, { order: 7, action: "Invia email", tool: "send_email" }, { order: 8, action: "Registra interazione", tool: "add_partner_note" }], tips: ["Quality 'premium' per email strategiche", "Personalizza con 3+ dati partner"] },
  email_campaign: { id: "email_campaign", name: "Campagna Email Massiva", category: "outreach", channels: ["email"], prerequisites: ["Profilo AI configurato", "5+ destinatari con email", "Obiettivo definito"], steps: [{ order: 1, action: "Seleziona destinatari", tool: "search_partners" }, { order: 2, action: "Verifica blacklist", tool: "check_blacklist" }, { order: 3, action: "Definisci obiettivo", tool: null }, { order: 4, action: "Genera email modello", tool: "generate_outreach" }, { order: 5, action: "Approva e lancia coda", tool: null }, { order: 6, action: "Monitora invio", tool: "check_job_status" }], tips: ["Limita a 50-100 destinatari", "Delay 30-60s tra invii"] },
  linkedin_message: { id: "linkedin_message", name: "Messaggio LinkedIn", category: "outreach", channels: ["linkedin"], prerequisites: ["Profilo AI configurato", "Contatto identificato"], steps: [{ order: 1, action: "Identifica contatto", tool: "search_partners" }, { order: 2, action: "Verifica LinkedIn", tool: "get_partner_detail" }, { order: 3, action: "Genera messaggio", tool: "generate_outreach" }, { order: 4, action: "Mostra per copia", tool: null }, { order: 5, action: "Registra attività", tool: "create_activity" }], tips: ["Max 300 char", "Menziona collegamento in comune"] },
  whatsapp_message: { id: "whatsapp_message", name: "Messaggio WhatsApp", category: "outreach", channels: ["whatsapp"], prerequisites: ["Contatto con cellulare"], steps: [{ order: 1, action: "Cerca contatto con mobile", tool: "search_partners" }, { order: 2, action: "Genera messaggio", tool: "generate_outreach" }, { order: 3, action: "Mostra per invio", tool: null }, { order: 4, action: "Registra attività", tool: "create_activity" }], tips: ["Tono informale ma professionale"] },
  sms_message: { id: "sms_message", name: "SMS", category: "outreach", channels: ["sms"], prerequisites: ["Contatto con cellulare"], steps: [{ order: 1, action: "Cerca contatto", tool: "search_partners" }, { order: 2, action: "Genera SMS", tool: "generate_outreach" }, { order: 3, action: "Mostra", tool: null }], tips: ["Max 160 caratteri"] },
  multi_channel_sequence: { id: "multi_channel_sequence", name: "Sequenza Multi-Canale", category: "outreach", channels: ["email", "linkedin", "whatsapp"], prerequisites: ["Profilo AI", "Email destinatario", "Obiettivo"], steps: [{ order: 1, action: "Verifica canali disponibili", tool: "get_partner_detail" }, { order: 2, action: "Email giorno 1", tool: "generate_outreach" }, { order: 3, action: "Pianifica LinkedIn giorno 3", tool: "create_activity" }, { order: 4, action: "Genera LinkedIn", tool: "generate_outreach" }, { order: 5, action: "Pianifica WhatsApp giorno 7", tool: "create_activity" }, { order: 6, action: "Reminder giorno 14", tool: "create_reminder" }], tips: ["Email→3gg→LinkedIn→4gg→WhatsApp", "Max 3 touchpoint senza risposta"] },
  scan_country: { id: "scan_country", name: "Scansione Directory Paese", category: "network", prerequisites: ["Sessione WCA attiva"], steps: [{ order: 1, action: "Verifica cache", tool: "get_directory_status" }, { order: 2, action: "Scansiona", tool: "scan_directory" }, { order: 3, action: "Confronta con DB", tool: "get_country_overview" }, { order: 4, action: "Suggerisci download", tool: null }], tips: ["Scansiona ogni 2-4 settimane"] },
  download_profiles: { id: "download_profiles", name: "Download Profili Paese", category: "network", prerequisites: ["Sessione WCA", "Directory scansionata", "No job attivi"], steps: [{ order: 1, action: "Verifica prerequisiti", tool: "get_directory_status" }, { order: 2, action: "Controlla job attivi", tool: "list_jobs" }, { order: 3, action: "Scegli mode", tool: null }, { order: 4, action: "Crea job", tool: "create_download_job" }, { order: 5, action: "Verifica avvio", tool: "check_job_status" }], tips: ["Mode 'no_profile' per completare paesi parziali", "Delay 30-45s"] },
  download_single: { id: "download_single", name: "Download Singolo Partner", category: "network", prerequisites: ["Sessione WCA"], steps: [{ order: 1, action: "Cerca partner", tool: "search_partners" }, { order: 2, action: "Download", tool: "download_single_partner" }, { order: 3, action: "Verifica", tool: "check_job_status" }], tips: ["NON usare create_download_job per singolo partner"] },
  deep_search_partner: { id: "deep_search_partner", name: "Deep Search Partner", category: "enrichment", prerequisites: ["Partner esiste", "Crediti sufficienti"], steps: [{ order: 1, action: "Dettagli partner", tool: "get_partner_detail" }, { order: 2, action: "Deep Search", tool: "deep_search_partner" }, { order: 3, action: "Verifica risultati", tool: "get_partner_detail" }], tips: ["Più efficace con sito web"] },
  enrich_website: { id: "enrich_website", name: "Arricchimento Sito Web", category: "enrichment", prerequisites: ["Partner ha website", "Crediti"], steps: [{ order: 1, action: "Verifica website", tool: "get_partner_detail" }, { order: 2, action: "Enrichment", tool: "enrich_partner_website" }, { order: 3, action: "Mostra risultati", tool: "get_partner_detail" }], tips: ["Combina con Deep Search"] },
  import_contacts: { id: "import_contacts", name: "Importazione Contatti", category: "crm", prerequisites: [], steps: [{ order: 1, action: "Carica file", tool: null }, { order: 2, action: "Analizza struttura", tool: null }, { order: 3, action: "Mappa colonne", tool: null }, { order: 4, action: "Importa", tool: null }, { order: 5, action: "Verifica", tool: "search_contacts" }], tips: ["Supporta CSV, Excel, TSV"] },
  deep_search_contact: { id: "deep_search_contact", name: "Deep Search Contatto", category: "crm", prerequisites: ["Contatto esiste", "Crediti"], steps: [{ order: 1, action: "Identifica", tool: "get_contact_detail" }, { order: 2, action: "Deep Search", tool: "deep_search_contact" }, { order: 3, action: "Verifica", tool: "get_contact_detail" }], tips: ["Meglio con nome+azienda+paese"] },
  update_lead_status: { id: "update_lead_status", name: "Aggiornamento Stato Lead", category: "crm", prerequisites: [], steps: [{ order: 1, action: "Filtra record", tool: "search_contacts" }, { order: 2, action: "Conferma selezione", tool: null }, { order: 3, action: "Aggiorna", tool: "update_lead_status" }], tips: ["Conferma per >5 record"] },
  assign_activity: { id: "assign_activity", name: "Assegnazione Attività", category: "crm", prerequisites: [], steps: [{ order: 1, action: "Identifica target", tool: "search_partners" }, { order: 2, action: "Crea attività", tool: "create_activity" }, { order: 3, action: "Conferma", tool: "list_activities" }], tips: ["Due date realistica"] },
  create_followup: { id: "create_followup", name: "Creazione Follow-up", category: "agenda", prerequisites: [], steps: [{ order: 1, action: "Identifica partner", tool: "search_partners" }, { order: 2, action: "Crea attività", tool: "create_activity" }, { order: 3, action: "Crea reminder", tool: "create_reminder" }], tips: ["Follow-up ideale entro 3 giorni"] },
  schedule_meeting: { id: "schedule_meeting", name: "Pianificazione Meeting", category: "agenda", prerequisites: [], steps: [{ order: 1, action: "Identifica partecipanti", tool: "get_partner_detail" }, { order: 2, action: "Crea attività meeting", tool: "create_activity" }, { order: 3, action: "Email invito", tool: "generate_outreach" }], tips: ["Specifica orario, luogo/link, agenda"] },
  manage_reminders: { id: "manage_reminders", name: "Gestione Reminder", category: "agenda", prerequisites: [], steps: [{ order: 1, action: "Elenca reminder", tool: "list_reminders" }, { order: 2, action: "Crea/aggiorna", tool: "create_reminder" }, { order: 3, action: "Completa", tool: "update_reminder" }], tips: ["Priorità 'high' per scadenze critiche"] },
  generate_aliases: { id: "generate_aliases", name: "Generazione Alias AI", category: "system", prerequisites: [], steps: [{ order: 1, action: "Seleziona target", tool: "search_partners" }, { order: 2, action: "Genera", tool: "generate_aliases" }, { order: 3, action: "Verifica", tool: "search_partners" }], tips: ["Max 20 per batch"] },
  blacklist_check: { id: "blacklist_check", name: "Verifica Blacklist", category: "system", prerequisites: [], steps: [{ order: 1, action: "Cerca", tool: "check_blacklist" }, { order: 2, action: "Mostra risultati", tool: null }], tips: ["Verifica SEMPRE prima di collaborare"] },
  bulk_update: { id: "bulk_update", name: "Aggiornamento Massivo", category: "system", prerequisites: [], steps: [{ order: 1, action: "Filtra", tool: "search_partners" }, { order: 2, action: "Conferma (OBBLIGATORIO)", tool: null }, { order: 3, action: "Aggiorna", tool: "bulk_update_partners" }, { order: 4, action: "Verifica", tool: "search_partners" }], tips: ["SEMPRE conferma per >5 record"] },
};

function executeGetProcedure(args: Record<string, unknown>): unknown {
  if (args.procedure_id) {
    const proc = PROCEDURES_DB[String(args.procedure_id)];
    if (proc) return { procedure: proc };
    return { error: `Procedura '${args.procedure_id}' non trovata. Procedure disponibili: ${Object.keys(PROCEDURES_DB).join(", ")}` };
  }
  if (args.search_tags && Array.isArray(args.search_tags)) {
    const tags = (args.search_tags as string[]).map(t => t.toLowerCase());
    const matches = Object.values(PROCEDURES_DB).filter((p) => {
      const procText = `${p.id} ${p.name} ${p.category} ${(p.channels || []).join(" ")}`.toLowerCase();
      return tags.some(t => procText.includes(t));
    });
    if (matches.length > 0) return { procedures: matches, count: matches.length };
    return { procedures: [], count: 0, available: Object.keys(PROCEDURES_DB) };
  }
  return { procedures: Object.values(PROCEDURES_DB), count: Object.keys(PROCEDURES_DB).length };
}

// ━━━ Inline executors (not in shared modules) ━━━

async function executeCreateDownloadJob(supabase: SupabaseClient, args: Record<string, unknown>): Promise<unknown> {
  const countryCode = String(args.country_code || "").toUpperCase();
  const countryName = String(args.country_name || "");
  const mode = String(args.mode || "no_profile");
  const networkName = String(args.network_name || "Tutti");
  const delaySec = Math.max(15, Number(args.delay_seconds) || 15);

  if (!countryCode || !countryName) return { error: "country_code e country_name sono obbligatori" };

  const { data: activeJobs } = await supabase.from("download_jobs").select("id, country_code, status").in("status", ["pending", "running"]).limit(5);
  if (activeJobs && activeJobs.length > 0) {
    const sameCountry = (activeJobs as Record<string, unknown>[]).find((j) => j.country_code === countryCode);
    if (sameCountry) return { error: `Esiste già un job attivo per ${countryName} (${countryCode}).`, active_job_id: sameCountry.id };
    if (activeJobs.length >= 1) return { error: `C'è già un job attivo (${(activeJobs[0] as Record<string, unknown>).country_code}). Attendi il completamento prima di avviarne un altro.`, active_job_id: (activeJobs[0] as Record<string, unknown>).id };
  }

  const { data: deadRows } = await supabase.from("partners_no_contacts").select("wca_id").eq("resolved", false);
  const deadIdSet = new Set((deadRows || []).map((r: Record<string, unknown>) => Number(r.wca_id)));

  let wcaIds: number[] = [];
  if (mode === "new") {
    const { data: cacheRows } = await supabase.from("directory_cache").select("members").eq("country_code", countryCode);
    if (!cacheRows || cacheRows.length === 0) return { error: `Nessuna directory cache per ${countryName}. Esegui prima una scansione directory.` };
    const dirIds: number[] = [];
    for (const row of cacheRows) { const members = row.members as Record<string, unknown>[]; if (Array.isArray(members)) for (const m of members) { const id = typeof m === "object" ? ((m as Record<string, unknown>).wca_id || (m as Record<string, unknown>).id) : m; if (id) dirIds.push(Number(id)); } }
    const { data: existing } = await supabase.from("partners").select("wca_id").eq("country_code", countryCode).not("wca_id", "is", null);
    const existingSet = new Set((existing || []).map((p: Record<string, unknown>) => p.wca_id));
    wcaIds = [...new Set(dirIds)].filter(id => !existingSet.has(id) && !deadIdSet.has(id));
  } else if (mode === "no_profile") {
    const { data: noProfile } = await supabase.from("partners").select("wca_id").eq("country_code", countryCode).not("wca_id", "is", null).is("raw_profile_html", null);
    wcaIds = (noProfile || []).map((p: Record<string, unknown>) => p.wca_id as number).filter(Boolean);
    const { data: cacheRows } = await supabase.from("directory_cache").select("members").eq("country_code", countryCode);
    if (cacheRows && cacheRows.length > 0) {
      const { data: allExisting } = await supabase.from("partners").select("wca_id").eq("country_code", countryCode).not("wca_id", "is", null);
      const existingSet = new Set((allExisting || []).map((p: Record<string, unknown>) => p.wca_id));
      for (const row of cacheRows) { const members = row.members as Record<string, unknown>[]; if (Array.isArray(members)) for (const m of members) { const id = typeof m === "object" ? ((m as Record<string, unknown>).wca_id || (m as Record<string, unknown>).id) : m; if (id && !existingSet.has(Number(id))) wcaIds.push(Number(id)); } }
    }
    wcaIds = [...new Set(wcaIds)].filter(id => !deadIdSet.has(id));
  } else {
    const { data: dbPartners } = await supabase.from("partners").select("wca_id").eq("country_code", countryCode).not("wca_id", "is", null);
    wcaIds = (dbPartners || []).map((p: Record<string, unknown>) => p.wca_id as number).filter(Boolean);
    const { data: cacheRows } = await supabase.from("directory_cache").select("members").eq("country_code", countryCode);
    if (cacheRows) for (const row of cacheRows) { const members = row.members as Record<string, unknown>[]; if (Array.isArray(members)) for (const m of members) { const id = typeof m === "object" ? ((m as Record<string, unknown>).wca_id || (m as Record<string, unknown>).id) : m; if (id) wcaIds.push(Number(id)); } }
    wcaIds = [...new Set(wcaIds)].filter(id => !deadIdSet.has(id));
  }

  if (wcaIds.length === 0) {
    const modeLabels: Record<string, string> = { new: "nuovi", no_profile: "senza profilo", all: "tutti" };
    return { success: false, message: `Nessun partner da scaricare in modalità "${modeLabels[mode] || mode}" per ${countryName}.` };
  }

  const { data: job, error } = await supabase.from("download_jobs").insert({
    country_code: countryCode, country_name: countryName, network_name: networkName,
    wca_ids: wcaIds as unknown, total_count: wcaIds.length, delay_seconds: delaySec, status: "pending",
  }).select("id").single();

  if (error) return { error: `Errore creazione job: ${error.message}` };

  const jobItems = wcaIds.map((id: number, i: number) => ({ job_id: (job as Record<string, unknown>).id, wca_id: id, position: i, status: "pending" }));
  for (let i = 0; i < jobItems.length; i += 500) {
    await supabase.from("download_job_items").insert(jobItems.slice(i, i + 500));
  }

  const modeLabels: Record<string, string> = { new: "Nuovi partner", no_profile: "Solo profili mancanti", all: "Aggiorna tutti" };
  return {
    success: true, job_id: (job as Record<string, unknown>).id, country: `${countryName} (${countryCode})`, mode: modeLabels[mode] || mode,
    total_partners: wcaIds.length, delay_seconds: delaySec,
    estimated_time_minutes: Math.ceil(wcaIds.length * (delaySec + 5) / 60),
    message: `Job creato! ${wcaIds.length} partner da scaricare per ${countryName}. Il download partirà automaticamente.`,
  };
}

async function executeDownloadSinglePartner(supabase: SupabaseClient, args: Record<string, unknown>): Promise<unknown> {
  const companyName = String(args.company_name || "").trim();
  const city = args.city ? String(args.city).trim() : null;
  const countryCode = args.country_code ? String(args.country_code).toUpperCase() : null;
  let wcaId = args.wca_id ? Number(args.wca_id) : null;

  if (!companyName && !wcaId) return { error: "Serve almeno il nome dell'azienda o il wca_id." };

  if (!wcaId) {
    let query = supabase.from("partners").select("id, wca_id, company_name, city, country_code, country_name, raw_profile_html").ilike("company_name", `%${escapeLike(companyName)}%`);
    if (countryCode) query = query.eq("country_code", countryCode);
    if (city) query = query.ilike("city", `%${escapeLike(city)}%`);
    const { data: found } = await query.limit(5);

    if (found && found.length > 0) {
      const exact = (found as Record<string, unknown>[]).find((p) => String(p.company_name).toLowerCase() === companyName.toLowerCase()) || found[0] as Record<string, unknown>;
      if (exact.raw_profile_html) {
        return { success: true, already_downloaded: true, partner_id: exact.id, company_name: exact.company_name, city: exact.city, country_code: exact.country_code, message: `"${exact.company_name}" ha già il profilo scaricato. Non serve un nuovo download.` };
      }
      wcaId = exact.wca_id as number | null;
      if (!wcaId) return { error: `"${exact.company_name}" trovata nel DB ma non ha un wca_id. Impossibile scaricare il profilo.` };
    }
  }

  if (!wcaId) {
    let cacheQuery = supabase.from("directory_cache").select("members, country_code");
    if (countryCode) cacheQuery = cacheQuery.eq("country_code", countryCode);
    const { data: cacheRows } = await cacheQuery;

    if (cacheRows) {
      for (const row of cacheRows) {
        const members = row.members as Record<string, unknown>[];
        if (!Array.isArray(members)) continue;
        const match = members.find((m: Record<string, unknown>) => {
          const name = typeof m === "object" ? (String(m.company_name || m.name || "")) : "";
          return name.toLowerCase().includes(companyName.toLowerCase());
        });
        if (match) {
          wcaId = typeof match === "object" ? Number((match as Record<string, unknown>).wca_id || (match as Record<string, unknown>).id) : Number(match);
          if (wcaId) break;
        }
      }
    }
  }

  if (!wcaId) return { error: `"${companyName}" non trovata nel database, nella directory cache, né cercando direttamente su WCA. Verifica il nome esatto dell'azienda.` };

  const { data: deadRows } = await supabase.from("partners_no_contacts").select("wca_id").eq("resolved", false);
  const deadIdSet = new Set((deadRows || []).map((r: Record<string, unknown>) => Number(r.wca_id)));
  if (deadIdSet.has(Number(wcaId))) return { error: `"${companyName}" (WCA ID: ${wcaId}) è nella lista "senza contatti". Probabilmente non ha dati utili.` };

  const { data: activeJobs } = await supabase.from("download_jobs").select("id, status, country_code").in("status", ["pending", "running"]).limit(5);
  if (activeJobs && activeJobs.length >= 1) return { error: `C'è già un job attivo. Attendi il completamento prima di avviarne un altro.`, active_job_id: (activeJobs[0] as Record<string, unknown>).id };

  let jobCountryCode = countryCode || "";
  let jobCountryName = "";
  if (!jobCountryCode) {
    const { data: p } = await supabase.from("partners").select("country_code, country_name").eq("wca_id", wcaId).single();
    if (p) { jobCountryCode = (p as Record<string, unknown>).country_code as string; jobCountryName = (p as Record<string, unknown>).country_name as string; }
    else { jobCountryCode = "XX"; jobCountryName = "Sconosciuto"; }
  }
  if (!jobCountryName) {
    const { data: p } = await supabase.from("partners").select("country_name").eq("country_code", jobCountryCode).limit(1).single();
    jobCountryName = (p as Record<string, unknown> | null)?.country_name as string || jobCountryCode;
  }

  const { data: job, error } = await supabase.from("download_jobs").insert({
    country_code: jobCountryCode, country_name: jobCountryName, network_name: "Tutti",
    wca_ids: [wcaId] as unknown, total_count: 1, delay_seconds: 15, status: "pending",
    job_type: "download",
  }).select("id").single();

  if (error) return { error: `Errore creazione job: ${error.message}` };

  await supabase.from("download_job_items").insert({ job_id: (job as Record<string, unknown>).id, wca_id: wcaId, position: 0, status: "pending" });

  return {
    success: true, job_id: (job as Record<string, unknown>).id, country: `${jobCountryName} (${jobCountryCode})`,
    mode: "Singolo partner", total_partners: 1, wca_id: wcaId, delay_seconds: 15,
    estimated_time_minutes: 1,
    message: `Job creato per scaricare il profilo di "${companyName}" (WCA ID: ${wcaId}). Tempo stimato: ~1 minuto.`,
  };
}

// ━━━ Unified Tool Dispatcher ━━━

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  deps: ToolExecutorDeps,
  userId?: string,
  authHeader?: string,
): Promise<unknown> {
  const { supabase, readH, writeH, entH } = deps;

  // ── Read handlers (shared module) ──
  const readMap: Record<string, () => Promise<unknown>> = {
    search_partners: () => readH.executeSearchPartners(args),
    get_country_overview: () => readH.executeCountryOverview(args),
    get_directory_status: () => readH.executeDirectoryStatus(args),
    list_jobs: () => readH.executeListJobs(args),
    get_partner_detail: () => readH.executePartnerDetail(args),
    get_global_summary: () => readH.executeGlobalSummary(),
    check_blacklist: () => readH.executeCheckBlacklist(args),
    list_reminders: () => readH.executeListReminders(args),
    get_partners_without_contacts: () => readH.executePartnersWithoutContacts(args),
    search_contacts: () => readH.executeSearchContacts(args),
    get_contact_detail: () => readH.executeGetContactDetail(args),
    search_prospects: () => readH.executeSearchProspects(args),
    list_activities: () => readH.executeListActivities(args),
    search_business_cards: () => readH.executeSearchBusinessCards(args),
    check_job_status: () => readH.executeCheckJobStatus(args),
  };
  if (readMap[name]) return readMap[name]();

  // ── Write handlers (shared module) ──
  const writeMap: Record<string, () => Promise<unknown>> = {
    update_partner: () => writeH.executeUpdatePartner(args),
    add_partner_note: () => writeH.executeAddPartnerNote(args),
    create_reminder: () => writeH.executeCreateReminder(args),
    update_lead_status: () => writeH.executeUpdateLeadStatus(args),
    bulk_update_partners: () => writeH.executeBulkUpdatePartners(args),
    link_business_card: () => writeH.executeLinkBusinessCard(args),
    create_activity: () => writeH.executeCreateActivity(args),
    update_activity: () => writeH.executeUpdateActivity(args),
    manage_partner_contact: () => writeH.executeManagePartnerContact(args),
    update_reminder: () => writeH.executeUpdateReminder(args),
    delete_records: () => writeH.executeDeleteRecords(args),
  };
  if (writeMap[name]) return writeMap[name]();

  // Write handlers needing authHeader
  const writeAuthMap: Record<string, () => Promise<unknown>> = {
    generate_outreach: () => writeH.executeGenerateOutreach(args, authHeader!),
    send_email: () => writeH.executeSendEmail(args, authHeader!),
    deep_search_partner: () => writeH.executeDeepSearchPartner(args, authHeader!),
    deep_search_contact: () => writeH.executeDeepSearchContact(args, authHeader!),
    enrich_partner_website: () => writeH.executeEnrichPartnerWebsite(args, authHeader!),
    scan_directory: () => writeH.executeScanDirectory(args, authHeader!),
    generate_aliases: () => writeH.executeGenerateAliases(args, authHeader!),
  };
  if (writeAuthMap[name]) return authHeader ? writeAuthMap[name]() : { error: "Auth required" };

  // ── Enterprise handlers (shared module) ──
  const entAuthMap: Record<string, () => Promise<unknown>> = {
    save_memory: () => entH.executeSaveMemory(args, userId!),
    search_memory: () => entH.executeSearchMemory(args, userId!),
    create_work_plan: () => entH.executeCreateWorkPlan(args, userId!),
    execute_plan_step: () => entH.executeExecutePlanStep(args, userId!, authHeader),
    get_active_plans: () => entH.executeGetActivePlans(userId!),
    save_as_template: () => entH.executeSaveAsTemplate(args, userId!),
    search_templates: () => entH.executeSearchTemplates(args, userId!),
    save_kb_rule: () => entH.executeSaveKbRule(args, userId!),
    save_operative_prompt: () => entH.executeSaveOperativePrompt(args, userId!),
    list_workflows: () => entH.executeListWorkflows(args, userId!),
    start_workflow: () => entH.executeStartWorkflow(args, userId!),
    advance_workflow_gate: () => entH.executeAdvanceWorkflowGate(args, userId!),
    list_playbooks: () => entH.executeListPlaybooks(args, userId!),
    apply_playbook: () => entH.executeApplyPlaybook(args, userId!),
  };
  if (entAuthMap[name]) return userId ? entAuthMap[name]() : { error: "Auth required" };

  // Enterprise handlers without user requirement
  const entMap: Record<string, () => Promise<unknown>> = {
    execute_ui_action: () => entH.executeUiAction(args),
    search_kb: () => entH.executeSearchKb(args),
  };
  if (entMap[name]) return entMap[name]();

  // ── Inline handlers ──
  switch (name) {
    case "create_download_job": return executeCreateDownloadJob(supabase, args);
    case "download_single_partner": return executeDownloadSinglePartner(supabase, args);
    case "get_procedure": return executeGetProcedure(args);
    default: return { error: `Tool sconosciuto: ${name}` };
  }
}
