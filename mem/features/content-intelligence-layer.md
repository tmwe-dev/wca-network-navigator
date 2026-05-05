---
name: Content Intelligence Layer (Strato 2 inbound)
description: classify-inbound-content legge il CONTENUTO mail con contesto pieno (mittente+history+holding+doctrine) e propone azioni senza eseguirle. Tabella email_content_intelligence + prompt operativo content-intelligence editabile da Prompt Lab.
type: feature
---
Step 1 attivo (lettura passiva, fail-safe). Step 2 (emit_pending_actions) opt-in, default OFF.

- Tabella `email_content_intelligence` (uniq message_id), RLS user-scoped.
- Edge `classify-inbound-content`: input {message_id, from_address, subject, body_text, partner_id?, user_id?, force?, emit_pending_actions?}.
- Output: content_label (libero), intent_summary, business_value, urgency, target_role, continuity, reasoning, confidence, suggested_actions[].
- NESSUN enum chiuso sui campi semantici. Le regole vivono nel prompt operativo `content-intelligence` (Prompt Lab, editabile).
- Contesto iniettato: system_doctrine + partner passport + partner_outreach_state (holding) + ultime 10 channel_messages.
- Invocato fail-safe da classify-inbound-message (channel=email) dopo funnemail-classify. Mai blocca legacy.
- Step 2: settare `emit_pending_actions=true` per materializzare suggested_actions in ai_pending_actions con risk_level mappato (draft_reply=PREPARE, lead_status/agenda=WRITE, badge=READ skip).
- Sanitizer + contentNormalizer + injection guard riusati.
