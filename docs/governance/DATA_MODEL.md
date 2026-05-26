# Data Model — Sintesi

Tabelle business soggette a soft-delete trigger globale (15): partners, contacts, business_cards, emails, conversations, messages, prompts, campaigns, missions, jobs, ecc.

## Domini
- **Identità**: `auth.users`, `profiles`, `user_roles`, `authorized_users`.
- **CRM**: `partners`, `contacts`, `business_cards`, `partner_interactions`.
- **Comunicazione**: `emails`, `conversations`, `messages`, `extension_dispatch_queue`, `channel_backfill_state`.
- **AI**: `operative_prompts`, `prompt_versions`, `prompt_test_cases/runs`, `agent_personas`, `agent_capabilities`, `ai_interaction_log`, `ai_pending_actions`, `ai_scope_registry`.
- **Campaign/Outreach**: `campaigns`, `cadences`, `outreach_*`, `missions`, `mission_steps`.
- **Governance**: `supervisor_audit_log`, `prompt_injection_reviews`, `edge_metrics`, `funnemail_message_claims`.
- **WCA**: `wca_cookies`, `wca_checkpoints`, `import_logs`.

## Vincoli architetturali
- FK verso `auth.users` solo via `user_id` (no riferimenti diretti in business).
- Soft-delete via colonna `deleted_at`; trigger DB intercetta `DELETE` e converte in `UPDATE`.
- RLS RESTRICTIVE su tabelle con soft-delete: record con `deleted_at IS NOT NULL` invisibili.
- Soft-link `transferred_to_partner_id` per dedup CRM lifecycle.
- `prompt_versions` snapshot immutabili via trigger BEFORE UPDATE.

## Indici hot path
- `partners(created_by, deleted_at)`, `emails(mailbox_id, received_at DESC)`, `messages(conversation_id, created_at)`, `ai_interaction_log(scope, created_at DESC)`.
