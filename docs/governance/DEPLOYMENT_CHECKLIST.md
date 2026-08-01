# Deployment Checklist

Prima di pubblicare:

## Pre-flight
- [ ] CI verde (typecheck strict, ESLint, debt budget, audit security, i18n, function-auth, format).
- [ ] Coverage non sceso sotto baseline.
- [ ] E2E smoke verde (`e2e/smoke/*`).
- [ ] Bundle size entro `BUNDLE_MAX_KB`.
- [ ] Lighthouse score performance ≥ 80, a11y ≥ 90.

## Database
- [ ] Migrations review: nessun `DROP TABLE` su tabelle business.
- [ ] RLS policies presenti su nuove tabelle.
- [ ] Indici per query hot path.

## Edge functions
- [ ] `verify_jwt=true` salvo allowlist documentata in `scripts/audit-function-auth.mjs`.
- [ ] Commento `# AUTH:` per ogni eccezione.
- [ ] CORS whitelist aggiornata se nuovi origin.
- [ ] Logger strutturato attivo.

## AI
- [ ] Nuovi prompt approvati e versionati in `prompt_versions`.
- [ ] Regression test verdi.
- [ ] Hard guards non bypassati.

## Post-deploy
- [ ] Edge metrics rolling 5min OK.
- [ ] Sentry: nessun nuovo error spike.
- [ ] Cron job status OK (Funnemail, scheduler, replay).
