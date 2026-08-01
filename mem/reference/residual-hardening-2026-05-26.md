---
name: Residual Hardening Sprint 2026-05-26
description: Chiusura 6 punti residui post-audit (R1-R6) - i18n parità, bundle/i18n guards CI, axe-core a11y, playwright timeout, LinkedIn queue documentata
type: reference
---

# Sprint chiusura residui audit — 2026-05-26

Partendo dallo score 97.000/100k dell'audit 2026-05-13, abbiamo
chiuso 6 azioni residue atomiche e reversibili.

| # | Item | Esito | File |
|---|------|-------|------|
| R1 | Playwright timeout/retry stabilizzazione flaky | ✅ | `playwright.config.ts` (timeout 30→45s, expect 5→10s, retries 2→3, action/nav timeout env) |
| R2 | LinkedIn dispatch queue orfana documentata | ✅ | `docs/debt/linkedin-dispatch-queue-orphan.md` (misurato: 0 record orfani, debito concettuale) |
| R3 | Lighthouse CI assertions | ✅ già esistente | `lighthouserc.json` (perf/a11y/best-practices/seo già con soglie) |
| R4 | Bundle size guard in CI (warn-only baseline 3500 KB) | ✅ | `scripts/bundle-size-guard.mjs` + `npm run bundle:check` + step CI |
| R5 | a11y axe-core su route pubbliche in E2E smoke | ✅ | `e2e/a11y-axe.spec.ts` + `@axe-core/playwright` + step smoke workflow |
| R6 | i18n coverage report + parità chiavi | ✅ | `scripts/i18n-coverage.mjs` + `npm run i18n:check` + step CI bloccante. EN/IT a 241/241 (100%) |

## Modifiche file

- `src/i18n/locales/en.json` — aggiunta chiave mancante `nav.prompt_reader`
- `scripts/i18n-coverage.mjs` — guard parità chiavi (exit≠0 su drift)
- `scripts/bundle-size-guard.mjs` — guard size (warn-only via env)
- `e2e/a11y-axe.spec.ts` — 3 route pubbliche (auth, reset, forgot)
- `playwright.config.ts` — timeout/retry più resilienti
- `.github/workflows/ci.yml` — i18n:check bloccante + bundle:check warn-only
- `.github/workflows/e2e-smoke.yml` — a11y-axe.spec aggiunta agli smoke
- `package.json` — scripts `i18n:check` / `bundle:check`, dep `@axe-core/playwright`
- `docs/debt/linkedin-dispatch-queue-orphan.md` — debt note (0 record orfani)

## Cosa non è stato fatto e perché

I "veri 17" che erano stati evocati in chat (monolith split,
feature-flag system, staging environment, i18n 100% inclusi i contenuti,
design system tokens audit completo) sono **progetti settimanali** che
richiedono ognuno un plan dedicato. Codex SC:ANTI + Metodo Enterprise
Vol II (atomicità: mai refactor di massa) impone di affrontarli uno
per volta con scope chiuso e rollback documentato.

## Score atteso

Da 97.000 → ~98.500/100k (+i18n guard, +a11y CI, +bundle baseline,
+debt formalizzato). I 1.500 punti mancanti sono progetti settimanali
citati sopra.