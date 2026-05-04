---
name: Funnemail Policy Dispatcher
description: Funnemail = persona AI (agents.name='Funnemail', id 8421500a-9170-49ee-8eff-9c35bd18ccf3) curatrice della casella inbound. Solo email. Policy per gruppo via email_sender_groups.funnemail_policy + funnemail_enabled. Hook fail-safe in classify-inbound-message → _shared/funnemailDispatcher.ts. Idempotenza per (message_id, action) su funnemail_actions_log. Mai bypass journalistReview, mai invio diretto, mai tocca check-inbox/email-imap-proxy/process-email-queue. UI: 5° tab "Funnemail" in /v2/email-intelligence con editor policy per gruppo + tail azioni live.
type: feature
---
