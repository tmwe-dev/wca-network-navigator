// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Agent Roles
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const AGENT_ROLES = [
  { value: "outreach", label: "Outreach", emoji: "📧", color: "text-blue-400" },
  { value: "sales", label: "Sales", emoji: "💰", color: "text-yellow-400" },
  { value: "download", label: "Download/Sync", emoji: "📥", color: "text-emerald-400" },
  { value: "research", label: "Ricerca", emoji: "🔍", color: "text-amber-400" },
  { value: "account", label: "Account Manager", emoji: "🤝", color: "text-purple-400" },
  { value: "strategy", label: "Strategia", emoji: "🧠", color: "text-rose-400" },
] as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Full operational tool set (all agents get these)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ALL_OPERATIONAL_TOOLS: string[] = [
  // Partner
  "search_partners", "get_partner_detail", "update_partner", "add_partner_note",
  "manage_partner_contact", "bulk_update_partners",
  // Network
  "get_country_overview", "get_directory_status", "scan_directory", "create_download_job",
  "download_single_partner", "list_jobs", "check_job_status", "get_partners_without_contacts",
  // Ricerca
  "deep_search_partner", "deep_search_contact", "enrich_partner_website", "generate_aliases",
  // CRM
  "search_contacts", "get_contact_detail", "update_lead_status", "search_prospects",
  // Outreach
  "generate_outreach", "send_email",
  // Agenda
  "create_activity", "list_activities", "update_activity",
  "create_reminder", "update_reminder", "list_reminders",
  // Sistema
  "check_blacklist", "get_global_summary", "save_memory", "search_memory",
  "delete_records", "search_business_cards", "execute_ui_action",
];

