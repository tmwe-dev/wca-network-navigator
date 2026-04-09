/**
 * Mock data for all 4 Outreach tabs — temporary, toggle-able via localStorage
 */

// ═══ IN USCITA (Sorting jobs) ═══
export const MOCK_SORTING_JOBS = [
  { id: "mock-sj-1", partner_id: "mock-p1", company_name: "Mazzetti Trasporti Srl", country_code: "IT", country_name: "Italy", city: "Milano", status: "pending", email: "m.rossi@mazzetti.it", job_type: "email", created_at: "2026-04-08T09:00:00Z", batch_id: "b1" },
  { id: "mock-sj-2", partner_id: "mock-p2", company_name: "Global Freight LLC", country_code: "AE", country_name: "UAE", city: "Dubai", status: "sent", email: "ops@globalfreight.ae", job_type: "email", created_at: "2026-04-07T14:30:00Z", batch_id: "b1" },
  { id: "mock-sj-3", partner_id: "mock-p3", company_name: "Pacifica Logistica SA", country_code: "BR", country_name: "Brazil", city: "São Paulo", status: "pending", email: "carlos@pacifica.com.br", job_type: "email", created_at: "2026-04-08T11:15:00Z", batch_id: "b2" },
  { id: "mock-sj-4", partner_id: "mock-p4", company_name: "Nordic Shipping AB", country_code: "SE", country_name: "Sweden", city: "Göteborg", status: "failed", email: "info@nordicship.se", job_type: "email", created_at: "2026-04-06T08:00:00Z", batch_id: "b2" },
  { id: "mock-sj-5", partner_id: "mock-p5", company_name: "Yangtze Express Co", country_code: "CN", country_name: "China", city: "Shanghai", status: "sent", email: "wang.li@yangtze-exp.cn", job_type: "email", created_at: "2026-04-07T03:45:00Z", batch_id: "b1" },
  { id: "mock-sj-6", partner_id: "mock-p6", company_name: "TransAlp Spedizioni", country_code: "IT", country_name: "Italy", city: "Verona", status: "pending", email: "g.bianchi@transalp.it", job_type: "email", created_at: "2026-04-08T16:20:00Z", batch_id: "b3" },
  { id: "mock-sj-7", partner_id: "mock-p7", company_name: "CargoPrime Ltd", country_code: "GB", country_name: "UK", city: "London", status: "sent", email: "sales@cargoprime.co.uk", job_type: "email", created_at: "2026-04-05T10:00:00Z", batch_id: "b3" },
  { id: "mock-sj-8", partner_id: "mock-p8", company_name: "Silk Route Logistics", country_code: "IN", country_name: "India", city: "Mumbai", status: "pending", email: "priya@silkroute.in", job_type: "email", created_at: "2026-04-08T06:30:00Z", batch_id: "b1" },
];

