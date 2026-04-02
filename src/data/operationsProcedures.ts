/**
 * Operations Procedures Knowledge Base
 * 
 * Catalogo completo di tutte le procedure operative del sistema.
 * L'AI consulta questa KB per guidare l'utente step-by-step.
 */

// ━━━ Types ━━━

export type ProcedureCategory = "outreach" | "network" | "crm" | "enrichment" | "agenda" | "system";
export type Channel = "email" | "linkedin" | "whatsapp" | "sms";

export interface PrerequisiteCheck {
  check: string;
  label: string;
  path?: string;
  tool?: string;
}

export interface ProcedureStep {
  order: number;
  action: string;
  tool: string | null;
  detail: string;
  optional?: boolean;
}

export interface OperationProcedure {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category: ProcedureCategory;
  channels?: Channel[];
  prerequisites: PrerequisiteCheck[];
  steps: ProcedureStep[];
  related_pages: string[];
  ai_tools_required: string[];
  tips: string[];
}

// ━━━ Procedure Definitions ━━━

export const OPERATIONS_PROCEDURES: OperationProcedure[] = [
  // ══════════════════════════════════════
  // OUTREACH (6 procedure)
  // ══════════════════════════════════════
  {
    id: "email_single",
    name: "Email Singola",
    description: "Invia un'email personalizzata a un singolo partner o contatto",
    tags: ["email", "singola", "outreach", "invio", "messaggio", "comunicazione"],
    category: "outreach",
    channels: ["email"],
    prerequisites: [
      { check: "ai_profile_configured", label: "Profilo AI configurato (obiettivi, azienda, proposta)", path: "/settings", tool: "search_memory" },
      { check: "recipient_has_email", label: "Il destinatario ha un indirizzo email valido", tool: "get_partner_detail" },
      { check: "goal_defined", label: "Obiettivo della comunicazione definito" },
    ],
    steps: [
      { order: 1, action: "Identifica il destinatario", tool: "search_partners", detail: "Cerca il partner/contatto per nome, paese o filtri. Verifica che abbia un'email." },
      { order: 2, action: "Recupera dati del destinatario", tool: "get_partner_detail", detail: "Ottieni nome contatto, email, azienda, paese, servizi, rating per personalizzare." },
      { order: 3, action: "Verifica blacklist", tool: "check_blacklist", detail: "Controlla che il destinatario non sia in blacklist prima di procedere." },
      { order: 4, action: "Carica profilo AI e knowledge base", tool: "search_memory", detail: "Recupera obiettivi commerciali, proposta base, preferenze di tono e lingua." },
      { order: 5, action: "Genera il messaggio", tool: "generate_outreach", detail: "Usa channel='email', goal, base_proposal dal profilo. Quality 'premium' per email importanti." },
      { order: 6, action: "Revisiona con l'utente", tool: null, detail: "Mostra subject + body all'utente. Chiedi conferma o modifiche." },
      { order: 7, action: "Invia l'email", tool: "send_email", detail: "Invia via SMTP. Traccia come interazione." },
      { order: 8, action: "Registra l'interazione", tool: "add_partner_note", detail: "Salva nota 'Email inviata' con subject e data." },
    ],
    related_pages: ["/cockpit", "/workspace", "/email-composer"],
    ai_tools_required: ["search_partners", "get_partner_detail", "check_blacklist", "generate_outreach", "send_email", "add_partner_note"],
    tips: [
      "Usa quality 'premium' per email a partner strategici",
      "Verifica sempre la blacklist prima dell'invio",
      "Personalizza con almeno 3 dati del partner (nome, paese, servizi)",
    ],
  },
  {
    id: "email_campaign",
    name: "Campagna Email Massiva",
    description: "Invia email personalizzate a un gruppo di partner filtrati per paese, servizio o altri criteri",
    tags: ["email", "campagna", "massiva", "outreach", "bulk", "invio multiplo"],
    category: "outreach",
    channels: ["email"],
    prerequisites: [
      { check: "ai_profile_configured", label: "Profilo AI configurato", path: "/settings" },
      { check: "has_recipients", label: "Almeno 5 destinatari con email valida" },
      { check: "goal_defined", label: "Obiettivo commerciale definito" },
    ],
    steps: [
      { order: 1, action: "Seleziona destinatari", tool: "search_partners", detail: "Filtra per paese, servizio, rating, email presente. Mostra conteggio." },
      { order: 2, action: "Verifica blacklist collettiva", tool: "check_blacklist", detail: "Escludi partner in blacklist dalla lista." },
      { order: 3, action: "Definisci obiettivo e proposta", tool: null, detail: "L'utente specifica goal, base_proposal, quality via Goal Bar o chat." },
      { order: 4, action: "Genera email modello", tool: "generate_outreach", detail: "Genera 1 email di esempio per approvazione. Quality 'standard' per campagne." },
      { order: 5, action: "Approva e lancia coda", tool: null, detail: "Dopo approvazione, le email vengono generate e accodate nella email_campaign_queue." },
      { order: 6, action: "Monitora invio", tool: "check_job_status", detail: "Verifica stato coda email: pending, sent, failed." },
    ],
    related_pages: ["/cockpit", "/workspace", "/email-composer", "/campaigns"],
    ai_tools_required: ["search_partners", "check_blacklist", "generate_outreach", "send_email", "check_job_status"],
    tips: [
      "Limita le campagne a 50-100 destinatari per evitare problemi SMTP",
      "Usa quality 'standard' per campagne, 'premium' per VIP",
      "Aggiungi un delay di 30-60 secondi tra ogni invio",
    ],
  },
  {
    id: "linkedin_message",
    name: "Messaggio LinkedIn",
    description: "Genera un messaggio di outreach per LinkedIn (InMail o DM)",
    tags: ["linkedin", "messaggio", "social", "outreach", "dm", "inmail"],
    category: "outreach",
    channels: ["linkedin"],
    prerequisites: [
      { check: "ai_profile_configured", label: "Profilo AI configurato", path: "/settings" },
      { check: "recipient_identified", label: "Contatto/partner identificato" },
    ],
    steps: [
      { order: 1, action: "Identifica il contatto", tool: "search_partners", detail: "Cerca partner e contatto specifico." },
      { order: 2, action: "Verifica profilo LinkedIn", tool: "get_partner_detail", detail: "Controlla se il contatto ha un link LinkedIn nei social_links." },
      { order: 3, action: "Genera messaggio LinkedIn", tool: "generate_outreach", detail: "channel='linkedin'. Max 300 caratteri per InMail, più conciso di un'email." },
      { order: 4, action: "Mostra all'utente per copia", tool: null, detail: "LinkedIn non supporta invio automatico: mostra il testo pronto da copiare." },
      { order: 5, action: "Registra attività", tool: "create_activity", detail: "Crea attività tipo 'linkedin_message' per tracciamento." },
    ],
    related_pages: ["/cockpit", "/workspace"],
    ai_tools_required: ["search_partners", "get_partner_detail", "generate_outreach", "create_activity"],
    tips: [
      "I messaggi LinkedIn devono essere brevi e personali",
      "Menziona un collegamento in comune o un evento recente",
      "Non allegare file nel primo messaggio",
    ],
  },
  {
    id: "whatsapp_message",
    name: "Messaggio WhatsApp",
    description: "Genera un messaggio per WhatsApp Business",
    tags: ["whatsapp", "messaggio", "outreach", "chat", "mobile"],
    category: "outreach",
    channels: ["whatsapp"],
    prerequisites: [
      { check: "recipient_has_phone", label: "Il contatto ha un numero di cellulare", tool: "get_partner_detail" },
    ],
    steps: [
      { order: 1, action: "Identifica contatto con cellulare", tool: "search_partners", detail: "Cerca partner con contatto che abbia campo mobile." },
      { order: 2, action: "Genera messaggio WhatsApp", tool: "generate_outreach", detail: "channel='whatsapp'. Tono informale ma professionale, max 200 parole." },
      { order: 3, action: "Mostra per invio manuale", tool: null, detail: "WhatsApp non supporta invio API: mostra testo + numero." },
      { order: 4, action: "Registra attività", tool: "create_activity", detail: "Crea attività tipo 'whatsapp'." },
    ],
    related_pages: ["/cockpit", "/workspace"],
    ai_tools_required: ["search_partners", "get_partner_detail", "generate_outreach", "create_activity"],
    tips: [
      "WhatsApp funziona meglio per follow-up dopo un primo contatto",
      "Aggiungi emoji moderati per un tono più umano",
    ],
  },
  {
    id: "sms_message",
    name: "SMS",
    description: "Genera un SMS breve per un contatto",
    tags: ["sms", "messaggio", "outreach", "testo", "mobile"],
    category: "outreach",
    channels: ["sms"],
    prerequisites: [
      { check: "recipient_has_phone", label: "Il contatto ha un numero di cellulare" },
    ],
    steps: [
      { order: 1, action: "Identifica contatto", tool: "search_partners", detail: "Cerca partner con mobile." },
      { order: 2, action: "Genera SMS", tool: "generate_outreach", detail: "channel='sms'. Max 160 caratteri." },
      { order: 3, action: "Mostra per invio manuale", tool: null, detail: "Mostra testo + numero." },
    ],
    related_pages: ["/cockpit"],
    ai_tools_required: ["search_partners", "generate_outreach"],
    tips: ["Gli SMS sono efficaci per promemoria meeting o conferme rapide"],
  },
  {
    id: "multi_channel_sequence",
    name: "Sequenza Multi-Canale",
    description: "Crea una sequenza di outreach su più canali: email → LinkedIn → WhatsApp → follow-up",
    tags: ["sequenza", "multi-canale", "outreach", "follow-up", "nurturing", "pipeline"],
    category: "outreach",
    channels: ["email", "linkedin", "whatsapp"],
    prerequisites: [
      { check: "ai_profile_configured", label: "Profilo AI configurato", path: "/settings" },
      { check: "recipient_has_email", label: "Destinatario con email" },
      { check: "goal_defined", label: "Obiettivo chiaro" },
    ],
    steps: [
      { order: 1, action: "Identifica target e canali disponibili", tool: "get_partner_detail", detail: "Verifica email, LinkedIn, mobile del contatto." },
      { order: 2, action: "Genera email di primo contatto", tool: "generate_outreach", detail: "channel='email', quality='premium'." },
      { order: 3, action: "Pianifica follow-up LinkedIn (giorno 3)", tool: "create_activity", detail: "Attività 'linkedin_message' con due_date +3 giorni." },
      { order: 4, action: "Genera messaggio LinkedIn", tool: "generate_outreach", detail: "channel='linkedin', riferimento all'email inviata." },
      { order: 5, action: "Pianifica follow-up WhatsApp (giorno 7)", tool: "create_activity", detail: "Attività 'whatsapp' con due_date +7 giorni." },
      { order: 6, action: "Crea reminder finale", tool: "create_reminder", detail: "Reminder a giorno 14 per valutare risposta." },
    ],
    related_pages: ["/cockpit", "/workspace", "/reminders"],
    ai_tools_required: ["get_partner_detail", "generate_outreach", "send_email", "create_activity", "create_reminder"],
    tips: [
      "Rispetta i tempi tra i canali: email → 3gg → LinkedIn → 4gg → WhatsApp",
      "Ogni messaggio deve fare riferimento al precedente",
      "Non insistere oltre 3 touchpoint senza risposta",
    ],
  },

  // ══════════════════════════════════════
  // NETWORK (5 procedure)
  // ══════════════════════════════════════
  {
    id: "scan_country",
    name: "Scansione Directory Paese",
    description: "Scansiona la directory WCA per un paese specifico e aggiorna la cache locale",
    tags: ["scan", "scansione", "directory", "paese", "wca", "network", "membri"],
    category: "network",
    prerequisites: [
      { check: "wca_session_active", label: "Sessione WCA attiva (cookie valido)", path: "/settings" },
    ],
    steps: [
      { order: 1, action: "Verifica stato directory corrente", tool: "get_directory_status", detail: "Controlla se il paese è già nella cache e quando è stato scansionato." },
      { order: 2, action: "Avvia scansione", tool: "scan_directory", detail: "search_by='CountryCode', country_code=XX. Aggiorna la directory_cache." },
      { order: 3, action: "Confronta con DB locale", tool: "get_country_overview", detail: "Compara membri directory vs partner già scaricati." },
      { order: 4, action: "Suggerisci azione successiva", tool: null, detail: "Se ci sono nuovi membri, suggerisci download." },
    ],
    related_pages: ["/operations", "/partner-hub"],
    ai_tools_required: ["get_directory_status", "scan_directory", "get_country_overview"],
    tips: [
      "Scansiona periodicamente i paesi prioritari (ogni 2-4 settimane)",
      "La scansione non scarica profili, solo l'elenco dei membri",
    ],
  },
  {
    id: "download_profiles",
    name: "Download Profili Paese",
    description: "Scarica i profili completi di tutti i partner (o quelli mancanti) per un intero paese",
    tags: ["download", "profili", "paese", "bulk", "wca", "scarica"],
    category: "network",
    prerequisites: [
      { check: "wca_session_active", label: "Sessione WCA attiva", path: "/settings" },
      { check: "directory_scanned", label: "Directory del paese già scansionata", tool: "get_directory_status" },
      { check: "no_active_jobs", label: "Nessun job di download già attivo per questo paese", tool: "list_jobs" },
    ],
    steps: [
      { order: 1, action: "Verifica prerequisiti", tool: "get_directory_status", detail: "Conferma che la directory sia aggiornata." },
      { order: 2, action: "Controlla job attivi", tool: "list_jobs", detail: "Verifica che non ci siano job già in corso." },
      { order: 3, action: "Scegli modalità", tool: null, detail: "Chiedi all'utente: 'new' (solo nuovi), 'no_profile' (senza profilo), 'all' (tutti)." },
      { order: 4, action: "Crea job di download", tool: "create_download_job", detail: "Lancia il job con mode scelto e delay consigliato." },
      { order: 5, action: "Verifica avvio", tool: "check_job_status", detail: "Conferma che il job sia stato accettato." },
    ],
    related_pages: ["/operations", "/test-download"],
    ai_tools_required: ["get_directory_status", "list_jobs", "create_download_job", "check_job_status"],
    tips: [
      "Usa mode 'no_profile' per completare paesi parzialmente scaricati",
      "Delay consigliato: 30s per paesi piccoli, 45s per paesi grandi",
    ],
  },
  {
    id: "download_single",
    name: "Download Singolo Partner",
    description: "Scarica il profilo completo di un singolo partner specifico dal sito WCA",
    tags: ["download", "singolo", "partner", "profilo", "scarica"],
    category: "network",
    prerequisites: [
      { check: "wca_session_active", label: "Sessione WCA attiva", path: "/settings" },
    ],
    steps: [
      { order: 1, action: "Identifica il partner", tool: "search_partners", detail: "Cerca per nome. Se non trovato, cerca nella directory WCA." },
      { order: 2, action: "Avvia download singolo", tool: "download_single_partner", detail: "Passa company_name e opzionalmente country_code." },
      { order: 3, action: "Verifica completamento", tool: "check_job_status", detail: "Conferma che il profilo sia stato scaricato." },
    ],
    related_pages: ["/partner-hub", "/operations"],
    ai_tools_required: ["search_partners", "download_single_partner", "check_job_status"],
    tips: [
      "Non usare create_download_job per un singolo partner — è uno spreco",
      "Se il partner non esiste nel DB, verrà creato automaticamente",
    ],
  },
  {
    id: "deep_search_partner",
    name: "Deep Search Partner",
    description: "Ricerca approfondita sul web per trovare logo, social, informazioni aggiuntive di un partner",
    tags: ["deep", "search", "ricerca", "partner", "web", "logo", "social", "arricchimento"],
    category: "enrichment",
    prerequisites: [
      { check: "partner_exists", label: "Il partner esiste nel database", tool: "search_partners" },
      { check: "has_credits", label: "Crediti sufficienti (costa 1 credito)" },
    ],
    steps: [
      { order: 1, action: "Identifica il partner", tool: "get_partner_detail", detail: "Ottieni dettagli completi per verificare cosa manca." },
      { order: 2, action: "Avvia Deep Search", tool: "deep_search_partner", detail: "Usa Partner Connect per cercare sul web." },
      { order: 3, action: "Verifica risultati", tool: "get_partner_detail", detail: "Ricarica il partner per vedere i dati arricchiti." },
    ],
    related_pages: ["/partner-hub", "/operations"],
    ai_tools_required: ["get_partner_detail", "deep_search_partner"],
    tips: [
      "Deep Search è più efficace quando il partner ha un sito web",
      "I risultati includono logo, social links e descrizione aggiornata",
    ],
  },
  {
    id: "enrich_website",
    name: "Arricchimento Sito Web",
    description: "Analizza il sito web di un partner per estrarre servizi, capacità e descrizione aziendale",
    tags: ["enrich", "arricchimento", "sito", "website", "servizi", "analisi"],
    category: "enrichment",
    prerequisites: [
      { check: "partner_has_website", label: "Il partner ha un sito web nel database", tool: "get_partner_detail" },
      { check: "has_credits", label: "Crediti sufficienti" },
    ],
    steps: [
      { order: 1, action: "Verifica sito web", tool: "get_partner_detail", detail: "Conferma che il campo website sia presente." },
      { order: 2, action: "Avvia enrichment", tool: "enrich_partner_website", detail: "Scraping e analisi AI del sito." },
      { order: 3, action: "Mostra risultati", tool: "get_partner_detail", detail: "Visualizza i dati arricchiti." },
    ],
    related_pages: ["/partner-hub"],
    ai_tools_required: ["get_partner_detail", "enrich_partner_website"],
    tips: ["Combinalo con Deep Search per massimo arricchimento"],
  },

  // ══════════════════════════════════════
  // CRM (5 procedure)
  // ══════════════════════════════════════
  {
    id: "import_contacts",
    name: "Importazione Contatti",
    description: "Importa contatti da file CSV/Excel nella rubrica CRM",
    tags: ["import", "importa", "contatti", "csv", "excel", "file", "carica"],
    category: "crm",
    prerequisites: [],
    steps: [
      { order: 1, action: "Carica il file", tool: null, detail: "L'utente carica il file CSV/Excel dalla pagina Import." },
      { order: 2, action: "Analizza struttura", tool: null, detail: "Il sistema analizza automaticamente le colonne con AI." },
      { order: 3, action: "Mappa le colonne", tool: null, detail: "L'utente conferma o corregge la mappatura colonne." },
      { order: 4, action: "Avvia importazione", tool: null, detail: "Il sistema processa le righe in batch." },
      { order: 5, action: "Verifica risultati", tool: "search_contacts", detail: "Controlla i contatti importati." },
    ],
    related_pages: ["/import", "/contacts"],
    ai_tools_required: ["search_contacts"],
    tips: [
      "Supporta CSV, Excel, TSV",
      "L'AI mappa automaticamente le colonne più comuni",
      "Usa l'Import Assistant per risolvere errori",
    ],
  },
  {
    id: "deep_search_contact",
    name: "Deep Search Contatto",
    description: "Ricerca approfondita sul web per un contatto importato (LinkedIn, social, info aggiuntive)",
    tags: ["deep", "search", "contatto", "crm", "linkedin", "arricchimento"],
    category: "crm",
    prerequisites: [
      { check: "contact_exists", label: "Il contatto esiste nel CRM" },
      { check: "has_credits", label: "Crediti sufficienti" },
    ],
    steps: [
      { order: 1, action: "Identifica il contatto", tool: "get_contact_detail", detail: "Ottieni dettagli completi." },
      { order: 2, action: "Avvia Deep Search", tool: "deep_search_contact", detail: "Cerca LinkedIn, social, info web." },
      { order: 3, action: "Verifica risultati", tool: "get_contact_detail", detail: "Visualizza dati arricchiti." },
    ],
    related_pages: ["/contacts"],
    ai_tools_required: ["get_contact_detail", "deep_search_contact"],
    tips: ["Funziona meglio se il contatto ha nome + azienda + paese"],
  },
  {
    id: "update_lead_status",
    name: "Aggiornamento Stato Lead",
    description: "Aggiorna lo stato di avanzamento (lead status) di contatti o partner",
    tags: ["lead", "status", "stato", "aggiorna", "pipeline", "contatto", "partner"],
    category: "crm",
    prerequisites: [],
    steps: [
      { order: 1, action: "Identifica i record", tool: "search_contacts", detail: "Filtra per criteri (paese, azienda, status attuale)." },
      { order: 2, action: "Conferma selezione", tool: null, detail: "Mostra quanti record verranno aggiornati." },
      { order: 3, action: "Aggiorna lo stato", tool: "update_lead_status", detail: "Passa nuovi status: new→contacted→in_progress→negotiation→converted." },
    ],
    related_pages: ["/contacts", "/partner-hub"],
    ai_tools_required: ["search_contacts", "update_lead_status"],
    tips: ["Per aggiornamenti massivi (>5 record), chiedi sempre conferma"],
  },
  {
    id: "export_contacts",
    name: "Esportazione Contatti",
    description: "Esporta contatti selezionati in formato CSV per uso esterno",
    tags: ["export", "esporta", "csv", "contatti", "scarica"],
    category: "crm",
    prerequisites: [],
    steps: [
      { order: 1, action: "Filtra contatti", tool: "search_contacts", detail: "Applica filtri per selezionare i contatti da esportare." },
      { order: 2, action: "Genera export", tool: null, detail: "L'utente usa il pulsante Export nella UI." },
    ],
    related_pages: ["/contacts"],
    ai_tools_required: ["search_contacts"],
    tips: ["L'export è disponibile dalla pagina Contatti con il pulsante dedicato"],
  },
  {
    id: "assign_activity",
    name: "Assegnazione Attività",
    description: "Crea e assegna un'attività a un membro del team per un partner o contatto specifico",
    tags: ["attività", "assegna", "task", "team", "follow-up", "azione"],
    category: "crm",
    prerequisites: [],
    steps: [
      { order: 1, action: "Identifica il target", tool: "search_partners", detail: "Cerca il partner o contatto." },
      { order: 2, action: "Crea l'attività", tool: "create_activity", detail: "Tipo, titolo, descrizione, due_date, priority." },
      { order: 3, action: "Conferma creazione", tool: "list_activities", detail: "Verifica che l'attività sia stata creata." },
    ],
    related_pages: ["/reminders", "/partner-hub"],
    ai_tools_required: ["search_partners", "create_activity", "list_activities"],
    tips: ["Assegna sempre una due_date realistica"],
  },

  // ══════════════════════════════════════
  // AGENDA (3 procedure)
  // ══════════════════════════════════════
  {
    id: "create_followup",
    name: "Creazione Follow-up",
    description: "Crea un follow-up automatico dopo un'interazione con un partner",
    tags: ["follow-up", "followup", "promemoria", "dopo", "contatto", "ricontattare"],
    category: "agenda",
    prerequisites: [],
    steps: [
      { order: 1, action: "Identifica il partner", tool: "search_partners", detail: "Cerca il partner." },
      { order: 2, action: "Crea attività follow-up", tool: "create_activity", detail: "activity_type='follow_up', due_date tra 3-7 giorni." },
      { order: 3, action: "Crea reminder", tool: "create_reminder", detail: "Reminder con due_date uguale all'attività.", optional: true },
    ],
    related_pages: ["/reminders"],
    ai_tools_required: ["search_partners", "create_activity", "create_reminder"],
    tips: [
      "Il follow-up ideale è entro 3 giorni dal primo contatto",
      "Aggiungi una nota su cosa discutere nel follow-up",
    ],
  },
  {
    id: "schedule_meeting",
    name: "Pianificazione Meeting",
    description: "Pianifica un meeting con un partner o contatto",
    tags: ["meeting", "incontro", "riunione", "pianifica", "appuntamento", "call"],
    category: "agenda",
    prerequisites: [],
    steps: [
      { order: 1, action: "Identifica partecipanti", tool: "get_partner_detail", detail: "Ottieni contatti del partner." },
      { order: 2, action: "Crea attività meeting", tool: "create_activity", detail: "activity_type='meeting', scheduled_at, due_date." },
      { order: 3, action: "Genera email di invito", tool: "generate_outreach", detail: "Email di conferma appuntamento.", optional: true },
    ],
    related_pages: ["/reminders", "/cockpit"],
    ai_tools_required: ["get_partner_detail", "create_activity", "generate_outreach"],
    tips: ["Specifica sempre orario, luogo/link e agenda del meeting"],
  },
  {
    id: "manage_reminders",
    name: "Gestione Reminder",
    description: "Crea, aggiorna o completa reminder associati ai partner",
    tags: ["reminder", "promemoria", "scadenza", "gestisci", "notifica"],
    category: "agenda",
    prerequisites: [],
    steps: [
      { order: 1, action: "Elenca reminder attivi", tool: "list_reminders", detail: "Mostra tutti i reminder pending/completati." },
      { order: 2, action: "Crea/aggiorna reminder", tool: "create_reminder", detail: "Nuovo reminder con titolo, data, priorità." },
      { order: 3, action: "Completa reminder", tool: "update_reminder", detail: "Marca come completato quando fatto." },
    ],
    related_pages: ["/reminders"],
    ai_tools_required: ["list_reminders", "create_reminder", "update_reminder"],
    tips: ["Usa priorità 'high' per scadenze critiche"],
  },

  // ══════════════════════════════════════
  // SISTEMA (3 procedure)
  // ══════════════════════════════════════
  {
    id: "generate_aliases",
    name: "Generazione Alias AI",
    description: "Genera alias brevi e memorizzabili per aziende o contatti usando l'AI",
    tags: ["alias", "genera", "nome", "breve", "etichetta", "abbreviazione"],
    category: "system",
    prerequisites: [],
    steps: [
      { order: 1, action: "Seleziona target", tool: "search_partners", detail: "Filtra partner senza alias (company_alias IS NULL)." },
      { order: 2, action: "Genera alias", tool: "generate_aliases", detail: "Passa partner_ids o country_code. Type: 'company' o 'contact'." },
      { order: 3, action: "Verifica risultati", tool: "search_partners", detail: "Controlla gli alias generati." },
    ],
    related_pages: ["/partner-hub"],
    ai_tools_required: ["search_partners", "generate_aliases"],
    tips: [
      "Genera per paese per risultati più consistenti",
      "Limita a 20 partner per batch per evitare timeout",
    ],
  },
  {
    id: "blacklist_check",
    name: "Verifica Blacklist",
    description: "Controlla se un'azienda è nella blacklist WCA per problemi di pagamento",
    tags: ["blacklist", "verifica", "controllo", "affidabilità", "pagamento", "rischio"],
    category: "system",
    prerequisites: [],
    steps: [
      { order: 1, action: "Cerca nella blacklist", tool: "check_blacklist", detail: "Cerca per nome azienda o paese." },
      { order: 2, action: "Mostra risultati", tool: null, detail: "Se trovato, mostra dettagli: importo dovuto, numero claims, status." },
    ],
    related_pages: ["/settings"],
    ai_tools_required: ["check_blacklist"],
    tips: [
      "Verifica SEMPRE la blacklist prima di iniziare una collaborazione",
      "La blacklist viene sincronizzata periodicamente dal sito WCA",
    ],
  },
  {
    id: "bulk_update",
    name: "Aggiornamento Massivo",
    description: "Aggiorna in blocco lo stato, i preferiti o altri campi di più partner contemporaneamente",
    tags: ["bulk", "massivo", "aggiorna", "blocco", "multiplo", "batch"],
    category: "system",
    prerequisites: [],
    steps: [
      { order: 1, action: "Definisci filtro", tool: "search_partners", detail: "Filtra i partner da aggiornare. Mostra conteggio." },
      { order: 2, action: "Chiedi conferma", tool: null, detail: "OBBLIGATORIO: mostra quanti record verranno modificati." },
      { order: 3, action: "Esegui aggiornamento", tool: "bulk_update_partners", detail: "Applica le modifiche in blocco." },
      { order: 4, action: "Verifica esito", tool: "search_partners", detail: "Ricarica i dati per confermare le modifiche." },
    ],
    related_pages: ["/partner-hub"],
    ai_tools_required: ["search_partners", "bulk_update_partners"],
    tips: [
      "SEMPRE chiedere conferma per aggiornamenti su >5 record",
      "Salva in memoria l'operazione effettuata per audit trail",
    ],
  },
];

