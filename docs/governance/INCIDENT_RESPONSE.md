# Incident Response

## Severità
- **SEV1** — Data loss, breach, app down >5min.
- **SEV2** — Funzionalità critica rotta (send-email, auth, CRM).
- **SEV3** — Degrado parziale, workaround disponibile.
- **SEV4** — Bug cosmetico/UX.

## Flusso SEV1/SEV2
1. **Detect**: Sentry alert, Discord webhook, segnalazione utente.
2. **Acknowledge** entro 15min (SEV1) / 1h (SEV2).
3. **Contain**: feature flag off, rollback prompt via `rollback_prompt_to_version`, disable cron sospetto.
4. **Eradicate**: fix in branch dedicato, hot-deploy.
5. **Recover**: verifica edge metrics, smoke E2E.
6. **Post-mortem** entro 48h (no-blame).

## Rollback rapido
- **App**: revert su Lovable history.
- **DB**: nuova migration revert (mai editare migration esistenti).
- **Edge function**: re-deploy versione precedente.
- **Prompt**: `SELECT rollback_prompt_to_version(<id>, <ver>);`.
- **AI off**: env `AI_USAGE_LIMITS_ENABLED=true` + abbassare quota a 0.

## Contatti
- Owner tecnico, supporto Lovable, Supabase support (Cloud).
