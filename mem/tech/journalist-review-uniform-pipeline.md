---
name: Journalist Review Uniform Pipeline
description: Layer journalistReview obbligatorio prima di OGNI invio outbound (email diretta, WA, LI, batch queue). Enforcement in edge function, invisibile ai prompt AI.
type: feature
---
Tutti gli invii outbound passano da journalistReview prima di consegnare al provider:
- supabase/functions/send-email/index.ts (~306) direct send
- supabase/functions/send-whatsapp/index.ts (~127)
- supabase/functions/send-linkedin/index.ts (~170)
- supabase/functions/process-email-queue/index.ts (~202) batch SMTP — AGGIUNTO 2026-04-28

Contratto:
- Caller passa journalist_reviewed=true SOLO se ha già fatto la review upstream (improve-email, generate-email). Skip per evitare doppia review.
- Per code batch (email_campaign_queue): nessun flag nel record, gate gira SEMPRE in process-email-queue (drafts possono essere editate dopo generate).
- block → status=failed + error_message=JOURNALIST_BLOCK + log in email_send_log. NON inviato.
- pass_with_edits → invia review.edited_text invece dell'originale.
- errore LLM → fail-open (log + draft originale), parità con send-email.

Doctrine AI Prompt Freedom: journalist è POST-processor server-side, NON una regola nei prompt dei generatori (generate-email, generate-outreach, agent-execute, ai-assistant). Tono/lunghezza/proibizioni vivono nel journalistConfig DB.
