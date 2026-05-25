---
name: Cron Cleanup 2026-05-25
description: Rimosso cron rotto funnemail-policy-engine-10min (400 ogni 10min, edge per-message chiamato senza body). Aggiunto cron retention ai_interaction_log >180gg (jobid 63, 03:17 UTC).
type: reference
---

## Contesto
Audit interno post-Codex 2026-05-25. Tre interventi proposti, due eseguiti.

## Eseguito
- **Unschedule** `funnemail-policy-engine-10min`: chiamava edge per-message senza `message_id`/`from_address` → 400 immediato, zero side effect, solo rumore log. Era stato creato in Sprint Codex Funnemail 2026-05-11 (jobid 56) ma mai funzionante.
- **Schedule** `ai-interaction-log-retention-daily` (jobid 63, `17 3 * * *`): DELETE righe >180gg. Oggi 143 righe / 184kB, preventivo.

## Skipped
- **KB dedup**: 0 duplicati attivi (titolo+contenuto) su `kb_entries` con `deleted_at IS NULL AND is_active=true`. L'audit 2026-05-02 risulta già chiuso da operazioni precedenti.

## Rollback
- Re-schedule cron rimosso: vedi command originale in chat 2026-05-25 (POST `funnemail-policy-engine` con `x-internal-token` da Vault, body `{source:'cron',triggered_at:now()}`). NON re-abilitare senza prima sistemare l'edge per accettare modalità batch.
- Disabilitare retention: `SELECT cron.unschedule('ai-interaction-log-retention-daily');`

## Debito residuo
- Se serve davvero un'esecuzione policy batch periodica, va progettato un nuovo edge (`funnemail-policy-batch`) che selezioni messaggi `unclassified` pendenti e chiami `funnemail-policy-engine` per ognuno. Out-of-scope di questo intervento.