// ━━━ Helper Functions ━━━

/** Find procedures matching any of the given tags */
export function findProcedures(tags: string[]): OperationProcedure[] {
  const lowerTags = tags.map(t => t.toLowerCase());
  return OPERATIONS_PROCEDURES.filter(p =>
    p.tags.some(pt => lowerTags.some(lt => pt.includes(lt) || lt.includes(pt)))
  );
}

/** Get procedures by category */
export function getProceduresByCategory(category: ProcedureCategory): OperationProcedure[] {
  return OPERATIONS_PROCEDURES.filter(p => p.category === category);
}

/** Get a single procedure by ID */
export function getProcedureById(id: string): OperationProcedure | undefined {
  return OPERATIONS_PROCEDURES.find(p => p.id === id);
}

/** Serialize procedures for AI prompt injection (compact format) */
export function serializeProceduresForPrompt(): string {
  return OPERATIONS_PROCEDURES.map(p => {
    const prereqs = p.prerequisites.length > 0
      ? `\n  Prerequisiti: ${p.prerequisites.map(pr => pr.label).join("; ")}`
      : "";
    const steps = p.steps.map(s => `    ${s.order}. ${s.action} → ${s.tool || "manuale"}: ${s.detail}`).join("\n");
    const tips = p.tips.length > 0 ? `\n  Tips: ${p.tips.join(" | ")}` : "";
    return `[${p.id}] ${p.name} (${p.category})\n  ${p.description}\n  Tags: ${p.tags.join(", ")}${prereqs}\n  Steps:\n${steps}${tips}`;
  }).join("\n\n");
}
