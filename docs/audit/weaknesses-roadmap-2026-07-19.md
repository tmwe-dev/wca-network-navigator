# Roadmap Debolezze — 2026-07-19

Piano ordinato per risolvere le 7 debolezze identificate dall'audit esterno.

## Stato attuale (misurato oggi)

| Metrica                     | Reale                   | Dichiarato README | Target                   |
| --------------------------- | ----------------------- | ----------------- | ------------------------ |
| Edge functions              | **150**                 | 149               | <100                     |
| File TS `src/`              | 1966 (1181 v1 + 785 v2) | ~2300             | —                        |
| Duplicati v1/v2 (candidati) | **23**                  | —                 | 0                        |
| Soppressioni ESLint prod    | **237** in 196 file     | —                 | <100                     |
| Coverage threshold          | 10% stmt / 10% lines    | 35%               | 30% stmt/lines           |
| Migrazioni                  | 400+                    | —                 | 1 baseline + <50 recenti |
| Repo pubblico               | ⚠️ SÌ                   | —                 | Privato                  |

## Deliverable già prodotti

- `docs/edge-functions-catalog.md` — auto-generato (150 righe) da `scripts/gen-edge-catalog.mjs`
- `docs/audit/v1-v2-duplicates.md` — 23 candidati con path v1/v2
- `docs/audit/eslint-suppressions.md` — 237 hit per regola e file

## Eseguito il 2026-07-19

- ✅ **E2E nightly bloccante** su 10 test critici (auth-guard, csp, prompt-injection, mailbox-access, public-edge, cron-secret, ai-invocation-charter, editorial-review, wca-risk-gate, home.smoke). Suite completa resta in modalità report-only.
- ✅ **Consolidamento `inboxPostProcess`**: `check-inbox/postProcessing.ts` ≡ `check-inbox-booking/postProcessing.ts` (identici byte-per-byte) → estratti in `supabase/functions/_shared/inboxPostProcess.ts`. Risolve il P0 #11 dell'audit (fix drift sul filter `direction`).
- ⏸️ **Duplicati v1/v2**: dei 23 candidati basename-match, la maggior parte NON sono veri duplicati (contenuti diversi). Richiede audit manuale, non elimino nulla in automatico.
- ⏸️ **Baseline migrazioni**: richiede backup DB esplicito dell'utente.
- ⏸️ **Repo privato**: azione utente su GitHub.

## Priorità (in ordine di ROI)

### P0 — Sicurezza / decisione utente

1. **Repo privato** (utente, GitHub Settings) — no cost, altissimo ROI
2. **E2E notturno bloccante** sui 10 test critici — rimuovere `continue-on-error: true` da `.github/workflows/e2e-nightly.yml`

### P1 — Riduzione superficie

3. **Edge functions 150→<100**: consolidare 5 cluster già identificati:
   - Classificatori email: 5 funzioni → 1 orchestratore (`classify-inbound-message`)
   - Scheduler: 4 motori → 1 (`unified-scheduler`)
   - Toolhandlers CRM: `_shared/toolHandlersWrite.ts` ≡ `agent-execute/toolHandlers/crmTools.ts`
   - `check-inbox` + `check-inbox-booking` con `postProcessing.ts` identico
   - Vari test/one-off funcs marcabili come `deprecated` e rimosse
   - Stima: -55 funzioni → 95 totali
4. **Duplicati v1/v2**: 23 file (elenco pronto). Eliminare v1 dopo verifica dei consumer.
5. **Baseline migrazioni**: `pg_dump --schema-only` → `supabase/migrations/00000000000000_baseline.sql`, archivio delle 400 in `supabase/migrations/_archive/`.

### P2 — Qualità

6. **Coverage ratchet incrementale**: 10% → 15% → 20% → 25% → 30% (sprint di 2 settimane ciascuno, aggiungendo test DAL + hooks).
7. **Soppressioni ESLint**: attaccare le 3 top rules che coprono >60% delle 237 hit (vedi `eslint-suppressions.md`).
8. **Sanitizzazione HTML**: sostituire regex con DOMPurify (client) + `sanitize-html` (edge). Audit dei 3 punti attuali.

### P3 — DX

9. **README auto-gen**: script che scrive header con numeri reali (edge count, migrations count, LOC) da riga di comando `pnpm docs:sync`.

## Ordine consigliato di esecuzione

```text
Week 1: (utente) repo privato → (io) E2E bloccante + duplicati v1/v2
Week 2: consolidamento classificatori email + scheduler
Week 3: baseline migrazioni + coverage a 15%
Week 4: sanitizzazione HTML + soppressioni ESLint round 1
```

Voto realistico dopo esecuzione completa: **8.5/10**.
