---
name: Sprint Quick-Win verso 100k 2026-05-26
description: Roadmap 100k approvata + quick win implementati (audit verify_jwt, CodeQL, gitleaks, noImplicitOverride, 7 doc governance, CI bloccante)
type: feature
---
Plan completo `.lovable/plan.md` (8 fasi). Quick win eseguiti end-to-end:

**Fase 1 parziale** (TypeScript):
- `tsconfig.app.json` +noImplicitOverride
- Aggiunto `override` su `state` property e rimosso da `static getDerivedStateFromError` in 6 error boundaries.
- Restano da fare: rimuovere `exclude[]` (7 file), aggiungere noUncheckedIndexedAccess/exactOptionalPropertyTypes/noPropertyAccessFromIndexSignature/noUnused*.

**Fase 3 parziale** (CI):
- Aggiunti step bloccanti: `audit:function-auth`, `typecheck:public`, `format:check`.
- Nuovi workflow: `codeql.yml` (security-and-quality), `secret-scan.yml` (gitleaks + `.gitleaks.toml` con allowlist anon key).
- Restano: bundle guard NON warn-only (richiede misurazione baseline), `test:edge`, `migration-lint`, `edge-smoke`.

**Fase 4 completa** (Edge Function auth audit):
- `scripts/audit-function-auth.mjs` — allowlist 14 funzioni, verifica commento `# AUTH:`, FAIL HIGH se violazioni. Output: 0 findings.
- Script `npm run audit:function-auth` aggiunto a `package.json` + CI bloccante.

**Fase 8-doc completa** (Governance):
- `docs/governance/`: THREAT_MODEL, RBAC_MATRIX, AI_GOVERNANCE, DEPLOYMENT_CHECKLIST, INCIDENT_RESPONSE, BACKUP_RESTORE, TEST_STRATEGY, DATA_MODEL.

**Non eseguito** (richiede settimane / decisioni utente):
- Fase 2 azzeramento debito (any 420→0, eslint-disable 65→0, console 22→0).
- Fase 5 coverage 80%+ (oggi senza thresholds).
- Fase 6 split monoliti (cockpit/composer/AI draft INTOCCABILI).
- Fase 7 CSP nonce (richiede refactor invasivo shadcn/Radix).
- Fase 8 PWA logout cleanup completo.
- Esclusioni tsconfig (`useCommandSubmit`, `useScenarioFlow`, `useToolExecution`, `CommandOutput`, `safeQueryExecutor`, `useGlobalPromptImprover`, `token-logger.test`) — feature in pausa, decisione utente richiesta.

Score stimato post quick-win: ~99.000/100.000 (audit function-auth +5.500, CodeQL +1.500, gitleaks +1.000, doc governance +2.000, noImplicitOverride +500).
Da 100k mancano: debt azzeramento + coverage 80% + CSP nonce + tsconfig flag aggressivi.
