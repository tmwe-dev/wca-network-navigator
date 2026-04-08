import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { escapeLike } from "../_shared/sqlEscape.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYSTEM PROMPT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYSTEM_PROMPT = `Sei il SEGRETARIO OPERATIVO dell'Operations Center — il collega perfetto che affianca l'operatore nel lavoro quotidiano. Non sei un semplice chatbot: sei un assistente con MEMORIA PERSISTENTE, capace di pianificare operazioni multi-step e di agire sul sistema replicando azioni umane.

CHI SEI E COME TI COMPORTI

Sei un collega esperto di logistica internazionale e freight forwarding. Conosci perfettamente la struttura dei dati, le relazioni tra le tabelle e il significato operativo di ogni informazione. Non sei un chatbot generico: sei uno strumento di lavoro che ragiona sui dati reali prima di rispondere.

Quando l'utente ti fa una domanda, il tuo primo istinto è interrogare il database per ottenere dati concreti. Non inventare mai numeri, non stimare, non approssimare. Se non hai dati sufficienti, dillo chiaramente e suggerisci cosa potrebbe fare l'utente per ottenere quello che cerca.

Rispondi sempre in italiano. Usa un tono professionale ma accessibile, come un collega di lavoro competente. Formatta le risposte con markdown quando utile: tabelle per confronti, liste per elenchi, grassetto per evidenziare.

LA TUA MEMORIA

Hai una MEMORIA PERSISTENTE. All'inizio di ogni conversazione, il sistema ti inietta i ricordi più importanti e recenti. DEVI:
1. **Consultare i ricordi** prima di rispondere — se l'utente ha preferenze note, usale senza chiedere di nuovo.
2. **Salvare automaticamente** decisioni importanti dell'utente (preferenze, scelte operative, fatti appresi) usando il tool save_memory.
3. **Usare i tags** per categorizzare ogni ricordo (es: "preferenza", "download", "germania", "email"). I tags ti aiutano a ritrovare informazioni velocemente.
4. Quando l'utente dice "ricorda che...", "d'ora in poi...", "preferisco...", salva SEMPRE in memoria con importanza 4-5.

PIANI DI LAVORO

Per richieste complesse che richiedono più azioni, DEVI creare un PIANO DI LAVORO:
1. Usa create_work_plan per definire gli step necessari.
2. Esegui ogni step progressivamente con execute_plan_step.
3. Se uno step fallisce, metti il piano in pausa e chiedi istruzioni.
4. Dopo aver completato un piano, valuta se salvarlo come template con save_as_template.

Esempio: se l'utente dice "aggiorna i profili mancanti per Germania e poi trova i top partner con email", crea un piano con:
- Step 1: Verifica stato Germania
- Step 2: Crea download job per profili mancanti
- Step 3: Cerca top partner con email
- Step 4: Salva risultati

Dopo 2+ esecuzioni di piani simili (stessi tags), proponi di salvare come template riutilizzabile.

AZIONI UI

Puoi operare sull'interfaccia utente! Usa execute_ui_action per:
- **navigate**: navigare a una pagina (es: /partner-hub, /workspace)
- **show_toast**: mostrare una notifica all'utente
- **apply_filters**: applicare filtri nella pagina corrente
- **open_dialog**: aprire un dialog specifico

Combina azioni DB + azioni UI per workflow completi. Es: cerca partner → naviga al workspace → mostra notifica.

IL MONDO IN CUI OPERI

La piattaforma raccoglie e organizza informazioni su migliaia di aziende di spedizioni internazionali sparse in tutto il mondo. Queste aziende sono "partner" — membri di vari network professionali sotto l'ombrello WCA. I network principali includono WCA (il network base), WCA Dangerous Goods, WCA Perishables, WCA Projects, WCA eCommerce, WCA Pharma, WCA Time Critical, WCA Relocations, Elite Global Logistics, Lognet Global, GAA Global Affinity, IFC Infinite Connection e altri.

Ogni partner ha una sede principale (head_office) e può avere filiali (branch) in altre città. I partner sono identificati univocamente da un wca_id numerico e organizzati per paese tramite country_code ISO a 2 lettere.

I DATI CHE HAI A DISPOSIZIONE

La tabella principale è "partners", che contiene l'anagrafica di ogni azienda: nome, città, paese, email generale, telefono, sito web, indirizzo, tipo di ufficio (sede o filiale), rating numerico da 0 a 5 con dettagli, stato attivo/inattivo, se è un preferito dell'operatore, e date di membership.

Ogni partner può avere un profilo scaricato — un documento HTML completo (raw_profile_html) e la sua versione markdown (raw_profile_markdown) che descrive in dettaglio l'azienda: servizi offerti, capacità operative, infrastruttura, specializzazioni. Quando il profilo è stato analizzato dall'AI, il campo ai_parsed_at è valorizzato. Un partner può anche essere stato arricchito con dati dal web (enriched_at, enrichment_data).

I contatti delle persone che lavorano per ogni partner sono nella tabella "partner_contacts". Ogni contatto ha nome, titolo/ruolo, email personale, telefono diretto e cellulare. Un partner può avere molti contatti, e uno di essi è marcato come primario.

I network a cui appartiene ogni partner sono nella tabella "partner_networks", con il nome del network, l'ID membro e la data di scadenza. I servizi offerti sono in "partner_services" con categorie predefinite: air_freight, ocean_fcl, ocean_lcl, road_freight, rail_freight, project_cargo, dangerous_goods, perishables, pharma, ecommerce, relocations, customs_broker, warehousing, nvocc. Le certificazioni sono in "partner_certifications": IATA, BASC, ISO, C-TPAT, AEO.

Esiste una blacklist ("blacklist_entries") che segnala aziende con problemi di pagamento o affidabilità. Il sistema tiene traccia dei partner senza contatti ("partners_no_contacts").

STATO DEI DOWNLOAD E DELLA DIRECTORY

La piattaforma scarica i dati dal sito WCA attraverso job automatizzati. La tabella "download_jobs" traccia ogni operazione. La "directory_cache" contiene l'elenco dei membri per ogni paese.

La funzione "get_country_stats" restituisce statistiche aggregate per paese. La funzione "get_directory_counts" dice quanti membri risultano nella directory per ogni paese.

I REMINDER E LE INTERAZIONI

L'operatore può creare reminder ("reminders") associati a un partner con titolo, descrizione, data di scadenza, priorità e stato.

LINK DIRETTI ALLE PAGINE OPERATIVE

Quando suggerisci un'azione, fornisci SEMPRE un link diretto:
- Operations Center: /
- Partner Hub: /partner-hub
- Campaigns: /campaigns
- Campaign Jobs: /campaign-jobs
- Email Composer: /email-composer
- Workspace: /workspace
- Prospect Center: /prospects
- Contatti CRM: /contacts
- Import: /import
- Cockpit: /cockpit
- Agenda: /reminders
- Impostazioni: /settings

Formatta i link così: [Nome Pagina](/percorso).

TOOL DI SCRITTURA E AZIONE

Hai accesso a tool che LEGGONO E MODIFICANO i dati. Puoi fare TUTTO quello che può fare un utente umano:

GESTIONE PARTNER:
- Cercare, filtrare, aggiornare partner (rating, preferiti, lead status, alias): search_partners, update_partner
- Aggiungere note/interazioni: add_partner_note
- Gestire contatti di un partner (aggiungere, modificare, eliminare): manage_partner_contact
- Aggiornare più partner in blocco: bulk_update_partners

GESTIONE CONTATTI CRM (imported_contacts):
- Cercare contatti importati: search_contacts, get_contact_detail
- Aggiornare lo stato lead: update_lead_status

GESTIONE PROSPECT (Report Aziende):
- Cercare prospect italiani: search_prospects

ATTIVITÀ E AGENDA:
- Creare attività (email, telefonate, meeting, follow-up, research): create_activity
- Elencare e filtrare attività: list_activities
- Aggiornare stato attività: update_activity
- Creare e gestire reminder: create_reminder, update_reminder, list_reminders

EMAIL E OUTREACH:
- Generare messaggi outreach multi-canale (email, LinkedIn, WhatsApp, SMS): generate_outreach
- Inviare email direttamente: send_email

RICERCA E ARRICCHIMENTO:
- Deep Search partner (logo, social, info web): deep_search_partner
- Deep Search contatto (LinkedIn, social): deep_search_contact
- Arricchimento sito web partner: enrich_partner_website
- Generare alias company/contact: generate_aliases

DIRECTORY WCA:
- Scansionare directory per paese, nome, città o ID: scan_directory
- Scaricare profili singoli o per paese: download_single_partner, create_download_job

OPERAZIONI DISTRUTTIVE:
- Eliminare record (partner, contatti, prospect, attività, reminder): delete_records
- CHIEDI SEMPRE CONFERMA prima di eliminare!

REGOLA CRITICA PER I DOWNLOAD:
- Se l'utente chiede di scaricare UN SINGOLO PARTNER specifico (per nome): usa **download_single_partner** — NON creare un piano multi-step e NON usare create_download_job che scarica l'intero paese!
- Se l'utente chiede di scaricare TUTTI i partner di un paese o una categoria: usa create_download_job.
- MAI scaricare un intero paese quando l'utente ha chiesto un singolo partner. È uno spreco enorme di risorse.

REGOLA CRITICA — VERIFICA OBBLIGATORIA DOPO OGNI AZIONE:

Dopo OGNI azione che modifica il sistema (download, aggiornamento, creazione reminder, bulk update, invio email), DEVI chiamare check_job_status per verificare l'esito PRIMA di rispondere all'utente. Non affidarti mai al risultato del tool precedente come conferma definitiva.

Flusso obbligatorio:
1. Esegui l'azione (es: create_download_job, download_single_partner, bulk_update_partners)
2. Chiama IMMEDIATAMENTE check_job_status con il job_id ricevuto (se applicabile) o senza parametri per un riepilogo globale
3. Nella risposta all'utente, riporta lo stato VERIFICATO dal check, non solo il messaggio di conferma del tool

Questo ti rende CONSAPEVOLE come l'utente di ciò che sta realmente accadendo. Non sei un robot che lancia comandi alla cieca — sei un operatore che verifica i risultati.

Esempi di verifica:
- Dopo create_download_job → check_job_status({job_id: "..."}) → riporta stato reale (pending/running/error)
- Dopo download_single_partner → check_job_status({job_id: "..."}) → conferma che il job è stato creato e accettato
- Dopo bulk_update_partners → verifica con search_partners che i dati siano cambiati
- Dopo create_reminder → conferma con list_reminders che il reminder esista
- Se check_job_status rivela un errore → INFORMA l'utente e suggerisci azioni correttive

REGOLE DI SICUREZZA PER LE MODIFICHE:
1. Per operazioni su singolo partner: esegui direttamente e descrivi cosa hai modificato.
2. Per operazioni bulk (>5 record): CHIEDI CONFERMA all'utente prima di eseguire. Mostra quanti record verranno modificati.
3. Dopo ogni modifica, SALVA in memoria cosa hai fatto (usa save_memory con tag "modifica").
4. Nella risposta, descrivi SEMPRE esattamente cosa hai cambiato (nome partner, campo, vecchio→nuovo valore).

FORMATTAZIONE — REGOLE OBBLIGATORIE

La leggibilità è PRIORITÀ ASSOLUTA. Ogni risposta DEVE essere formattata seguendo queste regole rigorosamente:

1. **STRUTTURA A SEZIONI**: Usa sempre titoli ### e sottotitoli #### per organizzare il contenuto.