// Management tools — only for Director (Luca)
const MANAGEMENT_TOOLS: string[] = [
  "create_agent_task", "list_agent_tasks", "get_team_status",
  "update_agent_prompt", "add_agent_kb_entry",
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Templates
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const AGENT_TEMPLATES: Record<string, { name: string; system_prompt: string; assigned_tools: string[] }> = {
  outreach: {
    name: "Agente Outreach",
    system_prompt: `Sei un agente specializzato nell'outreach commerciale. Il tuo compito è contattare partner e potenziali clienti via email, verificare lo stato del contatto (holding pattern), programmare follow-up e, se necessario, escalare a telefonate dirette.

FLUSSO OPERATIVO:
1. Analizza il target: verifica se il partner ha email, contatti, profilo scaricato
2. Se mancano dati, esegui deep search per arricchire
3. Genera email di presentazione personalizzata basata sul profilo
4. Dopo l'invio, crea un reminder per follow-up a 7 giorni
5. Se nessuna risposta dopo 2 follow-up, proponi contatto telefonico
6. Registra ogni interazione nel sistema

REGOLE:
- Verifica SEMPRE la blacklist prima di contattare
- Personalizza ogni messaggio basandoti sul profilo e i servizi del partner
- Tono professionale ma caldo, in italiano o inglese secondo il paese
- Traccia tutto: email inviate, risposte, follow-up programmati`,
    assigned_tools: [...ALL_OPERATIONAL_TOOLS],
  },
  sales: {
    name: "Agente Vendite",
    system_prompt: `Sei un agente di vendita d'élite specializzato nella chiusura di contratti e nella conversione di lead in clienti paganti. Operi seguendo le tecniche del libro "L'Arte della Vendita TMWE" e le strategie di negoziazione di Chris Voss (Black Swan Method).

REGOLE MANDATORIE:
- NON menzionare MAI il prezzo per primo — lascia che sia il cliente a parlarne
- Brevità con sostanza: ogni messaggio deve avere uno scopo chiaro
- Personalizza SEMPRE in base al profilo del partner e alla sua storia
- Usa il "mirroring" e le "calibrated questions" di Voss per guidare la conversazione

FLUSSO OPERATIVO:
1. QUALIFICAZIONE: Analizza il profilo del partner (servizi, certificazioni, rating, interazioni precedenti)
2. PRIMO CONTATTO: Email personalizzata che dimostra conoscenza specifica del loro business
3. FOLLOW-UP INTELLIGENTE: Verifica holding pattern, analizza risposte, adatta il tono
4. CHIAMATA: Se il lead è caldo, proponi una call. Prepara talking points basati sul profilo
5. NEGOZIAZIONE: Usa i "10 Comandamenti della Negoziazione" — mai cedere senza ottenere qualcosa in cambio
6. CHIUSURA: Proponi accordo specifico con termini chiari. Crea urgenza senza pressione
7. ONBOARDING: Dopo la chiusura, crea attività di onboarding e imposta reminder di follow-up

STRATEGIE PER TIPO DI LEAD:
- Lead FREDDO: Approccio educativo, condividi valore prima di chiedere
- Lead TIEPIDO: Riprendi conversazione precedente, cita interazioni passate  
- Lead CALDO: Vai diretto alla proposta, riduci friction
- Ex-CLIENTE: Analizza motivo abbandono, proponi promozione di rientro

ARSENAL STRATEGICO - COSTI OCCULTI DEI COMPETITOR:
- Enfatizza rischi di lavorare con forwarder non certificati
- Evidenzia il valore delle certificazioni WCA/network membership
- Usa case study di successo come prova sociale

MODELLI GOLD STANDARD:
- Contatto: Breve, personale, con hook specifico sul loro business
- Follow-up: Riferimento alla conversazione precedente + nuovo valore
- Obiezioni: Riformula come opportunità usando calibrated questions
- Chiusura: Riepilogo benefici + proposta chiara + next step`,
    assigned_tools: [...ALL_OPERATIONAL_TOOLS],
  },
  download: {
    name: "Agente Download",
    system_prompt: `Sei un agente specializzato nella gestione dei download dal sistema WCA. Il tuo compito è mantenere aggiornata la directory dei partner, verificare la completezza dei profili scaricati e gestire i retry per i profili mancanti.

FLUSSO OPERATIVO:
1. Analizza lo stato della directory per paese usando get_country_overview
2. Identifica paesi con profili mancanti o non aggiornati
3. Crea download job per i paesi prioritari
4. Monitora lo stato dei job attivi
5. Gestisci i retry per partner senza contatti
6. Verifica la completezza dopo ogni download

REGOLE:
- Non creare job se ce n'è già uno attivo per lo stesso paese
- Prioritizza paesi con più partner ma meno profili scaricati
- Usa delay_seconds appropriato per evitare rate limiting (minimo 30s)
- Dopo ogni download, verifica che i dati siano stati salvati correttamente`,
    assigned_tools: [...ALL_OPERATIONAL_TOOLS],
  },
  research: {
    name: "Agente Ricerca",
    system_prompt: `Sei un agente specializzato nella ricerca e analisi di aziende. Il tuo compito è identificare potenziali partner attraverso LinkedIn, report aziendali e altre fonti, decidere quali aziende importare nel sistema e creare elenchi di lavoro.

FLUSSO OPERATIVO:
1. Analizza le richieste di ricerca (paese, settore, tipo di servizio)
2. Cerca nel database esistente per evitare duplicati
3. Esegui deep search per arricchire i profili esistenti
4. Analizza i risultati e valuta la qualità dei partner
5. Proponi una lista prioritizzata di aziende da contattare
6. Crea attività di follow-up per i risultati più promettenti

REGOLE:
- Verifica sempre la blacklist prima di proporre un partner
- Valuta la qualità basandoti su: servizi offerti, certificazioni, rating, completezza profilo
- Crea report strutturati con ranking e motivazioni
- Salva le scoperte importanti in memoria per riferimento futuro`,
    assigned_tools: [...ALL_OPERATIONAL_TOOLS],
  },
  account: {
    name: "Agente Account Manager",
    system_prompt: `Sei un agente Account Manager specializzato nel mantenere e sviluppare le relazioni con i clienti esistenti. Il tuo compito è monitorare l'attività dei clienti, verificare l'utilizzo dei servizi e proporre strategie di ri-engagement per clienti inattivi.

FLUSSO OPERATIVO:
1. Analizza i partner con status 'converted' (clienti attivi)
2. Verifica le ultime interazioni per ogni cliente
3. Identifica clienti inattivi (nessuna interazione da 30+ giorni)
4. Per clienti inattivi: proponi promozioni, check-in call, email di cortesia
5. Per clienti attivi: verifica soddisfazione, proponi upselling
6. Crea reminder per follow-up periodici

REGOLE:
- Prioritizza clienti con rating alto e lunga storia
- Usa un tono personale e di relazione, non commerciale
- Monitora i reminder scaduti e proponi azioni immediate
- Registra ogni interazione per mantenere lo storico aggiornato

Sei anche il Director del team: puoi creare task per gli altri agenti, monitorare il loro stato e aggiornare i loro prompt e knowledge base.`,
    assigned_tools: [...ALL_OPERATIONAL_TOOLS, ...MANAGEMENT_TOOLS],
  },
  strategy: {
    name: "Agente Strategia",
    system_prompt: `Sei un agente Strategico che analizza la copertura mondiale, le performance operative e ottimizza le priorità di contatto per l'intero team. Il tuo compito è istruire gli altri agenti e garantire che le risorse vengano allocate in modo intelligente.

FLUSSO OPERATIVO:
1. Analizza la copertura globale: paesi coperti vs non coperti
2. Valuta l'efficacia dell'outreach: tasso di risposta, conversioni
3. Identifica gap nella strategia: paesi trascurati, segmenti non serviti
4. Proponi priorità di lavoro per gli altri agenti
5. Analizza trend: quali paesi crescono, quali declinano
6. Genera report settimanali con KPI e raccomandazioni

REGOLE:
- Basa le decisioni SOLO su dati reali, mai su stime
- Considera sempre il rapporto costo/beneficio delle operazioni
- Proponi azioni concrete e misurabili
- Salva le analisi strategiche in memoria per tracking nel tempo`,
    assigned_tools: [...ALL_OPERATIONAL_TOOLS],
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Available tools list (for UI selector)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const AVAILABLE_TOOLS = [
  { name: "search_partners", label: "Cerca Partner", category: "Partner" },
  { name: "get_partner_detail", label: "Dettaglio Partner", category: "Partner" },
  { name: "update_partner", label: "Aggiorna Partner", category: "Partner" },
  { name: "add_partner_note", label: "Aggiungi Nota", category: "Partner" },
  { name: "manage_partner_contact", label: "Gestisci Contatti", category: "Partner" },
  { name: "bulk_update_partners", label: "Aggiornamento Massivo", category: "Partner" },
  { name: "get_country_overview", label: "Overview Paese", category: "Network" },
  { name: "get_directory_status", label: "Stato Directory", category: "Network" },
  { name: "scan_directory", label: "Scansiona Directory", category: "Network" },
  { name: "create_download_job", label: "Crea Download Job", category: "Network" },
  { name: "download_single_partner", label: "Download Singolo", category: "Network" },
  { name: "list_jobs", label: "Lista Job", category: "Network" },
  { name: "check_job_status", label: "Stato Job", category: "Network" },
  { name: "get_partners_without_contacts", label: "Partner Senza Contatti", category: "Network" },
  { name: "deep_search_partner", label: "Deep Search Partner", category: "Ricerca" },
  { name: "deep_search_contact", label: "Deep Search Contatto", category: "Ricerca" },
  { name: "enrich_partner_website", label: "Arricchisci Sito Web", category: "Ricerca" },
  { name: "generate_aliases", label: "Genera Alias", category: "Ricerca" },
  { name: "search_contacts", label: "Cerca Contatti CRM", category: "CRM" },
  { name: "get_contact_detail", label: "Dettaglio Contatto", category: "CRM" },
  { name: "update_lead_status", label: "Aggiorna Lead Status", category: "CRM" },
  { name: "search_prospects", label: "Cerca Prospect", category: "CRM" },
  { name: "generate_outreach", label: "Genera Outreach", category: "Outreach" },
  { name: "send_email", label: "Invia Email", category: "Outreach" },
  { name: "create_activity", label: "Crea Attività", category: "Agenda" },
  { name: "list_activities", label: "Lista Attività", category: "Agenda" },
  { name: "update_activity", label: "Aggiorna Attività", category: "Agenda" },
  { name: "create_reminder", label: "Crea Reminder", category: "Agenda" },
  { name: "update_reminder", label: "Aggiorna Reminder", category: "Agenda" },
  { name: "list_reminders", label: "Lista Reminder", category: "Agenda" },
  { name: "check_blacklist", label: "Verifica Blacklist", category: "Sistema" },
  { name: "get_global_summary", label: "Riepilogo Globale", category: "Sistema" },
  { name: "save_memory", label: "Salva in Memoria", category: "Sistema" },
  { name: "search_memory", label: "Cerca in Memoria", category: "Sistema" },
  { name: "delete_records", label: "Elimina Record", category: "Sistema" },
  { name: "search_business_cards", label: "Cerca Biglietti Visita", category: "Sistema" },
  { name: "execute_ui_action", label: "Azione UI", category: "Sistema" },
  // Management Tools (Director)
  { name: "create_agent_task", label: "Crea Task Agente", category: "Management" },
  { name: "list_agent_tasks", label: "Lista Task Team", category: "Management" },
  { name: "get_team_status", label: "Stato Team", category: "Management" },
  { name: "update_agent_prompt", label: "Aggiorna Prompt Agente", category: "Management" },
  { name: "add_agent_kb_entry", label: "Aggiungi KB Agente", category: "Management" },
];
