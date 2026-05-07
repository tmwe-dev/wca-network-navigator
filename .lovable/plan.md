
# Audit LinkedIn — stato attuale e proposta di allineamento

> Questo è un **report di audit**, non un'implementazione. Dopo la lettura decidiamo insieme cosa applicare.

## 1. Cosa fa oggi il sistema su LinkedIn

### 1.1 Estensione browser (`public/linkedin-extension/`, ~3.700 LOC)
- Manifest V3, single content script, debugger API per AX-tree, AI bridge per fallback intelligente, Optimus client per modalità autonoma.
- Moduli: `actions.js` (send/connect/search/inbox/extract), `ax-tree.js`, `ai-learn.js`, `hybrid-ops.js`, `tab-manager.js`, `auth.js`, `optimus-client.js`.
- Supporta: lettura inbox, lettura thread, **backfill scroll-back**, send DM, connect request, scrape profilo, diagnostica DOM, login.

### 1.2 Edge Functions (6)
- `send-linkedin` → accoda invio in `extension_dispatch_queue` con hard cap **50/giorno, 3/ora, finestra 9-19, delay 45-180s**, journalistReview obbligatorio.
- `linkedin-ai-extract`, `linkedin-profile-api` (Proxycurl), `save/get-linkedin-credentials`, `save-linkedin-cookie`. Tutte con `requireExtensionAuth`.

### 1.3 Hook React (9, ~1.880 LOC)
| Hook | Ruolo |
|---|---|
| `useLinkedInExtensionBridge` | Connessione/ping + sendConfig + verifySession + extractProfile |
| `useLinkedInMessagingBridge` | Inbox/thread/backfill/sendMessage; **dual strategy**: extension + FireScrape come fallback lettura |
| `useLinkedInSync` | **Sync manuale only** (click → readInbox → upsert) |
| `useLinkedInBackfill` | Discovery + deep recovery con scroll-back, max 5 thread/sessione, pausa 18s ±15% |
| `useLinkedInFlow` | Orchestratore enrichment batch (profilo + sito + AI outreach) |
| `useLinkedInLookup` | Ricerca live URL profilo |
| `useSendLinkedIn` | Wrapper invio singolo |
| `useBulkLinkedInDispatch` | Bulk con timing configurabile (`buildSchedule`) |
| `useAutoConnect` | Verifica sessione al login (LI + WA) |

### 1.4 UI principali
- `LinkedInInboxView` (chat-style con sidebar, sync manuale + backfill manuale)
- `LinkedInDMDialog`, `BulkLinkedInDialog`, `OptimusAgentPanel`, `ConnectionStatusBar`.

### 1.5 Settings DB (`app_settings`, già funzionanti)
`linkedin_daily_limit=50`, `hourly_limit=3`, `send_start_hour=9`, `send_end_hour=19`, `min_delay=45`, `max_delay=180`, `bulk_max=50`, `cadence_days=7`, `max_message_length=300`.

## 2. Confronto con WhatsApp (modello target)

| Capability | WhatsApp (8 hook) | LinkedIn (9 hook) |
|---|---|---|
| Bridge estensione | ✅ `useWhatsAppExtensionBridge` | ✅ `useLinkedInExtensionBridge` |
| **Adaptive sync (cursor + dedup DAL)** | ✅ `useWhatsAppAdaptiveSync` (370 LOC) | ❌ assente — `useLinkedInSync` fa solo `readInbox` "ultimo messaggio" |
| **Auto-sync con cadenza irregolare** | ✅ `useWhatsAppAutoSync` (sequenza 20/18/8/3/15/7/18/15/2/3/20 min + pause) | ❌ assente — solo manuale |
| **Chat Mode (5s tick + auto-detect post-send)** | ✅ `useWhatsAppChatMode` | ❌ assente |
| **Header sync button + new-msg badge** | ✅ `WhatsAppSyncButton`, `useWhatsAppNewMessagesIndicator` | ❌ assente nel topbar |
| **Backfill** | ✅ `useWhatsAppBackfill` | ✅ `useLinkedInBackfill` (parità) |
| **DAL `channel_messages`** | ✅ tutto via `src/data/channelMessages.ts` | ⚠️ **violazione**: `useLinkedInBackfill` chiama `supabase.from("channel_messages")` direttamente |
| **Pausa notturna/work hours** | ✅ via `useGlobalAutoSync` | ⚠️ rispettata solo lato edge (send), **non** lato sync (perché sync è manuale) |
| **Indicator `wa-sync-completed`** | ✅ | parziale: emette `channel-sync-done` ma nessun consumer dedicato |
| Send queue + journalist review | ✅ | ✅ (parità) |

## 3. Sovrapposizioni / criticità rilevate

