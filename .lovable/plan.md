## Obiettivo

Togliere le briglie a Command e all'AI assistant: niente più mappe hardcoded di tabelle/scopi nei prompt. L'AI riceve un puntatore alla Knowledge Base ("guarda l'indice schema dati") e usa la sua intelligenza per trovare le tabelle giuste — incluse `partner_contacts`, `partner_addresses`, `prospect_contacts` e i campi dei biglietti che oggi non vede.

Tre modifiche, nessuna nuova tabella, nessuna nuova edge function, nessun nuovo file.

---

## Azione 1 — Arricchire la KB entry "Il Mondo Operativo e Schema Dati"

**File:** record `kb_entries` id `7c4615c8-ddea-406a-a80e-191fee9e48d6` (esiste già, tag `data_schema` già presente).

**Cosa cambia:** sostituisco il contenuto attuale (3.302 caratteri, descrittivo ma incompleto) con un indice semantico in linguaggio naturale che mappa ogni concetto di business alla tabella che lo contiene. Niente schemi SQL rigidi — solo "se cerchi X, guarda qui".

Contenuto previsto (estratto):
- **Partner** → `partners` (anagrafica), `partner_contacts` (persone/email/telefoni), `partner_addresses` (sedi multiple), `partner_interactions` (storico).
- **Prospect / lead non-WCA** → `prospects`, `prospect_contacts`.
- **Biglietti da visita** → `business_cards` (campi: nome, azienda, email, telefono, indirizzo, ocr_confidence, partner_id se collegato).
- **Contatti CRM importati** → `imported_contacts`.
- **Comunicazioni** → `channel_messages` (multicanale unificato), `outreach_queue` (outbound), `email_*` (inbox).
- **Attività** → `activities` (chiamate, follow-up, meeting).
- **AI** → `agents`, `agent_tasks`, `kb_entries`.
- **Job** → `download_jobs`, `campaign_jobs`.

Per ogni gruppo aggiungo 1 riga "dove trovi address/contatti" così l'AI sa che indirizzi e telefoni di un partner stanno in tabelle separate (non sul `partners` direttamente).

Chiusura entry: "Per lo schema esatto (colonne, tipi, enum) chiama l'RPC `ai_introspect_schema(table_name)`. Non fidarti di nomi colonna che ricordi — verifica sempre."

**Nota:** questo update richiede una migrazione (UPDATE su `kb_entries`).

---

## Azione 2 — Snellire il prompt di `ai-query-planner`

**File:** `supabase/functions/ai-query-planner/index.ts`

**Cosa rimuovo:**
- `TABLE_PURPOSE` (righe 42–54): la mappa hardcoded "tabella → descrizione" sparisce.
- L'elenco `tableList` nel prompt che ripete a ogni richiesta cosa fa ogni tabella.

**Cosa resta:**
- `ALLOWED_TABLES`: resta come **guardrail di sicurezza in codice** (whitelist tecnica), MA viene **estesa** per includere le tabelle che oggi mancano e che l'utente vede dai campi di ricerca:
  `partner_contacts`, `partner_addresses`, `prospects`, `prospect_contacts`, `partner_interactions`.
- Lo schema live caricato via RPC (`loadLiveSchema`) resta — è la fonte di verità sui campi.

**Cosa cambia nel prompt:**
Il system prompt diventa più corto e dice all'AI:
> "Hai accesso a una serie di tabelle business. Per capire **cosa contengono e come si relazionano**, consulta la KB entry con tag `data_schema` (titolo: 'Il Mondo Operativo e Schema Dati'), già iniettata nel contesto. Per i **campi esatti**, guarda lo SCHEMA REALE qui sotto. Decidi tu quale tabella usare."

L'elenco delle tabelle disponibili viene mostrato nudo (solo nomi, senza purpose hardcoded). L'AI capisce dal nome + dalla KB + dallo schema live.

**Iniezione KB:** aggiungo nel system prompt la lettura della entry `data_schema` da `kb_entries` (singola query DB, una tantum per richiesta) e la inserisco prima dello schema live.

---

## Azione 3 — Direttiva "consulta l'indice schema" nel system prompt LUCA

**File:** `supabase/functions/ai-assistant/systemPrompt.ts`

**Cosa aggiungo:** un breve paragrafo accanto al Charter R5 (riga 48–53), che dice:

> "Quando devi cercare dati nel database (partner, contatti, indirizzi, biglietti, attività), consulta prima l'indice semantico nella KB con tag `data_schema` per capire **dove vivono** le informazioni. Indirizzi e contatti dei partner non stanno sulla tabella `partners` — stanno in `partner_addresses` e `partner_contacts`. Stessa logica per prospect e biglietti. Non assumere — guarda l'indice."

Niente altro: nessuna lista hardcoded di tabelle, nessuna regola rigida. Solo il puntatore.

---

## Quello che NON faccio (per scelta)

- Non creo nuove tabelle, edge function, file o componenti UI.
- Non tocco `useCommandHistory`, l'iniezione del nome utente, il "living plan" — sono temi diversi che hai messo in pausa.
- Non aggiungo regole "if/then" nei prompt: la libertà sta nel rimuovere, non nell'aggiungere.

---

## Verifiche post-modifica

1. Aprire Command e chiedere: *"dammi l'indirizzo di [partner X]"* → l'AI deve scegliere `partner_addresses` (oggi fallisce perché non è whitelisted).
2. Chiedere: *"contatti email del partner Y"* → deve usare `partner_contacts`.
3. Chiedere: *"biglietti da visita di Milano"* → deve usare `business_cards` con filtro su città (campo già presente).
4. Verificare nei log di `ai-query-planner` che il prompt sia ~40% più corto e che l'AI scelga tabelle non più nominate esplicitamente nel prompt.

---

## Approvazione richiesta

L'**Azione 1** richiede una migration (UPDATE su `kb_entries`) — la lancio per prima e attendo conferma. Le Azioni 2 e 3 sono solo edit di file edge function, partono subito dopo l'approvazione della migration.

Confermi che procedo?