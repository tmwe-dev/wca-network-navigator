## Obiettivo

Una sola procedura di invio LinkedIn (quella validata sulla v3.9.56) e una sola procedura di download per LinkedIn e WhatsApp, usata **ovunque** nel sistema. Nessuna modifica al codice estensione: si fissa il contratto bridge attuale come SSOT e si forza tutto il resto a passarci.

Regola assoluta che il piano rispetta: **ogni invio non originato da una chat manuale diretta passa per `ai_pending_actions` con approvazione umana**. Bulk, AI, cadenze, autopilot, classificatore email → mai invio diretto.

---

## Stato attuale (mappa rapida)

Send LinkedIn (DOM extension, "v3.9.56 procedure"):
- `useLinkedInMessagingBridge.sendMessage(profileUrl, text)` → postMessage `from-webapp-li` action `sendMessage` → `HybridOps.sendMessage` nell'estensione. ✅ è la procedura buona.
- Edge `send-linkedin` accoda in `extension_dispatch_queue` (path queue) — usata da bulk/cadence/pending-executor.

Send WhatsApp:
- `useWhatsAppExtensionBridge.sendWhatsApp(phone, text)` → bridge estensione WA. ✅ procedura unica.
- Edge `send-whatsapp` analoga path queue.

Download:
- LinkedIn: `useLinkedInMessagingBridge.readInbox / readThread / backfillThread` (action `readLinkedInInbox`, `readLinkedInThread`, `backfillLinkedInThread`).
- WhatsApp: `useWhatsAppExtensionBridge.listSidebarChats / readThread + useWhatsAppBackfill / useWhatsAppAdaptiveSync`.

Punti che oggi chiamano i bridge (call site da uniformare/auditare):
- LinkedIn send: `LinkedInInboxView` (chat diretta), `useBulkLinkedInDispatch` (bulk → già crea ai_pending_actions ✅), `pending-action-executor` (consumer approvati), `cadence-engine`.
- WhatsApp send: `useSendWhatsApp` (cockpit), `WhatsAppInboxView`, `PartnerDetailCompact`, `useDirectContactActions`, `useOutreachQueue`, `pending-action-executor`, `cadence-engine`.
- Download LI: `useLinkedInSync`, `useLinkedInBackfill`.
- Download WA: `useWhatsAppAdaptiveSync`, `useWhatsAppBackfill`, `useWhatsAppDomLearning`.

---

## Piano in 5 step

### Step 1 — Congelare il contratto bridge (SSOT)

Creare `docs/extension-bridge-protocol.md` (esiste già: aggiornarlo) con:
- LinkedIn actions ammesse: `ping`, `setConfig`, `sendMessage`, `readLinkedInInbox`, `readLinkedInThread`, `backfillLinkedInThread`, `diagnosticLinkedInDom`. Versione attesa estensione ≥ 3.9.56.
- WhatsApp actions ammesse: `ping`, `verifySession`, `sendWhatsApp`, `listSidebarChats`, `readThread`, `backfillThread`, `learnDom`.
- Direzioni postMessage: `from-webapp-li` ↔ `from-extension-li`, `from-webapp-wa` ↔ `from-extension-wa`.
- Timeout standard: send 120s, read inbox 35s, read thread 30s, backfill 120s.

Nessun altro modulo può aprire un canale postMessage diverso.

### Step 2 — Un solo entry-point di invio per canale (lato app)

Creare due funzioni di servizio (no nuovo bridge, riusano gli hook esistenti):

- `src/lib/messaging/linkedinSender.ts`
  - `sendLinkedInDirect({ profileUrl, text, contactId, partnerId, source })` — solo per chat aperta dall'utente. Verifica bridge available, journalistReview client-side già fatto a monte (è un invio manuale), chiama `bridge.sendMessage`, logga `activities` via `useLogAction`.
  - `queueLinkedInForApproval({ targets[], messageTemplate, source })` — wrapper di `useBulkLinkedInDispatch`: scrive in `ai_pending_actions` con `action_type=send_linkedin`, mai invia subito.

- `src/lib/messaging/whatsappSender.ts`
  - `sendWhatsAppDirect(...)` analogo (solo chat aperta).
  - `queueWhatsAppForApproval(...)` analogo.

Tutti i call site oggi sparsi vengono refattorizzati a usare uno di questi due entry-point. Nessun `bridge.sendMessage` o `sendWhatsApp` chiamato direttamente fuori da questi due file (regola lint custom o code review).

### Step 3 — Forzare il flusso "Da Inviare" per tutto ciò che non è chat diretta

Audit dei call site e classificazione:

| Call site | Tipo | Azione |
|---|---|---|
| `LinkedInInboxView` send box | chat diretta | usa `sendLinkedInDirect` |
| `WhatsAppInboxView` send box | chat diretta | usa `sendWhatsAppDirect` |
| `PartnerDetailCompact` "Send WA" | chat diretta (manuale, 1 click utente) | usa `sendWhatsAppDirect` |
| `useDirectContactActions` (apri chat) | chat diretta | usa `sendWhatsAppDirect` |
| `useSendWhatsApp` (cockpit draft singolo) | manuale | usa `sendWhatsAppDirect` |
| `useBulkLinkedInDispatch` | bulk | già `queueLinkedInForApproval` ✅ |
| `cadence-engine` (LI/WA) | automatico | crea `ai_pending_actions`, mai invoke send-* diretto |
| `agent-execute` toolHandlers `send_whatsapp` / `send_linkedin` | AI | crea `ai_pending_actions` (già richiesto da `requiresApproval`); rimuovere qualunque path che bypassi |
| Email Intelligence reply → WA/LI | automatico | crea `ai_pending_actions` |
| `pending-action-executor` | esecuzione post-approvazione | unico autorizzato a chiamare `send-linkedin`/`send-whatsapp` edge function |

Verifica `_shared/policy/hardGuards.ts`: `send_whatsapp` e `send_linkedin` sono già in `APPROVAL_REQUIRED_TOOLS`. Aggiungere test che fallisce se un nuovo path li invoca senza passare da pending action.

### Step 4 — Un solo entry-point di download per canale

- `src/lib/messaging/linkedinDownloader.ts`
  - `downloadLinkedInInbox()` → `bridge.readInbox`, normalizza in DTO, persiste in `channel_messages` con dedup (riusa `useLinkedInSync`).
  - `downloadLinkedInThread(threadUrl)` → `bridge.readThread` + opzionale `backfillThread` se ci sono buchi rispetto al cursor in `channel_backfill_state`.

- `src/lib/messaging/whatsappDownloader.ts`
  - `downloadWhatsAppInbox()` e `downloadWhatsAppThread(chatId)` analoghi, integrati con `useWhatsAppAdaptiveSync` (timing già configurabile via `app_settings`).

Schedulazione automatica:
- I cron/timer esistenti (adaptive sync WA, sync LI) restano gli unici trigger del download.
- Frequenza e finestra orarie già lette da `app_settings` (vedi memoria multichannel-extension-architecture). Nessuna richiesta nuova: solo riusare.

### Step 5 — Guardrail e osservabilità

1. **Lint rule** (eslint custom) `no-direct-extension-send`: vieta import diretto di `useLinkedInMessagingBridge.sendMessage` o `useWhatsAppExtensionBridge.sendWhatsApp` fuori da `src/lib/messaging/*`.
2. **Test** in `src/test/`:
   - `bulk-li-goes-to-pending-actions.test.ts`
   - `cadence-engine-never-invokes-send.test.ts`
   - `agent-execute-send-requires-approval.test.ts`
3. **Telemetria**: ogni chiamata a `sendLinkedInDirect`/`sendWhatsAppDirect` logga `ai_interaction_log` con `scope=manual_send`, source = pagina chiamante. Approvazioni e relativi invii post-pending già loggati da `pending-action-executor`.
4. **UI "Da Inviare"**: badge counter per canale (LI, WA) sul header — già presente, verificare che mostri pendings di entrambi.
5. **Pause di sicurezza** già in `app_settings` (delay 45-180s LI, 4-12s WA, finestre orarie). Confermare che `pending-action-executor` rispetti le finestre prima di processare un'azione approvata schedulata.

---

## Cosa NON cambia

- Codice delle estensioni (`public/linkedin-extension/`, `public/whatsapp-extension/`) — intoccato.
- Edge functions `send-linkedin`, `send-whatsapp`, `pending-action-executor`, `cadence-engine` — solo verifica/regression, niente refactor opportunistici.
- Schemi DB.

## Rischi e mitigazioni

- **Rischio**: refactor call site rompe send manuale dall'inbox. → Mitigazione: `sendLinkedInDirect` è un wrapper sottile sopra `bridge.sendMessage`, stesso payload, stesso timeout 120s.
- **Rischio**: dimenticare un call site e lasciare un invio bypass. → Mitigazione: lint rule + grep CI su `\.sendMessage\(` e `\.sendWhatsApp\(` fuori da `src/lib/messaging/`.
- **Rischio**: doppio invio (immediato + pending). → Mitigazione: `queue*ForApproval` non chiama mai il bridge; `pending-action-executor` è l'unico che invoca le edge `send-*`.

## Deliverable

1. `src/lib/messaging/{linkedinSender,whatsappSender,linkedinDownloader,whatsappDownloader}.ts`
2. Refactor 8-10 call site (lista in tabella sopra) per usare i nuovi entry-point.
3. ESLint rule + 3 test di governance.
4. `docs/extension-bridge-protocol.md` aggiornato come SSOT del contratto.

Nessuna migrazione DB. Nessun cambio estensione. Nessun cambio edge function (solo audit).
