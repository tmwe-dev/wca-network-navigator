---
name: Audit Esterno 2026-05-13 (CHIUSO)
description: Roadmap audit esterno completata 8/8. Score finale 92.500/100k.
type: reference
---

## Stato finale (2026-05-25)
Score: **92.500/100.000** (da 66.800 baseline). Tutti gli 8 item della roadmap chiusi.

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
- 18 edge function pubbliche restano pubbliche per design (webhook/extension)
- LinkedIn dispatch queue orfana (debito noto)
- E2E nightly espansione (coverage attuale: 8 smoke + 7 guardrail)

## Riferimenti
- CSP: `src/lib/csp.ts`, `src/__tests__/csp-alignment.test.ts`
- E2E: `.github/workflows/e2e-smoke.yml`
- Mailbox: `supabase/functions/send-email/index.ts`
- Cron secret: Vault + cron job 37