1. **DAL violation** — `useLinkedInBackfill` (righe 86-94, 187-197) usa `supabase.from("channel_messages")` direttamente. Stessa identica violazione che abbiamo appena risolto su WA: va spostata in `src/data/channelMessages.ts` (helper già pronti: `getChannelContactCursor`, `upsertChannelMessageDedup`).
2. **Doppio bridge** — `useLinkedInExtensionBridge` + `useLinkedInMessagingBridge` mantengono **due heartbeat indipendenti** (poll 15s in messaging, polling in extension). Possibile consolidare via Context (stessa proposta fatta su WA).
3. **`useLinkedInSync` semplicistico** — non usa cursor: ad ogni click salva *solo* l'ultimo messaggio di ogni thread con `timestamp = now()`. **Perde messaggi** se ne arrivano 2+ tra una sync e l'altra. WhatsApp invece ha cursor per contatto.
4. **Niente auto-sync** — oggi se l'utente non clicca, non arriva nulla. Il commento in `useGlobalAutoSync` dice esplicitamente "solo manuali (click utente)". Mancanza di Chat Mode = problema identico a quello che avevamo su WA prima della tua richiesta precedente.
5. **`linkedin_connected=false` ripetuto 5 volte** in `app_settings` (chiave non univoca, leak da `useAutoConnect`). Da deduplicare via UNIQUE.
6. **Parser markdown FireScrape molto fragile** (regex su lingua IT hardcoded "gen/feb/mar…", "Tu:", "Sponsorizzata"). Rischio di salvare etichette UI come contatti — già mitigato in backfill con `LI_UI_LABELS`/`LI_GHOST_BODIES` ma non in `useLinkedInSync`.
7. **`useLinkedInBackfill` non rispetta `linkedin_send_start/end_hour`** — il backfill è lettura, non invio, ma se vogliamo coerenza con la pausa notturna serve gate.
8. **Optimus** (`optimus-client.js`, `useOptimusStatus`, `useOptimusBridgeListener`) è un sistema parallelo "agente autonomo LinkedIn" che non condivide cursor/dedup con `useLinkedInSync`. Potenziale doppia scrittura.

## 4. Validazione "accademica" — conformità best practice scraping LinkedIn

Da fonti pubbliche (LinkedIn TOS §8.2, articoli Bright Data 2024, ricerche Apify, comunità Phantombuster):
- **Limiti consigliati per account "warm"**: 80-100 InMail/sett (≈ 15-20/g), connect 100/sett, **DM a connessioni esistenti 50-80/g**.
- I nostri **50/g + 3/h** sono **conservativi e nella norma** "safe".
- **Delay 45-180s** randomizzato: standard consigliato è ≥ 30-90s tra azioni; siamo conservativi.
- **Finestra 9-19**: corretto evitare orari notturni (segnale anti-bot).
- **Pausa notturna**: necessaria, oggi mancante lato lettura.
- **Lettura inbox**: nessun limite ufficiale, ma cadenza umana = **ogni 5-15 min** se attivo, **ogni 30-60 min** se passivo. Su LinkedIn **raddoppiare i tempi WA è raccomandato** (LinkedIn ha detection più aggressiva di WA Web).

→ Conclusione: l'architettura va bene; mancano disciplina cursor + auto-sync ritmato (con cadenza ~2× WA, come hai chiesto).

## 5. Proposta di allineamento (da approvare)

### Fase A — Pareggio architettura WA (zero side-effect su invio)
1. **Estrarre query DAL** da `useLinkedInBackfill` → `channelMessages.ts` (riusare helper esistenti).
2. **Refactor `useLinkedInSync` con cursor**: nuovo `useLinkedInAdaptiveSync` (analogo a WA) che:
   - mantiene `last_seen_timestamp` per thread in `channel_messages`;
   - upserta solo nuovi messaggi (no perdita);
   - riusa `LI_UI_LABELS`/`LI_GHOST_BODIES` per filtrare ghost preview.

### Fase B — Auto-sync ritmato con cadenza 2× WhatsApp
3. Nuovo `useLinkedInAutoSync` con sequenza **doppia** rispetto a WA:
   - WA: 20/18/8/3/15/7/18/15/2/3/20 min → **LI: 40/36/16/6/30/14/36/30/4/6/40 min**.
   - Pause randomiche raddoppiate (4/10/6/4 → **8/20/12/8 min**).
   - Rispetta pausa notturna (`agent_work_start/end_hour`) come WA.
   - Pause su tab non visibile: idem WA.

### Fase C — Chat Mode LinkedIn
4. `useLinkedInChatMode` analogo a WA ma con tick **10s** (vs 5s WA), auto-attivazione se utente invia entro **60s** (vs 30s WA), spegnimento dopo **60s** silenzio (vs 30s WA). Stesso flag `__liChatModeActive` per pausare l'auto-sync.

### Fase D — Header & indicator
5. `LinkedInSyncButton` nel topbar (analogo a `WhatsAppSyncButton`), `useLinkedInNewMessagesIndicator` (consuma `channel-sync-done`).

### Fase E — Hardening
6. Deduplicare `linkedin_connected` con UNIQUE constraint.
7. Pausa notturna anche su backfill (gate `isNightTime`).
8. Audit Optimus per evitare doppia scrittura con auto-sync.

## 6. Rischi & nodi critici

- **Rate-limit detection LinkedIn**: ogni readInbox apre `linkedin.com/messaging`. Auto-sync ogni 4 min minimo è sostenibile; più frequente richiede la cautela del Chat Mode (utente attivo).
- **Backfill scroll-back** è la chiamata più "rumorosa" (apre thread, scrolla N volte): mantenere max 5 thread/sessione e gate notturno.
- **Niente API ufficiale** ⇒ ogni cambio DOM LinkedIn può rompere parser (già mitigato con AI fallback in `ai-learn.js`).
- **Hard guards di invio (50/g, 3/h)** restano identici, intoccabili.

## 7. Cosa decidere ora

a) Procediamo Fase A→E in un'unica PR?  
b) Oppure step-by-step (consiglio: A+B subito, C+D dopo verifica, E in coda)?  
c) Confermi le costanti raddoppiate (40/36/16/6/30/14/36/30/4/6/40 min, chat tick 10s, finestre 60s)?

Nessun file viene toccato finché non rispondi.
