# Test Strategy

## Piramide
- **Unit (vitest)** — DAL (`src/data/`), utility (`src/lib/`), reducer, helper puri. Target: 80% line coverage.
- **Component (vitest + RTL)** — atomi/molecole. Target: smoke render + interaction principali.
- **Integration (vitest)** — hook + DAL + Supabase wrapper. Mock `supabase` client.
- **Edge (Deno test)** — funzioni edge: `_shared/*`, auth guards, JSON validator, sanitizer.
- **E2E smoke (Playwright, su PR)** — auth, onboarding, contact CRUD, command, deep search, V2 nav.
- **E2E full (Playwright nightly)** — tutti gli spec `e2e/*.spec.ts`.
- **A11y (axe-core su E2E)** — route pubbliche + 5 critical.

## Security tests
- `e2e/auth-guard.spec.ts` — protezione route.
- `e2e/mailbox-access-guard.spec.ts` — ownership server-side.
- `e2e/lead-status-guard.spec.ts` — transizioni controllate.
- `e2e/public-edge-auth-guards.spec.ts` — auth in-code per funzioni `verify_jwt=false`.
- `e2e/prompt-injection-high-block.spec.ts` — block AI su pattern HIGH.

## AI tests
- `prompt-test-runner` — regression su `prompt_test_cases`.
- AI Lab — eval flow campaign output.

## CI gating
Bloccanti: unit + edge + smoke E2E + a11y + bundle + lint + typecheck strict + debt budget + function-auth.
Non bloccanti (warn): Lighthouse, i18n parity (eccetto inferiore a soglia).
