
# Piano: da 72.800 a 100.000 / 100.000

Obiettivo: chiudere ogni eccezione tollerata (debito, warn-only, esclusioni typecheck, auth manuale non verificata, aree non misurate). Ogni fase è **atomica, reversibile, con CI verde prima di passare alla successiva** (Metodo Enterprise Vol II — niente refactor + fix insieme).

## Vincoli da rispettare (nodi critici)

Le seguenti aree NON vanno toccate in modo opportunistico durante questo lavoro: `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, cockpit submit, composer, AI draft, journalistReview, agent-loop. Se una fase richiede modifiche qui, va isolata in plan dedicato.

## Fase 1 — TypeScript blindato (+7.000 → 79.800)

1. Rimuovere `exclude[]` da `tsconfig.app.json` (7 file: 5 hooks `command/`, 1 component, 1 test, 1 prompt-lab hook).
2. Per ognuno: tipizzare o spostare in `.test-only` se davvero non riparabile.
3. Aggiungere flag a `tsconfig.app.json` **uno alla volta**, ognuno con commit separato:
   - `noUncheckedIndexedAccess`
   - `noImplicitOverride`
   - `noPropertyAccessFromIndexSignature`
   - `noUnusedLocals` + `noUnusedParameters`
   - `exactOptionalPropertyTypes` (ultimo, è il più invasivo)
4. CI: `typecheck` e `typecheck:strict` già bloccanti.

Rischio: medio. Reversibile: sì (revert tsconfig).

## Fase 2 — Azzeramento debito (+9.000 → 88.800)

Sprint a ratchet-down sulla baseline in `scripts/debt-budget.js`. Target finale `{any:0, eslintDisable:0, console:0}` ma in 4 sprint:

| Sprint | any | eslint-disable | console |
|--------|-----|----------------|---------|
| S1     | 300 | 45             | 15      |
| S2     | 200 | 25             | 8       |
| S3     | 100 | 10             | 3       |
| S4     | 0   | 0              | 0       |

Per ogni sprint:
- Migrare `any` → `unknown`/tipi specifici o `untypedFrom`.
- Rimuovere `eslint-disable` motivando con refactor o tipi.
- Migrare `console.*` → `createLogger`.
- Abbassare baseline a fine sprint.

Rischio: basso (incrementale). Reversibile: sì per ogni file.

## Fase 3 — CI completamente bloccante (+5.000 → 93.800)

In `.github/workflows/ci.yml`:
1. `BUNDLE_GUARD_WARN_ONLY: "0"` (dopo aver verificato il valore reale del bundle e settato `BUNDLE_MAX_KB` correttamente).
2. Aggiungere step: `npm run test:edge`, `npm run format:check`, `npm run typecheck:public` (creare gli script mancanti in `package.json`).
3. Nuovi workflow separati:
   - `.github/workflows/codeql.yml`
   - `.github/workflows/secret-scan.yml` (gitleaks)
   - `.github/workflows/edge-smoke.yml`
   - `.github/workflows/migration-lint.yml` (squawk o sqlfluff su `supabase/migrations/`)
   - `dependency-review.yml` esiste già — verificare `fail-on-severity: high`.

Rischio: alto sul bundle guard (può rompere PR). Mitigazione: prima misurare baseline reale, poi attivare.

## Fase 4 — Edge Function auth audit automatico (+5.500 → 99.300… ma in realtà serve riservare a fasi successive)

Nuovo script `scripts/audit-function-auth.mjs`:
1. Parsa `supabase/config.toml`.
2. Per ogni `[functions.X]` con `verify_jwt = false`:
   - DEVE essere in allowlist hard-coded (health-check, webhook firmati, oauth callback, cron con `x-cron-secret`, extension con `x-extension-key`).
   - DEVE avere commento `# AUTH:` nel toml.
   - DEVE avere test in `e2e/public-edge-auth-guards.spec.ts` o test Deno dedicato.
3. Aggiungere a `package.json`: `"audit:function-auth": "node scripts/audit-function-auth.mjs"`.
4. Aggiungere step bloccante in CI.

Rischio: basso (read-only audit). Reversibile: sì.

## Fase 5 — Test coverage 80%+ (+6.000)

