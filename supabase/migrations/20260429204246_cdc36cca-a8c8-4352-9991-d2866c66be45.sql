-- ============================================================
-- KB entries (globali, user_id NULL) per i 6 nuovi tool di Command
-- ============================================================
INSERT INTO public.kb_entries (user_id, category, chapter, title, content, tags, priority, sort_order, is_active)
VALUES
(NULL, 'command_tools', 'messaging', 'Tool: send-whatsapp',
$txt$Tool `send-whatsapp` — accoda un messaggio WhatsApp via estensione browser (NO API ufficiale).
Quando proporlo:
- l'operatore chiede esplicitamente "manda/invia/scrivi WhatsApp/WA a …"
- esiste un numero di telefono (E.164) o un partner_id il cui contatto ha un telefono
Vincoli OBBLIGATORI:
- rate limit hard: max 5 messaggi/minuto per canale
- finestra operativa rispettata (CET 06-24)
- testo libero, NO subject
- richiede approvazione (write tool)
Quando NON usarlo:
- non c'è un numero o un contatto agganciato → blocca e chiedi
- l'utente vuole "una mail" o "un'email" → usa compose-email
- per outreach massivo a un paese → usa compose-email (batch) o create-campaign$txt$,
ARRAY['command','tool-routing','whatsapp','router'], 100, 1, true),

(NULL, 'command_tools', 'messaging', 'Tool: send-linkedin',
$txt$Tool `send-linkedin` — accoda un messaggio LinkedIn via estensione browser (NO API ufficiale).
Quando proporlo:
- l'operatore dice "scrivi/invia LinkedIn / LI a …"
- è disponibile un URL profilo (linkedin.com/in/<handle>)
Vincoli OBBLIGATORI:
- max 300 caratteri, NO subject
- finestra 9-19 CET, delay 45-180s tra messaggi
- limite giornaliero per utente (configurato in liSettings)
- richiede approvazione
Quando NON usarlo:
- senza URL profilo → blocca e chiedi
- per follow-up email → compose-email
- per messaggi automatici massivi → meglio campagna outreach con LI come canale$txt$,
ARRAY['command','tool-routing','linkedin','router'], 100, 2, true),

(NULL, 'command_tools', 'autopilot', 'Tool: launch-mission',
$txt$Tool `launch-mission` — esegue UN round di una missione autopilot già configurata in `agent_missions` via edge `mission-executor`.
Quando proporlo:
- l'operatore dice "avvia/esegui/lancia missione <nome>" o fornisce un mission_id (UUID)
- la missione esiste, non è disabilitata, ha azioni pendenti
Vincoli:
- rispetta slot (`mission_slot_config`) e KPI definiti
- richiede approvazione DIRETTORE
- esegue UN round, non l'intera missione: l'operatore deve sapere che sono passi incrementali
Quando NON usarlo:
- per CREARE una missione (non c'è ancora il tool, dirlo all'operatore)
- per inviare un singolo messaggio → send-whatsapp/send-linkedin/compose-email
- se non si conosce il nome o l'id → chiedi prima$txt$,
ARRAY['command','tool-routing','mission','autopilot','router'], 90, 3, true),

(NULL, 'command_tools', 'intelligence', 'Tool: daily-briefing',
$txt$Tool `daily-briefing` — read-only. Genera il riepilogo operativo della giornata: KPI partner, scadenze attività, code outreach, missioni attive, inbox non letti.
Quando proporlo:
- "fammi il briefing", "cosa devo fare oggi", "agenda di oggi", "stato di oggi", "riepilogo giornaliero"
- prima sessione mattutina dell'operatore
Vantaggi:
- nessuna approvazione (solo lettura)
- usa direttamente i dati locali, NON tenta download esterni
Quando NON usarlo:
- per analisi storiche su periodi lunghi → ai-query / dashboard-snapshot
- per dettaglio singolo partner → analyze-partner$txt$,
ARRAY['command','tool-routing','briefing','intelligence','router'], 95, 4, true),

