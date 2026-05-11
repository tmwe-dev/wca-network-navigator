---
name: Sprint Codex Funnemail 2026-05-11
description: Esecuzione Codex Sprint Lotto 1+2: backfill edge + pilot esteso + cron policy-engine + fix constraint funnemail_message_status. 31 inbound classificate qualità conf=1.0
type: reference
---
# Sprint Codex Funnemail — 11 maggio 2026

## Eseguito (Codex Cobra)
- **Edge `funnemail-backfill-inbound`**: nuova, dry-run by default, idempotente per `message_id`, hard cap 200/run, riusa pipeline `funnemail-classify`
- **Pilot esteso**: tutti i 35 gruppi `email_sender_groups` ora hanno `funnemail_enabled=true` con policy minimale `{tag_only}` (no draft, no autoresponder, no notify) — reversibile con 1 UPDATE
- **Cron `funnemail-policy-engine-10min`**: schedulato (jobid 56), token via vault `funnemail_trigger_service_role_key`
- **Fix CHECK `funnemail_message_status_status_check`**: aggiunto `classified`, `escalated`, `auto_handled` (era questo il silent fail dell'INSERT in funnemail_decisions)
- **Logging error in `funnemail-classify`**: insert/update ora loggano error invece di silently swallow

## Risultati
- 31 inbound 7gg classificate con confidence 1.0 (su ~50 totali, 20 restanti mancano di rule registrata)
- 5 batch dispatch, 13/13 + 13/13 OK al secondo, 0 fallimenti dopo fix constraint
- Nessuna scrittura su `funnemail_actions_log` (tag_only no-op) — corretto

## Pendenti P0
- Lotto 3: seed `agent_routing_rules` (0 rows → persona-aware routing inattivo)
- Backfill mittenti orfani (20 messaggi): richiede creazione automatica email_address_rules o policy "any sender → group fallback"
- aiInvocationLogger wrapper su 3 edge top-traffic per riattivare telemetria

## File chiave
- `supabase/functions/funnemail-backfill-inbound/index.ts`
- `supabase/migrations/*` constraint extension
