## Principio: tutto fuori sidebar tranne filtri/raggruppamenti

- **Sidebar globale** (filtri-drawer): contiene viste, cartelle, filtri urgenza, ricerca. Nient'altro.
- **Pagina Funnemail Inbox** (fuori sidebar): è il **client di posta** vero. Riusa lo stile delle nostre email esistenti (`SmartInboxView` / componenti `src/components/email`) e aggiunge il **box "Suggerimento Funnemail"** sopra ogni mail con cartella, azione, urgenza, motivazione e, quando il mittente è sconosciuto, gli esiti dello **Scout**.

## Stato già pronto (non si tocca)

- 14 cartelle in `funnemail_folders` (rfq, operations, tasks, support, alerts, info, internal, other_urgent, archive set, to_sort).
- Edge `funnemail-classify` con prompt `funnemail_classifier` da Prompt Lab.
- Edge `sherlock-extract` con livelli Scout/Detective/Sherlock già esistente.
- Pattern `FiltersDrawer` + `sidebarContextRegistry` + `FilterSection/ChipGroup/Chip`.

## Cosa cambia

### 1. Sidebar globale → nuova sezione "funnemail-inbox"

- Aggiungo `"funnemail-inbox"` al `SidebarContextKey` con banner (icona Inbox, titolo "Funnemail Inbox", descrizione breve).
- Nuovo file `FunnemailInboxFiltersSection.tsx` con SOLO filtri (riusa `FilterSection/ChipGroup/Chip`, niente UI custom):
  - **Vista**: Tutte / Prioritario (urgency in critical/high) / Standard (normal) / Altro (low + sorting + archive).
  - **Cartelle**: chip per ognuna delle 14 cartelle attive (lette runtime da DB).
  - **Cerca**: input testo (oggetto + mittente).
  - **Solo non letti**: toggle.
- Aggiungo i campi nel `GlobalFiltersContext` (`funnemailView`, `funnemailFolder`, `funnemailSearch`, `funnemailUnreadOnly`).
- La pagina `FunnemailInboxPage` registra la sidebar come "funnemail-inbox" (come fanno Agenda/Inbox).

### 2. FunnemailInboxPage → vero client di posta (rimuovo i 3 colonne attuali)

- **Rimuovo** `FoldersSidebar` (tutto va nella sidebar globale).
- Layout 2 colonne: lista mail (sx) + reader (dx), come nelle altre pagine email.
- La **lista** legge dalla DAL filtrata da `useGlobalFilters()`. Riga = oggetto + mittente + età + badge urgenza/azione/cartella + pallino non-letto. Niente cose strane.
- Il **reader** mostra: header (mittente, oggetto, data, partner se collegato) + corpo (HTML safe via DOMPurify, già usato nel resto) + sezione **"Suggerimento Funnemail"** in un Card minimalista:
  - cartella suggerita + azione suggerita + urgenza + reasoning + confidence
  - badge "Mittente sconosciuto" + risultato Scout se presente (tipo azienda, paese, sito, ruolo presunto: cliente / partner / freight forwarder / fornitore / sconosciuto)
  - pulsante "Conferma cartella" / select per riassegnare manualmente
  - pulsante "Riclassifica" (force=true)

### 3. Scout automatico in inbound (solo mittente sconosciuto)

- Nuova edge function **`funnemail-scout-sender`** (sub 200 LOC):
  1. Riceve `{ from_address, message_id, user_id }`.
  2. Estrae dominio, cerca nei `partners` (match su email/dominio).
  3. Se trovato → ritorna `{ known: true, partner_id, partner_type }` e basta.
  4. Se NON trovato → invoca `sherlock-extract` livello **scout** sul dominio (gratuito, senza AI gateway costoso).
  5. Salva l'esito in nuova tabella `funnemail_sender_intel` (cache 30gg per dominio).
  6. Ritorna `{ known: false, intel: { company_type, country, website, role_guess, evidence_url } }`.
- Hook in `classify-inbound-message`: PRIMA di chiamare `funnemail-classify`, chiama `funnemail-scout-sender`. Passa il risultato a `funnemail-classify` come `sender_intel` per arricchire il contesto del prompt.
- Tutta la logica AI passa da `invokeAi()` per rispettare l'AI Invocation Charter (registro nuovo scope `funnemail_scout`).