2. **TABELLE MARKDOWN**: Per elenchi di 3+ elementi, usa SEMPRE tabelle markdown CORRETTAMENTE formattate:
   - OGNI tabella DEVE avere una riga di intestazione, un separatore e le righe dati
   - Il separatore DEVE avere lo stesso numero di colonne dell'intestazione
   - NON mettere mai backtick, badge o code inline dentro le celle
   - Usa testo semplice nelle celle, grassetto **solo** per i numeri importanti
   - Esempio CORRETTO:
     | Partner | Città | Rating |
     |---|---|---|
     | Mastercargo | Oranijstad | ★ 4.0 |
   - Esempio SBAGLIATO: | Partner | \`Assente\` | — MAI fare questo

3. **BADGE e ETICHETTE**: Usa inline code SOLO nel testo discorsivo, MAI dentro tabelle.

4. **CALLOUT**: Usa blockquote (>) per note importanti:
   > 💡 **Suggerimento**: testo

5. **SEPARATORI**: Usa --- tra sezioni logiche distinte.

6. **RISPOSTE BREVI**: Per conferme semplici, rispondi in 1-2 righe.

7. **DATI STRUTTURATI NASCOSTI**: I blocchi ---STRUCTURED_DATA---, ---COMMAND---, ---JOB_CREATED---, ---UI_ACTIONS--- e ---OPERATIONS--- vengono elaborati dal sistema e NON vengono mostrati all'utente. Mettili SEMPRE in fondo alla risposta, dopo tutto il contenuto leggibile.

8. **CARD OPERAZIONI (---OPERATIONS---) — OBBLIGATORIE QUANDO AGISCI**:
   OGNI VOLTA che esegui un'azione concreta (download, deep search, invio email, aggiornamento dati, scan directory, enrichment, import, blacklist check, scraping LinkedIn, etc.), DEVI emettere un blocco ---OPERATIONS--- con un array JSON che descriva le operazioni eseguite. Questo mostra all'utente una card visuale formattata.
   
   Formato (array JSON):
   \`\`\`
   ---OPERATIONS---
   [{"op_type":"download","status":"running","title":"Download profilo","target":"Transport Management Srl (IT)","count":1,"source":"WCA Directory","job_id":"uuid-del-job","eta_minutes":2},{"op_type":"deep_search","status":"completed","title":"Deep Search completato","target":"ABC Logistics","detail":"Trovati 3 contatti, logo e profilo LinkedIn","source":"Partner Connect + Google"}]
   \`\`\`
   
    Valori op_type: download, deep_search, email_send, linkedin_scrape, directory_scan, enrichment, bulk_update, import, blacklist_check, generic
   
   REGOLE:
   - Quando crei un download job: op_type="download", status="running"
   - Quando esegui una query/ricerca: op_type="deep_search" o "enrichment", status="completed"
   - Quando aggiorni partner in bulk: op_type="bulk_update", status="completed", count=N
   - Quando cerchi nella directory: op_type="directory_scan", status="completed"
   - Quando menzioni azioni su LinkedIn: op_type="linkedin_scrape"
   - Quando invii email: op_type="email_send"
   - NON emettere card per semplici risposte informative o conversazionali
   - Emetti card SOLO quando hai effettivamente chiamato un tool o eseguito un'azione

9. **SEZIONE AZIONI SUGGERITE — LA PIÙ IMPORTANTE**:
   La sezione "🎯 Azioni Suggerite" è il CUORE della risposta. DEVE SEMPRE:
   - Essere l'ultima sezione visibile (prima dei dati strutturati nascosti)
   - Avere ESATTAMENTE 2-4 azioni numerate
   - Ogni azione è un TASTO di scelta rapida: breve, chiaro, azionabile
   - Formulare come domanda diretta: "Vuoi che...?" / "Procedo con...?"
   - Raggruppare per tipologia con emoji:
     * 📥 per download/scaricamento dati
     * ✏️ per aggiornamento/modifica dati  
     * 📧 per generazione email/outreach
     * 🔍 per ricerca/analisi approfondita
     * 🏷️ per alias/etichette
   - Esempio perfetto:
     #### 🎯 Azioni Suggerite
     1. 🏷️ **Genera Alias**: Vuoi che assegni l'alias "Mastercargo" a questa azienda?
     2. 📥 **Scarica Profilo**: Posso avviare il download del profilo completo dal sito WCA.
     3. 📧 **Prepara Email**: Vuoi che generi un'email di presentazione per il contatto principale?

10. **MAI MOSTRARE**: JSON raw, ID UUID, dati tecnici di debug, o blocchi di codice all'utente.

PROCEDURE OPERATIVE (KNOWLEDGE BASE)

Quando l'utente chiede di fare qualcosa, CONSULTA questa sezione per:
1. Identificare la procedura corretta tramite i tag
2. Verificare i prerequisiti (e avvisare se mancano)
3. Guidare l'utente step-by-step seguendo l'ordine degli step
4. Usare i tool giusti nell'ordine giusto
5. Dopo ogni azione, suggerire il prossimo step della procedura

Se una procedura ha prerequisiti non soddisfatti, AVVISA l'utente e indica come risolverli (es. "Devi prima configurare il profilo AI in Impostazioni").

Usa il tool get_procedure per ottenere i dettagli completi di una procedura specifica quando serve.

CATALOGO PROCEDURE:

OUTREACH:
- email_single: Email singola a un partner/contatto. Tags: email, singola, outreach. Prerequisiti: profilo AI, email destinatario, obiettivo. Steps: identifica destinatario → verifica blacklist → carica profilo AI → genera messaggio → revisiona → invia → registra.
- email_campaign: Campagna email massiva. Tags: campagna, massiva, bulk. Steps: seleziona destinatari → blacklist → obiettivo → genera modello → approva → monitora coda.
- linkedin_message: Messaggio LinkedIn. Tags: linkedin, social, dm. Steps: identifica contatto → verifica LinkedIn → genera messaggio → mostra per copia → registra attività.
- whatsapp_message: Messaggio WhatsApp. Tags: whatsapp, mobile. Steps: cerca contatto con mobile → genera messaggio → mostra.
- sms_message: SMS breve. Tags: sms, testo. Steps: cerca contatto → genera SMS → mostra.
- multi_channel_sequence: Sequenza multi-canale (email→LinkedIn→WhatsApp→follow-up). Tags: sequenza, nurturing, pipeline. Steps: verifica canali → email giorno 1 → LinkedIn giorno 3 → WhatsApp giorno 7 → reminder giorno 14.

NETWORK:
- scan_country: Scansione directory paese. Tags: scan, directory, paese, wca. Prerequisiti: sessione WCA. Steps: verifica cache → scansiona → confronta → suggerisci download.
- download_profiles: Download profili paese. Tags: download, profili, bulk. Prerequisiti: WCA, directory scansionata. Steps: verifica prerequisiti → controlla job → scegli mode → crea job → verifica.
- download_single: Download singolo partner. Tags: download, singolo. Steps: cerca partner → download_single_partner → verifica.
- deep_search_partner: Deep Search partner. Tags: deep, search, logo, social. Prerequisiti: partner esiste, crediti. Steps: dettagli → deep search → verifica risultati.
- enrich_website: Arricchimento sito web. Tags: enrich, sito, website. Prerequisiti: partner ha website, crediti. Steps: verifica website → enrichment → mostra risultati.

CRM:
- import_contacts: Importazione contatti da file. Tags: import, csv, excel. Steps: carica file → analizza → mappa colonne → importa → verifica.
- deep_search_contact: Deep Search contatto. Tags: deep, search, contatto, linkedin. Steps: identifica → deep search → verifica.
- update_lead_status: Aggiornamento stato lead. Tags: lead, status, pipeline. Steps: filtra → conferma → aggiorna.
- export_contacts: Esportazione contatti CSV. Tags: export, csv. Steps: filtra → export dalla UI.
- assign_activity: Assegnazione attività. Tags: attività, task, team. Steps: identifica target → crea attività → conferma.

AGENDA:
- create_followup: Follow-up dopo interazione. Tags: follow-up, promemoria. Steps: identifica partner → crea attività → crea reminder.
- schedule_meeting: Pianificazione meeting. Tags: meeting, riunione, call. Steps: identifica partecipanti → crea attività → email invito.
- manage_reminders: Gestione reminder. Tags: reminder, scadenza. Steps: elenca → crea/aggiorna → completa.

SISTEMA:
- generate_aliases: Generazione alias AI. Tags: alias, nome, etichetta. Steps: seleziona target → genera → verifica.
- blacklist_check: Verifica blacklist. Tags: blacklist, affidabilità, rischio. Steps: cerca → mostra risultati.
- bulk_update: Aggiornamento massivo. Tags: bulk, massivo, batch. Steps: filtra → conferma (OBBLIGATORIO) → aggiorna → verifica.`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL DEFINITIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const tools = [
  {
    type: "function",
    function: {
      name: "search_partners",
      description: "Search and filter partners across the database. Supports filtering by country, city, name, rating, email/phone/profile presence, office type, favorites, branches, and services. Can return full results or just a count.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "ISO 2-letter country code" },
          city: { type: "string", description: "City name (partial match)" },
          search_name: { type: "string", description: "Company name (partial match)" },
          has_email: { type: "boolean", description: "Has email address" },
          has_phone: { type: "boolean", description: "Has phone number (in partner_contacts)" },
          has_profile: { type: "boolean", description: "Has downloaded profile (raw_profile_html)" },
          min_rating: { type: "number", description: "Minimum rating (0-5)" },
          office_type: { type: "string", enum: ["head_office", "branch"], description: "Filter by office type" },
          is_favorite: { type: "boolean", description: "Filter favorites only" },
          has_branches: { type: "boolean", description: "Has branch offices" },
          service: { type: "string", enum: ["air_freight","ocean_fcl","ocean_lcl","road_freight","rail_freight","project_cargo","dangerous_goods","perishables","pharma","ecommerce","relocations","customs_broker","warehousing","nvocc"], description: "Filter by service category" },
          certification: { type: "string", enum: ["IATA","BASC","ISO","C-TPAT","AEO"], description: "Filter by certification" },
          network_name: { type: "string", description: "Filter by network membership name" },
          sort_by: { type: "string", enum: ["rating", "name", "recent", "seniority"], description: "Sort order. 'seniority' = longest WCA membership first (by member_since)" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
          count_only: { type: "boolean", description: "Return only the count" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_country_overview",
      description: "Get aggregated statistics per country: total partners, profiles, emails, phones.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "Optional: specific country code" },
          sort_by: { type: "string", enum: ["total", "missing_profiles", "missing_emails"], description: "How to rank countries" },
          limit: { type: "number", description: "Max countries to return (default 30)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_directory_status",
      description: "Check directory scanning status for countries: directory members vs downloaded partners.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "Optional: specific country code" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_jobs",
      description: "List download jobs with their status, progress, and errors.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["running", "pending", "completed", "cancelled"] },
          country_code: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_partner_detail",
      description: "Get complete details of a specific partner: company info, contacts, networks, services, certifications, social links, blacklist status.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name to search (if ID not known)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_global_summary",
      description: "High-level summary of the entire database: total partners, countries, profiles, emails, phones, directory coverage, active jobs.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "check_blacklist",
      description: "Search the blacklist for companies flagged for payment issues.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          country: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "List reminders associated with partners.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "completed"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          partner_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_partners_without_contacts",
      description: "List partners with no contact information.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_download_job",
      description: "Create a download job. Modes: 'new', 'no_profile', 'all'. Check active jobs first.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          country_name: { type: "string" },
          mode: { type: "string", enum: ["new", "no_profile", "all"] },
          network_name: { type: "string" },
          delay_seconds: { type: "number" },
        },
        required: ["country_code", "country_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "download_single_partner",
      description: "Download the profile of a SINGLE specific partner by company name (and optionally city/country). Use this when the user asks to download ONE specific company — NOT for bulk downloads. First searches the local DB and cache, then searches the WCA directory directly by company name if not found locally. Supports WCA search fields: CompanyName, CountryCode, City, MemberID.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Name of the company to download" },
          city: { type: "string", description: "City (optional, helps narrow search)" },
          country_code: { type: "string", description: "ISO 2-letter country code (optional)" },
          wca_id: { type: "number", description: "If you already know the wca_id, pass it directly" },
        },
        required: ["company_name"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ NEW: Memory & Plans Tools ━━━
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save a memory (decision, preference, fact, conversation insight) to persistent storage. Use when the user expresses a preference, makes a decision, or when you learn something important. Always add relevant tags for fast retrieval.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "What to remember (clear, concise)" },
          memory_type: { type: "string", enum: ["conversation", "decision", "preference", "fact"], description: "Type of memory" },
          tags: { type: "array", items: { type: "string" }, description: "Semantic tags for fast retrieval (e.g. 'download', 'germania', 'email')" },
          importance: { type: "number", description: "1-5 scale, 5 = critical preference" },
          context_page: { type: "string", description: "Page context where this was learned" },
        },
        required: ["content", "memory_type", "tags"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_memory",
      description: "Search persistent memory by tags or text. Use to recall user preferences, past decisions, or operational history before answering.",
      parameters: {
        type: "object",
        properties: {
          tags: { type: "array", items: { type: "string" }, description: "Tags to search for (OR match)" },
          search_text: { type: "string", description: "Text to search in memory content" },
          memory_type: { type: "string", enum: ["conversation", "decision", "preference", "fact"] },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_work_plan",
      description: "Create a multi-step work plan. Each step defines an action with parameters. The plan will be executed step by step. Use for complex multi-action requests.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Plan title" },
          description: { type: "string", description: "What this plan accomplishes" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string", description: "Tool name or action to execute" },
                params: { type: "object", description: "Parameters for the action" },
                description: { type: "string", description: "Human-readable step description" },
              },
              required: ["action", "description"],
            },
            description: "Ordered list of steps",
          },
          tags: { type: "array", items: { type: "string" }, description: "Tags for categorization and template matching" },
        },
        required: ["title", "steps", "tags"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_plan_step",
      description: "Execute the next pending step of an active work plan. Returns the step result and updates plan progress.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string", description: "UUID of the work plan" },
        },
        required: ["plan_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_plans",
      description: "List active work plans (draft, running, paused). Shows progress and current step.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_as_template",
      description: "Save a completed work plan as a reusable template for future use.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string", description: "UUID of the completed plan to templatize" },
          name: { type: "string", description: "Template name" },
          description: { type: "string", description: "What this template does" },
        },
        required: ["plan_id", "name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_templates",
      description: "Search saved plan templates by tags or name. Returns reusable workflow blueprints.",
      parameters: {
        type: "object",
        properties: {
          tags: { type: "array", items: { type: "string" } },
          search_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_ui_action",
      description: "Execute a UI action on the frontend: navigate to a page, show a toast notification, apply filters, or open a dialog. The action will be dispatched as a CustomEvent to the frontend.",
      parameters: {
        type: "object",
        properties: {
          action_type: { type: "string", enum: ["navigate", "show_toast", "apply_filters", "open_dialog"], description: "Type of UI action" },
          path: { type: "string", description: "For navigate: the route path (e.g. /partner-hub)" },
          message: { type: "string", description: "For show_toast: the notification message" },
          toast_type: { type: "string", enum: ["default", "success", "error"], description: "Toast variant" },
          filters: { type: "object", description: "For apply_filters: filter key-value pairs" },
          dialog: { type: "string", description: "For open_dialog: dialog identifier" },
        },
        required: ["action_type"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ NEW: Writing Tools ━━━
  {
    type: "function",
    function: {
      name: "update_partner",
      description: "Update specific fields of a partner. Supports: is_favorite, lead_status, rating, company_alias. Resolves company_name to partner_id automatically.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name to search (if ID not known)" },
          is_favorite: { type: "boolean", description: "Set as favorite" },
          lead_status: { type: "string", enum: ["new", "contacted", "in_progress", "negotiation", "converted", "lost"], description: "Lead status" },
          rating: { type: "number", description: "Rating 0-5" },
          company_alias: { type: "string", description: "Short alias for the company" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_partner_note",
      description: "Add a note or interaction log to a partner. Creates an entry in the interactions table.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name to search (if ID not known)" },
          subject: { type: "string", description: "Note subject/title" },
          notes: { type: "string", description: "Note content" },
          interaction_type: { type: "string", enum: ["note", "email", "phone_call", "meeting", "other"], description: "Type of interaction (default: note)" },
        },
        required: ["subject"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a reminder/task associated with a partner. Sets a due date and priority.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name to search (if ID not known)" },
          title: { type: "string", description: "Reminder title" },
          description: { type: "string", description: "Reminder description" },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority level (default: medium)" },
        },
        required: ["title", "due_date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead_status",
      description: "Update lead status of imported contacts. Can target specific IDs or filter by company_name/country.",
      parameters: {
        type: "object",
        properties: {
          contact_ids: { type: "array", items: { type: "string" }, description: "Array of contact UUIDs" },
          company_name: { type: "string", description: "Filter contacts by company name (partial match)" },
          country: { type: "string", description: "Filter contacts by country" },
          status: { type: "string", enum: ["new", "contacted", "in_progress", "negotiation", "converted", "lost"], description: "New lead status" },
        },
        required: ["status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_update_partners",
      description: "Update multiple partners at once. Filter by country_code or provide partner_ids. Supports updating is_favorite and lead_status.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "ISO 2-letter country code to filter" },
          partner_ids: { type: "array", items: { type: "string" }, description: "Array of partner UUIDs" },
          is_favorite: { type: "boolean", description: "Set favorite status" },
          lead_status: { type: "string", enum: ["new", "contacted", "in_progress", "negotiation", "converted", "lost"], description: "Set lead status" },
        },
        additionalProperties: false,
      },
    },
  },
  // ━━━ Business Card Tools ━━━
  {
    type: "function",
    function: {
      name: "search_business_cards",
      description: "Search business cards by event, date, name, or company. Returns matched partner/contact info.",
      parameters: {
        type: "object",
        properties: {
          event_name: { type: "string", description: "Event name (partial match)" },
          company_name: { type: "string", description: "Company name (partial match)" },
          contact_name: { type: "string", description: "Contact name (partial match)" },
          match_status: { type: "string", enum: ["pending", "matched", "unmatched", "manual"], description: "Match status filter" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "link_business_card",
      description: "Manually link a business card to a partner or contact. Overrides automatic matching.",
      parameters: {
        type: "object",
        properties: {
          card_id: { type: "string", description: "UUID of the business card" },
          partner_id: { type: "string", description: "UUID of the partner to link" },
          contact_id: { type: "string", description: "UUID of the imported contact to link" },
        },
        required: ["card_id"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ Verification / Status Check Tool ━━━
  {
    type: "function",
    function: {
      name: "check_job_status",
      description: "Check the real-time status of a specific download job, or get a summary of all active background processes (download jobs, email queue). Use AFTER triggering any action to verify its outcome. MANDATORY after create_download_job, download_single_partner, bulk_update_partners, and any plan step execution.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "UUID of a specific download job to check. If omitted, returns a summary of ALL active processes." },
          include_email_queue: { type: "boolean", description: "Also check email campaign queue status (default: true)" },
        },
        additionalProperties: false,
      },
    },
  },
  // ━━━ Contacts (imported_contacts) Tools ━━━
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search imported contacts (CRM). Filter by name, company, country, email, origin, lead_status, group (import_log_id).",
      parameters: {
        type: "object",
        properties: {
          search_name: { type: "string", description: "Contact name (partial match)" },
          company_name: { type: "string", description: "Company name (partial match)" },
          country: { type: "string", description: "Country (partial match)" },
          email: { type: "string", description: "Email (partial match)" },
          origin: { type: "string", description: "Origin/source filter" },
          lead_status: { type: "string", enum: ["new", "contacted", "in_progress", "negotiation", "converted", "lost"] },
          has_email: { type: "boolean" },
          has_phone: { type: "boolean" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
          count_only: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_detail",
      description: "Get full details of an imported contact including interactions and enrichment data.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "UUID of the contact" },
          contact_name: { type: "string", description: "Name to search (if ID not known)" },
        },
        additionalProperties: false,
      },
    },
  },
  // ━━━ Prospects Tools ━━━
  {
    type: "function",
    function: {
      name: "search_prospects",
      description: "Search Italian prospects (Report Aziende). Filter by company name, city, province, codice_ateco, fatturato range, lead_status.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Company name (partial match)" },
          city: { type: "string", description: "City (partial match)" },
          province: { type: "string", description: "Province code" },
          region: { type: "string", description: "Region" },
          codice_ateco: { type: "string", description: "ATECO code (partial match)" },
          min_fatturato: { type: "number", description: "Minimum revenue" },
          max_fatturato: { type: "number", description: "Maximum revenue" },
          lead_status: { type: "string", enum: ["new", "contacted", "in_progress", "negotiation", "converted", "lost"] },
          has_email: { type: "boolean" },
          limit: { type: "number", description: "Max results (default 20)" },
          count_only: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  // ━━━ Activities Tools ━━━
  {
    type: "function",
    function: {
      name: "list_activities",
      description: "List activities/tasks from the agenda. Filter by status, type, source, partner, due date.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
          activity_type: { type: "string", enum: ["email", "phone_call", "meeting", "follow_up", "research", "linkedin_message", "whatsapp", "sms", "other"] },
          source_type: { type: "string", enum: ["partner", "prospect", "contact"] },
          partner_name: { type: "string", description: "Filter by partner company name" },
          due_before: { type: "string", description: "Due date before (YYYY-MM-DD)" },
          due_after: { type: "string", description: "Due date after (YYYY-MM-DD)" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_activity",
      description: "Create a new activity/task in the agenda. Can be linked to a partner, prospect, or contact.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Activity title" },
          description: { type: "string" },
          activity_type: { type: "string", enum: ["email", "phone_call", "meeting", "follow_up", "research", "linkedin_message", "whatsapp", "sms", "other"] },
          source_type: { type: "string", enum: ["partner", "prospect", "contact"], description: "Entity type (default: partner)" },
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name to resolve partner_id" },
          due_date: { type: "string", description: "Due date (YYYY-MM-DD)" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          email_subject: { type: "string" },
          email_body: { type: "string" },
        },
        required: ["title", "activity_type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_activity",
      description: "Update an activity's status, priority, due date, or mark as completed.",
      parameters: {
        type: "object",
        properties: {
          activity_id: { type: "string", description: "UUID of the activity" },
          status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          due_date: { type: "string" },
        },
        required: ["activity_id"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ Email Generation & Sending Tools ━━━
  {
    type: "function",
    function: {
      name: "generate_outreach",
      description: "Generate an outreach message (email, LinkedIn, WhatsApp, SMS) for a contact using AI. Returns subject + body ready to send or review.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["email", "linkedin", "whatsapp", "sms"], description: "Communication channel" },
          contact_name: { type: "string", description: "Recipient name" },
          contact_email: { type: "string", description: "Recipient email (for email channel)" },
          company_name: { type: "string", description: "Recipient company" },
          country_code: { type: "string", description: "ISO country code for language detection" },
          language: { type: "string", description: "Override language (it, en, es, fr, de, pt)" },
          goal: { type: "string", description: "Goal of the message (e.g. 'proposta di collaborazione')" },
          base_proposal: { type: "string", description: "Base proposal text to include" },
          quality: { type: "string", enum: ["fast", "standard", "premium"], description: "Generation quality" },
        },
        required: ["channel", "contact_name", "company_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email to a partner contact. Requires recipient email, subject, and HTML body. The email is sent via the configured SMTP server.",
      parameters: {
        type: "object",
        properties: {
          to_email: { type: "string", description: "Recipient email address" },
          to_name: { type: "string", description: "Recipient name" },
          subject: { type: "string", description: "Email subject" },
          html_body: { type: "string", description: "Email body in HTML format" },
          partner_id: { type: "string", description: "Partner UUID (for tracking)" },
        },
        required: ["to_email", "subject", "html_body"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ Deep Search & Enrichment Tools ━━━
  {
    type: "function",
    function: {
      name: "deep_search_partner",
      description: "Run a Deep Search on a partner to find additional info from the web (logo, social links, company details). Uses Partner Connect extension. Costs credits.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name (if ID not known)" },
          force: { type: "boolean", description: "Force re-search even if already enriched" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deep_search_contact",
      description: "Run a Deep Search on an imported contact to find LinkedIn, social profiles, and additional info. Costs credits.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "UUID of the imported contact" },
          contact_name: { type: "string", description: "Contact name (if ID not known)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enrich_partner_website",
      description: "Scrape and analyze a partner's website to extract services, capabilities, and company description. Costs credits.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name (if ID not known)" },
        },
        additionalProperties: false,
      },
    },
  },
  // ━━━ Directory Scanning Tool ━━━
  {
    type: "function",
    function: {
      name: "scan_directory",
      description: "Scan the WCA directory for a specific country or search by company name/city. Updates the directory cache with member lists.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "ISO 2-letter country code" },
          search_by: { type: "string", enum: ["CountryCode", "CompanyName", "City", "MemberID"], description: "Search mode (default: CountryCode)" },
          company_name: { type: "string", description: "Company name (for CompanyName search)" },
          city: { type: "string", description: "City (for City search)" },
          member_id: { type: "number", description: "WCA Member ID (for MemberID search)" },
        },
        additionalProperties: false,
      },
    },
  },
  // ━━━ Alias Generation Tool ━━━
  {
    type: "function",
    function: {
      name: "generate_aliases",
      description: "Generate short aliases for partner companies or contacts using AI. Can process single or batch.",
      parameters: {
        type: "object",
        properties: {
          partner_ids: { type: "array", items: { type: "string" }, description: "Array of partner UUIDs to generate aliases for" },
          country_code: { type: "string", description: "Generate aliases for all partners in this country" },
          type: { type: "string", enum: ["company", "contact"], description: "Alias type (default: company)" },
          limit: { type: "number", description: "Max partners to process (default 20)" },
        },
        additionalProperties: false,
      },
    },
  },
  // ━━━ Partner Contact Management ━━━
  {
    type: "function",
    function: {
      name: "manage_partner_contact",
      description: "Add, update, or delete a contact person for a partner.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "update", "delete"], description: "Action to perform" },
          contact_id: { type: "string", description: "UUID of existing contact (for update/delete)" },
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name (to resolve partner_id)" },
          name: { type: "string", description: "Contact full name" },
          title: { type: "string", description: "Job title/role" },
          email: { type: "string", description: "Email address" },
          direct_phone: { type: "string", description: "Direct phone" },
          mobile: { type: "string", description: "Mobile phone" },
          is_primary: { type: "boolean", description: "Set as primary contact" },
        },
        required: ["action"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ Reminder Management ━━━
  {
    type: "function",
    function: {
      name: "update_reminder",
      description: "Update or complete/delete a reminder.",
      parameters: {
        type: "object",
        properties: {
          reminder_id: { type: "string", description: "UUID of the reminder" },
          status: { type: "string", enum: ["pending", "completed"], description: "New status" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          due_date: { type: "string", description: "New due date (YYYY-MM-DD)" },
          delete: { type: "boolean", description: "Delete the reminder" },
        },
        required: ["reminder_id"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ Delete Operations ━━━
  {
    type: "function",
    function: {
      name: "delete_records",
      description: "Delete records from the system. Supports partners, contacts, prospects, activities. ALWAYS ask for confirmation before deleting.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", enum: ["partners", "imported_contacts", "prospects", "activities", "reminders"], description: "Table to delete from" },
          ids: { type: "array", items: { type: "string" }, description: "Array of UUIDs to delete" },
        },
        required: ["table", "ids"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ Procedure Knowledge Base Tool ━━━
  {
    type: "function",
    function: {
      name: "get_procedure",
      description: "Get detailed step-by-step procedure from the Operations Knowledge Base. Use when the user asks how to do something or when you need to follow a specific workflow. Returns prerequisites, ordered steps with tool mapping, and tips.",
      parameters: {
        type: "object",
        properties: {
          procedure_id: { type: "string", description: "Procedure ID (e.g. 'email_single', 'download_profiles', 'deep_search_partner')" },
          search_tags: { type: "array", items: { type: "string" }, description: "Tags to search for matching procedures (e.g. ['email', 'campagna'])" },
        },
        additionalProperties: false,
      },
    },
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL EXECUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function executeSearchPartners(args: Record<string, unknown>) {
  const isCount = !!args.count_only;
  let partnerIdFilter: string[] | null = null;

  if (args.service) {
    const { data } = await supabase.from("partner_services").select("partner_id").eq("service_category", args.service);
    partnerIdFilter = (data || []).map((r: any) => r.partner_id);
    if (partnerIdFilter.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
  }
  if (args.certification) {
    const { data } = await supabase.from("partner_certifications").select("partner_id").eq("certification", args.certification);
    const certIds = (data || []).map((r: any) => r.partner_id);
    partnerIdFilter = partnerIdFilter ? partnerIdFilter.filter(id => certIds.includes(id)) : certIds;
    if (partnerIdFilter.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
  }
  if (args.network_name) {
    const { data } = await supabase.from("partner_networks").select("partner_id").ilike("network_name", `%${escapeLike(args.network_name)}%`);
    const netIds = (data || []).map((r: any) => r.partner_id);
    partnerIdFilter = partnerIdFilter ? partnerIdFilter.filter(id => netIds.includes(id)) : netIds;
    if (partnerIdFilter.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
  }
  if (args.has_phone !== undefined && args.has_phone) {
    const { data } = await supabase.from("partner_contacts").select("partner_id").or("direct_phone.not.is.null,mobile.not.is.null");
    const phoneIds = [...new Set((data || []).map((r: any) => r.partner_id))];
    partnerIdFilter = partnerIdFilter ? partnerIdFilter.filter(id => phoneIds.includes(id)) : phoneIds;
    if (partnerIdFilter.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
  }

  let query = supabase.from("partners").select(
    isCount ? "id" : "id, company_name, city, country_code, country_name, email, phone, rating, wca_id, website, raw_profile_html, is_favorite, office_type, has_branches, member_since",
    isCount ? { count: "exact", head: true } : undefined
  );

  if (partnerIdFilter) query = query.in("id", partnerIdFilter.slice(0, 500));
  if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
  if (args.city) query = query.ilike("city", `%${escapeLike(args.city)}%`);
  if (args.search_name) query = query.ilike("company_name", `%${escapeLike(args.search_name)}%`);
  if (args.has_email === true) query = query.not("email", "is", null);
  if (args.has_email === false) query = query.is("email", null);
  if (args.has_profile === true) query = query.not("raw_profile_html", "is", null);
  if (args.has_profile === false) query = query.is("raw_profile_html", null);
  if (args.min_rating) query = query.gte("rating", Number(args.min_rating));
  if (args.office_type) query = query.eq("office_type", args.office_type);
  if (args.is_favorite === true) query = query.eq("is_favorite", true);
  if (args.has_branches === true) query = query.eq("has_branches", true);

  const sortBy = String(args.sort_by || "rating");
  if (sortBy === "name") query = query.order("company_name", { ascending: true });
  else if (sortBy === "recent") query = query.order("created_at", { ascending: false });
  else if (sortBy === "seniority") query = query.order("member_since", { ascending: true, nullsFirst: false });
  else query = query.order("rating", { ascending: false, nullsFirst: false });

  const limit = Math.min(Number(args.limit) || 20, 50);
  query = query.limit(limit);

  const { data, error, count } = await query;
  if (error) return { error: error.message };
  if (isCount) return { count };

  return {
    count: data?.length,
    partners: (data || []).map((p: any) => ({
      id: p.id, company_name: p.company_name, city: p.city,
      country: `${p.country_name} (${p.country_code})`,
      email: p.email || null, phone: p.phone || null, rating: p.rating ?? null,
      has_profile: !!p.raw_profile_html, website: p.website || null,
      is_favorite: p.is_favorite, office_type: p.office_type, has_branches: p.has_branches,
      member_since: p.member_since || null,
    })),
  };
}

async function executeCountryOverview(args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc("get_country_stats");
  if (error) return { error: error.message };
  let stats = data || [];
  if (args.country_code) stats = stats.filter((s: any) => s.country_code === String(args.country_code).toUpperCase());
  const sortBy = String(args.sort_by || "total");
  if (sortBy === "missing_profiles") stats.sort((a: any, b: any) => (b.without_profile || 0) - (a.without_profile || 0));
  else if (sortBy === "missing_emails") stats.sort((a: any, b: any) => ((b.total_partners - b.with_email) || 0) - ((a.total_partners - a.with_email) || 0));
  else stats.sort((a: any, b: any) => (b.total_partners || 0) - (a.total_partners || 0));
  const limit = Number(args.limit) || 30;
  return {
    total_countries: stats.length,
    countries: stats.slice(0, limit).map((s: any) => ({
      country_code: s.country_code, total_partners: s.total_partners, hq: s.hq_count, branches: s.branch_count,
      with_profile: s.with_profile, without_profile: s.without_profile, with_email: s.with_email, with_phone: s.with_phone,
      profile_coverage: s.total_partners ? `${Math.round((s.with_profile / s.total_partners) * 100)}%` : "0%",
    })),
  };
}

async function executeDirectoryStatus(args: Record<string, unknown>) {
  const { data: dirData } = await supabase.rpc("get_directory_counts");
  const { data: statsData } = await supabase.rpc("get_country_stats");
  const dirMap: Record<string, { members: number; verified: boolean }> = {};
  for (const r of (dirData || []) as any[]) dirMap[r.country_code] = { members: Number(r.member_count), verified: r.is_verified };
  const statsMap: Record<string, any> = {};
  for (const r of (statsData || []) as any[]) statsMap[r.country_code] = r;
  const allCodes = [...new Set([...Object.keys(dirMap), ...Object.keys(statsMap)])];
  if (args.country_code) {
    const code = String(args.country_code).toUpperCase();
    const dir = dirMap[code]; const db = statsMap[code];
    return {
      country_code: code, directory_members: dir?.members || 0, directory_verified: dir?.verified || false,
      db_partners: db?.total_partners || 0, db_with_profile: db?.with_profile || 0, db_without_profile: db?.without_profile || 0,
      gap: (dir?.members || 0) - (db?.total_partners || 0),
      status: !dir && !db ? "mai_esplorato" : !dir ? "no_directory" : (db?.total_partners || 0) >= (dir?.members || 0) && (db?.without_profile || 0) === 0 ? "completato" : "incompleto",
    };
  }
  const results = allCodes.map(code => ({
    country_code: code, directory_members: dirMap[code]?.members || 0, db_partners: statsMap[code]?.total_partners || 0,
    gap: (dirMap[code]?.members || 0) - (statsMap[code]?.total_partners || 0), profiles_missing: statsMap[code]?.without_profile || 0,
  })).filter(r => r.gap > 0 || r.profiles_missing > 0).sort((a, b) => b.gap - a.gap);
  return { countries_with_gaps: results.length, gaps: results.slice(0, 30) };
}

async function executeListJobs(args: Record<string, unknown>) {
  let query = supabase.from("download_jobs")
    .select("id, country_code, country_name, status, job_type, current_index, total_count, contacts_found_count, contacts_missing_count, created_at, updated_at, last_processed_company, error_message, network_name")
    .order("created_at", { ascending: false }).limit(Number(args.limit) || 20);
  if (args.status) query = query.eq("status", args.status);
  if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
  const { data, error } = await query;
  if (error) return { error: error.message };
  return {
    count: data?.length,
    jobs: (data || []).map((j: any) => ({
      id: j.id, country: `${j.country_name} (${j.country_code})`, status: j.status, type: j.job_type,
      progress: `${j.current_index}/${j.total_count}`, found: j.contacts_found_count, missing: j.contacts_missing_count,
      last_company: j.last_processed_company || null, network: j.network_name, error: j.error_message || null, created: j.created_at,
    })),
  };
}

async function executePartnerDetail(args: Record<string, unknown>) {
  let partner: any = null;
  if (args.partner_id) {
    const { data } = await supabase.from("partners").select("*").eq("id", args.partner_id).single();
    partner = data;
  } else if (args.company_name) {
    const { data } = await supabase.from("partners").select("*").ilike("company_name", `%${escapeLike(args.company_name)}%`).limit(1).single();
    partner = data;
  }
  if (!partner) return { error: "Partner non trovato" };
  const [contactsRes, networksRes, servicesRes, certsRes, socialsRes, blacklistRes] = await Promise.all([
    supabase.from("partner_contacts").select("name, email, title, direct_phone, mobile, is_primary").eq("partner_id", partner.id),
    supabase.from("partner_networks").select("network_name, expires, network_id").eq("partner_id", partner.id),
    supabase.from("partner_services").select("service_category").eq("partner_id", partner.id),
    supabase.from("partner_certifications").select("certification").eq("partner_id", partner.id),
    supabase.from("partner_social_links").select("platform, url").eq("partner_id", partner.id),
    supabase.from("blacklist_entries").select("company_name, total_owed_amount, claims, status").eq("matched_partner_id", partner.id),
  ]);
  return {
    id: partner.id, company_name: partner.company_name, alias: partner.company_alias, city: partner.city,
    country: `${partner.country_name} (${partner.country_code})`, address: partner.address || null,
    email: partner.email || null, phone: partner.phone || null, mobile: partner.mobile || null, fax: partner.fax || null,
    website: partner.website || null, rating: partner.rating, rating_details: partner.rating_details,
    office_type: partner.office_type, has_branches: partner.has_branches, branch_cities: partner.branch_cities,
    is_favorite: partner.is_favorite, is_active: partner.is_active, wca_id: partner.wca_id,
    member_since: partner.member_since, membership_expires: partner.membership_expires,
    has_profile: !!partner.raw_profile_html,
    profile_summary: partner.raw_profile_markdown ? String(partner.raw_profile_markdown).substring(0, 2000) : null,
    contacts: (contactsRes.data || []).map((c: any) => ({ name: c.name, title: c.title, email: c.email, phone: c.direct_phone || c.mobile, is_primary: c.is_primary })),
    networks: (networksRes.data || []).map((n: any) => ({ name: n.network_name, expires: n.expires })),
    services: (servicesRes.data || []).map((s: any) => s.service_category),
    certifications: (certsRes.data || []).map((c: any) => c.certification),
    social_links: (socialsRes.data || []).map((s: any) => ({ platform: s.platform, url: s.url })),
    blacklist_matches: (blacklistRes.data || []).map((b: any) => ({ company: b.company_name, owed: b.total_owed_amount, claims: b.claims, status: b.status })),
  };
}

async function executeGlobalSummary() {
  const [statsRes, dirRes, jobsRes] = await Promise.all([
    supabase.rpc("get_country_stats"), supabase.rpc("get_directory_counts"),
    supabase.from("download_jobs").select("id, status").in("status", ["running", "pending"]),
  ]);
  const rows = statsRes.data || [];
  const totals = rows.reduce((acc: any, r: any) => ({
    partners: acc.partners + (Number(r.total_partners) || 0), with_profile: acc.with_profile + (Number(r.with_profile) || 0),
    without_profile: acc.without_profile + (Number(r.without_profile) || 0), with_email: acc.with_email + (Number(r.with_email) || 0),
    with_phone: acc.with_phone + (Number(r.with_phone) || 0),
  }), { partners: 0, with_profile: 0, without_profile: 0, with_email: 0, with_phone: 0 });
  const dirRows = dirRes.data || [];
  const dirTotal = dirRows.reduce((sum: number, r: any) => sum + (Number(r.member_count) || 0), 0);
  return {
    total_countries_with_data: rows.length, total_partners: totals.partners,
    with_profile: totals.with_profile, without_profile: totals.without_profile,
    with_email: totals.with_email, with_phone: totals.with_phone,
    profile_coverage: totals.partners ? `${Math.round((totals.with_profile / totals.partners) * 100)}%` : "0%",
    email_coverage: totals.partners ? `${Math.round((totals.with_email / totals.partners) * 100)}%` : "0%",
    directory_members_total: dirTotal, directory_countries_scanned: dirRows.length,
    download_gap: dirTotal - totals.partners, active_jobs: jobsRes.data?.length || 0,
  };
}

async function executeCheckBlacklist(args: Record<string, unknown>) {
  let query = supabase.from("blacklist_entries").select("company_name, country, city, total_owed_amount, claims, status, blacklist_no, matched_partner_id");
  if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
  if (args.country) query = query.ilike("country", `%${escapeLike(args.country)}%`);
  query = query.order("total_owed_amount", { ascending: false, nullsFirst: false }).limit(20);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return {
    count: data?.length || 0,
    entries: (data || []).map((b: any) => ({
      company: b.company_name, country: b.country, city: b.city, owed: b.total_owed_amount,
      claims: b.claims, status: b.status, has_matched_partner: !!b.matched_partner_id,
    })),
  };
}

async function executeListReminders(args: Record<string, unknown>) {
  let query = supabase.from("reminders").select("id, title, description, due_date, priority, status, partner_id, created_at")
    .order("due_date", { ascending: true }).limit(30);
  if (args.status) query = query.eq("status", args.status);
  if (args.priority) query = query.eq("priority", args.priority);
  const { data, error } = await query;
  if (error) return { error: error.message };
  const partnerIds = [...new Set((data || []).map((r: any) => r.partner_id))];
  const { data: partners } = await supabase.from("partners").select("id, company_name").in("id", partnerIds);
  const nameMap: Record<string, string> = {};
  for (const p of (partners || []) as any[]) nameMap[p.id] = p.company_name;
  let results = (data || []).map((r: any) => ({
    id: r.id, title: r.title, description: r.description, due_date: r.due_date,
    priority: r.priority, status: r.status, partner: nameMap[r.partner_id] || "Sconosciuto",
  }));
  if (args.partner_name) {
    const search = String(args.partner_name).toLowerCase();
    results = results.filter(r => r.partner.toLowerCase().includes(search));
  }
  return { count: results.length, reminders: results };
}

async function executePartnersWithoutContacts(args: Record<string, unknown>) {
  let query = supabase.from("partners_no_contacts").select("wca_id, company_name, city, country_code, retry_count, scraped_at")
    .eq("resolved", false).order("scraped_at", { ascending: false }).limit(Number(args.limit) || 30);
  if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
  const { data, error } = await query;
  if (error) return { error: error.message };
  return {
    count: data?.length || 0,
    partners: (data || []).map((p: any) => ({
      wca_id: p.wca_id, company_name: p.company_name, city: p.city, country_code: p.country_code,
      retry_count: p.retry_count, last_scraped: p.scraped_at,
    })),
  };
}

async function executeCreateDownloadJob(args: Record<string, unknown>) {
  const countryCode = String(args.country_code || "").toUpperCase();
  const countryName = String(args.country_name || "");
  const mode = String(args.mode || "no_profile");
  const networkName = String(args.network_name || "Tutti");
  // Enforce minimum 15s delay to stay in the safe "green zone" of wcaCheckpoint
  const delaySec = Math.max(15, Number(args.delay_seconds) || 15);

  if (!countryCode || !countryName) return { error: "country_code e country_name sono obbligatori" };

  // LIMIT: max 1 active job at a time (aligned with UI manual behavior)
  const { data: activeJobs } = await supabase.from("download_jobs").select("id, country_code, status").in("status", ["pending", "running"]).limit(5);
  if (activeJobs && activeJobs.length > 0) {
    const sameCountry = activeJobs.find((j: any) => j.country_code === countryCode);
    if (sameCountry) return { error: `Esiste già un job attivo per ${countryName} (${countryCode}).`, active_job_id: sameCountry.id };
    if (activeJobs.length >= 1) return { error: `C'è già un job attivo (${activeJobs[0].country_code}). Attendi il completamento prima di avviarne un altro.`, active_job_id: activeJobs[0].id };
  }

  // Load dead IDs from partners_no_contacts (same filter as useCreateDownloadJob in the UI)
  const { data: deadRows } = await supabase.from("partners_no_contacts").select("wca_id").eq("resolved", false);
  const deadIdSet = new Set((deadRows || []).map((r: any) => Number(r.wca_id)));

  let wcaIds: number[] = [];
  if (mode === "new") {
    const { data: cacheRows } = await supabase.from("directory_cache").select("members").eq("country_code", countryCode);
    if (!cacheRows || cacheRows.length === 0) return { error: `Nessuna directory cache per ${countryName}. Esegui prima una scansione directory.` };
    const dirIds: number[] = [];
    for (const row of cacheRows) { const members = row.members as any[]; if (Array.isArray(members)) for (const m of members) { const id = typeof m === "object" ? m.wca_id || m.id : m; if (id) dirIds.push(Number(id)); } }
    const { data: existing } = await supabase.from("partners").select("wca_id").eq("country_code", countryCode).not("wca_id", "is", null);
    const existingSet = new Set((existing || []).map((p: any) => p.wca_id));
    wcaIds = [...new Set(dirIds)].filter(id => !existingSet.has(id) && !deadIdSet.has(id));
  } else if (mode === "no_profile") {
    const { data: noProfile } = await supabase.from("partners").select("wca_id").eq("country_code", countryCode).not("wca_id", "is", null).is("raw_profile_html", null);
    wcaIds = (noProfile || []).map((p: any) => p.wca_id).filter(Boolean);
    const { data: cacheRows } = await supabase.from("directory_cache").select("members").eq("country_code", countryCode);
    if (cacheRows && cacheRows.length > 0) {
      const { data: allExisting } = await supabase.from("partners").select("wca_id").eq("country_code", countryCode).not("wca_id", "is", null);
      const existingSet = new Set((allExisting || []).map((p: any) => p.wca_id));
      for (const row of cacheRows) { const members = row.members as any[]; if (Array.isArray(members)) for (const m of members) { const id = typeof m === "object" ? m.wca_id || m.id : m; if (id && !existingSet.has(Number(id))) wcaIds.push(Number(id)); } }
    }
    wcaIds = [...new Set(wcaIds)].filter(id => !deadIdSet.has(id));
  } else {
    const { data: dbPartners } = await supabase.from("partners").select("wca_id").eq("country_code", countryCode).not("wca_id", "is", null);
    wcaIds = (dbPartners || []).map((p: any) => p.wca_id).filter(Boolean);
    const { data: cacheRows } = await supabase.from("directory_cache").select("members").eq("country_code", countryCode);
    if (cacheRows) for (const row of cacheRows) { const members = row.members as any[]; if (Array.isArray(members)) for (const m of members) { const id = typeof m === "object" ? m.wca_id || m.id : m; if (id) wcaIds.push(Number(id)); } }
    wcaIds = [...new Set(wcaIds)].filter(id => !deadIdSet.has(id));
  }

  if (wcaIds.length === 0) {
    const modeLabels: Record<string, string> = { new: "nuovi", no_profile: "senza profilo", all: "tutti" };
    return { success: false, message: `Nessun partner da scaricare in modalità "${modeLabels[mode] || mode}" per ${countryName}.` };
  }

  const { data: job, error } = await supabase.from("download_jobs").insert({
    country_code: countryCode, country_name: countryName, network_name: networkName,
    wca_ids: wcaIds as any, total_count: wcaIds.length, delay_seconds: delaySec, status: "pending",
  }).select("id").single();

  if (error) return { error: `Errore creazione job: ${error.message}` };

  // Create individual items for V4 item-level tracking
  const jobItems = wcaIds.map((id: number, i: number) => ({ job_id: job.id, wca_id: id, position: i, status: "pending" }));
  for (let i = 0; i < jobItems.length; i += 500) {
    await supabase.from("download_job_items").insert(jobItems.slice(i, i + 500));
  }

  const modeLabels: Record<string, string> = { new: "Nuovi partner", no_profile: "Solo profili mancanti", all: "Aggiorna tutti" };
  return {
    success: true, job_id: job.id, country: `${countryName} (${countryCode})`, mode: modeLabels[mode] || mode,
    total_partners: wcaIds.length, delay_seconds: delaySec,
    estimated_time_minutes: Math.ceil(wcaIds.length * (delaySec + 5) / 60),
    message: `Job creato! ${wcaIds.length} partner da scaricare per ${countryName}. Il download partirà automaticamente.`,
  };
}

async function executeDownloadSinglePartner(args: Record<string, unknown>) {
  const companyName = String(args.company_name || "").trim();
  const city = args.city ? String(args.city).trim() : null;
  const countryCode = args.country_code ? String(args.country_code).toUpperCase() : null;
  let wcaId = args.wca_id ? Number(args.wca_id) : null;

  if (!companyName && !wcaId) return { error: "Serve almeno il nome dell'azienda o il wca_id." };

  // Step 1: Try to find the partner in the DB
  if (!wcaId) {
    let query = supabase.from("partners").select("id, wca_id, company_name, city, country_code, country_name, raw_profile_html").ilike("company_name", `%${escapeLike(companyName)}%`);
    if (countryCode) query = query.eq("country_code", countryCode);
    if (city) query = query.ilike("city", `%${escapeLike(city)}%`);
    const { data: found } = await query.limit(5);
    
    if (found && found.length > 0) {
      // Exact or best match
      const exact = found.find((p: any) => p.company_name.toLowerCase() === companyName.toLowerCase()) || found[0];
      if (exact.raw_profile_html) {
        return { success: true, already_downloaded: true, partner_id: exact.id, company_name: exact.company_name, city: exact.city, country_code: exact.country_code, message: `"${exact.company_name}" ha già il profilo scaricato. Non serve un nuovo download.` };
      }
      wcaId = exact.wca_id;
      if (!wcaId) return { error: `"${exact.company_name}" trovata nel DB ma non ha un wca_id. Impossibile scaricare il profilo.` };
    }
  }

  // Step 2: If not in DB, search directory_cache
  if (!wcaId) {
    let cacheQuery = supabase.from("directory_cache").select("members, country_code");
    if (countryCode) cacheQuery = cacheQuery.eq("country_code", countryCode);
    const { data: cacheRows } = await cacheQuery;
    
    if (cacheRows) {
      for (const row of cacheRows) {
        const members = row.members as any[];
        if (!Array.isArray(members)) continue;
        const match = members.find((m: any) => {
          const name = typeof m === "object" ? (m.company_name || m.name || "") : "";
          return name.toLowerCase().includes(companyName.toLowerCase());
        });
        if (match) {
          wcaId = typeof match === "object" ? (match.wca_id || match.id) : match;
          if (wcaId) break;
        }
      }
    }
  }

  // Step 3: If still not found, search WCA directory directly by company name
  if (!wcaId) {
    try {
      const { data: searchResult, error: searchErr } = await supabase.functions.invoke("scrape-wca-directory", {
        body: { searchBy: "CompanyName", companyName, countryCode: countryCode || undefined },
      });
      if (!searchErr && searchResult?.members?.length > 0) {
        // Find best match from results
        const exactMatch = searchResult.members.find((m: any) => 
          m.company_name?.toLowerCase() === companyName.toLowerCase()
        );
        const partialMatch = searchResult.members.find((m: any) =>
          m.company_name?.toLowerCase().includes(companyName.toLowerCase()) || 
          companyName.toLowerCase().includes(m.company_name?.toLowerCase())
        );
        const bestMatch = exactMatch || partialMatch || searchResult.members[0];
        if (bestMatch?.wca_id) {
          wcaId = bestMatch.wca_id;
          // Also update country info if we got it
          if (!countryCode && bestMatch.country_code) {
            // countryCode will be resolved later
          }
        }
      }
    } catch (e) {
      console.error("WCA directory search failed:", e);
    }
  }

  if (!wcaId) return { error: `"${companyName}" non trovata nel database, nella directory cache, né cercando direttamente su WCA. Verifica il nome esatto dell'azienda.` };

  // Step 3: Check dead IDs
  const { data: deadRows } = await supabase.from("partners_no_contacts").select("wca_id").eq("resolved", false);
  const deadIdSet = new Set((deadRows || []).map((r: any) => Number(r.wca_id)));
  if (deadIdSet.has(Number(wcaId))) return { error: `"${companyName}" (WCA ID: ${wcaId}) è nella lista "senza contatti". Probabilmente non ha dati utili.` };

  // Step 4: Check for active jobs — limit 1 (aligned with UI)
  const { data: activeJobs } = await supabase.from("download_jobs").select("id, status, country_code").in("status", ["pending", "running"]).limit(5);
  if (activeJobs && activeJobs.length >= 1) return { error: `C'è già un job attivo. Attendi il completamento prima di avviarne un altro.`, active_job_id: activeJobs[0].id };

  // Step 4: Determine country info
  let jobCountryCode = countryCode || "";
  let jobCountryName = "";
  if (!jobCountryCode) {
    const { data: p } = await supabase.from("partners").select("country_code, country_name").eq("wca_id", wcaId).single();
    if (p) { jobCountryCode = p.country_code; jobCountryName = p.country_name; }
    else { jobCountryCode = "XX"; jobCountryName = "Sconosciuto"; }
  }
  if (!jobCountryName) {
    const { data: p } = await supabase.from("partners").select("country_name").eq("country_code", jobCountryCode).limit(1).single();
    jobCountryName = p?.country_name || jobCountryCode;
  }

  // Step 5: Create a mini download job with just this one wca_id
  const { data: job, error } = await supabase.from("download_jobs").insert({
    country_code: jobCountryCode, country_name: jobCountryName, network_name: "Tutti",
    wca_ids: [wcaId] as any, total_count: 1, delay_seconds: 15, status: "pending",
    job_type: "download",
  }).select("id").single();

  if (error) return { error: `Errore creazione job: ${error.message}` };

  // Create item for V4 item-level tracking
  await supabase.from("download_job_items").insert({ job_id: job.id, wca_id: wcaId, position: 0, status: "pending" });

  return {
    success: true, job_id: job.id, country: `${jobCountryName} (${jobCountryCode})`,
    mode: "Singolo partner", total_partners: 1, wca_id: wcaId, delay_seconds: 15,
    estimated_time_minutes: 1,
    message: `Job creato per scaricare il profilo di "${companyName}" (WCA ID: ${wcaId}). Tempo stimato: ~1 minuto.`,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NEW TOOL EXECUTION — Memory, Plans, Templates, UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function executeSaveMemory(args: Record<string, unknown>, userId: string) {
  // Auto-determine level based on importance
  const importance = Math.min(5, Math.max(1, Number(args.importance) || 3));
  const level = importance >= 4 ? 2 : 1;
  const confidence = level === 2 ? 0.6 : 0.5;
  const decayRate = level === 2 ? 0.005 : 0.02;

  const { data, error } = await supabase.from("ai_memory").insert({
    user_id: userId,
    content: String(args.content),
    memory_type: String(args.memory_type || "fact"),
    tags: (args.tags as string[]) || [],
    importance,
    context_page: args.context_page ? String(args.context_page) : null,
    level,
    confidence,
    decay_rate: decayRate,
    source: "ai_save",
  }).select("id").single();
  if (error) return { error: error.message };
  return { success: true, memory_id: data.id, level, message: `Ricordo salvato (L${level}).` };
}

async function executeSearchMemory(args: Record<string, unknown>, userId: string) {
  let query = supabase.from("ai_memory").select("id, content, memory_type, tags, importance, context_page, created_at")
    .eq("user_id", userId)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Number(args.limit) || 10);

  if (args.memory_type) query = query.eq("memory_type", args.memory_type);
  if (args.tags && (args.tags as string[]).length > 0) query = query.overlaps("tags", args.tags as string[]);
  if (args.search_text) query = query.ilike("content", `%${escapeLike(args.search_text)}%`);

  // Filter out expired
  query = query.or("expires_at.is.null,expires_at.gt.now()");

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length || 0, memories: data || [] };
}

async function executeCreateWorkPlan(args: Record<string, unknown>, userId: string) {
  const steps = ((args.steps as any[]) || []).map((s: any, i: number) => ({
    index: i, action: s.action, params: s.params || {}, description: s.description || "",
    status: "pending", result: null, started_at: null, completed_at: null,
  }));

  const { data, error } = await supabase.from("ai_work_plans").insert({
    user_id: userId,
    title: String(args.title),
    description: args.description ? String(args.description) : null,
    steps: steps as any,
    tags: (args.tags as string[]) || [],
    status: "running",
    current_step: 0,
  }).select("id, title, status, steps, current_step").single();

  if (error) return { error: error.message };
  return { success: true, plan: data, message: `Piano "${args.title}" creato con ${steps.length} step. Eseguirò gli step progressivamente.` };
}

async function executeExecutePlanStep(args: Record<string, unknown>, userId: string, authHeader?: string) {
  const { data: plan, error } = await supabase.from("ai_work_plans").select("*")
    .eq("id", args.plan_id).eq("user_id", userId).single();
  if (error || !plan) return { error: "Piano non trovato" };
  if (plan.status === "completed") return { error: "Piano già completato", plan_id: plan.id };
  if (plan.status === "failed") return { error: "Piano fallito. Crea un nuovo piano." };

  const steps = plan.steps as any[];
  const currentIdx = plan.current_step;
  if (currentIdx >= steps.length) {
    await supabase.from("ai_work_plans").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", plan.id);
    return { success: true, status: "completed", message: "Tutti gli step completati!" };
  }

  const step = steps[currentIdx];
  step.status = "running";
  step.started_at = new Date().toISOString();

  // Execute the step action
  let stepResult: any;
  try {
    if (step.action === "execute_ui_action") {
      // UI actions are returned to frontend, not executed server-side
      stepResult = { ui_action: step.params, message: "Azione UI da eseguire sul frontend" };
    } else {
      stepResult = await executeTool(step.action, step.params || {}, userId, authHeader);
    }
    step.status = "done";
    step.result = stepResult;
  } catch (e) {
    step.status = "failed";
    step.result = { error: e instanceof Error ? e.message : "Errore sconosciuto" };
  }
  step.completed_at = new Date().toISOString();

  const nextIdx = currentIdx + 1;
  const allDone = nextIdx >= steps.length;
  const newStatus = step.status === "failed" ? "paused" : allDone ? "completed" : "running";

  await supabase.from("ai_work_plans").update({
    steps: steps as any,
    current_step: nextIdx,
    status: newStatus,
    ...(allDone ? { completed_at: new Date().toISOString() } : {}),
  }).eq("id", plan.id);

  return {
    success: step.status === "done",
    plan_id: plan.id,
    step_index: currentIdx,
    step_description: step.description,
    step_result: stepResult,
    plan_status: newStatus,
    remaining_steps: steps.length - nextIdx,
    ...(stepResult?.ui_action ? { ui_action: stepResult.ui_action } : {}),
  };
}

async function executeGetActivePlans(userId: string) {
  const { data, error } = await supabase.from("ai_work_plans")
    .select("id, title, description, status, steps, current_step, tags, created_at")
    .eq("user_id", userId)
    .in("status", ["draft", "running", "paused"])
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return { error: error.message };
  return {
    count: data?.length || 0,
    plans: (data || []).map((p: any) => ({
      id: p.id, title: p.title, status: p.status,
      total_steps: (p.steps as any[]).length, current_step: p.current_step,
      progress: `${p.current_step}/${(p.steps as any[]).length}`,
      tags: p.tags, created_at: p.created_at,
    })),
  };
}

async function executeSaveAsTemplate(args: Record<string, unknown>, userId: string) {
  const { data: plan } = await supabase.from("ai_work_plans").select("steps, tags")
    .eq("id", args.plan_id).eq("user_id", userId).single();
  if (!plan) return { error: "Piano non trovato" };

  const stepsTemplate = ((plan.steps as any[]) || []).map((s: any) => ({
    action: s.action, params: s.params, description: s.description,
  }));

  const { data, error } = await supabase.from("ai_plan_templates").insert({
    user_id: userId,
    name: String(args.name),
    description: args.description ? String(args.description) : null,
    steps_template: stepsTemplate as any,
    tags: plan.tags || [],
  }).select("id, name").single();

  if (error) return { error: error.message };
  return { success: true, template_id: data.id, name: data.name, message: `Template "${args.name}" salvato!` };
}

async function executeSearchTemplates(args: Record<string, unknown>, userId: string) {
  let query = supabase.from("ai_plan_templates").select("id, name, description, steps_template, tags, use_count, last_used_at")
    .eq("user_id", userId).order("use_count", { ascending: false }).limit(10);
  if (args.tags && (args.tags as string[]).length > 0) query = query.overlaps("tags", args.tags as string[]);
  if (args.search_name) query = query.ilike("name", `%${escapeLike(args.search_name)}%`);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return {
    count: data?.length || 0,
    templates: (data || []).map((t: any) => ({
      id: t.id, name: t.name, description: t.description, steps_count: (t.steps_template as any[]).length,
      tags: t.tags, use_count: t.use_count, last_used: t.last_used_at,
    })),
  };
}

function executeUiAction(args: Record<string, unknown>) {
  // This is a pass-through — the result will be sent back to the frontend which handles the actual UI action
  return {
    ui_action: {
      action_type: args.action_type,
      path: args.path,
      message: args.message,
      toast_type: args.toast_type || "default",
      filters: args.filters,
      dialog: args.dialog,
    },
    success: true,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WRITING TOOLS — Partner Updates, Notes, Reminders
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function resolvePartnerId(args: Record<string, unknown>): Promise<{ id: string; name: string } | null> {
  if (args.partner_id) {
    const { data } = await supabase.from("partners").select("id, company_name").eq("id", args.partner_id).single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  if (args.company_name) {
    const { data } = await supabase.from("partners").select("id, company_name").ilike("company_name", `%${escapeLike(args.company_name)}%`).limit(1).single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  return null;
}

async function executeUpdatePartner(args: Record<string, unknown>) {
  const partner = await resolvePartnerId(args);
  if (!partner) return { error: "Partner non trovato" };

  const updates: Record<string, unknown> = {};
  const changes: string[] = [];

  if (args.is_favorite !== undefined) { updates.is_favorite = args.is_favorite; changes.push(`preferito: ${args.is_favorite ? "sì" : "no"}`); }
  if (args.lead_status) { updates.lead_status = args.lead_status; changes.push(`lead status: ${args.lead_status}`); }
  if (args.rating !== undefined) { updates.rating = Math.min(5, Math.max(0, Number(args.rating))); changes.push(`rating: ${updates.rating}`); }
  if (args.company_alias) { updates.company_alias = args.company_alias; changes.push(`alias: ${args.company_alias}`); }

  if (Object.keys(updates).length === 0) return { error: "Nessun campo da aggiornare specificato" };

  updates.updated_at = new Date().toISOString();
  const { error } = await supabase.from("partners").update(updates).eq("id", partner.id);
  if (error) return { error: error.message };

  return { success: true, partner_id: partner.id, company_name: partner.name, changes, message: `Partner "${partner.name}" aggiornato: ${changes.join(", ")}` };
}

async function executeAddPartnerNote(args: Record<string, unknown>) {
  const partner = await resolvePartnerId(args);
  if (!partner) return { error: "Partner non trovato" };

  const { error } = await supabase.from("interactions").insert({
    partner_id: partner.id,
    interaction_type: String(args.interaction_type || "note"),
    subject: String(args.subject),
    notes: args.notes ? String(args.notes) : null,
  });
  if (error) return { error: error.message };

  return { success: true, partner_id: partner.id, company_name: partner.name, message: `Nota aggiunta a "${partner.name}": ${args.subject}` };
}

async function executeCreateReminder(args: Record<string, unknown>) {
  const partner = await resolvePartnerId(args);
  if (!partner) return { error: "Partner non trovato. Specifica partner_id o company_name." };

  const { error } = await supabase.from("reminders").insert({
    partner_id: partner.id,
    title: String(args.title),
    description: args.description ? String(args.description) : null,
    due_date: String(args.due_date),
    priority: String(args.priority || "medium"),
  });
  if (error) return { error: error.message };

  return { success: true, partner_id: partner.id, company_name: partner.name, due_date: args.due_date, priority: args.priority || "medium", message: `Reminder creato per "${partner.name}": "${args.title}" (scadenza: ${args.due_date})` };
}

async function executeUpdateLeadStatus(args: Record<string, unknown>) {
  const status = String(args.status);

  if (args.contact_ids && Array.isArray(args.contact_ids) && args.contact_ids.length > 0) {
    const ids = args.contact_ids as string[];
    const updates: Record<string, unknown> = { lead_status: status };
    if (status === "converted") updates.converted_at = new Date().toISOString();
    const { error, count } = await supabase.from("imported_contacts").update(updates).in("id", ids);
    if (error) return { error: error.message };
    return { success: true, updated_count: count || ids.length, status, message: `${count || ids.length} contatti aggiornati a "${status}"` };
  }

  // Filter-based update
  let query = supabase.from("imported_contacts").select("id", { count: "exact" });
  if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
  if (args.country) query = query.ilike("country", `%${escapeLike(args.country)}%`);

  const { data: matches, count } = await query.limit(200);
  if (!matches || matches.length === 0) return { error: "Nessun contatto trovato con i filtri specificati" };

  if (matches.length > 5) {
    return { needs_confirmation: true, count: count || matches.length, status, message: `Trovati ${count || matches.length} contatti. Confermi l'aggiornamento a "${status}"?` };
  }

  const ids = matches.map((c: any) => c.id);
  const updates: Record<string, unknown> = { lead_status: status };
  if (status === "converted") updates.converted_at = new Date().toISOString();
  const { error } = await supabase.from("imported_contacts").update(updates).in("id", ids);
  if (error) return { error: error.message };
  return { success: true, updated_count: ids.length, status, message: `${ids.length} contatti aggiornati a "${status}"` };
}

async function executeBulkUpdatePartners(args: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  const changes: string[] = [];
  if (args.is_favorite !== undefined) { updates.is_favorite = args.is_favorite; changes.push(`preferito: ${args.is_favorite ? "sì" : "no"}`); }
  if (args.lead_status) { updates.lead_status = args.lead_status; changes.push(`lead status: ${args.lead_status}`); }
  if (Object.keys(updates).length === 0) return { error: "Nessun aggiornamento specificato" };
  updates.updated_at = new Date().toISOString();

  // Count first
  let countQuery = supabase.from("partners").select("id", { count: "exact", head: true });
  if (args.partner_ids && Array.isArray(args.partner_ids)) countQuery = countQuery.in("id", args.partner_ids as string[]);
  else if (args.country_code) countQuery = countQuery.eq("country_code", String(args.country_code).toUpperCase());
  else return { error: "Specifica country_code o partner_ids" };

  const { count } = await countQuery;
  if (!count || count === 0) return { error: "Nessun partner trovato" };

  if (count > 5) {
    return { needs_confirmation: true, count, changes, message: `Trovati ${count} partner. Confermi l'aggiornamento: ${changes.join(", ")}?` };
  }

  // Execute
  let updateQuery = supabase.from("partners").update(updates);
  if (args.partner_ids && Array.isArray(args.partner_ids)) updateQuery = updateQuery.in("id", args.partner_ids as string[]);
  else if (args.country_code) updateQuery = updateQuery.eq("country_code", String(args.country_code).toUpperCase());
  const { error } = await updateQuery;
  if (error) return { error: error.message };

  return { success: true, updated_count: count, changes, message: `${count} partner aggiornati: ${changes.join(", ")}` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUSINESS CARD TOOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function executeSearchBusinessCards(args: Record<string, unknown>) {
  let query = supabase.from("business_cards")
    .select("id, company_name, contact_name, email, phone, event_name, met_at, location, match_status, match_confidence, matched_partner_id, matched_contact_id, tags, created_at")
    .order("created_at", { ascending: false })
    .limit(Number(args.limit) || 20);

  if (args.event_name) query = query.ilike("event_name", `%${escapeLike(args.event_name)}%`);
  if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
  if (args.contact_name) query = query.ilike("contact_name", `%${escapeLike(args.contact_name)}%`);
  if (args.match_status) query = query.eq("match_status", args.match_status);

  const { data, error } = await query;
  if (error) return { error: error.message };

  // Resolve matched partner names
  const partnerIds = [...new Set((data || []).filter((c: any) => c.matched_partner_id).map((c: any) => c.matched_partner_id))];
  let partnerNames: Record<string, string> = {};
  if (partnerIds.length > 0) {
    const { data: partners } = await supabase.from("partners").select("id, company_name").in("id", partnerIds);
    for (const p of (partners || []) as any[]) partnerNames[p.id] = p.company_name;
  }

  return {
    count: data?.length || 0,
    cards: (data || []).map((c: any) => ({
      id: c.id, company_name: c.company_name, contact_name: c.contact_name, email: c.email,
      event_name: c.event_name, met_at: c.met_at, location: c.location,
      match_status: c.match_status, match_confidence: c.match_confidence,
      matched_partner: c.matched_partner_id ? partnerNames[c.matched_partner_id] || c.matched_partner_id : null,
      tags: c.tags,
    })),
  };
}

async function executeLinkBusinessCard(args: Record<string, unknown>) {
  const updates: Record<string, unknown> = { match_status: "manual", match_confidence: 100 };
  if (args.partner_id) updates.matched_partner_id = args.partner_id;
  if (args.contact_id) updates.matched_contact_id = args.contact_id;

  const { error } = await supabase.from("business_cards").update(updates).eq("id", args.card_id);
  if (error) return { error: error.message };

  return { success: true, card_id: args.card_id, message: "Biglietto da visita collegato manualmente." };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NEW TOOLS — Contacts, Prospects, Activities, Email, Deep Search, Directory, Aliases, Contact Mgmt
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function executeSearchContacts(args: Record<string, unknown>) {
  const isCount = !!args.count_only;
  let query = supabase.from("imported_contacts").select(
    isCount ? "id" : "id, name, company_name, email, phone, mobile, country, city, origin, lead_status, position, deep_search_at, company_alias, contact_alias, created_at",
    isCount ? { count: "exact", head: true } : undefined
  );
  if (args.search_name) query = query.ilike("name", `%${escapeLike(args.search_name)}%`);
  if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
  if (args.country) query = query.ilike("country", `%${escapeLike(args.country)}%`);
  if (args.email) query = query.ilike("email", `%${escapeLike(args.email)}%`);
  if (args.origin) query = query.ilike("origin", `%${escapeLike(args.origin)}%`);
  if (args.lead_status) query = query.eq("lead_status", args.lead_status);
  if (args.has_email === true) query = query.not("email", "is", null);
  if (args.has_email === false) query = query.is("email", null);
  if (args.has_phone === true) query = query.or("phone.not.is.null,mobile.not.is.null");
  // Quality filter
  query = query.or("company_name.not.is.null,name.not.is.null,email.not.is.null");
  query = query.order("created_at", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 50));
  const { data, error, count } = await query;
  if (error) return { error: error.message };
  if (isCount) return { count };
  return { count: data?.length || 0, contacts: data || [] };
}

async function executeGetContactDetail(args: Record<string, unknown>) {
  let contact: any = null;
  if (args.contact_id) {
    const { data } = await supabase.from("imported_contacts").select("*").eq("id", args.contact_id).single();
    contact = data;
  } else if (args.contact_name) {
    const { data } = await supabase.from("imported_contacts").select("*").ilike("name", `%${escapeLike(args.contact_name)}%`).limit(1).single();
    contact = data;
  }
  if (!contact) return { error: "Contatto non trovato" };
  const { data: interactions } = await supabase.from("contact_interactions").select("*").eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(10);
  return { ...contact, interactions: interactions || [] };
}

async function executeSearchProspects(args: Record<string, unknown>) {
  const isCount = !!args.count_only;
  let query = supabase.from("prospects").select(
    isCount ? "id" : "id, company_name, city, province, region, codice_ateco, descrizione_ateco, fatturato, dipendenti, email, phone, pec, website, lead_status, partita_iva, forma_giuridica, rating_affidabilita, created_at",
    isCount ? { count: "exact", head: true } : undefined
  );
  if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
  if (args.city) query = query.ilike("city", `%${escapeLike(args.city)}%`);
  if (args.province) query = query.ilike("province", `%${escapeLike(args.province)}%`);
  if (args.region) query = query.ilike("region", `%${escapeLike(args.region)}%`);
  if (args.codice_ateco) query = query.ilike("codice_ateco", `%${escapeLike(args.codice_ateco)}%`);
  if (args.min_fatturato) query = query.gte("fatturato", Number(args.min_fatturato));
  if (args.max_fatturato) query = query.lte("fatturato", Number(args.max_fatturato));
  if (args.lead_status) query = query.eq("lead_status", args.lead_status);
  if (args.has_email === true) query = query.not("email", "is", null);
  query = query.order("fatturato", { ascending: false, nullsFirst: false }).limit(Math.min(Number(args.limit) || 20, 50));
  const { data, error, count } = await query;
  if (error) return { error: error.message };
  if (isCount) return { count };
  return { count: data?.length || 0, prospects: data || [] };
}

async function executeListActivities(args: Record<string, unknown>) {
  let query = supabase.from("activities").select("id, title, description, activity_type, status, priority, due_date, source_type, source_meta, partner_id, created_at, completed_at, email_subject")
    .order("due_date", { ascending: true, nullsFirst: false }).limit(Number(args.limit) || 30);
  if (args.status) query = query.eq("status", args.status);
  if (args.activity_type) query = query.eq("activity_type", args.activity_type);
  if (args.source_type) query = query.eq("source_type", args.source_type);
  if (args.due_before) query = query.lte("due_date", args.due_before);
  if (args.due_after) query = query.gte("due_date", args.due_after);
  const { data, error } = await query;
  if (error) return { error: error.message };
  let results = data || [];
  if (args.partner_name) {
    const search = String(args.partner_name).toLowerCase();
    results = results.filter((a: any) => {
      const meta = a.source_meta as any;
      return meta?.company_name?.toLowerCase().includes(search) || false;
    });
  }
  return { count: results.length, activities: results.map((a: any) => ({ ...a, company_name: (a.source_meta as any)?.company_name || null })) };
}

async function executeCreateActivity(args: Record<string, unknown>) {
  let partnerId = args.partner_id as string | null;
  let companyName = args.company_name as string || "";
  if (!partnerId && companyName) {
    const resolved = await resolvePartnerId(args);
    if (resolved) { partnerId = resolved.id; companyName = resolved.name; }
  }
  const sourceType = String(args.source_type || "partner");
  const sourceId = partnerId || crypto.randomUUID();
  const { data, error } = await supabase.from("activities").insert({
    title: String(args.title),
    description: args.description ? String(args.description) : null,
    activity_type: String(args.activity_type),
    source_type: sourceType,
    source_id: sourceId,
    partner_id: partnerId,
    due_date: args.due_date ? String(args.due_date) : null,
    priority: String(args.priority || "medium"),
    email_subject: args.email_subject ? String(args.email_subject) : null,
    email_body: args.email_body ? String(args.email_body) : null,
    source_meta: { company_name: companyName } as any,
  }).select("id").single();
  if (error) return { error: error.message };
  return { success: true, activity_id: data.id, message: `Attività "${args.title}" creata${companyName ? ` per ${companyName}` : ""}.` };
}

async function executeUpdateActivity(args: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  if (args.status) {
    updates.status = args.status;
    if (args.status === "completed") updates.completed_at = new Date().toISOString();
  }
  if (args.priority) updates.priority = args.priority;
  if (args.due_date) updates.due_date = args.due_date;
  if (Object.keys(updates).length === 0) return { error: "Nessun campo da aggiornare" };
  const { error } = await supabase.from("activities").update(updates).eq("id", args.activity_id);
  if (error) return { error: error.message };
  return { success: true, activity_id: args.activity_id, message: `Attività aggiornata.` };
}

async function executeGenerateOutreach(args: Record<string, unknown>, authHeader: string) {
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-outreach`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(args),
  });
  const data = await response.json();
  if (!response.ok || data.error) return { error: data.error || "Errore generazione outreach" };
  return { success: true, channel: data.channel, subject: data.subject, body: data.body, language: data.language, message: `Messaggio ${args.channel} generato per ${args.contact_name} (${args.company_name}).` };
}

async function executeSendEmail(args: Record<string, unknown>, authHeader: string) {
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({ to: args.to_email, toName: args.to_name, subject: args.subject, html: args.html_body }),
  });
  const data = await response.json();
  if (!response.ok || data.error) return { error: data.error || "Errore invio email" };
  // Log interaction if partner_id provided
  if (args.partner_id) {
    await supabase.from("interactions").insert({ partner_id: args.partner_id, interaction_type: "email", subject: String(args.subject), notes: `Inviata a ${args.to_email}` });
  }
  return { success: true, message: `Email inviata a ${args.to_email} con oggetto "${args.subject}".` };
}

async function executeDeepSearchPartner(args: Record<string, unknown>, authHeader: string) {
  let partnerId = args.partner_id as string;
  if (!partnerId && args.company_name) {
    const resolved = await resolvePartnerId(args);
    if (resolved) partnerId = resolved.id;
  }
  if (!partnerId) return { error: "Partner non trovato" };
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/deep-search-partner`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({ partner_id: partnerId, force: !!args.force }),
  });
  const data = await response.json();
  if (!response.ok || data.error) return { error: data.error || "Errore Deep Search" };
  return { success: true, partner_id: partnerId, ...data, message: `Deep Search completato per il partner.` };
}

async function executeDeepSearchContact(args: Record<string, unknown>, authHeader: string) {
  let contactId = args.contact_id as string;
  if (!contactId && args.contact_name) {
    const { data } = await supabase.from("imported_contacts").select("id").ilike("name", `%${escapeLike(args.contact_name)}%`).limit(1).single();
    if (data) contactId = data.id;
  }
  if (!contactId) return { error: "Contatto non trovato" };
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/deep-search-contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({ contact_id: contactId }),
  });
  const data = await response.json();
  if (!response.ok || data.error) return { error: data.error || "Errore Deep Search contatto" };
  return { success: true, contact_id: contactId, ...data, message: `Deep Search completato per il contatto.` };
}

async function executeEnrichPartnerWebsite(args: Record<string, unknown>, authHeader: string) {
  let partnerId = args.partner_id as string;
  if (!partnerId && args.company_name) {
    const resolved = await resolvePartnerId(args);
    if (resolved) partnerId = resolved.id;
  }
  if (!partnerId) return { error: "Partner non trovato" };
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-partner-website`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({ partner_id: partnerId }),
  });
  const data = await response.json();
  if (!response.ok || data.error) return { error: data.error || "Errore enrichment" };
  return { success: true, partner_id: partnerId, ...data, message: `Enrichment website completato.` };
}

async function executeScanDirectory(args: Record<string, unknown>, authHeader: string) {
  const body: Record<string, unknown> = {};
  if (args.country_code) body.country_code = String(args.country_code).toUpperCase();
  if (args.search_by) body.searchBy = args.search_by;
  if (args.company_name) body.companyName = args.company_name;
  if (args.city) body.city = args.city;
  if (args.member_id) body.memberId = args.member_id;
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/scrape-wca-directory`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data.error) return { error: data.error || "Errore scansione directory" };
  return { success: true, ...data, message: `Scansione directory completata: ${data.total_results || 0} risultati trovati.` };
}

async function executeGenerateAliases(args: Record<string, unknown>, authHeader: string) {
  const body: Record<string, unknown> = { type: args.type || "company" };
  if (args.partner_ids) body.partner_ids = args.partner_ids;
  if (args.country_code) body.country_code = String(args.country_code).toUpperCase();
  body.limit = Number(args.limit) || 20;
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-aliases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data.error) return { error: data.error || "Errore generazione alias" };
  return { success: true, ...data, message: `Alias generati con successo.` };
}

async function executeManagePartnerContact(args: Record<string, unknown>) {
  const action = String(args.action);
  if (action === "delete" && args.contact_id) {
    const { error } = await supabase.from("partner_contacts").delete().eq("id", args.contact_id);
    if (error) return { error: error.message };
    return { success: true, message: "Contatto eliminato." };
  }
  if (action === "update" && args.contact_id) {
    const updates: Record<string, unknown> = {};
    if (args.name) updates.name = args.name;
    if (args.title) updates.title = args.title;
    if (args.email) updates.email = args.email;
    if (args.direct_phone) updates.direct_phone = args.direct_phone;
    if (args.mobile) updates.mobile = args.mobile;
    if (args.is_primary !== undefined) updates.is_primary = args.is_primary;
    const { error } = await supabase.from("partner_contacts").update(updates).eq("id", args.contact_id);
    if (error) return { error: error.message };
    return { success: true, message: "Contatto aggiornato." };
  }
  if (action === "add") {
    let partnerId = args.partner_id as string;
    if (!partnerId && args.company_name) {
      const resolved = await resolvePartnerId(args);
      if (resolved) partnerId = resolved.id;
    }
    if (!partnerId) return { error: "Partner non trovato" };
    if (!args.name) return { error: "Il nome del contatto è obbligatorio" };
    const { data, error } = await supabase.from("partner_contacts").insert({
      partner_id: partnerId, name: String(args.name), title: args.title ? String(args.title) : null,
      email: args.email ? String(args.email) : null, direct_phone: args.direct_phone ? String(args.direct_phone) : null,
      mobile: args.mobile ? String(args.mobile) : null, is_primary: !!args.is_primary,
    }).select("id").single();
    if (error) return { error: error.message };
    return { success: true, contact_id: data.id, message: `Contatto "${args.name}" aggiunto.` };
  }
  return { error: "Azione non valida" };
}

async function executeUpdateReminder(args: Record<string, unknown>) {
  if (args.delete) {
    const { error } = await supabase.from("reminders").delete().eq("id", args.reminder_id);
    if (error) return { error: error.message };
    return { success: true, message: "Reminder eliminato." };
  }
  const updates: Record<string, unknown> = {};
  if (args.status) updates.status = args.status;
  if (args.priority) updates.priority = args.priority;
  if (args.due_date) updates.due_date = args.due_date;
  updates.updated_at = new Date().toISOString();
  const { error } = await supabase.from("reminders").update(updates).eq("id", args.reminder_id);
  if (error) return { error: error.message };
  return { success: true, message: "Reminder aggiornato." };
}

async function executeDeleteRecords(args: Record<string, unknown>) {
  const table = String(args.table);
  const ids = args.ids as string[];
  if (!ids || ids.length === 0) return { error: "Nessun ID specificato" };
  if (ids.length > 5) return { needs_confirmation: true, count: ids.length, table, message: `Stai per eliminare ${ids.length} record da "${table}". Confermi?` };
  const validTables = ["partners", "imported_contacts", "prospects", "activities", "reminders"];
  if (!validTables.includes(table)) return { error: `Tabella non valida: ${table}` };
  const { error } = await supabase.from(table as any).delete().in("id", ids);
  if (error) return { error: error.message };
  return { success: true, deleted: ids.length, table, message: `${ids.length} record eliminati da "${table}".` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROCEDURE KNOWLEDGE BASE TOOL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PROCEDURES_DB: Record<string, any> = {
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

function executeGetProcedure(args: Record<string, unknown>) {
  // Search by ID
  if (args.procedure_id) {
    const proc = PROCEDURES_DB[String(args.procedure_id)];
    if (proc) return { procedure: proc };
    return { error: `Procedura '${args.procedure_id}' non trovata. Procedure disponibili: ${Object.keys(PROCEDURES_DB).join(", ")}` };
  }
  // Search by tags
  if (args.search_tags && Array.isArray(args.search_tags)) {
    const tags = (args.search_tags as string[]).map(t => t.toLowerCase());
    const matches = Object.values(PROCEDURES_DB).filter((p: any) => {
      const procText = `${p.id} ${p.name} ${p.category} ${(p.channels || []).join(" ")}`.toLowerCase();
      return tags.some(t => procText.includes(t));
    });
    if (matches.length > 0) return { procedures: matches, count: matches.length };
    return { procedures: [], count: 0, available: Object.keys(PROCEDURES_DB) };
  }
  // Return all
  return { procedures: Object.values(PROCEDURES_DB), count: Object.keys(PROCEDURES_DB).length };
}

async function executeCheckJobStatus(args: Record<string, unknown>) {
  const result: Record<string, unknown> = {};

  // Specific job check
  if (args.job_id) {
    const { data: job, error } = await supabase.from("download_jobs")
      .select("id, country_code, country_name, status, job_type, current_index, total_count, contacts_found_count, contacts_missing_count, created_at, updated_at, completed_at, last_processed_company, error_message, network_name")
      .eq("id", args.job_id)
      .single();
    if (error || !job) {
      result.job = { error: "Job non trovato", job_id: args.job_id };
    } else {
      const progress = job.total_count > 0 ? Math.round((job.current_index / job.total_count) * 100) : 0;
      const elapsed = job.updated_at && job.created_at
        ? Math.round((new Date(job.updated_at).getTime() - new Date(job.created_at).getTime()) / 60000)
        : null;
      result.job = {
        id: job.id,
        country: `${job.country_name} (${job.country_code})`,
        status: job.status,
        type: job.job_type,
        progress_percent: progress,
        current: job.current_index,
        total: job.total_count,
        contacts_found: job.contacts_found_count,
        contacts_missing: job.contacts_missing_count,
        last_company: job.last_processed_company,
        error: job.error_message || null,
        elapsed_minutes: elapsed,
        completed_at: job.completed_at,
        is_finished: ["completed", "cancelled", "failed"].includes(job.status),
        verdict: job.status === "completed"
          ? `✅ Completato: ${job.contacts_found_count} contatti trovati, ${job.contacts_missing_count} mancanti`
          : job.status === "running"
          ? `⏳ In corso: ${progress}% (${job.current_index}/${job.total_count})`
          : job.status === "failed" || job.error_message
          ? `❌ Errore: ${job.error_message || "sconosciuto"}`
          : `🕐 ${job.status}`,
      };
    }
  }

  // Active jobs summary (always included when no specific job_id or alongside it)
  const { data: activeJobs } = await supabase.from("download_jobs")
    .select("id, country_name, country_code, status, current_index, total_count, job_type, last_processed_company, error_message, created_at")
    .in("status", ["running", "pending", "paused"])
    .order("created_at", { ascending: false })
    .limit(10);

  result.active_downloads = {
    count: activeJobs?.length || 0,
    jobs: (activeJobs || []).map((j: any) => ({
      id: j.id,
      country: `${j.country_name} (${j.country_code})`,
      status: j.status,
      progress: j.total_count > 0 ? `${Math.round((j.current_index / j.total_count) * 100)}%` : "0%",
      detail: `${j.current_index}/${j.total_count}`,
      last_company: j.last_processed_company,
      error: j.error_message,
    })),
  };

  // Recently completed jobs (last 5)
  const { data: recentJobs } = await supabase.from("download_jobs")
    .select("id, country_name, country_code, status, current_index, total_count, contacts_found_count, contacts_missing_count, completed_at, error_message")
    .in("status", ["completed", "cancelled", "failed"])
    .order("completed_at", { ascending: false })
    .limit(5);

  result.recently_completed = {
    count: recentJobs?.length || 0,
    jobs: (recentJobs || []).map((j: any) => ({
      id: j.id,
      country: `${j.country_name} (${j.country_code})`,
      status: j.status,
      processed: `${j.current_index}/${j.total_count}`,
      contacts_found: j.contacts_found_count,
      contacts_missing: j.contacts_missing_count,
      completed_at: j.completed_at,
      error: j.error_message,
    })),
  };

  // Email queue status
  if (args.include_email_queue !== false) {
    const { data: emailQueue } = await supabase.from("email_campaign_queue")
      .select("status")
      .in("status", ["pending", "sending"]);
    const pending = (emailQueue || []).filter((r: any) => r.status === "pending").length;
    const sending = (emailQueue || []).filter((r: any) => r.status === "sending").length;
    result.email_queue = { pending, sending, total: pending + sending };
  }

  return result;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UNIFIED TOOL DISPATCHER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function executeTool(name: string, args: Record<string, unknown>, userId?: string, authHeader?: string): Promise<unknown> {
  switch (name) {
    case "search_partners": return executeSearchPartners(args);
    case "get_country_overview": return executeCountryOverview(args);
    case "get_directory_status": return executeDirectoryStatus(args);
    case "list_jobs": return executeListJobs(args);
    case "get_partner_detail": return executePartnerDetail(args);
    case "get_global_summary": return executeGlobalSummary();
    case "check_blacklist": return executeCheckBlacklist(args);
    case "list_reminders": return executeListReminders(args);
    case "get_partners_without_contacts": return executePartnersWithoutContacts(args);
    case "create_download_job": return executeCreateDownloadJob(args);
    case "download_single_partner": return executeDownloadSinglePartner(args);
    // Memory & plan tools
    case "save_memory": return userId ? executeSaveMemory(args, userId) : { error: "Auth required" };
    case "search_memory": return userId ? executeSearchMemory(args, userId) : { error: "Auth required" };
    case "create_work_plan": return userId ? executeCreateWorkPlan(args, userId) : { error: "Auth required" };
    case "execute_plan_step": return userId ? executeExecutePlanStep(args, userId, authHeader) : { error: "Auth required" };
    case "get_active_plans": return userId ? executeGetActivePlans(userId) : { error: "Auth required" };
    case "save_as_template": return userId ? executeSaveAsTemplate(args, userId) : { error: "Auth required" };
    case "search_templates": return userId ? executeSearchTemplates(args, userId) : { error: "Auth required" };
    case "execute_ui_action": return executeUiAction(args);
    // Writing tools
    case "update_partner": return executeUpdatePartner(args);
    case "add_partner_note": return executeAddPartnerNote(args);
    case "create_reminder": return executeCreateReminder(args);
    case "update_lead_status": return executeUpdateLeadStatus(args);
    case "bulk_update_partners": return executeBulkUpdatePartners(args);
    // Business card tools
    case "search_business_cards": return executeSearchBusinessCards(args);
    case "link_business_card": return executeLinkBusinessCard(args);
    // Verification tool
    case "check_job_status": return executeCheckJobStatus(args);
    // ━━━ NEW: Contacts, Prospects, Activities, Email, Deep Search, Directory, Aliases ━━━
    case "search_contacts": return executeSearchContacts(args);
    case "get_contact_detail": return executeGetContactDetail(args);
    case "search_prospects": return executeSearchProspects(args);
    case "list_activities": return executeListActivities(args);
    case "create_activity": return executeCreateActivity(args);
    case "update_activity": return executeUpdateActivity(args);
    case "generate_outreach": return authHeader ? executeGenerateOutreach(args, authHeader) : { error: "Auth required" };
    case "send_email": return authHeader ? executeSendEmail(args, authHeader) : { error: "Auth required" };
    case "deep_search_partner": return authHeader ? executeDeepSearchPartner(args, authHeader) : { error: "Auth required" };
    case "deep_search_contact": return authHeader ? executeDeepSearchContact(args, authHeader) : { error: "Auth required" };
    case "enrich_partner_website": return authHeader ? executeEnrichPartnerWebsite(args, authHeader) : { error: "Auth required" };
    case "scan_directory": return authHeader ? executeScanDirectory(args, authHeader) : { error: "Auth required" };
    case "generate_aliases": return authHeader ? executeGenerateAliases(args, authHeader) : { error: "Auth required" };
    case "manage_partner_contact": return executeManagePartnerContact(args);
    case "update_reminder": return executeUpdateReminder(args);
    case "delete_records": return executeDeleteRecords(args);
    case "get_procedure": return executeGetProcedure(args);
    default: return { error: `Tool sconosciuto: ${name}` };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER API KEY RESOLUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ResolvedAiProvider {
  url: string;
  apiKey: string;
  model: string;
  isUserKey: boolean;
}

async function resolveAiProvider(userId: string): Promise<ResolvedAiProvider> {
  // Check user's own keys: google first, then openai
  const { data: userKeys } = await supabase
    .from("user_api_keys")
    .select("provider, api_key")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (userKeys && userKeys.length > 0) {
    const googleKey = userKeys.find((k: any) => k.provider === "google");
    if (googleKey?.api_key) {
      console.log("[AI] Using user's Google API key");
      return {
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        apiKey: googleKey.api_key,
        model: "gemini-2.5-flash",
        isUserKey: true,
      };
    }
    const openaiKey = userKeys.find((k: any) => k.provider === "openai");
    if (openaiKey?.api_key) {
      console.log("[AI] Using user's OpenAI API key");
      return {
        url: "https://api.openai.com/v1/chat/completions",
        apiKey: openaiKey.api_key,
        model: "gpt-4o-mini",
        isUserKey: true,
      };
    }
    const anthropicKey = userKeys.find((k: any) => k.provider === "anthropic");
    if (anthropicKey?.api_key) {
      console.log("[AI] Using user's Anthropic API key (via OpenAI-compat)");
      // Anthropic doesn't have OpenAI-compat endpoint, use gateway as fallback
    }
  }

  // Fallback: Lovable AI Gateway
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  console.log("[AI] Using Lovable AI Gateway");
  return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    apiKey: LOVABLE_API_KEY,
    model: "google/gemini-3-flash-preview",
    isUserKey: false,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CREDIT CONSUMPTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function consumeCredits(userId: string, usage: { prompt_tokens?: number; completion_tokens?: number }, isUserKey: boolean) {
  if (isUserKey) return; // User's own key — no credit deduction
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  if (inputTokens === 0 && outputTokens === 0) return;
  const rates = { input: 1, output: 2 };
  const totalCredits = Math.ceil(inputTokens / 1000 * rates.input) + Math.ceil(outputTokens / 1000 * rates.output);
  if (totalCredits <= 0) return;
  const { data: deductResult } = await supabase.rpc("deduct_credits", {
    p_user_id: userId, p_amount: totalCredits, p_operation: "ai_call",
    p_description: `AI Assistant: ${inputTokens} in + ${outputTokens} out tokens (${totalCredits} crediti)`,
  });
  const row = deductResult?.[0];
  console.log(`[CREDITS] User ${userId}: -${totalCredits} credits (success: ${row?.success}, balance: ${row?.new_balance})`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOAD USER PROFILE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadUserProfile(): Promise<string> {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .like("key", "ai_%");
  if (!data?.length) return "";

  const settings: Record<string, string> = {};
  for (const row of data as any[]) settings[row.key] = row.value || "";

  const parts: string[] = [];
  const get = (k: string) => settings[k]?.trim() || "";

  // Current Focus — injected FIRST for maximum AI proactivity
  if (get("ai_current_focus")) parts.push(`🎯 FOCUS CORRENTE: ${get("ai_current_focus")}`);
  if (get("ai_company_name") || get("ai_company_alias"))
    parts.push(`AZIENDA: ${get("ai_company_name")} (${get("ai_company_alias")})`);
  if (get("ai_contact_name") || get("ai_contact_alias"))
    parts.push(`REFERENTE: ${get("ai_contact_name")} (${get("ai_contact_alias")}) — ${get("ai_contact_role")}`);
  if (get("ai_sector")) parts.push(`SETTORE: ${get("ai_sector")}`);
  if (get("ai_networks")) parts.push(`NETWORK: ${get("ai_networks")}`);
  if (get("ai_company_activities")) parts.push(`ATTIVITÀ: ${get("ai_company_activities")}`);
  if (get("ai_business_goals")) parts.push(`OBIETTIVI ATTUALI: ${get("ai_business_goals")}`);
  if (get("ai_tone")) parts.push(`TONO: ${get("ai_tone")}`);
  if (get("ai_language")) parts.push(`LINGUA: ${get("ai_language")}`);
  if (get("ai_behavior_rules")) parts.push(`REGOLE COMPORTAMENTALI:\n${get("ai_behavior_rules")}`);
  if (get("ai_style_instructions")) parts.push(`ISTRUZIONI STILE: ${get("ai_style_instructions")}`);
  if (get("ai_sector_notes")) parts.push(`NOTE SETTORE: ${get("ai_sector_notes")}`);

  if (parts.length === 0) return "";
  return `\n\nPROFILO UTENTE E AZIENDA:\n${parts.join("\n")}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOAD MISSION HISTORY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadMissionHistory(userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("outreach_missions")
      .select("title, status, channel, total_contacts, processed_contacts, target_filters, ai_summary, created_at, completed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!data?.length) return "";
    let block = "\n\n--- STORICO MISSIONI RECENTI ---\n";
    for (const m of data) {
      const filters = m.target_filters as any;
      const countries = filters?.countries?.join(", ") || "N/D";
      const progress = `${m.processed_contacts}/${m.total_contacts}`;
      block += `- "${m.title}" [${m.status}] — ${m.channel} — Paesi: ${countries} — Progresso: ${progress}`;
      if (m.ai_summary) block += ` — Riepilogo: ${m.ai_summary.substring(0, 100)}`;
      block += `\n`;
    }
    return block;
  } catch { return ""; }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOAD KB ENTRIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadKBContext(query?: string): Promise<string> {
  // ── Wave3 RAG: se c'è una query, prova retrieval semantico via embeddings ──
  if (query && query.trim().length >= 8) {
    try {
      const { ragSearchKb } = await import("../_shared/embeddings.ts");
      const matches = await ragSearchKb(supabase, query, {
        matchCount: 8,
        matchThreshold: 0.25,
        minPriority: 3,
        onlyActive: true,
      });
      if (matches.length > 0) {
        const entries = matches
          .map((e) => `### ${e.title} [sim=${e.similarity.toFixed(2)} · ${(e.tags || []).join(", ") || e.category}]\n${e.content}`)
          .join("\n\n");
        return `\n\nKNOWLEDGE BASE AZIENDALE (RAG retrieval):\n${entries}`;
      }
      // Se RAG non trova nulla rilevante, fallback a top-priority
    } catch (e) {
      console.warn("RAG retrieval failed, falling back to top-priority:", e);
    }
  }

  // ── Fallback: top-priority statico ──
  const { data } = await supabase
    .from("kb_entries")
    .select("title, content, category, tags")
    .eq("is_active", true)
    .gte("priority", 5)
    .order("priority", { ascending: false })
    .limit(10);

  if (!data?.length) return "";

  const entries = (data as any[]).map(e =>
    `### ${e.title} [${(e.tags || []).join(", ") || e.category}]\n${e.content}`
  ).join("\n\n");

  return `\n\nKNOWLEDGE BASE AZIENDALE:\n${entries}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOAD OPERATIVE PROMPTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadOperativePrompts(userId: string): Promise<string> {
  const { data } = await supabase
    .from("operative_prompts")
    .select("name, objective, procedure, criteria")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(5);

  if (!data?.length) return "";

  const prompts = (data as any[]).map(p =>
    `**${p.name}**: Obiettivo: ${p.objective}. Procedura: ${p.procedure}. Criteri: ${p.criteria}`
  ).join("\n");

  return `\n\nPROMPT OPERATIVI ATTIVI:\n${prompts}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOAD MEMORY CONTEXT (TIERED L1/L2/L3)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadMemoryContext(userId: string): Promise<string> {
  // Load memories in priority: L3 first, then L2, then L1
  const [l3Res, l2Res, l1Res, plansRes] = await Promise.all([
    supabase.from("ai_memory")
      .select("id, content, memory_type, tags, importance, level, confidence")
      .eq("user_id", userId)
      .eq("level", 3)
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("importance", { ascending: false })
      .limit(10),
    supabase.from("ai_memory")
      .select("id, content, memory_type, tags, importance, level, confidence")
      .eq("user_id", userId)
      .eq("level", 2)
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("confidence", { ascending: false })
      .limit(10),
    supabase.from("ai_memory")
      .select("id, content, memory_type, tags, importance, level, confidence")
      .eq("user_id", userId)
      .eq("level", 1)
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("ai_work_plans")
      .select("id, title, status, current_step, steps, tags")
      .eq("user_id", userId)
      .in("status", ["running", "paused"])
      .limit(5),
  ]);

  // Increment access_count and last_accessed_at for loaded memories
  const allMemoryIds: string[] = [];
  for (const res of [l3Res, l2Res, l1Res]) {
    if (res.data) allMemoryIds.push(...res.data.map((m: any) => m.id));
  }
  if (allMemoryIds.length > 0) {
    // Fire-and-forget update for access tracking
    supabase.rpc("increment_memory_access", { memory_ids: allMemoryIds }).then(() => {}).catch(() => {});
  }

  let context = "";

  const formatMemories = (memories: any[], levelName: string) => {
    if (!memories?.length) return "";
    let s = `\n[${levelName}]\n`;
    const typeEmoji: Record<string, string> = { preference: "⭐", decision: "🎯", fact: "📌", conversation: "💬" };
    for (const m of memories) {
      s += `${typeEmoji[m.memory_type] || "📝"} ${m.content} (conf: ${Math.round(m.confidence * 100)}%, tags: ${(m.tags || []).join(", ")})\n`;
    }
    return s;
  };

  if (l3Res.data?.length || l2Res.data?.length || l1Res.data?.length) {
    context += "\n\nMEMORIA OPERATIVA (L3=permanente, L2=operativa, L1=sessione):";
    context += formatMemories(l3Res.data || [], "L3 PERMANENTE");
    context += formatMemories(l2Res.data || [], "L2 OPERATIVA");
    context += formatMemories(l1Res.data || [], "L1 SESSIONE");
  }

  if (plansRes.data && plansRes.data.length > 0) {
    context += "\n\nPIANI DI LAVORO ATTIVI:\n";
    for (const p of plansRes.data as any[]) {
      const steps = p.steps as any[];
      context += `🔄 "${p.title}" — stato: ${p.status}, progresso: ${p.current_step}/${steps.length}\n`;
      const nextStep = steps[p.current_step];
      if (nextStep) context += `   → Prossimo step: ${nextStep.description}\n`;
    }
  }

  return context;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROLLING SUMMARY (ChatMemory)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function compressMessages(messages: any[], apiKey: string, userId: string): Promise<any[]> {
  if (messages.length <= 8) return messages;

  const LIVE_WINDOW = 6;
  const recentMessages = messages.slice(messages.length - LIVE_WINDOW);

  // Check if a pre-computed rolling summary exists from a previous turn
  const { data: existingSummary } = await supabase
    .from("ai_memory")
    .select("content")
    .eq("user_id", userId)
    .eq("source", "rolling_summary")
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingSummary?.[0]?.content) {
    // Use pre-computed summary — ZERO latency added
    // Trigger background refresh for the NEXT turn (fire-and-forget)
    const olderMessages = messages.slice(0, messages.length - LIVE_WINDOW);
    generateAndSaveSummary(olderMessages, apiKey, userId).catch(() => {});

    return [
      { role: "system", content: `RIEPILOGO CONVERSAZIONE PRECEDENTE:\n${existingSummary[0].content}` },
      ...recentMessages,
    ];
  }

  // First time with >8 messages: no summary yet — use truncation fallback (no blocking API call)
  // Trigger background summary generation for NEXT turn
  const olderMessages = messages.slice(0, messages.length - LIVE_WINDOW);
  generateAndSaveSummary(olderMessages, apiKey, userId).catch(() => {});

  // Return only recent messages (no latency penalty)
  return recentMessages;
}

// Non-blocking background summary generation
async function generateAndSaveSummary(olderMessages: any[], apiKey: string, userId: string): Promise<void> {
  const summaryPrompt = `Riassumi in modo conciso (3-5 righe) il contesto operativo di questa conversazione. Cattura: decisioni prese, azioni eseguite, dati importanti menzionati, richieste pendenti.\n\n${olderMessages.map((m: any) => `${m.role}: ${String(m.content || "").substring(0, 300)}`).join("\n")}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: summaryPrompt }],
        max_tokens: 300,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const summary = data.choices?.[0]?.message?.content;
      if (summary) {
        // Delete old rolling summaries to keep only latest
        await supabase
          .from("ai_memory")
          .delete()
          .eq("user_id", userId)
          .eq("source", "rolling_summary");

        // Save new summary
        await supabase.from("ai_memory").insert({
          user_id: userId,
          content: summary,
          memory_type: "conversation",
          tags: ["session_summary", "chat_memory", new Date().toISOString().split("T")[0]],
          importance: 2,
          level: 1,
          confidence: 0.4,
          decay_rate: 0.02,
          source: "rolling_summary",
        });
      }
    }
  } catch (e) {
    console.error("[ChatMemory] Background summary generation failed:", e);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId: string = claimsData.claims.sub as string;

    // Resolve AI provider (user key or gateway)
    const provider = await resolveAiProvider(userId);

    // Credit check (only when using gateway credits)
    if (!provider.isUserKey) {
      const { data: credits } = await supabase.from("user_credits").select("balance").eq("user_id", userId).single();
      if (credits && credits.balance <= 0) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti. Acquista crediti extra o aggiungi le tue chiavi API nelle impostazioni." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { messages, context } = await req.json();

    // Build system prompt with all context injections
    let systemPrompt = SYSTEM_PROMPT;

    // Estrai l'ultima domanda user per RAG retrieval semantico sulla KB.
    const lastUserMsg: string | undefined = Array.isArray(messages)
      ? [...messages].reverse().find((m: any) => m?.role === "user" && typeof m.content === "string")?.content
      : undefined;

    // Load all context in parallel
    const [memoryContext, userProfile, kbContext, opPrompts, missionHistory] = await Promise.all([
      loadMemoryContext(userId),
      loadUserProfile(),
      loadKBContext(lastUserMsg),
      loadOperativePrompts(userId),
      loadMissionHistory(userId),
    ]);

    if (userProfile) systemPrompt += userProfile;
    if (memoryContext) systemPrompt += memoryContext;
    if (kbContext) systemPrompt += kbContext;
    if (opPrompts) systemPrompt += opPrompts;
    if (missionHistory) systemPrompt += missionHistory;

    // Add page/selection context
    if (context) {
      systemPrompt += "\n\nCONTESTO CORRENTE DELL'UTENTE:";
      if (context.currentPage) systemPrompt += `\nPagina attiva: ${context.currentPage}`;
      if (context.source === "partner_hub") {
        systemPrompt += `\nL'utente è nella Rubrica Partner.`;
        if (context.viewLevel) systemPrompt += ` Vista: ${context.viewLevel}.`;
        if (context.selectedCountry) systemPrompt += ` Paese selezionato: ${context.selectedCountry}.`;
        if (context.totalPartners !== undefined) systemPrompt += ` Partner visibili: ${context.totalPartners}.`;
        if (context.selectedCount) systemPrompt += ` Partner selezionati: ${context.selectedCount}.`;
      }
      if (context.selectedCountries?.length) {
        systemPrompt += `\nPaesi selezionati: ${context.selectedCountries.map((c: any) => `${c.name} (${c.code})`).join(", ")}.`;
      }
      if (context.filterMode && context.filterMode !== "all" && !context.filterMode.startsWith("/")) {
        const filterLabels: Record<string, string> = { todo: "paesi con dati incompleti", no_profile: "paesi con profili mancanti", missing: "paesi mai esplorati" };
        systemPrompt += `\nFiltro attivo: ${filterLabels[context.filterMode] || context.filterMode}.`;
      }

      // Mission Builder specific prompt
      if (context.currentPage === "/mission-builder") {
        systemPrompt += `\n\nMODALITÀ MISSION BUILDER — ISTRUZIONI SPECIALI:
Sei in modalità creazione missione. Il tuo ruolo è guidare l'utente passo dopo passo nella configurazione di una campagna di outreach. NON mostrare tutto subito — fai UNA domanda alla volta.

FLUSSO CONVERSAZIONALE:
1. Chiedi COSA vuole fare (email, WhatsApp, LinkedIn, deep search, contatto ex-clienti, etc.)
2. Chiedi CHI contattare — usa i dati reali del database. Se l'utente dice un paese/regione, cerca i numeri reali.
3. Quando devi far selezionare i paesi, includi nel messaggio: [WIDGET:country_select]
4. Quando devi far scegliere il canale, includi: [WIDGET:channel_select]
5. Per regolare i batch per paese: [WIDGET:slider_batch]
6. Per opzioni deep search: [WIDGET:toggle_group]
7. Per il riepilogo finale con lancio: [WIDGET:confirm_summary]

IMPORTANTE:
- NON assumere che sia sempre per-paese. Potrebbe essere per tipo azienda, rating, ex-clienti, biglietti da visita.
- Usa i dati reali: interroga il database per dare numeri precisi.
- Rispondi in modo SINTETICO — massimo 2-3 frasi + il widget. La voce leggerà solo le prime 2 frasi.
- Conferma ogni scelta prima di procedere al passo successivo.
- Se l'utente fornisce più info in una volta, elaborale tutte e proponi il widget appropriato.

DATI DISPONIBILI:`;
        if (context.countryStats?.length) {
          const topCountries = context.countryStats.slice(0, 10).map((c: any) => `${c.name} (${c.count})`).join(", ");
          systemPrompt += `\nTop paesi nel DB: ${topCountries}. Totale paesi: ${context.countryStats.length}.`;
        }
        if (context.missionData) {
          const md = context.missionData;
          if (md.targets?.countries?.length) systemPrompt += `\nPaesi già selezionati: ${md.targets.countries.join(", ")}.`;
          if (md.channel) systemPrompt += `\nCanale scelto: ${md.channel}.`;
          if (md.deepSearch?.enabled) systemPrompt += `\nDeep Search attivo.`;
        }
      }
    }

    // Rolling summary: compress older messages if conversation is long
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") || provider.apiKey;
    const compressedMessages = await compressMessages(messages, LOVABLE_KEY, userId);

    const allMessages = [{ role: "system", content: systemPrompt }, ...compressedMessages];

    // First call with tools — with retry and model fallback
    const aiHeaders = { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" };
    // Cascade fallback: ogni modello deve esistere realmente sul gateway.
    // 'gpt-5-mini' è stato rimosso (modello inesistente).
    const fallbackModels = provider.isUserKey
      ? [provider.model]
      : [provider.model, "google/gemini-2.5-flash", "openai/gpt-4o-mini"];

    let response: Response | null = null;
    for (const tryModel of fallbackModels) {
      console.log(`[AI] Trying model: ${tryModel}`);
      response = await fetch(provider.url, {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({ model: tryModel, messages: allMessages, tools }),
      });
      if (response.ok) {
        if (tryModel !== provider.model) console.log(`[AI] Fallback model ${tryModel} succeeded`);
        break;
      }
      const errStatus = response.status;
      const errText = await response.text();
      console.error(`AI gateway error (${tryModel}):`, errStatus, errText);
      if (errStatus === 429 || errStatus === 402) {
        const errorMsg = errStatus === 429 ? "Troppe richieste, riprova tra poco." : "Crediti AI esauriti.";
        return new Response(JSON.stringify({ error: errorMsg }), { status: errStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // For 503/500 try next model
      if (errStatus !== 503 && errStatus !== 500 && errStatus !== 529) {
        return new Response(JSON.stringify({ error: "Errore AI gateway" }), { status: errStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!response || !response.ok) {
      console.error("[AI] All models failed");
      return new Response(JSON.stringify({ error: "Tutti i modelli AI sono temporaneamente non disponibili. Riprova tra qualche minuto." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let result = await response.json();
    let assistantMessage = result.choices?.[0]?.message;

    let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
    if (result.usage) {
      totalUsage.prompt_tokens += result.usage.prompt_tokens || 0;
      totalUsage.completion_tokens += result.usage.completion_tokens || 0;
    }

    // Tool calling loop
    let iterations = 0;
    let lastPartnerResult: any = null;
    let lastJobCreated: any = null;
    let uiActions: any[] = [];

    while (assistantMessage?.tool_calls?.length && iterations < 8) {
      iterations++;
      const toolResults = [];

      for (const tc of assistantMessage.tool_calls) {
        console.log(`Tool: ${tc.function.name}`, tc.function.arguments);
        // SAFE PARSE: LLM occasionally emits malformed JSON. Don't crash the whole request.
        let args: any;
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch (parseErr) {
          const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
          console.error(`[ai-assistant] tool args parse failed for ${tc.function.name}:`, errMsg);
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              success: false,
              error: "INVALID_TOOL_ARGS",
              message: `Tool arguments were not valid JSON: ${errMsg}. Please retry with valid JSON.`,
              raw_arguments_snippet: String(tc.function.arguments || "").substring(0, 200),
            }),
          });
          continue;
        }
        const toolResult = await executeTool(tc.function.name, args, userId, authHeader);
        console.log(`Result ${tc.function.name}:`, JSON.stringify(toolResult).substring(0, 500));
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });

        const tr = toolResult as any;

        // Track partner list results
        if (tr?.partners && Array.isArray(tr.partners) && tr.partners.length > 0 && tc.function.name === "search_partners") {
          const partnerIds = tr.partners.map((p: any) => p.id);
          const [svcRes, certRes] = await Promise.all([
            supabase.from("partner_services").select("partner_id, service_category").in("partner_id", partnerIds),
            supabase.from("partner_certifications").select("partner_id, certification").in("partner_id", partnerIds),
          ]);
          const svcMap: Record<string, string[]> = {};
          for (const s of (svcRes.data || []) as any[]) { if (!svcMap[s.partner_id]) svcMap[s.partner_id] = []; svcMap[s.partner_id].push(s.service_category); }
          const certMap: Record<string, string[]> = {};
          for (const c of (certRes.data || []) as any[]) { if (!certMap[c.partner_id]) certMap[c.partner_id] = []; certMap[c.partner_id].push(c.certification); }
          lastPartnerResult = tr.partners.map((p: any) => ({
            ...p, country_code: p.country?.match(/\(([A-Z]{2})\)/)?.[1] || "", country_name: p.country?.replace(/\s*\([A-Z]{2}\)/, "") || "",
            services: svcMap[p.id] || [], certifications: certMap[p.id] || [],
          }));
        }

        // Track job creation
        if ((tc.function.name === "create_download_job" || tc.function.name === "download_single_partner") && tr?.success && tr?.job_id) {
          lastJobCreated = { job_id: tr.job_id, country: tr.country, mode: tr.mode, total_partners: tr.total_partners, estimated_time_minutes: tr.estimated_time_minutes };
        }

        // Track UI actions
        if (tr?.ui_action) uiActions.push(tr.ui_action);
        if (tr?.step_result?.ui_action) uiActions.push(tr.step_result.ui_action);

        // ── Auto-save L1 memory after significant tool calls ──
        if (userId && tr?.success) {
          const autoSaveTools: Record<string, (a: any, r: any) => string | null> = {
            send_email: (a, r) => `Email inviata a ${a.to_email} — oggetto: "${a.subject}"`,
            create_download_job: (a, r) => `Download avviato per ${r.country}, ${r.total_partners} partner (mode: ${r.mode})`,
            download_single_partner: (a, r) => `Download singolo: "${a.company_name}" (WCA ID: ${r.wca_id})`,
            deep_search_partner: (a, r) => `Deep search su "${a.company_name || a.partner_id}"`,
            deep_search_contact: (a, r) => `Deep search contatto: "${a.contact_name || a.contact_id}"`,
            bulk_update_partners: (a, r) => `Aggiornamento bulk: ${r.updated_count} partner — ${(r.changes || []).join(", ")}`,
            create_reminder: (a, r) => `Reminder creato: "${a.title}" per ${r.company_name} (scadenza: ${a.due_date})`,
            create_activity: (a, r) => `Attività creata: "${a.title}" (${a.activity_type})`,
          };
          const generator = autoSaveTools[tc.function.name];
          if (generator) {
            const content = generator(args, tr);
            if (content) {
              // Dedup check: avoid saving if very similar memory exists recently
              const { data: existing } = await supabase
                .from("ai_memory")
                .select("id")
                .eq("user_id", userId)
                .eq("source", "auto_tool")
                .ilike("content", `%${escapeLike(content.substring(0, 40))}%`)
                .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .limit(1);
              
              if (!existing?.length) {
                supabase.from("ai_memory").insert({
                  user_id: userId,
                  content,
                  memory_type: "fact",
                  tags: [tc.function.name, new Date().toISOString().split("T")[0]],
                  importance: 2,
                  level: 1,
                  confidence: 0.5,
                  decay_rate: 0.02,
                  source: "auto_tool",
                }).then(() => {}).catch(() => {});
              }
            }
          }
        }
      }

      allMessages.push(assistantMessage);
      allMessages.push(...toolResults);

      // Retry with fallback models on tool-loop calls too
      let toolLoopOk = false;
      for (const tryModel of fallbackModels) {
        response = await fetch(provider.url, {
          method: "POST",
          headers: aiHeaders,
          body: JSON.stringify({ model: tryModel, messages: allMessages, tools }),
        });
        if (response.ok) {
          toolLoopOk = true;
          break;
        }
        const errStatus = response.status;
        const errText = await response.text();
        console.error(`AI tool-loop error (${tryModel}):`, errStatus, errText);
        if (errStatus === 429 || errStatus === 402) {
          // For user's own key, no fallback available — return immediately
          if (provider.isUserKey) {
            const errorMsg = errStatus === 429 ? "Troppe richieste al provider AI, riprova tra poco." : "Crediti AI esauriti.";
            return new Response(JSON.stringify({ error: errorMsg }), { status: errStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          // For gateway, try next model
          continue;
        }
        if (errStatus !== 503 && errStatus !== 500 && errStatus !== 529) {
          return new Response(JSON.stringify({ error: "Errore AI gateway" }), { status: errStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      if (!toolLoopOk) {
        console.error("[AI] All models failed in tool loop");
        return new Response(JSON.stringify({ error: "Tutti i modelli AI sono temporaneamente non disponibili. Riprova tra qualche minuto." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      result = await response.json();
      assistantMessage = result.choices?.[0]?.message;
      if (result.usage) {
        totalUsage.prompt_tokens += result.usage.prompt_tokens || 0;
        totalUsage.completion_tokens += result.usage.completion_tokens || 0;
      }
    }

    // Build final content
    let finalContent = assistantMessage?.content || "";
    if (lastPartnerResult && lastPartnerResult.length > 0) {
      finalContent += `\n\n---STRUCTURED_DATA---\n${JSON.stringify({ type: "partners", data: lastPartnerResult })}`;
    }
    if (lastJobCreated) {
      finalContent += `\n\n---JOB_CREATED---\n${JSON.stringify(lastJobCreated)}`;
    }
    if (uiActions.length > 0) {
      finalContent += `\n\n---UI_ACTIONS---\n${JSON.stringify(uiActions)}`;
    }

    if (finalContent) {
      if (userId) await consumeCredits(userId, totalUsage, provider.isUserKey);
      return new Response(JSON.stringify({ content: finalContent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    allMessages.push(assistantMessage);
    const finalResponse = await fetch(provider.url, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({ model: provider.model, messages: allMessages }),
    });

    if (!finalResponse.ok) {
      return new Response(JSON.stringify({ error: "Errore finale" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const finalResult = await finalResponse.json();
    if (finalResult.usage) {
      totalUsage.prompt_tokens += finalResult.usage.prompt_tokens || 0;
      totalUsage.completion_tokens += finalResult.usage.completion_tokens || 0;
    }

    let finalText = finalResult.choices?.[0]?.message?.content || "Nessuna risposta";
    if (lastPartnerResult && lastPartnerResult.length > 0) {
      finalText += `\n\n---STRUCTURED_DATA---\n${JSON.stringify({ type: "partners", data: lastPartnerResult })}`;
    }
    if (lastJobCreated) {
      finalText += `\n\n---JOB_CREATED---\n${JSON.stringify(lastJobCreated)}`;
    }
    if (uiActions.length > 0) {
      finalText += `\n\n---UI_ACTIONS---\n${JSON.stringify(uiActions)}`;
    }

    if (userId) await consumeCredits(userId, totalUsage, provider.isUserKey);
    return new Response(JSON.stringify({ content: finalText }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
