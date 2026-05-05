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

AGGIORNAMENTO 2026-05-05: NO PIÙ "ULTIME 30 MAIL" NEL PROMPT.
- `classify-inbound-content` ora usa `_shared/conversationSummaryLoader.ts` (SSOT).
- Loader: legge `contact_conversation_context.conversation_summary` + `last_exchanges` (≤5) + metriche. Fallback max 5 messaggi recenti SOLO se summary assente (bootstrap).
- Builder: edge `refresh-conversation-context` (debounced 5min, idempotente per `interaction_count`). Legge fino a 30 `channel_messages` cross-canale e produce summary narrativo via Gemini Flash + tool `build_summary` (Zod-validated).
- Trigger: `classify-inbound-message` invoca `refresh-conversation-context` fire-and-forget DOPO ogni inbound (mai blocca legacy).
- Prompt operativo `conversation-summary` (priority 80, tag `OBBLIGATORIA`-style universale) seedato per ogni utente. Editabile da Prompt Lab.
- Token budget: ~1.5k token (summary+5 sintesi) vs ~15k (30 mail raw). Riduzione 10×.
