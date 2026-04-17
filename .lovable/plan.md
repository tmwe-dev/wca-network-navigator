

L'utente vuole una **mappatura completa del ciclo WhatsApp** del sistema: cosa legge, come ragiona, cosa fa coi contatti. È una richiesta di **audit/report**, non di implementazione → presento il documento direttamente come piano informativo, senza modifiche al codice.

## CICLO WHATSAPP — MAPPA COMPLETA

### A. LIVELLO 1 — ESTENSIONE BROWSER (cliente, su `web.whatsapp.com`)

**Posizione**: `public/whatsapp-extension/` (manifest v3, versione 5.1)
**Moduli**:
- `background.js` — router messaggi, registry azioni
- `content.js` — bridge con la webapp, heartbeat adattivo (8–30s)
- `tab-manager.js` — gestisce/recupera la tab di WhatsApp Web
- `discovery.js` — riconosce stato UI (QR, loading, sidebar pronta)
- `actions.js` — esegue azioni reali sul DOM
- `ai-extract.js` — fallback AI quando il DOM non è interpretabile
- `config.js` — credenziali Supabase ricevute dalla webapp

**Cosa sa fare** (azioni esposte):
1. `verifySession` — verifica login WhatsApp Web (5 strategie: sidebar/chat-items/compose-box/shell-fallback/QR)
2. `readUnread` — scansiona la sidebar e estrae chat con messaggi non letti (S1 schema appreso → S2 testid → S3 role → S4 container → S5 euristica span+title; fallback AI su HTML grezzo)
3. `readThread` — apre una chat e legge gli ultimi N messaggi (default 50)
4. `backfillChat` — scrolla all'indietro per recuperare lo storico (max 30 scroll)
5. `sendWhatsApp` — apre chat e digita+invia un messaggio (CSP-compliant, no eval)
6. `learnDom` — manda l'HTML al backend AI per imparare nuovi selettori CSS (auto-healing quando WA cambia DOM)
7. `diagnosticDom` — raccoglie stato pagina per debug

### B. LIVELLO 2 — BRIDGE WEBAPP ↔ ESTENSIONE

**File**: `src/hooks/useWhatsAppExtensionBridge.ts`
- Comunicazione via `window.postMessage` con direction `from-webapp-wa` ↔ `from-extension-wa`
- Ping ogni 3s → setta `isAvailable`
- `verifySession` ogni 30s → setta `isAuthenticated`
- All'avvio invia config Supabase (url+anonKey+JWT) all'estensione
- Espone: `sendWhatsApp, readUnread, readThread, backfillChat, learnDom, verifySession`

### C. LIVELLO 3 — ORCHESTRAZIONE LATO APP

#### C1. Sync manuale (lettura)
**File**: `src/hooks/useWhatsAppAdaptiveSync.ts`
- **Solo manuale**, no polling/timer (vincolo `whatsapp-stealth-sync`)
- Click "Leggi" → `readNow()`:
  - Se nessuna chat focalizzata → `sidebarScan()` → `readUnread`
  - Se chat focalizzata → `threadScan()` → `readThread(20)`
- Per ogni messaggio:
  - Detect `direction` (prefisso "Tu:", "You:", ecc. → outbound; altrimenti inbound)
  - Genera ID deterministico via `buildDeterministicId("wa", contact, text, time)` per dedup
  - Risolve `operator_id` per l'utente
  - Upsert in `channel_messages` con `onConflict: user_id,message_id_external, ignoreDuplicates: true`
- Notifica toast "📱 N nuovi messaggi" + invalida query React-Query

#### C2. Backfill profondo (recupero storico)
**File**: `src/hooks/useWhatsAppBackfill.ts`
- Cursor persistente in tabella `channel_backfill_state` (per `operator_id+channel+external_chat_id`)
- Per sessione: max 10 chat, pause 17.5s ±15% tra chat, max 30 scroll/chat
- Ogni click avanza il cursor `oldest_message_at` indietro nel tempo
- Se la chat raggiunge l'inizio → `reached_beginning=true`, skip nei click successivi

#### C3. Invio messaggi (outbound)
**Edge function**: `supabase/functions/send-whatsapp/index.ts`
- Verifica rate limit via RPC `check_channel_rate_limit` (max 5/min)
- Inserisce in `extension_dispatch_queue` con `status='pending'`
- L'estensione fa polling della coda e invia via DOM injection
- Conferma delivery via webhook `receive-channel-message` (aggiorna `delivered_at`)

**Hook applicativi che invocano l'invio**:
- `useSendWhatsApp.ts` — invio singolo (Cockpit, contact panel)
- `useOutreachQueue.ts` — invio batch da campagne (delay 5s tra invii)

### D. LIVELLO 4 — INGESTION & DEDUP

