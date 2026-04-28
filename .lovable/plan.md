# Piano esecutivo — WCA Road to 100K v2 (calibrato sul reale)

Il piano v2 ricevuto è **buono** (assorbe tutti i feedback critici della v1: Whitelist Sezione 0, DoD binari, Vercel rimosso, Sentry/rate-limiter riusati). Però alcuni numeri sono ancora sottostimati e c'è un **bug runtime attivo** introdotto nei turni precedenti che va sanato per primo.

## A. Correzioni numeriche prima di partire (verifica reale)

| Metrica | Piano v2 dice | Reale (grep) | Impatto |
|---|---|---|---|
| `:any` totali | 15 (10 eliminabili) | **515** | Sprint 3 va riformulato come "ridurre a 117 (baseline `debt-budget.js`)", non "azzerare" |
| `console.error` | non quantificato | **89** | Realistico per Sprint 1 (8h) |
| `console.warn` | 67 | **70** | OK |
| Edge functions | 109 | 110 | OK |
| Test files | 227 unit + 47 E2E | 279 unit + 47 E2E | OK |

→ **Aggiornare baseline `scripts/debt-budget.js`** mano a mano che si riduce, NON imporre target irrealistici.

## B. Bug bloccante PRIMA di tutto

**`src/v2/observability/TraceConsole.tsx:102`** viola le Rules of Hooks: `if (!user) return null;` è prima di `useMemo(...)` alle righe 104 e 117 → React 18 lancia "Rendered more hooks than during the previous render" appena un anonimo apre l'app. Fix: spostare i due `useMemo` sopra il guard `!user`.

→ **Task 0 (15 min)**: fix hook order in TraceConsole. Senza questo, ogni nuovo sprint introduce regressioni invisibili dietro un crash.

## C. Sequenza di esecuzione proposta (questo turno)

Eseguo **solo la slice ad alto valore / basso rischio** del piano v2, lasciando il resto a sprint successivi (richiedono coordinamento che vale la pena fare a freddo).

### Lotto immediato (questo turno) — ~2h

1. **Fix TraceConsole** (Task 0, blocker runtime).
2. **Sprint 1 → E1**: ErrorBoundary su `ContactRecordDrawer` e principali drawer/modal. Riuso `PageErrorBoundary.tsx` esistente, no nuovo componente. *DoD: ogni drawer wrappato.*
3. **Sprint 1 → O5/O6 (slice)**: convertire `console.error/warn` a `createLogger` (esistente in `src/v2/lib/logger.ts`) **solo nei 10 file più critici** (`src/data/notifications.ts`, `src/data/analytics.ts`, `src/data/tokenUsage.ts`, `src/hooks/useGlobalChat.ts`, `src/hooks/useMissionActions.ts`, ecc.). *DoD: in quei 10 file, 0 console.\**
4. **Sprint 2 → S1**: rimuovere `localhost` da `_shared/cors.ts` quando `Deno.env.get("ENVIRONMENT") === "production"`. *DoD: test che simula prod = origin localhost rifiutata.*
5. **Sprint 2 → E5**: edge function `health-check` (nuova, ~30 LOC). *DoD: `curl /functions/v1/health-check` → 200 + JSON `{ ok, ts, version }`.*
6. **Sprint 1 → E2**: unificare error handling in `aiInvocationGuard` per loggare a Sentry tramite `captureException` (già disponibile in `src/lib/sentry.ts`). *DoD: errore AI = breadcrumb Sentry.*
7. **Aggiornare baseline `debt-budget.js`** se i conteggi scendono dopo i task O5/O6.

### Lotti successivi (NON in questo turno — richiedono PR dedicate)

- **Sprint 1 completo** (rimanenti O5/O6: 80 file): troppo invasivo per una sessione.
- **Sprint 3** (any reduction da 515 → 117): meccanico ma 4-6h di solo grep+fix.
- **Sprint 4** (test coverage 35%): richiede progettazione test, non puro coding.
- **Sprint 5** (performance + arch): richiede profiling reale.
- **Sprint 6** (AI excellence): richiede misurazioni AI lab prima.

## D. Suggerimenti aggiuntivi (oltre il piano v2)

1. **Aggiungere check anti-regressione hook order** in `eslint.config.js`: `react-hooks/rules-of-hooks: "error"`. Avrebbe prevenuto il bug TraceConsole.
2. **Sentry: abilitare il `wrap` su `<App />`**: `src/lib/sentry.ts` esiste ma va verificato che `Sentry.ErrorBoundary` sia montato in `main.tsx` come outer boundary. Se manca, l'error capture frontend è cieco.
3. **Health-check come ping per l'estensione**: l'edge function `health-check` può servire anche da heartbeat per le 6 extensions (Chrome, Email, LI, WA, RA, Partner-Connect) → unifica monitoring.
4. **Whitelist eseguibile**: aggiungere `eslint-rules/no-touch-protected.js` che fallisce se una PR modifica i file in Sezione 0 senza commento `// owner-approved: <id>`. Trasforma la whitelist da convenzione a guard.
5. **Trace Console come oracolo di regressione**: `ai_runtime_traces` (creato nei turni precedenti) può essere snapshottato pre/post sprint per detect regressioni AI silenziose. Aggiungere script `scripts/trace-snapshot.ts`.
6. **Gating progressivo coverage**: invece di gate 35% globale, gate **per cartella** (`src/v2/io/supabase/queries/` deve essere ≥ 60%, il resto libero). Più facile da rispettare, più mirato dove conta.

## E. Cosa NON faccio (e perché)

- Non tocco le 110 edge functions con un wrapper massivo: rischio rottura `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (Sezione 0).
- Non azzero i `:any` in un colpo solo: 515 occorrenze, molte legittime in test/wrapper.
- Non aggiungo `vercel.json` né staging Vercel: il piano v2 li ha già scartati correttamente.
- Non attivo rate limiting AI: memoria attiva dice "AI usage limits DISATTIVATI per uso interno" con kill-switch `AI_USAGE_LIMITS_ENABLED`.

---

## Riepilogo del lotto immediato

| # | Task | Stima | Rischio |
|---|---|---|---|
| 0 | Fix `TraceConsole` hook order (blocker) | 15 min | Nullo |
| 1 | ErrorBoundary su drawer principali | 25 min | Basso |
| 2 | Migrazione 10 file da console a createLogger | 30 min | Basso |
| 3 | CORS prod-only (no localhost in prod) | 10 min | Basso |
| 4 | Edge function `health-check` | 20 min | Nullo |
| 5 | AI errors → Sentry via aiInvocationGuard | 20 min | Medio (lo guardo prima) |
| 6 | Aggiornare baseline `debt-budget.js` | 5 min | Nullo |
| 7 | ESLint `react-hooks/rules-of-hooks: error` | 5 min | Basso |

**Tempo totale stimato: ~2h. Tutto rollbackabile per file.**

Confermi questo lotto? Se sì, eseguo in sequenza con `tsc --noEmit` come gate tra un task e l'altro.