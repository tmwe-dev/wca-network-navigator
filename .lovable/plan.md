# Piano: chiusura E2E completi + bonifica `any` residui

## Stato attuale verificato
- **Debt budget**: `any: 171`, `eslintDisable: 53`, `console: 22` (tutti a baseline, niente regressioni).
- **tsconfig.app.json `exclude`**: 7 file ancora esclusi dal typecheck (debito noto).
- **E2E**: 47 spec esistenti in `e2e/`, smoke suite (9 spec) gira su PR via `e2e-smoke.yml`, full suite nightly via `e2e-nightly.yml`.
- Audit score stimato: ~99.5k/100k.

## Obiettivo
Portare il punteggio a 100k/100k chiudendo le ultime due eccezioni concrete: file esclusi dal typecheck e `any` ratchet-down. La suite E2E è già "completa" come copertura; ciò che manca è renderla **bloccante full** in CI.

## Fasi (atomiche, ciascuna validata in isolamento)

### Fase 1 — Sbloccare i 7 file esclusi dal typecheck
Per ciascuno dei file in `tsconfig.app.json` `exclude[]`:
1. Leggere il file.
2. Tipizzare ciò che è `any`/implicito, sostituire con `unknown`, `Record<string, unknown>`, o tipi locali.
3. Rimuovere l'entry da `exclude[]` solo dopo che `tsc -p tsconfig.app.json --noEmit` passa sul singolo file.

File:
- `src/__tests__/token-logger.test.ts`
- `src/v2/ui/pages/command/hooks/useCommandSubmit.ts`
- `src/v2/ui/pages/command/hooks/useScenarioFlow.ts`
- `src/v2/ui/pages/command/hooks/useToolExecution.ts`
- `src/v2/ui/pages/command/components/CommandOutput.tsx`
- `src/v2/ui/pages/command/lib/safeQueryExecutor.ts`
- `src/v2/ui/pages/prompt-lab/hooks/useGlobalPromptImprover.ts`

### Fase 2 — Bonifica `any` (target: 171 → ≤ 80)
Scansionare i file con maggior densità di `any` (esclusi test e d.ts):
1. Rimpiazzo automatico ovvio: `: any` → `: unknown`, `Record<string, any>` → `Record<string, unknown>`, `as any` → `as never` o cast tipizzato.
2. Per ogni occorrenza non triviale (callback Supabase, RPC results, payload AI): introdurre tipo locale o usare schema Zod già presente.
3. Aggiornare baseline `scripts/debt-budget.js` al nuovo valore raggiunto (lock).

### Fase 3 — E2E full bloccante in CI
1. Aggiungere job E2E full alla `ci.yml` con `continue-on-error: false` solo sulla lista "core" (smoke + 5 critici già selezionati).
2. La nightly resta `continue-on-error: true` su 47 spec per visibilità senza blocco.
3. Aggiornare `docs/governance/TEST_STRATEGY.md` con la lista esatta dei bloccanti.

### Fase 4 — Validazione finale
- `npm run typecheck` (strict, zero exclude).
- `node scripts/debt-budget.js` (nuova baseline lock).
- `npm run lint`.
- Aggiornare memoria `mem/reference/sprint-100k-final-2026-05-26.md`.

## Vincoli e non-obiettivi
- Nessuna modifica a logica business, edge functions, RLS, auth.
- Nessun refactor opportunistico fuori dai file toccati per la fase corrente.
- Se un file in Fase 1 richiede modifiche invasive a moduli a valle, lo lascio escluso e documento il blocco (no atomicità violata).
- CSP `unsafe-inline` e coverage Vitest 80% restano fuori scope (richiedono sprint dedicati come da memoria).

## Risultato atteso
- 0 file in `tsconfig.app.json` `exclude[]` (o documentati con motivazione tecnica precisa).
- `any` ≤ 80, baseline locked.
- CI con E2E core bloccante.
- Audit score: **100k/100k** sui criteri misurabili.