(NULL, 'command_tools', 'ingest', 'Tool: parse-business-card',
$txt$Tool `parse-business-card` — OCR + AI vision su immagine di biglietto da visita.
Quando proporlo:
- l'operatore allega/menziona un'immagine biglietto e vuole estrarre i dati
- è disponibile un URL pubblico (https://… .png/.jpg/.webp/.heic)
Vincoli:
- consuma crediti AI vision → richiede approvazione
- output: nome, azienda, email, telefono, ruolo
- NON crea automaticamente un contatto: l'operatore decide se promuovere il risultato in CRM
Quando NON usarlo:
- senza URL immagine → spiega che serve caricare l'immagine prima
- per cercare biglietti già censiti → search-business-cards (tool esistente)$txt$,
ARRAY['command','tool-routing','ocr','business-card','router'], 80, 5, true),

(NULL, 'command_tools', 'ingest', 'Tool: kb-ingest-document',
$txt$Tool `kb-ingest-document` — pipeline ufficiale di ingestion documenti nella Knowledge Base (PDF/DOCX/MD/TXT). Estrazione → chunking → embedding → INSERT in `kb_entries`.
Quando proporlo:
- l'operatore dice "ingerisci/indicizza/carica nella KB <file>"
- esiste un upload pendente o un nome file noto
Vincoli:
- da Command NON si possono ricevere allegati binari: il tool risponde indirizzando alla pagina KB se manca `contentBase64`
- richiede approvazione DIRETTORE
- crea N chunk + embedding (consumo AI tokens)
Quando NON usarlo:
- per aggiungere una singola card di testo → create-kb-entry
- per cercare contenuti nella KB → search-kb$txt$,
ARRAY['command','tool-routing','kb','ingest','router'], 85, 6, true);


-- ============================================================
-- Operative prompts (per ogni utente esistente, scope=command)
-- ============================================================
INSERT INTO public.operative_prompts (user_id, name, context, objective, procedure, criteria, tags, priority, is_active)
SELECT
  u.user_id,
  'Command Router — regole di scelta tool',
  'command',
  'Scegliere il tool corretto in base al verbo e al canale richiesto, evitando di proporre tool inesistenti o non disponibili in modalità interna.',
$proc$Mappa verbi → tool (priorità in ordine):
1. "manda/invia/scrivi WhatsApp/WA a <numero|partner>" → `send-whatsapp` (rate 5/min, no subject).
2. "manda/invia/scrivi LinkedIn/LI a <url profilo>" → `send-linkedin` (max 300 char, finestra 9-19 CET, daily limit).
3. "scrivi/componi/prepara email|mail …" → `compose-email` (gestisce singolo destinatario E batch country-wide).
4. "avvia/esegui/lancia missione <nome|uuid>" → `launch-mission` (richiede mission_id risolvibile in `agent_missions`).
5. "briefing|agenda di oggi|cosa devo fare|riepilogo giornaliero" → `daily-briefing` (read-only).
6. "leggi biglietto|business card|estrai dati biglietto" + URL immagine → `parse-business-card`.
7. "ingerisci|indicizza|carica documento nella KB" → `kb-ingest-document` (avvisa se manca upload binario).
8. "mostra|elenca|cerca|quanti …" senza azione di scrittura → `ai-query` (catch-all read).

VIETATO:
- proporre `download_single_partner`, `scan_directory`, `create_download_job`: i tool WCA non esistono in modalità interna.
- spezzare in più step un singolo verbo di scrittura (es. ai-query + compose-email): `compose-email` risolve da sé partner/contatto.

Quando i parametri obbligatori mancano (numero, URL profilo, mission_id, URL immagine), NON inventarli: ritorna toolId del tool corretto con `reasoning` che spiega il dato mancante, così il tool stesso entra in modalità approval e chiede all'operatore.$proc$,
$crit$- Ogni risposta JSON deve scegliere uno dei tool dell'elenco fornito.
- Mai inventare toolId fuori dalla lista.
- Mai duplicare step se un singolo tool basta.$crit$,
  ARRAY['command','tool-routing','router','OBBLIGATORIA'],
  100,
  true
FROM (SELECT DISTINCT user_id FROM public.operative_prompts WHERE user_id IS NOT NULL) u;


INSERT INTO public.operative_prompts (user_id, name, context, objective, procedure, criteria, tags, priority, is_active)
SELECT
  u.user_id,
  'Command — vincoli messaging multicanale',
  'command',
  'Applicare i limiti operativi WA e LinkedIn quando si propone send-whatsapp o send-linkedin.',
$proc$WhatsApp:
- rate 5 messaggi/minuto
- finestra 06-24 CET
- testo libero, no subject
- consigliato 1 messaggio per persona/giorno; più di 3 messaggi non risposti → fermarsi e proporre cambio canale
LinkedIn:
- max 300 caratteri
- finestra 9-19 CET, delay 45-180s
- limite giornaliero (vedi liSettings)
- mai più di 1 messaggio/giorno per profilo, mai 2 messaggi consecutivi senza risposta
Routing:
- partner con holding pattern attivo → preferire email follow-up, non WA/LI
- partner blacklisted → bloccare ogni invio$proc$,
  'I limiti sopra sono hard guard: rispettali sempre, non chiederlo all''utente.',
  ARRAY['command','tool-routing','whatsapp','linkedin','OBBLIGATORIA'],
  90,
  true
FROM (SELECT DISTINCT user_id FROM public.operative_prompts WHERE user_id IS NOT NULL) u;