// ═══ ATTIVITÀ ═══
export const MOCK_ACTIVITIES = [
  {
    id: "mock-act-1", title: "Email primo contatto a Mazzetti Trasporti", description: "Presentazione servizi consolidato aereo per rotta MXP-DXB",
    activity_type: "send_email", status: "completed", priority: "high", due_date: "2026-04-07T10:00:00Z", created_at: "2026-04-06T09:00:00Z",
    email_subject: "Collaborazione Aereo MXP–DXB: tariffe consolidate", email_body: "<p>Gentile Sig. Rossi,</p><p>Le scrivo per presentare le nostre tariffe consolidate sulla rotta MXP-DXB...</p><p>Cordiali saluti</p>",
    partner_id: "mock-p1", source_id: "s1", source_type: "manual", user_id: null, assigned_to: null, campaign_batch_id: null,
    completed_at: "2026-04-07T10:15:00Z", executed_by_agent_id: null, reviewed: true, scheduled_at: null, selected_contact_id: null, sent_at: "2026-04-07T10:15:00Z", source_meta: null,
  },
  {
    id: "mock-act-2", title: "Follow-up WhatsApp Global Freight", description: "Secondo contatto via WhatsApp dopo mancata risposta email",
    activity_type: "phone_call", status: "pending", priority: "medium", due_date: "2026-04-10T14:00:00Z", created_at: "2026-04-08T11:00:00Z",
    email_subject: null, email_body: null,
    partner_id: "mock-p2", source_id: "s2", source_type: "ai_agent", user_id: null, assigned_to: null, campaign_batch_id: null,
    completed_at: null, executed_by_agent_id: "agent-1", reviewed: false, scheduled_at: "2026-04-10T14:00:00Z", selected_contact_id: null, sent_at: null, source_meta: { note: "Nessuna risposta dopo 5 giorni" },
  },
  {
    id: "mock-act-3", title: "Campagna mare Q2 — Pacifica Logistica", description: "Invio bulk campagna tariffe mare Santos-Genova",
    activity_type: "email", status: "completed", priority: "low", due_date: "2026-04-05T09:00:00Z", created_at: "2026-04-04T16:00:00Z",
    email_subject: "Tariffe Mare FCL Santos – Genova Q2 2026", email_body: "<p>Caro Carlos,</p><p>In allegato le nostre migliori tariffe FCL per il Q2...</p>",
    partner_id: "mock-p3", source_id: "s3", source_type: "campaign", user_id: null, assigned_to: null, campaign_batch_id: "b2",
    completed_at: "2026-04-05T09:05:00Z", executed_by_agent_id: null, reviewed: true, scheduled_at: null, selected_contact_id: null, sent_at: "2026-04-05T09:05:00Z", source_meta: null,
  },
  {
    id: "mock-act-4", title: "Chiamata Nordic Shipping — verifica interesse", description: "Chiamata programmata per verificare interesse dopo proposta aereo",
    activity_type: "phone_call", status: "in_progress", priority: "high", due_date: "2026-04-09T10:00:00Z", created_at: "2026-04-08T08:00:00Z",
    email_subject: null, email_body: null,
    partner_id: "mock-p4", source_id: "s4", source_type: "manual", user_id: null, assigned_to: null, campaign_batch_id: null,
    completed_at: null, executed_by_agent_id: null, reviewed: true, scheduled_at: "2026-04-09T10:00:00Z", selected_contact_id: null, sent_at: null, source_meta: { note: "Dopo 2 email senza risposta — escalation telefonica" },
  },
  {
    id: "mock-act-5", title: "LinkedIn connection request — CargoPrime", description: "Richiesta connessione LinkedIn a Sales Manager",
    activity_type: "follow_up", status: "completed", priority: "low", due_date: "2026-04-06T12:00:00Z", created_at: "2026-04-05T15:00:00Z",
    email_subject: null, email_body: null,
    partner_id: "mock-p7", source_id: "s5", source_type: "ai_agent", user_id: null, assigned_to: null, campaign_batch_id: null,
    completed_at: "2026-04-06T12:10:00Z", executed_by_agent_id: "agent-1", reviewed: true, scheduled_at: null, selected_contact_id: null, sent_at: null, source_meta: null,
  },
  {
    id: "mock-act-6", title: "Nota: Silk Route richiede tariffe espresso", description: "Il cliente ha richiesto urgentemente tariffe espresso BOM-FCO. Preparare quotazione.",
    activity_type: "follow_up", status: "pending", priority: "urgent", due_date: "2026-04-09T08:00:00Z", created_at: "2026-04-08T17:00:00Z",
    email_subject: null, email_body: null,
    partner_id: "mock-p8", source_id: "s6", source_type: "manual", user_id: null, assigned_to: null, campaign_batch_id: null,
    completed_at: null, executed_by_agent_id: null, reviewed: false, scheduled_at: null, selected_contact_id: null, sent_at: null, source_meta: { note: "Urgente: il cliente ha chiamato direttamente" },
  },
  {
    id: "mock-act-7", title: "Email reminder TransAlp Spedizioni", description: "Reminder automatico dopo 5 giorni senza risposta",
    activity_type: "send_email", status: "pending", priority: "medium", due_date: "2026-04-11T09:00:00Z", created_at: "2026-04-09T07:00:00Z",
    email_subject: "Re: Collaborazione spedizioni aeree", email_body: "<p>Gentile Sig. Bianchi,</p><p>Mi permetto di ricontattarla in merito alla nostra proposta...</p>",
    partner_id: "mock-p6", source_id: "s7", source_type: "ai_agent", user_id: null, assigned_to: null, campaign_batch_id: null,
    completed_at: null, executed_by_agent_id: "agent-2", reviewed: false, scheduled_at: "2026-04-11T09:00:00Z", selected_contact_id: null, sent_at: null, source_meta: null,
  },
  {
    id: "mock-act-8", title: "Proposta partnership Yangtze Express", description: "Invio proposta di partnership esclusiva per rotta PVG-MXP",
    activity_type: "send_email", status: "completed", priority: "high", due_date: "2026-04-07T06:00:00Z", created_at: "2026-04-06T18:00:00Z",
    email_subject: "Partnership esclusiva PVG–MXP", email_body: "<p>Dear Mr. Wang,</p><p>We are pleased to present our exclusive partnership proposal for the PVG-MXP route...</p>",
    partner_id: "mock-p5", source_id: "s8", source_type: "manual", user_id: null, assigned_to: null, campaign_batch_id: null,
    completed_at: "2026-04-07T06:20:00Z", executed_by_agent_id: null, reviewed: true, scheduled_at: null, selected_contact_id: null, sent_at: "2026-04-07T06:20:00Z", source_meta: null,
  },
  {
    id: "mock-act-9", title: "Meeting online con Mazzetti — demo piattaforma", description: "Demo della piattaforma di tracking e booking online",
    activity_type: "meeting", status: "pending", priority: "high", due_date: "2026-04-12T15:00:00Z", created_at: "2026-04-09T08:00:00Z",
    email_subject: null, email_body: null,
    partner_id: "mock-p1", source_id: "s9", source_type: "manual", user_id: null, assigned_to: null, campaign_batch_id: null,
    completed_at: null, executed_by_agent_id: null, reviewed: true, scheduled_at: "2026-04-12T15:00:00Z", selected_contact_id: null, sent_at: null, source_meta: { note: "Il Sig. Rossi ha confermato via telefono" },
  },
  {
    id: "mock-act-10", title: "Invio tariffe LCL a Global Freight", description: "Tariffe LCL per rotta JEA-GOA mensile",
    activity_type: "email", status: "in_progress", priority: "medium", due_date: "2026-04-09T12:00:00Z", created_at: "2026-04-08T14:00:00Z",
    email_subject: "LCL Rates JEA–GOA Monthly", email_body: "<p>Dear Team,</p><p>Please find attached our updated LCL rates...</p>",
    partner_id: "mock-p2", source_id: "s10", source_type: "ai_agent", user_id: null, assigned_to: null, campaign_batch_id: null,
    completed_at: null, executed_by_agent_id: "agent-1", reviewed: false, scheduled_at: null, selected_contact_id: null, sent_at: null, source_meta: null,
  },
  {
    id: "mock-act-11", title: "Follow-up telefonico Pacifica Logistica", description: "Verifica ricezione tariffe e interesse per servizio regolare",
    activity_type: "phone_call", status: "pending", priority: "medium", due_date: "2026-04-10T16:00:00Z", created_at: "2026-04-09T09:00:00Z",
    email_subject: null, email_body: null,
    partner_id: "mock-p3", source_id: "s11", source_type: "manual", user_id: null, assigned_to: null, campaign_batch_id: null,
    completed_at: null, executed_by_agent_id: null, reviewed: true, scheduled_at: "2026-04-10T16:00:00Z", selected_contact_id: null, sent_at: null, source_meta: null,
  },
  {
    id: "mock-act-12", title: "WhatsApp pricing update — Silk Route", description: "Invio aggiornamento prezzi via WhatsApp dopo richiesta urgente",
    activity_type: "follow_up", status: "completed", priority: "urgent", due_date: "2026-04-09T09:00:00Z", created_at: "2026-04-09T07:30:00Z",
    email_subject: null, email_body: null,
    partner_id: "mock-p8", source_id: "s12", source_type: "manual", user_id: null, assigned_to: null, campaign_batch_id: null,
    completed_at: "2026-04-09T09:15:00Z", executed_by_agent_id: null, reviewed: true, scheduled_at: null, selected_contact_id: null, sent_at: null, source_meta: { note: "Inviato PDF tariffe via WA" },
  },
];