### 4. Prompt Funnemail aggiornato (matrice operations)

Aggiorno il prompt `funnemail_classifier` in `operative_prompts` (no codice, solo testo, modificabile da Prompt Lab):
- Riceve in input anche `sender_intel` (tipo azienda).
- Per email **operations**, riconosce sotto-tipo e applica matrice:
  - **booking_confirm** → cartella `operations`, azione `none`, agenda no, estrai riferimento booking.
  - **awb_update** → cartella `operations`, azione `none`, agenda no.
  - **tracking_update** → cartella `operations`, azione `none`, agenda no.
  - **rate_alert** → cartella `info`, azione `none`, agenda no.
  - **invoice/document** → cartella `tasks`, azione `none`, agenda no.
  - **operative_quotation_received** → cartella `rfq`, azione `draft_reply`, agenda **sì**.
  - **operative_request** (richiesta servizio da partner) → cartella `operations`, azione `notify_human`, agenda **sì**.
- Default conservativo: `goes_to_agenda=false`. Vero solo se mail richiede azione esplicita dell'operatore.
- Il sotto-tipo va in `decision.reasoning` come prefisso "[subtype:xxx] ...".

### 5. Tabella nuova `funnemail_sender_intel`

- Campi business: `email_domain` (PK), `is_known_partner` bool, `partner_id` nullable, `company_type` text, `country` text, `website` text, `role_guess` text, `evidence` jsonb, `expires_at` timestamptz.
- RLS: globale lettura per autenticati (è cache di info pubbliche), insert/update solo via service role.

## Cosa NON cambia (volutamente — rispetta principio madre)

- `check-inbox`, `email-imap-proxy`, `mark-imap-seen` → intoccati.
- Editorial review intoccato.
- Agenda → resta come l'abbiamo ridisegnata; nessun nuovo intervento qui.
- Le 19 attività vecchie → restano come da decisione precedente.
- Nessun hardcode di mittenti/regole: tutto via prompt + tabelle.

## Tecnica (riassunto file)

**Nuovi**
- `supabase/functions/funnemail-scout-sender/index.ts`
- `supabase/migrations/<ts>_funnemail_sender_intel.sql` (tabella + RLS)
- `supabase/migrations/<ts>_funnemail_classifier_prompt_v2.sql` (UPDATE del prompt operativo)
- `src/components/global/filters-drawer/FunnemailInboxFiltersSection.tsx`

**Modificati**
- `src/components/global/filters-drawer/sidebarContextRegistry.ts` (+ key)
- `src/components/global/filters-drawer/FiltersDrawer.tsx` (+ case render)
- `src/contexts/GlobalFiltersContext.tsx` (+ 4 campi funnemail*)
- `src/data/funnemailInbox.ts` (query con i nuovi filtri + join intel)
- `src/v2/hooks/useFunnemailInbox.ts` (legge dai global filters)
- `src/v2/ui/pages/FunnemailInboxPage.tsx` (layout 2 colonne, registra sidebar)
- `src/v2/ui/pages/funnemail-inbox/MailReader.tsx` (Card "Suggerimento Funnemail" + Scout)
- `src/v2/ui/pages/funnemail-inbox/MailList.tsx` (riusa stile email esistente, semplificato)
- `supabase/functions/classify-inbound-message/index.ts` (chiama scout PRIMA di classify, passa intel)
- `supabase/functions/funnemail-classify/index.ts` (accetta `sender_intel` opzionale, lo aggiunge al prompt)
- `src/lib/queryKeys.ts` (key nuovi)

**Eliminati**
- `src/v2/ui/pages/funnemail-inbox/FoldersSidebar.tsx` (tutto traslato in sidebar globale)

## Checklist verifica finale

- Cartelle e viste appaiono SOLO nella sidebar filtri globale.
- La pagina mostra mail con stile email standard + box suggerimento sopra.
- Mittente noto → niente Scout, intel = `{ known: true, partner_id }`.
- Mittente sconosciuto → Scout chiamato 1 volta, cached 30gg.
- Email "operations" finiscono nella cartella corretta secondo matrice prompt, niente in agenda salvo eccezioni.
- Prompt Funnemail editabile da Prompt Lab senza redeploy.
- Nessuna chiamata AI fuori da `invokeAi()` lato frontend; nuovo scope `funnemail_scout` registrato.
