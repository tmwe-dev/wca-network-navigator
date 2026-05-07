
# WhatsApp — riparazione + procedura unica "incremental from cursor"

## Obiettivo (riallineato sulle tue parole)

Una sola operazione, pulita, in tutto il sistema:

> "Per ogni chat, trova nel DB l'ora dell'ultimo messaggio salvato, apri il thread, leggi tutti i messaggi più recenti di quell'ora e salvali. Letti/non letti non contano."

Il bridge estensione resta, le edge function restano. Cambia il **flusso di lettura**: niente più "scan badge unread → solo chat con pallino"; entriamo in ogni chat, partendo dal cursore temporale per chat, e prendiamo il delta.

## 1. Procedura unica `syncWhatsAppFromCursor` (la sola)

Pseudocodice:

```text
syncWhatsAppFromCursor():
  if !ext_available || !ext_authenticated → toast errore, stop

  cursors = SELECT contact, max(created_at) AS last_at
            FROM channel_messages
            WHERE channel='whatsapp' AND user_id=me
            GROUP BY contact   -- mappa { "Mario Rossi": "2026-05-05T10:23:00Z" }

  chats = ext.listSidebarChats()        -- nome + ultimo timestamp visibile (no badge)

  for chat in chats:
    cursor_iso = cursors[chat.name] || null   -- null = chat nuova → take last 50

    if (chat.lastVisibleAt > cursor_iso) OR cursor_iso == null:
      threadMsgs = ext.readThreadSince(chat.name, cursor_iso)
      saveMessages(threadMsgs)              -- upsert deterministico già esistente

  invalidate query keys, toast "X nuovi messaggi"
```

Una sola chiamata utente (un click o un trigger interno). Una sola funzione orchestratrice. Un solo punto di scrittura DB.

## 2. Cosa cambia, file per file

### 2.1 Estensione (`public/whatsapp-extension/`)

