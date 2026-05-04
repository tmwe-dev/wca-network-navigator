---
name: Group-Aware Classification + Operative Dispatcher
description: F1-F5 del piano prompt-audit-2026-05-04. classify-email-response inietta SENDER GROUP e blocca promozioni lead da gruppi non commerciali (getNextStatusGated). Tabelle inbound_operative_actions e wake_up_rules pronte. Campi hint su email_sender_groups.
type: feature
---
- `classify-email-response` joina `email_sender_groups` via group_id e inietta blocco `## SENDER GROUP` nel prompt.
- `getNextStatusGated(currentStatus, classification, senderGroup)` blocca escalation lead se gruppo ∈ {amministrazione, fornitori, system, internal, support_provider, administrative, providers, newsletter}. Solo `unsubscribe`/`bounce` passano sempre.
- `inbound_operative_actions(group_name, category, action_type, default_assignee, sla_hours)` — pronta per dispatch automatico, edge `dispatch-inbound-action` da implementare quando l'utente configura regole.
- `wake_up_rules(group_name, min_score, days_dormant, channel, max_per_day)` — pronta; smart-scheduler legge ancora costanti, da migrare al primo uso reale.
- `email_sender_groups.classification_hint / response_style_hint / auto_action_default` — campi per editor UI per-gruppo.
- Nuovi prompt operativi: Group-Aware Classification (90), Operative Dispatcher Routing (80), Wake-Up Composer (75) — caricati per ogni user esistente.
- Reports: /mnt/documents/prompt-audit.md, /mnt/documents/pipeline-coverage.md.
