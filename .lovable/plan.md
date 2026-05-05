## Cosa ho trovato

**Buona notizia:** la tabella `contact_conversation_context` esiste già nel DB con i campi giusti:
- `conversation_summary` (text) — il riassunto narrativo della relazione
- `last_exchanges` (jsonb) — gli ultimi scambi sintetizzati
- `interaction_count`, `last_interaction_at`, `dominant_sentiment`, `response_rate`, `avg_response_time_hours`, `preferred_language`

Ed è **già letta** da 6 edge function (`generate-email`, `generate-outreach`, `classify-email-response`, `cadence-engine`, `ai-assistant`, `agent-execute`) e 4 componenti UI.

**Cattiva notizia:** nessuno la **scrive**. C'è 1 solo record in tutto il DB (probabilmente seed manuale). Non esiste edge function o trigger che costruisce/aggiorna il summary quando arrivano email/WA/LI. È un'infrastruttura "morta" — letta ovunque, mai alimentata.

**Bug correlato:** trovati anche **6 duplicati** del prompt `content-intelligence` (uno per ogni utente, ma tutti identici). Da deduplicare.

## Piano

### 1. Pulizia duplicati prompt (parallelo)
Mantieni il record più recente di `content-intelligence`, archivia gli altri 5 (`is_active=false`). Il loader prende max N e in caso di duplicati spreca token.

### 2. Sostituire la lettura "ultime 30 mail" con il summary
In `classify-inbound-content/index.ts` (e ovunque iniettiamo cross-history nei prompt AI):
- **PRIMA:** carica `conversation_summary` + `last_exchanges` (≤5) + metriche da `contact_conversation_context`
- **FALLBACK:** se non esiste ancora il record, usa max **5 messaggi recenti** (non 30) solo per il primo bootstrap
- **Mai più 30 messaggi raw nel prompt.**

### 3. Costruire un builder/refresher del summary
Nuova edge function `refresh-conversation-context`:
- **Input:** `partner_id` (o `email_address` o `contact_id`)
- **Logica:** legge gli ultimi 30 `channel_messages` cross-canale, li passa a Gemini Flash con un prompt operativo dedicato (`conversation-summary`, editabile in Prompt Lab) che produce:
  - `conversation_summary` narrativo (max 800 char): chi è, cosa abbiamo fatto insieme, ultima trattativa, tono, esito atteso
  - `last_exchanges`: array di max 5 sintesi `{date, channel, direction, gist}`
  - metriche (response_rate, avg_response_time, dominant_sentiment, preferred_language)
- **Upsert** in `contact_conversation_context` per `(user_id, partner_id)` o `(user_id, email_address)`.

### 4. Trigger di aggiornamento (incrementale, non blocking)
- Dopo che `classify-inbound-message` salva un messaggio inbound → invoca `refresh-conversation-context` in **fire-and-forget** (`waitUntil`-style, mai blocca la pipeline inbound).
- Stessa cosa al post-send (campaigns/outreach) per messaggi outbound.
- Idempotente: se il summary è stato aggiornato negli ultimi 5 minuti e non è cambiato l'`interaction_count`, skip.

### 5. Wiring nei prompt AI esistenti
- `classify-inbound-content`: blocco `recent_history` → diventa `relationship_summary` (summary + ultimi 5 sintetici).
- `generate-email/conversationIntel.ts`, `generate-outreach/conversationContext.ts`, `cadence-engine`: già leggono il summary, ora avranno dati veri invece di tabella vuota.
- `agent-execute/contextInjection`: aggiungi tool/blocco `getRelationshipSummary(partner_id)` come prima fonte, history grezza solo on-demand.

### 6. UI: bottone "Rigenera summary" (manual override)
In Contact Drawer e Partner Passport, piccolo bottone che invoca `refresh-conversation-context` con `force=true`. Per quando l'operatore vuole forzare l'aggiornamento dopo una telefonata o nota manuale.

## Dettagli tecnici

**Token budget:** summary ~800 char + 5 sintesi ~150 char = ~1.5k token totali invece di 30 mail × ~500 char = ~15k token. **Riduzione 10×** per chiamata AI.

**Prompt operativo nuovo:** `conversation-summary` in `operative_prompts`, editabile da Prompt Lab. Standard "Professore" 5 sezioni (Identità/Obiettivo/Metodo/Guardrail/Output JSON).

**Schema validato** con Zod (`safeParseAiJson`) — no `as any`.

**Logger strutturato** (`_shared/structuredLogger.ts`) per tracciare ogni refresh, latenza, token usati, dimensione summary.

**Risk gate:** la refresh function è `READ` only sui channel_messages e `WRITE` solo su `contact_conversation_context` (già RLS user-scoped) — no risk gate AI necessario.

**Files toccati:**
- `supabase/functions/refresh-conversation-context/index.ts` (NEW)
- `supabase/functions/classify-inbound-content/index.ts` (sostituire blocco history → summary, ridurre 30→5 fallback)
- `supabase/functions/classify-inbound-message/index.ts` (fire-and-forget refresh post-classify)
- `supabase/functions/_shared/conversationSummaryLoader.ts` (NEW — helper SSOT lettura summary con fallback)
- Migration: dedup prompt content-intelligence + seed prompt `conversation-summary`
- `src/data/conversationContext.ts` (NEW DAL) + bottone manual refresh in Contact Drawer
- mem aggiornato

## Cosa resta uguale
- Tutti i lettori esistenti (6 edge + 4 UI) continuano a funzionare: ora vedono dati veri.
- `email_content_intelligence` invariato.
- Nessun side-effect duplicato: il refresh è idempotente, fire-and-forget, debounced 5 min.