Tutti i messaggi (inbound dal sync + outbound delivered) finiscono in `channel_messages` con:
- `channel='whatsapp'`, `direction`, `from_address`, `to_address`, `body_text`, `operator_id`, `user_id`
- `message_id_external` deterministico → dedup transazionale via `ON CONFLICT`
- Trigger `channel_messages_search_trigger` aggiorna `search_vector` (full-text)
- Trigger `on_inbound_message` (solo `direction='inbound'`):
  - **a)** Cerca match con `outreach_queue` via `partner_id` o `from_address` → marca `replied_at`
  - **b)** Cancella followup pendenti in `outreach_schedules` (`status='skipped'`)
  - **c)** Crea `activity` di tipo `follow_up` (priorità `high`, due_date `now()`)
  - **d)** Invoca via `pg_net` → edge function `classify-inbound-message`

### E. LIVELLO 5 — RAGIONAMENTO AI (classificazione + decisione)

**Edge function**: `supabase/functions/classify-inbound-message/index.ts`
Modello: `google/gemini-3-flash-preview` via Lovable AI Gateway

**Output strutturato** (tool calling JSON):
- `classification`: positive | negative | neutral | needs_human | spam
- `confidence`: 0–1
- `sentiment`: positive | negative | neutral | mixed
- `urgency`: critical | high | normal | low
- `intent`: descrizione breve
- `reasoning`: spiegazione

**Hint specifico WhatsApp**: "This is a WhatsApp message (short, informal)" → modifica il tono di valutazione vs email/LinkedIn.

**Side-effects**:
1. Insert in `reply_classifications` (storico classificazioni)
2. Aggiorna `activity.description` con etichetta `[positive 87% | positive] whatsapp from +39…`
3. Se `needs_human` → priorità activity = `critical`
4. Se `positive` + missione `autopilot=true` → crea `ai_pending_actions(action_type='send_proposal')` → trigger `on_ai_pending_action_approved` → `pending-action-executor`

### F. LIVELLO 6 — IMPATTO SUL CONTATTO

A valle della classificazione, si attivano automatismi sul partner/lead:

1. **Lead status escalation** (memory `automated-lead-status-logic`): la `classify-email-response` (e per analogia inbound WA) può promuovere `lead_status: new → contacted → in_progress → negotiation`
2. **Holding pattern** (memory `holding-pattern-governance`): se positivo, esce dal circuito d'attesa ✈️
3. **Activity timeline**: nuova attività `follow_up` visibile in `/v2/agenda` e nel pannello partner
4. **Mission progress**: `mission_actions` aggiornata; followup pendenti vengono `skipped`
5. **Increment counters**: `partners.interaction_count` / `imported_contacts.interaction_count` via RPC `increment_partner_interaction`
6. **Reliability scorecard**: rispondi-rapidamente alza il "response rate" del partner

### G. UI DOVE APPARE TUTTO QUESTO

- `/v2/in-arrivo` (tab WhatsApp): toolbar `WhatsAppToolbar` con pulsanti "Leggi"/"Recupera storico"
- Inbox WhatsApp: lista chat + thread view (legge da `channel_messages` filtrata `channel='whatsapp'`)
- `WhatsAppExtensionStatus`: badge isAvailable/isAuthenticated nel header
- Cockpit / Contact panel: bottone "WhatsApp" → `useSendWhatsApp`
- AI Control Center: classificazioni e pending actions visibili in audit log

### H. PUNTI DI ATTENZIONE / RISCHI NOTI

1. **TOS WhatsApp**: l'intero impianto si regge su DOM injection (no API ufficiale). Memory `multichannel-extension-architecture` documenta il rischio.
2. **Rate limit**: 5 msg/min hard cap; backfill 10 chat/sessione, 17.5s tra chat (anti-flood).
3. **DOM healing**: se WA cambia il DOM, `learnDom` rigenera selettori via AI. Ma se l'AI sbaglia, sync va a 0.
4. **operator_id mancante**: utenti senza riga in `operators` vedono i messaggi scartati (log "no operator found"). Già osservato nei log check-inbox.
5. **Sync solo manuale**: nessun WA arriva senza che l'utente clicchi "Leggi" → memory `whatsapp-stealth-sync` lo richiede esplicitamente per evitare ban.
6. **Direction detection fragile**: prefissi "Tu:/You:/Tú:" sono localizzati; se WA cambia lingua, tutti i messaggi appaiono come `inbound`.

## RIEPILOGO IN UNA RIGA

**Click "Leggi" → estensione legge sidebar/thread WA Web → upsert in `channel_messages` (dedup) → trigger `on_inbound_message` → activity + classify-inbound-message AI → escalation lead_status / pending action / followup skip → UI inbox + agenda + cockpit aggiornati.**

Vuoi che approfondisca un anello specifico (es. la parte AI di classificazione, il backfill cursor, o l'invio outbound), o vuoi un intervento concreto su uno dei punti deboli (es. fix direction detection, gestione operator_id mancante, healing DOM più robusto)?