// ═══ CIRCUITO (Holding Pattern Messages) ═══
export const MOCK_HOLDING_GROUPS = [
  {
    partnerId: "mock-p1",
    companyName: "Mazzetti Trasporti Srl",
    logoUrl: null,
    countryCode: "IT",
    contactName: "Marco Rossi",
    unreadCount: 2,
    messages: [
      {
        id: "mock-hm-1", channel: "email", direction: "inbound", subject: "Re: Collaborazione aereo MXP–DXB",
        from_address: "m.rossi@mazzetti.it", to_address: "agent@company.com",
        body_text: "Buongiorno, ho ricevuto la vostra proposta e la trovo interessante. Vorrei capire meglio i tempi di transito e le frequenze settimanali disponibili. Potete inviarmi un dettaglio?",
        body_html: "<p>Buongiorno,</p><p>ho ricevuto la vostra proposta e la trovo interessante. Vorrei capire meglio i tempi di transito e le frequenze settimanali disponibili.</p><p>Potete inviarmi un dettaglio?</p><p>Cordiali saluti,<br/>Marco Rossi</p>",
        email_date: "2026-04-08T14:30:00Z", created_at: "2026-04-08T14:30:00Z", read_at: null,
        partner_id: "mock-p1", user_id: "u1", category: null, cc_addresses: null, bcc_addresses: null,
        imap_uid: null, imap_flags: null, in_reply_to: null, internal_date: null, message_id_external: null,
        operator_id: null, parse_status: null, parse_warnings: null, raw_payload: null, raw_sha256: null,
        raw_size_bytes: null, raw_storage_path: null, references_header: null, search_vector: null,
        source_id: null, source_type: null, thread_id: null, uidvalidity: null,
      },
      {
        id: "mock-hm-2", channel: "email", direction: "outbound", subject: "Re: Re: Collaborazione aereo MXP–DXB",
        from_address: "agent@company.com", to_address: "m.rossi@mazzetti.it",
        body_text: "Gentile Sig. Rossi, grazie per il suo interesse. Le invio in allegato il dettaglio delle frequenze e transit time sulla rotta MXP-DXB.",
        body_html: null,
        email_date: "2026-04-08T16:00:00Z", created_at: "2026-04-08T16:00:00Z", read_at: "2026-04-08T16:00:00Z",
        partner_id: "mock-p1", user_id: "u1", category: null, cc_addresses: null, bcc_addresses: null,
        imap_uid: null, imap_flags: null, in_reply_to: null, internal_date: null, message_id_external: null,
        operator_id: null, parse_status: null, parse_warnings: null, raw_payload: null, raw_sha256: null,
        raw_size_bytes: null, raw_storage_path: null, references_header: null, search_vector: null,
        source_id: null, source_type: null, thread_id: null, uidvalidity: null,
      },
    ],
  },
  {
    partnerId: "mock-p2",
    companyName: "Global Freight LLC",
    logoUrl: null,
    countryCode: "AE",
    contactName: "Ahmed Al-Rashid",
    unreadCount: 1,
    messages: [
      {
        id: "mock-hm-3", channel: "email", direction: "inbound", subject: "Price inquiry for JEA-GOA",
        from_address: "ops@globalfreight.ae", to_address: "agent@company.com",
        body_text: "Hi, we need your best rates for LCL shipments from Jebel Ali to Genova. Monthly volumes around 15-20 CBM. Please advise.",
        body_html: null,
        email_date: "2026-04-09T06:00:00Z", created_at: "2026-04-09T06:00:00Z", read_at: null,
        partner_id: "mock-p2", user_id: "u1", category: null, cc_addresses: null, bcc_addresses: null,
        imap_uid: null, imap_flags: null, in_reply_to: null, internal_date: null, message_id_external: null,
        operator_id: null, parse_status: null, parse_warnings: null, raw_payload: null, raw_sha256: null,
        raw_size_bytes: null, raw_storage_path: null, references_header: null, search_vector: null,
        source_id: null, source_type: null, thread_id: null, uidvalidity: null,
      },
    ],
  },
  {
    partnerId: "mock-p5",
    companyName: "Yangtze Express Co",
    logoUrl: null,
    countryCode: "CN",
    contactName: "Wang Li",
    unreadCount: 0,
    messages: [
      {
        id: "mock-hm-4", channel: "email", direction: "inbound", subject: "Re: Partnership esclusiva PVG–MXP",
        from_address: "wang.li@yangtze-exp.cn", to_address: "agent@company.com",
        body_text: "Thank you for the proposal. We are currently reviewing internally. Could you provide some references from your European partners? We would like to proceed but need approval from management.",
        body_html: null,
        email_date: "2026-04-08T04:00:00Z", created_at: "2026-04-08T04:00:00Z", read_at: "2026-04-08T10:00:00Z",
        partner_id: "mock-p5", user_id: "u1", category: null, cc_addresses: null, bcc_addresses: null,
        imap_uid: null, imap_flags: null, in_reply_to: null, internal_date: null, message_id_external: null,
        operator_id: null, parse_status: null, parse_warnings: null, raw_payload: null, raw_sha256: null,
        raw_size_bytes: null, raw_storage_path: null, references_header: null, search_vector: null,
        source_id: null, source_type: null, thread_id: null, uidvalidity: null,
      },
    ],
  },
  {
    partnerId: "mock-p8",
    companyName: "Silk Route Logistics",
    logoUrl: null,
    countryCode: "IN",
    contactName: "Priya Sharma",
    unreadCount: 1,
    messages: [
      {
        id: "mock-hm-5", channel: "email", direction: "inbound", subject: "Urgent: Express rates BOM-FCO needed",
        from_address: "priya@silkroute.in", to_address: "agent@company.com",
        body_text: "Dear team, we have an urgent shipment of 500kg fragile electronics from Mumbai to Rome. Need express air rates ASAP. Customer deadline is April 15th. Please confirm availability and pricing.",
        body_html: null,
        email_date: "2026-04-09T05:30:00Z", created_at: "2026-04-09T05:30:00Z", read_at: null,
        partner_id: "mock-p8", user_id: "u1", category: null, cc_addresses: null, bcc_addresses: null,
        imap_uid: null, imap_flags: null, in_reply_to: null, internal_date: null, message_id_external: null,
        operator_id: null, parse_status: null, parse_warnings: null, raw_payload: null, raw_sha256: null,
        raw_size_bytes: null, raw_storage_path: null, references_header: null, search_vector: null,
        source_id: null, source_type: null, thread_id: null, uidvalidity: null,
      },
    ],
  },
  {
    partnerId: "mock-p7",
    companyName: "CargoPrime Ltd",
    logoUrl: null,
    countryCode: "GB",
    contactName: "James Wilson",
    unreadCount: 0,
    messages: [
      {
        id: "mock-hm-6", channel: "email", direction: "outbound", subject: "Follow-up: Air freight LHR-MXP",
        from_address: "agent@company.com", to_address: "sales@cargoprime.co.uk",
        body_text: "Dear Mr. Wilson, following up on our previous conversation about the LHR-MXP route. Have you had a chance to review our rates?",
        body_html: null,
        email_date: "2026-04-07T11:00:00Z", created_at: "2026-04-07T11:00:00Z", read_at: "2026-04-07T11:00:00Z",
        partner_id: "mock-p7", user_id: "u1", category: null, cc_addresses: null, bcc_addresses: null,
        imap_uid: null, imap_flags: null, in_reply_to: null, internal_date: null, message_id_external: null,
        operator_id: null, parse_status: null, parse_warnings: null, raw_payload: null, raw_sha256: null,
        raw_size_bytes: null, raw_storage_path: null, references_header: null, search_vector: null,
        source_id: null, source_type: null, thread_id: null, uidvalidity: null,
      },
    ],
  },
  {
    partnerId: "mock-p6",
    companyName: "TransAlp Spedizioni",
    logoUrl: null,
    countryCode: "IT",
    contactName: "Giovanni Bianchi",
    unreadCount: 1,
    messages: [
      {
        id: "mock-hm-7", channel: "email", direction: "inbound", subject: "Richiesta info spedizioni aeree",
        from_address: "g.bianchi@transalp.it", to_address: "agent@company.com",
        body_text: "Buongiorno, siamo interessati ai vostri servizi di spedizione aerea verso il Middle East. Abbiamo volumi settimanali di circa 2-3 tonnellate. Possiamo organizzare una call?",
        body_html: null,
        email_date: "2026-04-09T08:15:00Z", created_at: "2026-04-09T08:15:00Z", read_at: null,
        partner_id: "mock-p6", user_id: "u1", category: null, cc_addresses: null, bcc_addresses: null,
        imap_uid: null, imap_flags: null, in_reply_to: null, internal_date: null, message_id_external: null,
        operator_id: null, parse_status: null, parse_warnings: null, raw_payload: null, raw_sha256: null,
        raw_size_bytes: null, raw_storage_path: null, references_header: null, search_vector: null,
        source_id: null, source_type: null, thread_id: null, uidvalidity: null,
      },
    ],
  },
];

