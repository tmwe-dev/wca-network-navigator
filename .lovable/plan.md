## Obiettivo

Eliminare la confusione tra "stanze" che sembrano fare la stessa cosa. Niente nuove maschere, niente nuove tabelle, niente cambi al modo in cui le email vengono prodotte e inviate. Solo **pulizia di navigazione**.

## Cosa cambia (lato utente)

### 1. Outreach → "In Uscita" — semplificato
Oggi ha 4 sotto-tab: **Da Inviare**, **Inviati**, **Programmati**, **Falliti**.
Domani avrà 2 sotto-tab: **Da Inviare**, **Inviati**.

I sotto-tab "Programmati" e "Falliti" leggevano dalla tabella sbagliata (`cockpit_queue`, che non è una coda di invio): erano fuorvianti. Vengono nascosti dalla UI.

I **badge contatori in alto** del tab vengono riallineati: oggi contano dalla tabella sbagliata, vanno fatti puntare alle stesse fonti dei sotto-tab rimasti (attività + missioni + storico).

### 2. AI Control Center → "Pending Actions" — rimossa
Mostrava le stesse cose della "Coda AI" di Outreach. Tieni solo **Outreach → Coda AI** come unico posto per le azioni AI in attesa di approvazione. La sub-view "pending" sparisce dal menu di AI Control Center.

### 3. Pagine fantasma — nascoste dai menu

- **`/v2/campaigns/jobs`** (pagina vuota, vecchio sistema): rimossa dalla navigazione e dai link interni. Se uno arriva con il vecchio URL, viene rediretto a `/v2/campaigns`.
- **Componente `CampagneTab`**: nessuno lo importava già — viene marcato come deprecato nel commento di testa (in linea con la regola "non eliminare codice in `src/components/`").
- **Hook V2 mai usati** (`useCampaignDraftsV2`, `useCampaignStatsV2`, `useEmailCampaignQueueV2`): marcati come deprecati nel commento di testa.

### 4. Cosa NON cambia

- Il **CampaignQueueMonitor dentro il Command Canvas** resta esattamente com'è: continui a vedere lì le tue mail batch in coda, con Avvia / Pausa / Cancel.
- Le tabelle `email_drafts` e `email_campaign_queue` non vengono toccate: i tuoi 5 draft + 4 record in coda restano.
- La pipeline di creazione/autorizzazione/invio email non viene toccata in questo intervento. Quella la decidiamo dopo, separatamente.
- Nessuna `cockpit_queue` viene cancellata — è solo nascosta dai sotto-tab che la mostravano in modo fuorviante.

## Dettaglio tecnico (per riferimento)

### File modificati

| File | Cambio |
|---|---|
| `src/components/outreach/InUscitaTab.tsx` | Lascia solo i sotto-tab `da-inviare` e `inviati`; ricalcola i badge contatori dalle stesse fonti dei sotto-tab |
| `src/v2/ui/pages/AIControlCenterPage.tsx` | Rimuove la sub-view `pending` dal menu interno |
| `src/v2/routes.tsx` | `/v2/campaigns/jobs` → redirect a `/v2/campaigns` |
| `src/v2/ui/templates/OrphanPagesNav.tsx` | Rimuove la voce "Campaign Jobs" |
| `src/App.tsx` | Rimuove l'alias di redirect `campaign-jobs → /v2/campaigns/jobs` |
| `src/components/outreach/ProgrammatiSubTab.tsx` | Header del file: marcato `@deprecated` (codice intatto) |
| `src/components/outreach/FallitiSubTab.tsx` | Header del file: marcato `@deprecated` |
| `src/components/outreach/CampagneTab.tsx` | Header del file: marcato `@deprecated` |
| `src/v2/hooks/useCampaignDraftsV2.ts` | Header del file: marcato `@deprecated` |
| `src/v2/hooks/useCampaignStatsV2.ts` (se presente nello stesso file sopra) | idem |
| `src/v2/hooks/useEmailCampaignQueueV2.ts` | Header del file: marcato `@deprecated` |

### File NON toccati (importanti)

- `supabase/functions/send-email`, `process-email-queue`, `generate-email`, `improve-email`, `journalistReview*`
- `email_drafts`, `email_campaign_queue`, `cockpit_queue`, `outreach_queue`, `ai_pending_actions`, `campaign_jobs` (nessuna migrazione DB)
- `CampaignQueueMonitor.tsx` (resta funzionante nel Command Canvas)

### Verifica post-modifica

- Apertura `/v2/outreach` → tab "In Uscita" mostra solo Da Inviare + Inviati, badge contatori coerenti
- Apertura `/v2/ai-control` → niente sub-view "pending", restano le altre
- Apertura `/v2/campaigns/jobs` → redirect a `/v2/campaigns`
- Apertura `/v2/command` → CampaignQueueMonitor continua ad apparire quando crei una bozza batch

## Cosa decideremo DOPO (non in questo intervento)

- Se trasformare il `CampaignQueueMonitor` in una maschera fissa nel menu (oggi hai detto "no, basta dov'è").
- Se ricollegare `outreach_queue` come coda multicanale unificata (oggi vuota, è una scelta architetturale separata).
- Se introdurre lo step "Autorizza" obbligatorio prima dell'invio per le mail batch — discusso nel turno precedente, da affrontare a parte.
