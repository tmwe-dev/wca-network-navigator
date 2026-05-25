---
name: Audit Esterno 2026-05-13 (CHIUSO)
description: Roadmap audit esterno completata 8/8 + hardening edge pubbliche. Score finale 95.000/100k.
type: reference
---

## Stato finale (2026-05-25)
Score: **95.000/100.000** (da 66.800 baseline). Tutti gli 8 item della roadmap chiusi + edge pubbliche annotate e testate.

| # | Item | Stato | Note |
|---|------|-------|------|
| 1 | CI typecheck reale | ✅ | tsc --noEmit bloccante in CI |
| 2 | Debt+audit in CI | ✅ | debt-budget.js + audit-ai-invocations.ts gating |
| 3 | Mailbox guard server-side | ✅ | send-email verifica access ownership |
| 4 | verify_jwt lockdown | ✅ | 14/32 edge AI hardened (resto pubblico by design) |
| 5 | CSP SSOT + drift test | ✅ | src/lib/csp.ts SSOT + upgrade-insecure-requests + csp-alignment.test.ts |
| 6 | E2E guardrail coverage | ✅ | 7 spec P0 aggiunti a e2e-smoke.yml |
| 7 | Vite URL hardcoded | ✅ | loadEnv + import.meta.env, 0 hardcode |
| 8 | Query client / routing | ✅ | SSOT singleton in queryClient.ts + App.tsx |

## Punti residui (non bloccanti, fuori scope audit)
- 14 edge function con `verify_jwt = false` ora annotate in `supabase/config.toml` con pattern auth in-code (JWT user / HMAC / x-cron-secret / OAuth public). Coperte da `e2e/public-edge-auth-guards.spec.ts` che verifica rigetto 401/403 senza credenziali.
- LinkedIn dispatch queue orfana (debito noto)
- E2E nightly già gira full suite (47 spec) via `e2e-nightly.yml` con continue-on-error + report JSON. Coverage incrementale (-3000 residui) richiede stabilizzazione spec esistenti, fuori scope hardening.

## Riferimenti
- CSP: `src/lib/csp.ts`, `src/__tests__/csp-alignment.test.ts`
- E2E: `.github/workflows/e2e-smoke.yml` (15 spec smoke+guardrail), `.github/workflows/e2e-nightly.yml` (full)
- Mailbox: `supabase/functions/send-email/index.ts`
- Cron secret: Vault + cron job 37
- Edge pubbliche auth: `supabase/config.toml` (commenti `# AUTH:`) + `e2e/public-edge-auth-guards.spec.ts`
