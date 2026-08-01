---
name: TMWE Inbound Triage & WhatsApp Alerts
description: KB doctrine TMWE/Find Air, prompt operativo "Inbound Triage TMWE" (priority 95), tabelle alert_recipients/alert_dispatch_log, edge dispatch-urgent-alert, UI /v2/settings/alert-routing
type: feature
---

## Doctrine inbound (KB priority 100)
5 categorie business: operations, administrative, commercial_demand, commercial_supply, noise.
Priorità: ops/admin URGENT > commercial_demand > commercial_supply > noise.
Identità: Transport Management Srl (TMWE) + piattaforma Find Air (cargo/express/ground real-time booking).

## Triage prompt
"Inbound Triage TMWE" (priority 95) classifica ogni inbound con:
- business_category (enum 5 valori)
- urgency_score 0-100 (open-ended)
- should_alert + alert_categories
- suggested_summary_for_alert (max 280 char per WhatsApp)

## Alert routing
- Tabella `alert_recipients` (whatsapp_e164, categories, min_urgency_score, quiet_hours, timezone, is_active).
- Tabella `alert_dispatch_log` con idempotenza per (recipient_id, message_id).
- Edge `dispatch-urgent-alert`: bypassa journalistReview SOLO per template alert (is_system_alert=true), invia via extension_dispatch_queue WhatsApp.
- Helper `_shared/inboundTriage.ts` invocato fire-and-forget da `classify-inbound-message`.
- UI CRUD: `/v2/settings/alert-routing` (AlertRoutingPage), DAL `src/data/alertRecipients.ts`.

## Voce menu
Linkata in SettingsPage > Sistema & Admin > "Alert Routing (WhatsApp)".
