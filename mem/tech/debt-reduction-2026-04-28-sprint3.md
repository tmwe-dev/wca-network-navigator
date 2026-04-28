---
name: Sprint 3 Type-Safety + Logger Migration
description: Riduzione debt 2026-04-28 — any 496→440, console 153→81. Pattern untypedFrom + createLogger.
type: feature
---
- `:any` totali src: 496 → 440 (-56). `console.*`: 153 → 81 (-72).
- Sostituito `(supabase as any).from(...)` con `untypedFrom(...)` (SSOT in `src/lib/supabaseUntyped.ts`) in: `src/data/rbac.ts`, `src/data/calendar.ts`, `src/data/promptLabGlobalRuns.ts`, `src/v2/io/supabase/mutations/conversations.ts`.
- Migrato `console.error/warn` → `createLogger("module").error/warn` con context object `{ error }` su 13 file top (data/, hooks/, prompt-lab/harmonizer*, email-intelligence/management).
- Baseline `scripts/debt-budget.js` aggiornata a {any: 440, console: 81} (ratchet-down policy).
- Pattern obbligatorio per future migrazioni logger: `log.error("messaggio", { error: e })` — secondo argomento DEVE essere `Record<string, unknown>`, non `unknown` raw.
