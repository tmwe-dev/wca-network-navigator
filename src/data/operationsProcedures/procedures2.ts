import type { OperationProcedure } from "./types";

export const PROCEDURES_PART2: OperationProcedure[] = [
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
];