// ═══ CODA AI (Agent pending actions) ═══
export const MOCK_AGENT_ACTIONS = [
  {
    id: "mock-aa-1", activity_type: "email", title: "Follow-up automatico Mazzetti — dettaglio transit time",
    description: "Risposta automatica con transit time e frequenze settimanali MXP-DXB",
    email_subject: "Re: Collaborazione aereo MXP–DXB — Transit Time & Frequenze",
    email_body: "<p>Gentile Sig. Rossi,</p><p>Grazie per il suo interesse. Ecco i dettagli richiesti:</p><ul><li>Transit time: 2-3 giorni lavorativi</li><li>Frequenze: 3 voli settimanali (Lun/Mer/Ven)</li><li>Cut-off: 24h prima della partenza</li></ul><p>Rimango a disposizione per qualsiasi chiarimento.</p>",
    partner_id: "mock-p1", executed_by_agent_id: "agent-1", created_at: "2026-04-09T07:00:00Z",
    status: "pending", priority: "high", source_meta: { trigger: "auto_reply", confidence: 92 },
  },
  {
    id: "mock-aa-2", activity_type: "email", title: "Quotazione LCL JEA-GOA per Global Freight",
    description: "Preventivo automatico basato sui volumi indicati (15-20 CBM)",
    email_subject: "LCL Rates JEA–GOA | 15-20 CBM Monthly",
    email_body: "<p>Dear Ahmed,</p><p>Thank you for your inquiry. Based on your volumes of 15-20 CBM monthly:</p><ul><li>Rate: USD 45/CBM (all-in)</li><li>Transit: 18-21 days</li><li>Frequency: Weekly departures</li></ul><p>Best regards</p>",
    partner_id: "mock-p2", executed_by_agent_id: "agent-1", created_at: "2026-04-09T07:30:00Z",
    status: "pending", priority: "medium", source_meta: { trigger: "auto_reply", confidence: 88 },
  },
  {
    id: "mock-aa-3", activity_type: "email", title: "Referenze europee per Yangtze Express",
    description: "Invio lista referenze partner europei come richiesto",
    email_subject: "European Partner References — Yangtze Express Partnership",
    email_body: "<p>Dear Mr. Wang,</p><p>As requested, here are some of our key European partners who can provide references:</p><ol><li>TransAlp Spedizioni (Italy)</li><li>Nordic Shipping AB (Sweden)</li><li>CargoPrime Ltd (UK)</li></ol><p>We look forward to your positive feedback.</p>",
    partner_id: "mock-p5", executed_by_agent_id: "agent-2", created_at: "2026-04-09T08:00:00Z",
    status: "pending", priority: "medium", source_meta: { trigger: "auto_reply", confidence: 85 },
  },
  {
    id: "mock-aa-4", activity_type: "email", title: "Express rates BOM-FCO urgenti — Silk Route",
    description: "Quotazione express per spedizione urgente 500kg elettronica fragile",
    email_subject: "URGENT: Express Air Rates BOM–FCO | 500kg Electronics",
    email_body: "<p>Dear Priya,</p><p>We understand the urgency. Here is our express quote:</p><ul><li>Rate: USD 4.20/kg (express priority)</li><li>Transit: 48-72 hours</li><li>Special handling: fragile electronics packaging included</li><li>Availability: confirmed for April 11-12</li></ul><p>Please confirm to proceed with booking.</p>",
    partner_id: "mock-p8", executed_by_agent_id: "agent-1", created_at: "2026-04-09T06:00:00Z",
    status: "pending", priority: "high", source_meta: { trigger: "urgent_auto", confidence: 95 },
  },
  {
    id: "mock-aa-5", activity_type: "email", title: "Proposta call — TransAlp Spedizioni",
    description: "Proposta di organizzare una video call per presentazione servizi Middle East",
    email_subject: "Re: Richiesta info spedizioni aeree — Proposta Call",
    email_body: "<p>Gentile Sig. Bianchi,</p><p>Grazie per il suo interesse. Sarebbe disponibile per una breve call di 15 minuti questa settimana?</p><p>Propongo:</p><ul><li>Giovedì 10 aprile, ore 11:00</li><li>Venerdì 11 aprile, ore 14:00</li></ul><p>Cordiali saluti</p>",
    partner_id: "mock-p6", executed_by_agent_id: "agent-2", created_at: "2026-04-09T08:30:00Z",
    status: "pending", priority: "medium", source_meta: { trigger: "auto_reply", confidence: 90 },
  },
];

// Country flag helper
const FLAG_MAP: Record<string, string> = {
  IT: "🇮🇹", AE: "🇦🇪", BR: "🇧🇷", SE: "🇸🇪", CN: "🇨🇳", GB: "🇬🇧", IN: "🇮🇳",
  US: "🇺🇸", DE: "🇩🇪", FR: "🇫🇷", ES: "🇪🇸", JP: "🇯🇵",
};

export function getCountryFlag(code: string): string {
  return FLAG_MAP[code?.toUpperCase()] || "🏳️";
}
