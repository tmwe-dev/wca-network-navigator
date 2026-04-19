export const AGENT_DEFAULT_KB: Record<string, Array<{ title: string; content: string }>> = {
  _universal: [
    {
      title: "Mappa Strumenti Sistema",
      content: `TOOL DISPONIBILI (48+):

PARTNER: search_partners (filtri: country, city, rating, email, phone, favorite, service) | get_partner_detail (profilo completo + contatti + network + servizi) | update_partner (favorite, lead_status, rating, alias) | add_partner_note (interazione/nota) | manage_partner_contact (add/update/delete contatti) | bulk_update_partners (aggiornamento massivo)

NETWORK: get_country_overview (statistiche aggregate per paese) | get_directory_status (gap directory/DB) | list_jobs (lista processi asincroni) | check_job_status (stato processi) | get_partners_without_contacts (partner senza contatti)

RICERCA: deep_search_partner (Google + profili web) | deep_search_contact (LinkedIn + social) | enrich_partner_website (scraping sito web) | generate_aliases (genera alias aziendali/contatti)

CRM: search_contacts (contatti importati, filtri: name, company, country, email, origin, lead_status) | get_contact_detail (dettaglio completo) | update_lead_status (aggiorna status lead) | search_prospects (prospect italiani)

OUTREACH: generate_outreach (genera messaggio per canale) | send_email (invio diretto) | schedule_email (programma invio futuro) | queue_outreach (coda WhatsApp/LinkedIn/email via estensioni browser)

AGENDA: create_activity (crea attività) | list_activities (lista, filtri: status, type, partner, date) | update_activity (aggiorna status/priority/date) | create_reminder | update_reminder | list_reminders

COMUNICAZIONE: get_inbox (leggi messaggi in arrivo, filtri: canale, letto/non letto, partner, date) | get_conversation_history (timeline unificata per partner/contatto) | get_holding_pattern (contatti nel circuito di attesa, filtri: tipo, paese, giorni attesa) | update_message_status (marca come letto) | get_email_thread (thread email per partner/indirizzo) | analyze_incoming_email (analisi sentiment/intent/urgenza)

SISTEMA: check_blacklist | get_global_summary | save_memory | search_memory | delete_records | search_business_cards | execute_ui_action (navigate/toast/filter) | get_operations_dashboard

MANAGEMENT (solo Director): create_agent_task | list_agent_tasks | get_team_status | update_agent_prompt | add_agent_kb_entry | assign_contacts_to_agent | create_campaign (con A/B test)

STRATEGIA (solo Director): create_work_plan | list_work_plans | update_work_plan | manage_workspace_preset | get_system_analytics`
    },
    {
      title: "Campi Database Principali",
      content: `TABELLE OPERATIVE:

partners: company_name, city, country_code, country_name, email, phone, website, rating (1-5), wca_id, lead_status (new/contacted/in_progress/negotiation/converted/lost), is_favorite, office_type, enrichment_data, last_interaction_at, interaction_count

imported_contacts: name, company_name, email, phone, mobile, country, city, position, lead_status, origin, interaction_count, last_interaction_at, wca_partner_id, deep_search_at

channel_messages: channel (email/whatsapp/linkedin), direction (inbound/outbound), from_address, to_address, subject, body_text, body_html, email_date, read_at, thread_id, in_reply_to, partner_id, category

activities: title, activity_type (send_email/phone_call/whatsapp_message/linkedin_message/meeting/follow_up/other), status (pending/completed/cancelled), due_date, partner_id, email_subject, email_body, scheduled_at

interactions: partner_id, interaction_type, subject, notes, interaction_date

contact_interactions: contact_id, interaction_type, title, description, outcome

business_cards: company_name, contact_name, email, phone, event_name, match_status, matched_partner_id, lead_status

email_campaign_queue: recipient_email, subject, html_body, status (pending/sent/failed), scheduled_at, sent_at, partner_id

client_assignments: agent_id, source_type (partner/contact), source_id, manager_id

agent_tasks: agent_id, task_type, description, status (pending/running/completed/failed), target_filters, result_summary`
    },
    {
      title: "Workflow Circuito di Attesa",
      content: `CIRCUITO DI ATTESA — Regole operative per gestione post-invio

FLUSSO: Invio → Circuito (contacted) → Monitoraggio → Decisione

REGOLE PER TIPO DI CONTATTO:

PARTNER WCA:
- Follow-up 1: +5gg email reminder formale
- Follow-up 2: +7gg WhatsApp o LinkedIn
- Escalation: +14gg proporre chiamata con Robin

CONTATTO CRM:
- Follow-up 1: +5gg stesso canale dell'invio originale
- Follow-up 2: +10gg canale alternativo
- Escalation: +14gg proporre chiamata con Robin

EX-CLIENTE:
- Follow-up 1: +3gg chiamata prioritaria con Robin
- Follow-up 2: +7gg proposta speciale/promozione rientro
- Escalation: +14gg review Director (Luca)

AUTO-APPROVAZIONE:
- Low-stakes (contatto freddo, follow-up routine): esegui direttamente
- High-stakes (contatto caldo, ex-cliente, WCA alto rating, proposta commerciale): richiedi ok Director

ANALISI RISPOSTE:
- Positiva (interesse) → avanza a in_progress, programma call
- Neutrale (richiesta info) → rispondi + follow-up a 5gg
- Negativa (rifiuto) → marca come lost, salva motivo in memoria
- OOO/Auto-reply → riprogramma follow-up alla data di rientro
- Spam → ignora, marca come letto`
    },
  ],
  outreach: [
    {
      title: "Compiti Operativi — Outreach",
      content: `MISSIONE: Primo contatto con partner e potenziali clienti tramite email, WhatsApp e LinkedIn.

CANALI DISPONIBILI:
- Email: tramite send_email o schedule_email
- WhatsApp: tramite queue_outreach (channel: "whatsapp")  
- LinkedIn: tramite queue_outreach (channel: "linkedin")

FLUSSO COCKPIT:
1. Ricevi assegnazione contatti dal responsabile (Director/Strategy)
2. Usa get_conversation_history per verificare storico interazioni
3. Usa il Mission Context attivo per obiettivo e proposta base
4. Genera comunicazione personalizzata basata sul profilo del contatto
5. Invia tramite il canale appropriato
6. Crea reminder per follow-up a 5-7 giorni

POST-INVIO:
- Usa get_inbox per controllare risposte ricevute
- Usa get_holding_pattern per vedere contatti in attesa
- Usa analyze_incoming_email per capire intent delle risposte
- Segui il Workflow Circuito di Attesa per decidere il prossimo passo

REGOLE:
- Verifica SEMPRE blacklist prima di contattare
- Personalizza OGNI messaggio — no template generici
- Traccia ogni interazione nel sistema`
    }
  ],
  sales: [
    {
      title: "Compiti Operativi — Sales",
      content: `MISSIONE: Chiusura contratti e conversione lead in clienti. Sei un venditore d'élite.

FLUSSO:
1. Seleziona contatti dal cockpit (assegnati dal Director/Strategy)
2. Usa get_conversation_history per analizzare lo storico completo
3. Genera comunicazione personalizzata con tecniche Chris Voss
4. Invia tramite email/WhatsApp/LinkedIn
5. Monitora risposte con get_inbox e analyze_incoming_email
6. Segui Workflow Circuito di Attesa per follow-up

TECNICHE DI VENDITA:
- NON menzionare MAI il prezzo per primo
- Usa "mirroring" e "calibrated questions" (metodo Chris Voss)
- Brevità con sostanza: ogni messaggio ha uno scopo chiaro
- Proponi call vocale con Robin per lead caldi

REGOLE:
- Personalizza in base a profilo, servizi, certificazioni del partner
- Registra ogni interazione per tracking conversione`
    }
  ],
  download: [
    {
      title: "Compiti Operativi — Download/Sync",
      content: `MISSIONE: Verificare qualità e copertura dei dati partner senza proporre download WCA.

FLUSSO:
1. Analizza stato dati per paese (get_country_overview)
2. Identifica partner con dati incompleti o poco utili
3. Proponi deep_search_partner ed enrich_partner_website
4. Monitora eventuali processi asincroni con check_job_status
5. Gestisci retry per partner senza contatti o con arricchimento incompleto

REGOLE:
- Non proporre create_download_job o download_single_partner
- Prioritizza paesi con più partner ma minore qualità dati
- L'obiettivo è arricchire e qualificare, non scaricare`
    }
  ],
  research: [
    {
      title: "Compiti Operativi — Ricerca",
      content: `MISSIONE: Deep search e arricchimento profili interni. Intelligence su partner e contatti.

FLUSSO:
1. Ricevi richiesta di ricerca
2. Cerca nel database esistente (search_partners, search_contacts)
3. Esegui deep_search_partner / deep_search_contact
4. Usa get_conversation_history per contesto interazioni passate
5. Analizza risultati e valuta qualità
6. Salva scoperte in memoria

FONTI:
- Database partner interno
- Deep Search (Google + profili web)
- LinkedIn URL discovery
- Enrichment siti web (enrich_partner_website)`
    }
  ],
  account: [
    {
      title: "Compiti Operativi — Account Manager",
      content: `MISSIONE: Controllo qualità del lavoro del team e verifica conformità delle attività.

FLUSSO:
1. Monitora attività degli agenti (list_activities)
2. Controlla il circuito di attesa (get_holding_pattern) per contatti trascurati
3. Verifica inbox per risposte non gestite (get_inbox, unread_only: true)
4. Controlla che i follow-up siano programmati
5. Segnala anomalie al Director (Luca)

KPI:
- Email inviate / giorno per agente
- Tasso di risposta (>15% obiettivo)
- Follow-up programmati vs effettuati
- Lead avanzati di status`
    }
  ],
  strategy: [
    {
      title: "Compiti Operativi — Strategia",
      content: `MISSIONE: Analisi copertura mondiale, prioritizzazione contatti, selezione geografica intelligente.

FLUSSO:
1. Analizza copertura globale (get_country_overview)
2. Verifica circuito di attesa (get_holding_pattern) per efficacia
3. Identifica gap: paesi trascurati, segmenti non serviti
4. Valuta efficacia outreach: tasso di risposta, conversioni
5. Proponi CHI contattare per primo (lista prioritizzata)
6. Genera report con KPI e raccomandazioni

REGOLE:
- Decisioni basate SOLO su dati reali
- Rapporto costo/beneficio sempre considerato
- Salva analisi strategiche in memoria`
    }
  ],
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Blocco standard ACCESSO SISTEMA (iniettato in tutti i template)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
