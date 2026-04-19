import type { OperationProcedure } from "./types";

export const PROCEDURES_PART1: OperationProcedure[] = [
  // ══════════════════════════════════════
  // OUTREACH (6 procedure)
  // ══════════════════════════════════════
  {
    id: "email_single",
    name: "Email Singola",
    description: "[STUB] Procedura migrata in KB. Vedi procedures/email-single (autorità unica, OBBLIGATORIA A→Z).",
    tags: ["email", "singola", "outreach", "stub", "kb-redirect"],
    category: "outreach",
    channels: ["email"],
    prerequisites: [
      { check: "kb_consult", label: "Consulta KB procedures/email-single per gate completi", tool: "search_kb" },
    ],
    steps: [
      { order: 1, action: "Consulta KB procedures/email-single", tool: "search_kb", detail: "Single source of truth: kb_entries title='procedures/email-single'. Esegui A→Z fino al post-send-checklist." },
    ],
    related_pages: ["/cockpit", "/workspace", "/email-composer"],
    ai_tools_required: ["search_kb"],
    tips: ["Procedura unificata in KB: include gate, invio, post-send checklist (activity + lead_status + reminder + next_action)."],
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
    description: "[STUB] Migrata in KB. Vedi procedures/whatsapp-message + Dottrina Multi-Canale.",
    tags: ["whatsapp", "stub", "kb-redirect"],
    category: "outreach",
    channels: ["whatsapp"],
    prerequisites: [
      { check: "kb_consult", label: "Consulta KB procedures/whatsapp-message (gate consenso, fase qualified+)", tool: "search_kb" },
    ],
    steps: [
      { order: 1, action: "Consulta KB procedures/whatsapp-message", tool: "search_kb", detail: "WhatsApp VIETATO primo contatto. Solo lead_status in [engaged|qualified|negotiation|converted] + consenso esplicito. Refusal JSON se gate non rispettato." },
    ],
    related_pages: ["/cockpit", "/workspace"],
    ai_tools_required: ["search_kb"],
    tips: ["Single source of truth: kb_entries title='procedures/whatsapp-message'."],
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
    description: "[STUB] Migrata in KB. Vedi procedures/multi-channel-sequence (G0 email, G+5 LinkedIn, G+12 follow-up, WhatsApp solo se engaged+consenso).",
    tags: ["sequenza", "multi-canale", "stub", "kb-redirect"],
    category: "outreach",
    channels: ["email", "linkedin", "whatsapp"],
    prerequisites: [
      { check: "kb_consult", label: "Consulta KB procedures/multi-channel-sequence", tool: "search_kb" },
    ],
    steps: [
      { order: 1, action: "Consulta KB procedures/multi-channel-sequence", tool: "search_kb", detail: "Cadence allineata a Dottrina Multi-Canale: NO WhatsApp G+7 cieco." },
    ],
    related_pages: ["/cockpit", "/workspace", "/reminders"],
    ai_tools_required: ["search_kb"],
    tips: ["Single source of truth: kb_entries title='procedures/multi-channel-sequence'."],
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
      { order: 1, action: "Verifica stato dati corrente", tool: "get_directory_status", detail: "Controlla copertura e qualità dati del paese." },
      { order: 2, action: "Confronta con DB locale", tool: "get_country_overview", detail: "Valuta quantità e qualità dei partner presenti." },
      { order: 3, action: "Scegli arricchimento", tool: null, detail: "Se mancano rating o dati qualitativi, proponi deep search o arricchimento sito web." },
    ],
    related_pages: ["/operations", "/partner-hub"],
    ai_tools_required: ["get_directory_status", "get_country_overview"],
    tips: [
      "Non proporre scansioni o download WCA",
      "Usa deep search e website enrichment come azione successiva",
    ],
  },
  // [REMOVED] download_single — workflow legacy non più usato dagli agenti AI.
  // In questo frangente operativo l'AI deve guidare verso arricchimento, non verso download WCA.
  {
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
];
