---
name: Sprint 3 Type-Safety + Logger Migration
description: Riduzione debt 2026-04-28 — any 496→440, console 153→81. Pattern untypedFrom + createLogger.
type: feature
---
- `:any` totali src: 496 → 440 (-56). `console.*`: 153 → **22** (-131, di cui 81→22 nel batch finale).
- Sprint 3 batch finale: 46 file produzione migrati con script `/tmp/migrate-console.mjs` (regex-based: console.X(msg, ctx) → log.X(msg, {error: ctx})). Restano 22 console autorizzati (logger interno, error boundaries, telemetry).
- `:any` in produzione (escluso test/.d.ts): solo **44** residui — i restanti 396 sono test mock e definizioni ambient.
- Baseline `scripts/debt-budget.js` aggiornata a {any: 420, eslintDisable: 65, console: 22}.
- Round 2: rimossi 20 `any` espliciti UI/hooks (NotificationsPage Select cast, TokenBudgetGauge Badge variant, AgentTasksPage, useExport, useInboundNotifications payload type). Eliminati 7 `eslint-disable @typescript-eslint/no-explicit-any` sostituendo `(supabase as any).from(...)` e module-level cast con `untypedFrom` o oggetto `{from: untypedFrom}`.
- Sostituito `(supabase as any).from(...)` con `untypedFrom(...)` (SSOT in `src/lib/supabaseUntyped.ts`) in: `src/data/rbac.ts`, `src/data/calendar.ts`, `src/data/promptLabGlobalRuns.ts`, `src/v2/io/supabase/mutations/conversations.ts`.
- Migrato `console.error/warn` → `createLogger("module").error/warn` con context object `{ error }` su 13 file top (data/, hooks/, prompt-lab/harmonizer*, email-intelligence/management).
- Pattern obbligatorio per future migrazioni logger: `log.error("messaggio", { error: e })` — secondo argomento DEVE essere `Record<string, unknown>`, non `unknown` raw.
