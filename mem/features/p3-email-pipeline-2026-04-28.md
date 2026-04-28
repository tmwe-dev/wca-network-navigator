---
name: P3 Email Pipeline 2026-04-28
description: Delivery events table + webhook + SMTP rate limit DB-based con kill-switch
type: feature
---
# P3 — Email Pipeline residuo

## P3.1 Delivery events
- Tabella `email_delivery_events` (event_type, recipient_email, message_id, campaign_queue_id, smtp_code, diagnostic_code, reason, raw_payload, occurred_at).
- Trigger `apply_email_delivery_event`:
  - bounce_hard/bounce_soft → email_campaign_queue.status='bounced'
  - complaint → 'complained'
  - rejected → 'failed'
  - opened → bump opened_at + open_count
- Edge function `email-delivery-webhook` (verify_jwt=false):
  - Auth shared-secret `EMAIL_WEBHOOK_SECRET` (timing-safe compare)
  - Validazione Zod, supporta single event o `{events: [...]}` batch ≤500
  - Insert in bulk; il trigger fa il resto.
- RLS: SELECT solo admin; INSERT/UPDATE/DELETE solo via service role.

## P3.2 Post-send hook
GIÀ COPERTO da `runPostSendPipeline` (LOVABLE-85) chiamato per ogni item in `process-email-queue`. Inserisce activity con status='completed', escalation lead_status, increment partner counters.

## P3.3 SMTP rate limit per-utente
- `_shared/smtpRateLimit.ts`: conta `email_send_log` (status=sent, ultima ora) per user_id.
- Cap configurabile via `app_settings` key `smtp_rate_limit_per_hour` (default 50).
- Kill-switch `AI_USAGE_LIMITS_ENABLED`: se OFF (uso interno), funzione no-op (allowed=true sempre).
- Integrato in `process-email-queue`: se cap → draft paused, batch break, riprende next tick.
- 3/3 test verdi.

## Setup operativo
Per attivare il webhook:
1. Configurare secret `EMAIL_WEBHOOK_SECRET` su Lovable Cloud.
2. Configurare l'ESP/SMTP per inviare eventi POST a `/functions/v1/email-delivery-webhook` con header `x-webhook-secret`.
3. (Opzionale) per attivare rate limit: `AI_USAGE_LIMITS_ENABLED=true` + insert in `app_settings(user_id, key='smtp_rate_limit_per_hour', value='50')`.
