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

---

## STEP 2 — IO Layer: Zod Schemas + Mappers + Query/Mutations ✅

**Completato l'11 aprile 2026. 63 test green (21 nuovi).**

### File creati:

#### Zod Schemas (`src/v2/io/supabase/schemas/`)
- `partner-schema.ts`, `contact-schema.ts`, `agent-schema.ts`, `activity-schema.ts`, `campaign-schema.ts`

#### Mappers (`src/v2/core/mappers/`)
- `partner-mapper.ts`, `contact-mapper.ts`, `agent-mapper.ts`, `activity-mapper.ts`, `campaign-mapper.ts`

#### Queries (`src/v2/io/supabase/queries/`)
- `partners.ts`, `contacts.ts`, `agents.ts`, `activities.ts`, `campaigns.ts`, `app-settings.ts`

#### Mutations (`src/v2/io/supabase/mutations/`)
- `partners.ts`, `contacts.ts`, `agents.ts`, `activities.ts`, `campaigns.ts`

#### Edge/External (`src/v2/io/`)
- `edge/client.ts` — invokeEdgeV2 con Result + circuit breaker + Zod validation
- `edge/schemas.ts` — Zod schemas per risposte edge function
- `external/wca-api.ts` — WCA API client v2 con Result + circuit breaker

#### Validators (`src/v2/core/domain/`)
- `validators.ts` — validateEmail, validateCountryCode, validateCompanyName, validateDateRange, validatePartnerInput

#### Test nuovi
- `test/io/schemas.test.ts` (7 test) — Zod parse/reject + mapper integration
- `test/core/validators.test.ts` (14 test) — validazioni dominio pure

### Prossimo: STEP 3 — Auth Completo + Profili + Ruoli (migrazione DB `user_roles`)