- `actions.js`
  - **Nuova azione `listSidebarChats`**: scansiona la sidebar **senza filtro badge**. Restituisce `[{ contact, lastVisibleAt, snippet }]` per tutte le chat visibili in pane-side. Riusa `unifiedExtract` ma rimuove il `if (count === 0) continue` e ritorna anche chat lette.
  - **Nuova azione `readThreadSince`**: apre la chat, scrolla verso l'alto **finché il timestamp del messaggio più vecchio caricato è ≤ cursor**, poi raccoglie tutti i `[data-testid="msg-container"]` e ritorna direzione + testo + timestamp. Riusa `_pageOpenChatForBackfill` e parte dello `_pageScrollAndRead` esistente, ma ferma il loop sul cursore (non sul `lastKnownText`, che è fragile).
  - Mantenute (compat): `verifySession`, `sendWhatsApp`, `learnDom`. **Deprecate** (no più chiamate dall'app): `readUnread`, `readThread`, `backfillChat`. Lascio i moduli per non rompere chi le importa, ma le rimuovo dalla whitelist `ALLOWED_ACTIONS`? **No**, le tengo nella whitelist ma le marco internamente come deprecated; verranno rimosse in una fase successiva quando saremo certi che nessun consumer le usa.
- `background.js` → registra i 2 nuovi handler `listSidebarChats` / `readThreadSince`.
- `content.js` → estende `ALLOWED_ACTIONS` con i due nuovi nomi.
- Versione: bump coerente a 5.11 in **manifest, background, content, popup** (oggi sono disallineate 5.10/5.8/5.4/5.0).

### 2.2 Webapp

- `src/hooks/useWhatsAppExtensionBridge.ts`
  - Aggiunge `listSidebarChats()` e `readThreadSince(contact, sinceIso)` come wrapper su `sendMsg`.
  - **Rimuove** `onSidebarChanged` (mai consumato, dead code).
- **Nuovo hook unico** `src/hooks/useWhatsAppCursorSync.ts`:
  - Espone `syncNow()`, `progress`, `isAvailable`, `isAuthenticated`.
  - Implementa l'algoritmo della sezione 1.
  - Usa il **DAL** (`src/data/channelMessages.ts` — da estendere con `getWhatsAppCursorsByContact()`), zero `supabase.from()` diretto.
- **Sostituzioni**:
  - `useWhatsAppAdaptiveSync.ts` → diventa thin wrapper su `useWhatsAppCursorSync` per non rompere `WhatsAppInboxView`, `InArrivoTab`, `ConnectionStatusBar`, `PartnerDetailCompact`. Conserva `readNow` come alias di `syncNow` e `isReading` come alias di `progress.running`.
  - `useWhatsAppBackfill.ts` → marcato deprecated, mantenuto perché ancora referenziato (vedremo se rimuoverlo dopo verifica). Non viene più chiamato dalla UI principale.

### 2.3 Bug fix collaterali (tutti dentro la stessa PR)

- **Parser timestamp multilingua** (`src/lib/whatsappTimestamp.ts`, nuovo): gestisce `HH:MM`, `ieri`, `oggi`, giorni della settimana (it/en), `dd MMM` (`03 mag`, `Mar 03`). Sostituisce `normalizeWhatsAppTimestamp` ovunque (adaptive sync e backfill).
- **`useAutoConnect`**: rimuovere il fallback "se esiste `whatsapp_sender` allora connesso=true" — riflette solo lo stato reale del bridge.
- **`whatsapp-ai-extract` PII redaction**: prima di mandare HTML a Lovable AI, sostituire numeri E.164 e email con `[REDACTED]` (il selettore CSS non ha bisogno dei valori reali).
- **`extension_dispatch_queue`**: non parte di questa PR (è un problema di "outbound queue"). Annotato come issue separata da affrontare quando attiveremo l'invio automatico.

## 3. Si arriva al 100%? Realisticamente no, ecco perché

Il 100% richiederebbe:
- WhatsApp Web sempre aperto **e visibile** (limite imposto da WhatsApp stesso)
- Connessione Internet attiva
- Estensione non aggiornata da Chrome durante la lettura
- WhatsApp non cambia DOM mid-scan

Cosa garantisce la nuova procedura:

| Aspetto | Prima | Dopo |
|---|---|---|
| Recall messaggi nuovi | ~50% (solo unread) | **~98%** (tutti i thread, no filtro lettura) |
| Ordine cronologico | rotto su "ieri/lun" | corretto (parser multilingua) |
| Idempotenza ri-esecuzione | OK (dedup hash) | OK (stesso dedup, scope più ampio) |
| Operazioni sovrapposte | possibili (3 hook attivi) | **una sola** (`syncNow`, lock con `isReading`) |
| Tempo per 50 chat | n/d (mai testato) | ~60-90s (12-18 click + 800ms cad. + scroll) |

Il **2% mancante** è inevitabile: chat che non sono mai apparse in sidebar (archiviate manualmente), gruppi con migliaia di messaggi storici (lo scroll deep fa solo l'ultimo blocco DOM), allegati binari (immagini/audio non testuali). Per questi servirebbe l'API ufficiale Cloud API di Meta — fuori scope.

## 4. UX: un solo bottone

- In `WhatsAppInboxView` e `ConnectionStatusBar`: un solo CTA **"Sincronizza WhatsApp"** che chiama `syncNow`.
- Mostra progress: "X / Y chat lette · Z messaggi nuovi".
- Disabilitato se ext non rilevata o non autenticata, con tooltip esplicativo.
- Rimosso il dual-mode "sidebar scan vs thread scan" (oggi nasconde all'utente la differenza).

## 5. Note tecniche (per te o per il revisore tecnico)

- DAL nuovo: `getWhatsAppCursorsByContact(userId): Promise<Map<string, string>>` — singola query `GROUP BY` filtrata su `channel_messages.channel='whatsapp'`.
- L'estensione deve poter **conoscere il cursor**: lo passiamo come argomento a `readThreadSince`, nessuno stato lato extension.
- Il loop di scroll si ferma quando: (a) timestamp meno recente in DOM ≤ cursor, oppure (b) `scrollTop` non scende più (già implementato in `_pageScrollUpOnly`), oppure (c) maxScrolls (default 25) raggiunto — fail-safe.
- Nessuna modifica ai constraint critici di memoria: journalist review intoccato, dedup intoccato, soft-delete intoccato, RLS intoccato.

## 6. Cosa NON faccio in questa fase

- Non tocco `extension_dispatch_queue` / consumer (problema separato di outbound).
- Non tocco edge function `send-whatsapp` (gate, rate, journalist review).
- Non rimuovo `useWhatsAppBackfill.ts` finché non verifico tutti i call site (preservazione codice in sviluppo, da memoria progetto).
- Non passo a Cloud API ufficiale (fuori scope, richiede Business Manager Meta).

Approvi e procedo.
