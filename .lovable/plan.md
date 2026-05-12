## Audit completo dei tasti di sincronizzazione email

### Mappa dei tasti (pagina `/v2/inbox` → `InArrivoTab` → `EmailToolbar`)

| Tasto | Hook | Cosa fa | Stato |
|---|---|---|---|
| **Scarica nuove** | `useCheckInbox` → `callCheckInbox(mailboxId)` | 1 batch, scansione completa (legge tutto) | ⚠️ funziona ma scansiona anche le lette |
| **Download non lette** | `useContinuousSync` → `bgSyncStart(mailboxId, {unreadOnly:true})` | loop continuo, solo unread, header `x-unread-only:1` | ❌ **ROTTO** (CORS) |
| **Stop** | `bgSyncStop()` | flag `abortSync = true` | ✅ |
| **Auto** | `useEmailAutoSync` | timer 2 min → `callCheckInbox()` | ✅ |
| **Reset cursore** | `useResetSync` → UPDATE `email_sync_state` | azzera last_uid | ✅ |

### Problema #1 — CAUSA PRINCIPALE del fallimento "Download non lette"

I log console mostrano una raffica di `FunctionsFetchError` con `status: undefined` su `check-inbox`. Gli edge function logs mostrano che la funzione **esegue il boot ma non completa mai la response** per quelle chiamate (nessun metric line dopo il `booted`).

Diagnosi: in `src/lib/checkInbox.ts` la chiamata aggiunge l'header `x-unread-only: 1` quando `bgSyncStart` parte in modalità unread. Ma in `supabase/functions/_shared/cors.ts` (riga 43), `Access-Control-Allow-Headers` elenca:

```
authorization, x-client-info, apikey, content-type,
x-supabase-client-platform, …, x-mailbox-id, x-sync-user-id,
x-cron-secret, x-injection-review-id
```

**Manca `x-unread-only`.** Il browser fa il preflight OPTIONS, il server non dichiara questo header come permesso, e il browser blocca la POST → `TypeError: Failed to fetch` → supabase-js lo riveste come `FunctionsFetchError` con `status: undefined`. Per questo gli edge logs mostrano `booted` ma nessun completamento: il preflight cached scade e ogni POST fallisce subito a livello di rete.

**Spiega anche perché**: la prima sincronizzazione di 492 email (14:16:55) era partita da auto-sync / "Scarica nuove" (senza `x-unread-only`), e quella ha funzionato.

### Problema #2 — Retry inefficace su `FunctionsFetchError`

`src/lib/checkInbox.ts::isSkippableCheckInboxError` intercetta solo 503 `BOOT_ERROR` e 546 `WORKER_RESOURCE_LIMIT`. Un `FunctionsFetchError` (network/CORS) non ha `httpStatus` → non viene riconosciuto come transient → la retry rimbalza per 10 batch in `bgSyncStart` con back-off lineare (2s → 20s) producendo solo rumore. Va aggiunto: se l'errore è una `TypeError`/`FunctionsFetchError` senza status → trattalo come transient.

### Problema #3 — "Scarica nuove" non rispetta il flag unread

Il pulsante principale chiama `callCheckInbox(mailboxId)` senza `{ unreadOnly: true }`. Quando l'utente clicca "Scarica nuove", l'edge function fa `flag_resync` su tutta la finestra (vedi log: `checked: 492, marked_read: 492`) — pesante e in conflitto con la richiesta dell'utente di lavorare solo sulle non lette. Aggiungere `{ unreadOnly: true }` come default coerente con la doctrine.

### Problema #4 — Single-flight troppo stretto

`inFlightCheckInbox` in `src/lib/checkInbox.ts` deduplica per nome funzione, ignorando `mailboxId` e `unreadOnly`. Se il cron auto-sync (casella personale, full) parte mentre l'utente clicca "Download non lette" su una casella condivisa, le due chiamate si fondono e la seconda riceve i dati della prima. Va dedupato per `(mailboxId, unreadOnly)`.

---

## Piano di fix (minimale, edge-only + lib client)

### 1. Sblocco CORS (root cause)
File: `supabase/functions/_shared/cors.ts`
- Aggiungere `x-unread-only` all'elenco `Access-Control-Allow-Headers`.

### 2. Resilienza `callCheckInbox`
File: `src/lib/checkInbox.ts`
- Estendere `isSkippableCheckInboxError` per riconoscere anche `FunctionsFetchError` / errori senza `httpStatus` con name `TypeError|FunctionsFetchError|FunctionsRelayError` → ritornare `{ transient: true }` così bgSyncStart fa back-off.
- Cambiare la chiave di dedup `inFlightCheckInbox` in una `Map<string, Promise>` con chiave `${mailboxId ?? "personal"}|${unreadOnly ? "u" : "all"}`.

### 3. "Scarica nuove" passa `unreadOnly: true`
File: `src/hooks/useEmailSync.ts` (`useCheckInbox`)
- Modificare la mutation in `callCheckInbox(mailboxId, { unreadOnly: true })`. Anche `useEmailAutoSync` (`src/hooks/useEmailAutoSync.ts`) → idem.

### 4. UI: rinominare il pulsante secondario
File: `src/components/outreach/EmailToolbar.tsx`
- Tooltip "Download non lette" → spiegare che è un loop continuo. Nessun cambio funzionale.

### 5. Verifica post-deploy
- Deploy `check-inbox` (per propagare il nuovo CORS shared).
- Da `/v2/inbox`: cliccare "Download non lette" e leggere i log: niente più `FunctionsFetchError`, ogni batch deve produrre un metric line in `check-inbox`.
- Verificare che "Scarica nuove" non scateni più 492 `marked_read` su mail già viste.

### Non tocco
- Logica `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (vincolo memoria `linkedin-single-channel-rule` / `email-download-integrity`).
- Trigger DB `on_inbound_message` (già fixato nello sprint precedente).
- Editorial review, classificazione AI, queue.

### Stima impatto
3 file client + 1 file shared edge + 1 redeploy. Zero migrazioni DB. Zero breaking change su contratti API.
