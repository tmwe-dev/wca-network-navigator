
CREATE OR REPLACE VIEW public.message_intelligence_v
WITH (security_invoker = true) AS
SELECT
  -- Colonne esistenti (ordine preservato)
  cm.id                                  AS message_id,
  cm.user_id,
  cm.channel,
  cm.direction,
  cm.subject,
  cm.from_address,
  cm.to_address,
  cm.body_text,
  cm.body_html,
  cm.partner_id,
  cm.read_at,
  cm.category                            AS message_category,
  cm.email_date,
  cm.created_at                          AS message_created_at,
  rc.classification,
  rc.confidence,
  rc.sentiment,
  rc.urgency,
  rc.intent,
  rc.reasoning,
  rc.model,
  rc.category,
  rc.sender_group_id,
  rc.folder_hint,
  rc.policy_plan,
  rc.triage,
  rc.canonical_version,
  rc.created_at                          AS classified_at,
  cm.id                                  AS correlation_id,
  -- Colonne nuove (append-only) per parità con channel_messages
  cm.id                                  AS id,
  cm.created_at,
  cm.cc_addresses,
  cm.bcc_addresses,
  cm.mailbox_id,
  cm.folder,
  cm.ai_classification_suggestion,
  cm.raw_payload,
  cm.message_id_external,
  cm.in_reply_to,
  cm.references_header,
  cm.thread_id,
  cm.source_type,
  cm.source_id,
  cm.raw_storage_path,
  cm.raw_sha256,
  cm.raw_size_bytes,
  cm.imap_uid,
  cm.uidvalidity,
  cm.imap_flags,
  cm.internal_date,
  cm.parse_status,
  cm.parse_warnings
FROM public.channel_messages cm
LEFT JOIN LATERAL (
  SELECT r.id, r.message_id, r.channel, r.classification, r.confidence,
         r.sentiment, r.urgency, r.intent, r.reasoning, r.model,
         r.created_at, r.category, r.sender_group_id, r.folder_hint,
         r.policy_plan, r.triage, r.canonical_version
  FROM public.reply_classifications r
  WHERE r.message_id = cm.id
  ORDER BY r.created_at DESC
  LIMIT 1
) rc ON true;

REVOKE ALL ON public.message_intelligence_v FROM PUBLIC;
REVOKE ALL ON public.message_intelligence_v FROM anon;
GRANT SELECT ON public.message_intelligence_v TO authenticated;
GRANT ALL   ON public.message_intelligence_v TO service_role;
