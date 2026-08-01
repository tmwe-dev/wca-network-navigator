---
name: P2 Schema Hardening 2026-04-28
description: Indici composti, FK auth.users CASCADE e Zod validators per JSON columns critiche
type: feature
---
# P2 — Schema DB residuo

## P2.1 Indici composti
- `idx_partners_country_lead_status` (WHERE deleted_at IS NULL)
- `idx_imported_contacts_user_id` (WHERE deleted_at IS NULL)
- `idx_download_jobs_status_user`
- `idx_activities_partner_status` (WHERE deleted_at IS NULL)
- `idx_email_campaign_queue_status_scheduled`

## P2.2 FK enforced verso auth.users (ON DELETE CASCADE)
- agent_tasks.user_id, ai_conversations.user_id, ai_memory.user_id, import_logs.user_id
- Aggiunte NOT VALID + VALIDATE CONSTRAINT (zero downtime)

## P2.3 Zod validators (src/data/schemas/jsonValidators.ts)
- PartnerEnrichmentDataSchema (.passthrough(), evoluzione safe)
- AssignedToolsSchema (snake_case, cap 100)
- safeParse* (log + non-bloccante) / parse*Strict (throw)
- 9/9 test verdi
