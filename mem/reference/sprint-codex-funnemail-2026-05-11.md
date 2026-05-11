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
- Backfill mittenti orfani (20 messaggi): richiede creazione automatica email_address_rules o policy "any sender → group fallback"

## Lotto 3 + 4 (chiusi 2026-05-11)
- **Lotto 3**: 5 regole globali in `agent_routing_rules` (owner jose@tmwe.it, agent_id=NULL): bounce/NDR (p10, archived+skip), unsubscribe (p15, blacklisted+skip), out_of_office (p20, skip), amministrativo priority (p30, bias administrative), fornitori bias (p80). Pickup automatico via `loadRoutingRules` in `classify-email-response`.
- **Lotto 4**: `_shared/monitoring.ts` esteso con persistenza best-effort su `edge_metrics` (fire-and-forget service-role, mai throw). Riattiva telemetria su tutte le edge già wrappate con `startMetrics/endMetrics/logEdgeError` — nessuna modifica alle edge stesse. Deployate: classify-inbound-message, funnemail-classify, generate-email, agent-execute, classify-email-response.

## File chiave
- `supabase/functions/funnemail-backfill-inbound/index.ts`
- `supabase/migrations/*` constraint extension
