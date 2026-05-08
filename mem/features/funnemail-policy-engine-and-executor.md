---
name: Funnemail Policy Engine + Executor
description: Sprint 3 — taxonomy enum + funnemail_policy table + edge functions policy-engine/policy-executor con idempotency e hard guards
type: feature
---

# Funnemail Policy Engine + Executor (Sprint 3)

## Taxonomy
Enum DB `funnemail_action_type`:
`tag_only | deep_search | draft_reply | crm_update | imap_action | escalate | autoresponder | snooze`

`funnemail_actions_log` esteso con colonne `action_type` (enum) e `idempotency_key` (text).
Indice unico facoltativo `funnemail_actions_log_idem_uq` su `(message_id, idempotency_key)` quando `idempotency_key IS NOT NULL`.

## Per-user override
Tabella `funnemail_policy(user_id, scope, match_value, enabled, priority, policy jsonb)`.
Scope: `sender > domain > group > global`. RLS: solo proprietario.

RPC `resolve_funnemail_policy(user_id, from_address, group_id)` ritorna la policy effettiva (priorità scope + priority ASC).

## Edge functions
- `funnemail-policy-engine`: risolve policy + costruisce piano azioni (no side-effect). Auth: internal token o JWT utente.
- `funnemail-policy-executor`: esegue UNA action idempotentemente.
  - Hard guard `draft_reply`: solo log "queued", esecuzione delegata all'orchestratore outreach (journalistReview enforced lì).
  - Hard guard `autoresponder`: solo log "queued", esecuzione delegata a `funnemail-send-autoresponder` (template-only, eccezione approvata).
  - `tag_only/crm_update/snooze/escalate`: log idempotente (status=ok).
  - `imap_action/deep_search`: claim + delega ai flussi esistenti.

`funnemailDispatcher.ts` aggiornato per popolare automaticamente `action_type` e `idempotency_key` (default = nome action) sui claim esistenti.

## Smoke test 2026-05-08
- engine: scope=none, plan=[] su mittente sconosciuto ✅
- executor: tag_only → claimed=true, retry → claimed=false reason=duplicate ✅