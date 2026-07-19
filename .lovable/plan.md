# Piano — Bonifica sequenziale dei 7 punti dell'audit

Obiettivo: eliminare debito e duplicazioni realmente, non a suon di soppressioni. Ogni fase è indipendente e verificabile; nessun refactor opportunistico fuori scope.

## Punto 1 — Complessità: consolidamento v1→v2 per dominio

Attaccare i **6 duplicati v1 ad alto consumer count** dai 21 mantenuti, uno per volta, migrando i consumer e cancellando il v1.

Ordine (ROI decrescente, rischio crescente):
1. `src/lib/errors.ts` (2 consumer) → `@/v2/core/domain/errors`
2. `src/lib/queryKeysParts/system.ts` (1 consumer) → in-line in `queryKeys.ts`
3. `src/components/ui/EmptyState.tsx` (1 consumer) → `@/v2/ui/atoms/EmptyState`
4. `src/components/shared/EmptyState.tsx` (3 consumer, API più ricca) → estensione atom v2
5. `src/data/prospects.ts` (4 consumer) → `@/v2/io/supabase/queries/prospects`
6. `src/data/blacklist.ts` (2 consumer) → wrap intorno al tool v2

Per ogni file: `rg` dei consumer → sostituzione import → `bun run build` → cancellazione file v1.
NON tocco `partners.ts` (46 consumer, 684 LOC), `contacts.ts` (28), `activities.ts` (16), `agents.ts` (10), `tabs.tsx` (56), `PageErrorBoundary.tsx` (12): richiedono migrazione per-dominio separata, fuori scope di un singolo intervento sicuro.

## Punto 2 — Coverage reale + E2E bloccante

- E2E bloccante: **già fatto** (10 test critici in `.github/workflows/e2e-nightly.yml`).
- Ratchet coverage: alzare `vitest.config.ts` gradualmente `10 → 15%` statements/lines, scrivendo **~15 nuovi test mirati** sui moduli critici già identificati:
  - `src/v2/agent/runtime/intentClassifier.ts`
  - `src/v2/ui/pages/command/hooks/useCommandSubmit.ts` (parti pure)
  - `src/v2/agent/runtime/tools/*` (branch di validazione)
  - `supabase/functions/_shared/inboxPostProcess.ts`
  - `src/v2/core/domain/result.ts` / `errors.ts`

Threshold 15% è realistico in un giro; 30% richiede più iterazioni ed è tracciato come step successivo, non one-shot.

## Punto 3 — Soppressioni ESLint (237 → target <150)

Attaccare le 3 regole più frequenti da `docs/audit/eslint-suppressions.md`. Tipicamente:
- `@typescript-eslint/no-explicit-any` → tipare correttamente le firme di ritorno
- `no-restricted-syntax` (bypass DAL) → moving i call site più semplici dentro `src/data/`
- `react-hooks/exhaustive-deps` → aggiungere dep o memoizzare correttamente

Target: **rimuovere ~90 soppressioni** senza rompere test o build. Le restanti (framework-driven, edge cases) vengono documentate con motivazione, non lasciate silenziose.

## Punto 4 — Edge Functions 150 → <100

Consolidamento con SSOT, non cancellazioni cieche. Cluster in ordine:

A. **Classificatori email** (5 funzioni → 1 orchestratore)
   - `classify-emails-batch`, `classify-inbound-message`, `classify-inbound-content`, `funnemail-classify`, `funnemail-auto-route`
   - Estraggo la logica comune in `_shared/emailClassifier.ts`, mantengo le entry HTTP come thin wrapper. Poi mando in deprecated le funzioni ridondanti reindirizzandole all'orchestratore.

B. **Scheduler** (4 → 1)
   - `outreach-scheduler`, `funnemail-reminders-tick`, `agent-task-drainer`, `process-inbound-enrichment` condividono pattern boot→drain→shutdown. Estraggo `_shared/schedulerRunner.ts` e uno solo entry `unified-scheduler` con `mode` parameter. Cron già configurati vengono migrati.

C. **Toolhandler CRM** (`_shared/toolHandlersWrite.ts` ≡ `agent-execute/toolHandlers/crmTools.ts`)
   - Un unico modulo condiviso, elimino la copia.

D. **One-off/test funcs**: censimento e rimozione delle funzioni non chiamate da 30+ giorni (verifica via `edge_function_logs` + grep frontend).

Stima realistica: **-40/-50 funzioni** → totale ~100/110. Se <100 non è raggiungibile senza degradare feature, mi fermo e lo dico.

## Punto 5 — Repo pubblico

**Azione tua, non mia.** Fuori dalla mia superficie di scrittura. Va fatto su GitHub → Settings → Danger Zone → Change visibility → Private. Lo lascio come TODO nel report finale.

## Punto 6 — Sanitizzazione HTML (regex → librerie dedicate)

- Client: installo `dompurify` + `@types/dompurify`; sostituisco tutte le `dangerouslySetInnerHTML` con contenuto non-fidato usando `DOMPurify.sanitize()` centralizzato in `src/v2/core/security/sanitizeHtml.ts`.
- Edge (Deno): uso `npm:sanitize-html` in `supabase/functions/_shared/sanitizeHtml.ts` per email inbound rendering e KB entries.
- Grep dei 3 punti attuali che usano regex HTML → sostituzione.
- Nuovo test `src/v2/core/security/sanitizeHtml.test.ts` con vettori XSS classici (script tag, onerror, javascript:, data:text/html).

## Punto 7 — Documentazione auto-generata

- `scripts/gen-edge-catalog.mjs`: **già esiste**. Aggiungo hook pre-commit (`.husky/pre-commit`) che lo rilancia se cambiano file in `supabase/functions/`.
- Nuovo `scripts/gen-readme-stats.mjs`: legge numeri reali (edge count, migrations count, LOC, coverage effettiva da `vitest.config.ts`) e riscrive un blocco `<!-- STATS:START -->…<!-- STATS:END -->` nel README. Elimina divergenza 149/148/150 e 35%/10%.
- Aggiungo entrambi come step CI in `.github/workflows/ci.yml` (fail se README stale).

---

## Ordine di esecuzione e checkpoint

Eseguo in sequenza 1 → 2 → 3 → 4 → 6 → 7 (salto il 5, azione tua). Ad ogni punto:
1. Faccio le modifiche
2. `bun run build` verde
3. `bunx vitest run` verde
4. Aggiorno `docs/audit/weaknesses-roadmap-2026-07-19.md` con lo stato reale

Al termine: report finale con voto onesto ricalcolato, cosa è cambiato, cosa resta.

## Rischi noti

- **Punto 4 (edge consolidation)**: tocca nodi critici (cron, classificatori). Ogni merge include fallback e non elimina file finché la nuova versione non è verificata in log per un ciclo.
- **Punto 3 (ESLint)**: alcune soppressioni sono legittime (tipi di libreria esterna). Non forzo la rimozione dove il fix richiederebbe refactor di terzi.
- **Punto 6 (sanitize)**: `dompurify` funziona solo in browser; per SSR/edge servono jsdom o `sanitize-html`. Uso l'approccio corretto per contesto.

Se un punto sfora o rompe test, mi fermo lì, ti riferisco lo stato e chiedo se cambiare rotta — non forzo per completare la lista.
