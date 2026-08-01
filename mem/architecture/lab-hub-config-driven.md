---
name: Lab Hub Config-Driven
description: Tutti i tool di test/lab/prompt/observability/charts vivono in /v2/lab; sorgente unica src/v2/config/labTabs.ts (una riga per tab)
type: feature
---

## Regola
- Aggiungere un nuovo strumento di test/diagnostica/QA = aggiungere UNA riga in `src/v2/config/labTabs.ts` (LAB_TABS).
- Mai creare nuove rotte top-level per pagine "lab-style"; aggiungerle al config.
- I path legacy (`/v2/email-lab`, `/v2/ai-test-hub`, `/v2/prompt-lab/*`, `/v2/pipeline-traces`, `/v2/ai-interactions-log`, `/v2/token-cockpit`, `/v2/settings/{diagnostics,telemetry,observability,health,e2e-status,alert-routing,brand-voice,prompt-lab,prompt-reader}`, `/v2/design-system-preview`) reindirizzano a `/v2/lab?group=<group>&tab=<tab>`.

## Architettura
- `src/v2/config/labTabs.ts`: SSOT con 22 tab raggruppate in 4 group (tests, prompts, observability, design). Schema `{ id, label, icon, group, Component (lazy), legacyPath }`.
- `src/v2/ui/pages/LabPage.tsx`: presenta group selector + tab pills, deep-link `?group=&tab=`, lazy + ErrorBoundary, nessuna business logic.
- `src/v2/navigation/registry.ts`: gruppo "Lab & Verifiche (hub)" punta a `/v2/lab?group=...`. Le voci vecchie sparse sono state rimosse.

## Codex
- SC:DEFENSE: zero modifiche a edge functions, AI, DB, business logic.
- SC:ROLLBACK: rimuovere `labTabs.ts` e ripristinare i 7 tab hardcoded; redirect path eliminabili.
- SC:ANTI: pagine importate as-is, nessun refactor opportunistico.
