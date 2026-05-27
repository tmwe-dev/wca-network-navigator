
# Sprint 90k — Chiusura debito residuo + coverage reale

Obiettivo: passare da ~76k a ≥90k chiudendo i tre blocchi rimasti: coverage Vitest bassa, 24 `any` residui, PWA cache rischiosa su Supabase REST.

## Fase 1 — Coverage reale 50%+ (impatto maggiore)

Target soglie Vitest: **statements 50 / branches 65 / functions 50 / lines 50** (oggi 8/55/25/8).

Strategia: aggiungere test sui critical-path **non ancora coperti**, partendo dai moduli più piccoli e ad alto leverage:

1. **DAL `src/data/` non testati** (22 moduli da `docs/test/coverage-2026-04-14.md`): `agentPrompts`, `agentTasks`, `aiConversations`, `campaignJobs`, `cockpitQueue`, `contactInteractions`, `emailCampaigns`, `emailDrafts`, `importLogs`, `interactions`, `linkedinFlow`, `outreachPipeline`, `outreachQueue`, `partnerRelations`, `prospects`, `workPlans`, `workspaceDocs`, `clientAssignments`. Pattern già consolidato (mock supabase, export + happy/error path) → ~15 test/file.

2. **`src/lib/` puro** (utility senza dipendenze): finire test su `checkInbox`, `prefetchRoutes`, `lazify`/`lazyRetry`, `agentResponse`, `typedSupabase`. Alto rapporto LOC coperti/test scritti.

3. **Hook critici senza test** (top per LOC da coverage report): `useCalendar`, `useAgentTasks`, `useOperativeJobs`, `usePushNotifications`, `useExtensionBridge`. Mock React Query + Supabase, smoke render + 1-2 mutation path.

4. **Ratchet `vitest.config.ts`** progressivo: 8→25→40→50 in commit separati per evitare regressioni.

## Fase 2 — Azzerare i 24 `any` residui

Tutti i restanti sono concentrati in 4 file di boundary Supabase:

- `src/lib/supabaseUntyped.ts` (2 `any` sanctioned)
- `src/lib/typedSupabase.ts` (1 `any` sanctioned)
- `src/lib/lazify.ts` (2 `any` su `ComponentType`)
- `src/lib/lazyRetry.ts` (1 `any` su `ComponentType`)
- ~18 `any` distribuiti su `safeQueryExecutor`, harmonizer orchestrator, bulk-ops wrappers (vedi sprint precedente).

Approccio:
1. **`lazify`/`lazyRetry`**: sostituire `ComponentType<any>` con `ComponentType<Record<string, unknown>>` o generic libero `<P extends object>`. Zero impatto runtime.
2. **`supabaseUntyped`/`typedSupabase`**: generare tipi Supabase per le 14 tabelle in `KNOWN_UNTYPED_TABLES` via `supabase gen types` rigenerato → eliminare i wrapper. Se alcune tabelle non sono nel pubblico schema, mantenere il wrapper ma tipizzarlo come `PostgrestQueryBuilder<Database['public'], any, string>` (il singolo `any` rimasto è quello del builder PostgREST, accettabile e documentato).
3. **Altri 18**: refactor mirato file-per-file (DAL → schema Zod già esistenti dove possibile).

Target: `any ≤ 5` (solo boundary PostgREST documentati). Ratchet `scripts/debt-budget.js`.

## Fase 3 — PWA cache hardening

Service Worker (`vite.config.ts` / workbox config): rimuovere `StaleWhileRevalidate` su Supabase REST. Sostituire con:
- **NetworkOnly** per `/rest/v1/*` (dati live, mai cache stale).
- **NetworkFirst** con `maxAgeSeconds: 30` solo per endpoint read-only espliciti (es. `app_settings`, `kb_entries`).
- Mantenere `CacheFirst` per asset statici e immagini.

## Fase 4 — Eslint-disable ratchet finale

49 → ≤20: la maggior parte sono `react-hooks/exhaustive-deps` e `@typescript-eslint/no-explicit-any` su file già toccati in Fase 2. Pulizia naturale.

## Fase 5 — Validazione e ratchet finale

- `npx vitest run --coverage` → conferma soglie nuove.
- `npm run typecheck:strict` + `eslint --max-warnings 0`.
- `node scripts/debt-budget.js` → lock nuove baseline.
- Aggiornare `mem/reference/sprint-90k-2026-05-27.md` + index.
- Eseguire smoke E2E locale (8 spec) per verificare nessuna regressione.

## Risultato atteso

| Area | Oggi | Target |
|---|---|---|
| Test coverage statements/lines | 8% | ≥50% |
| `any` | 24 | ≤5 |
| `eslint-disable` | 49 | ≤20 |
| PWA cache Supabase | SWR 600s | NetworkOnly |
| **Score audit** | **~76k** | **≥90k** |

## Vincoli

- Nessuna modifica a logica business, RLS, edge functions, auth.
- Atomicità per fase: ogni fase committabile in isolamento con typecheck + test verdi.
- Nessun refactor opportunistico fuori scope.
- Le 14 tabelle `KNOWN_UNTYPED_TABLES` non vengono ridisegnate: solo tipizzate o wrappate meglio.

## Stima

~3-4 ore di lavoro AI continuo, dominate da Fase 1 (scrittura test DAL). Fase 2/3/4 sono tutte sub-30min.
