## Piano v2.0 — Stato di Avanzamento

### Archivio decisioni precedenti
- Piano originale: Archiviazione 4 Volumi in `docs/metodo/` ✅
- Antipattern AI Code Generators documentato ✅

---

## STEP 1 — Fondazioni TypeScript e Infrastruttura Core ✅

**Completato l'11 aprile 2026. 42 test green.**

### File creati in `src/v2/`:

- `core/domain/entities.ts` — 11 branded ID + 10 interfacce dominio. Zero `any`.
- `core/domain/errors.ts` — Error factory 3 categorie (Domain/IO/Infra) + recovery strategies.
- `core/domain/events.ts` — 20+ tipi evento + factory `createEvent()`.
- `core/domain/result.ts` — Result monad con ok/err/map/flatMap/unwrapOr/fromPromise.
- `core/glossary.ts` — SSOT nomi dominio + nomi vietati.
- `bridge/event-bus.ts` — Event bus tipizzato con DLQ (max 3 retry).
- `bridge/circuit-breaker.ts` — 3 stati: closed/open/half-open.
- `bridge/retry.ts` — Backoff esponenziale.
- `bridge/health.ts` — Health check registry.
- `bridge/internal-logger.ts` — Logger bridge interno.
- `lib/logger.ts` — Wrapper v2 del logger v1.
- `lib/feature-flags.ts` — 10 feature flags moduli v2.
- `test/` — 6 suite, 42 test tutti green.
- Dipendenza `zod` installata.

### Prossimo: STEP 2 — IO Layer (Zod Schemas + Mappers + Query/Mutations)