1. In `vitest.config.ts` impostare thresholds: `statements:80, branches:70, functions:80, lines:80`.
2. Identificare i file sotto soglia con `vitest run --coverage`.
3. Aggiungere unit test mirati su: DAL (`src/data/`), business logic (`src/lib/`), hooks critici.
4. Separare suite:
   - `vitest` → unit
   - `e2e/smoke/*` → smoke (già esistente)
   - `e2e/*.spec.ts` full → nightly
   - test sicurezza già esistenti (`auth-guard`, `mailbox-access-guard`, `lead-status-guard`) → mantenere in CI obbligatoria
5. Step CI: `vitest run --coverage` bloccante.

Rischio: alto (richiede settimane di lavoro). Suggerimento: target intermedio 70% per chiudere fase, poi ratchet-up.

## Fase 6 — Spezzare monoliti (+4.500)

Solo file non critici, uno alla volta, senza toccare submit/cockpit/composer/AI draft:
- `src/v2/routes.tsx` → split per dominio (public/command/crm/email/ai/settings/legacy).
- Componenti >500 LOC non critici: `HarmonizeSystemDialog`, etc.
- Pagine Prompt Lab (non toccano submit).

Per ognuno: plan dedicato + E2E pre/post.

Rischio: alto se applicato ai nodi critici. Vincolo: **mai più di un file per PR**.

## Fase 7 — Security hardening completo (+7.000)

1. CodeQL workflow (Fase 3).
2. Gitleaks workflow (Fase 3).
3. CSP senza `unsafe-inline` in `src/lib/csp.ts`: spostare a nonce-based + hash. Richiede rimozione di tutti gli inline style/script. **Alto rischio** — fare ultimo.
4. Audit RLS automatico: script `scripts/audit-rls.mjs` che query `pg_policies` e verifica ownership clauses.
5. Test RBAC automatici: estendere `e2e/auth-guard.spec.ts`.
6. Test su ogni funzione service-role: censimento in `_shared/` e wrapper.
7. Log sanitization: regex check in CI che nessun `log.*` contenga `password`, `token`, `secret`, `cookie`.

## Fase 8 — PWA prudente + Documentazione (+2.500 + 2.000 → 100.000)

PWA:
1. Verificare `vite.config.ts` — Workbox runtime caching DEVE escludere `*.supabase.co/rest/*`.
2. Hook logout: pulire `localStorage`, `sessionStorage`, `caches.keys() → delete`, `navigator.serviceWorker.getRegistrations() → unregister`.
3. Test E2E: `e2e/pwa-offline-fallback.spec.ts` già presente, estendere con logout-cleanup.

Documentazione (`docs/governance/`):
- `SECURITY.md` (esiste già in root — spostare/aggiornare)
- `THREAT_MODEL.md`
- `DATA_MODEL.md`
- `RBAC_MATRIX.md`
- `AI_GOVERNANCE.md` (esiste `docs/ai/AI_INVOCATION_CHARTER.md` — estendere)
- `DEPLOYMENT_CHECKLIST.md`
- `INCIDENT_RESPONSE.md`
- `BACKUP_RESTORE.md`
- `TEST_STRATEGY.md`

## Sequenza esecuzione consigliata

Fasi 1 → 2 → 3 → 4 → 5 (target 70%) → 8-doc → 7 (senza CSP nonce) → 6 → 5 (target 80%+) → 7 (CSP nonce) → 8 PWA finale.

Motivazione: i quick win (1, 3, 4, 8-doc) sbloccano +20.000 punti in pochi giorni. Le fasi pesanti (2, 5, 6, 7-CSP) richiedono settimane e vanno spalmate.

## Cosa serve dall'utente

Prima di partire serve la decisione su:

1. **Scope**: tutte le 8 fasi end-to-end (settimane), oppure solo le quick-win (Fase 1+3+4+8-doc, ~3-4 giorni)?
2. **Tolleranza ratchet-down debito** (Fase 2): mantenere 4 sprint o accettare baseline finale `{any:50, eslint-disable:10, console:0}` come "98.000-friendly"?
3. **CSP senza unsafe-inline** (Fase 7): è invasiva su molti componenti shadcn. OK procedere o accettare CSP attuale (-1.000 punti)?
4. **Esclusioni tsconfig** (Fase 1): i 7 file esclusi vanno riparati o cancellati? Alcuni sembrano feature in pausa (`useCommandSubmit`, `useScenarioFlow`).

Una volta confermati questi 4 punti, parto **end-to-end senza ulteriori conferme** secondo memoria utente.
