
CREATE OR REPLACE VIEW public.message_intelligence_v
WITH (security_invoker = true) AS
SELECT
  cm.id                        AS message_id,
  cm.user_id                   AS user_id,
  cm.channel                   AS channel,
  cm.direction                 AS direction,
  cm.subject                   AS subject,
  cm.from_address              AS from_address,
  cm.email_date                AS email_date,
  cm.created_at                AS message_created_at,
  rc.classification            AS classification,
  rc.confidence                AS confidence,
  rc.sentiment                 AS sentiment,
  rc.urgency                   AS urgency,
  rc.intent                    AS intent,
  rc.reasoning                 AS reasoning,
  rc.model                     AS model,
  rc.category                  AS category,
  rc.sender_group_id           AS sender_group_id,
  rc.folder_hint               AS folder_hint,
  rc.policy_plan               AS policy_plan,
  rc.triage                    AS triage,
  rc.canonical_version         AS canonical_version,
  rc.created_at                AS classified_at,
  cm.id                        AS correlation_id
FROM public.channel_messages cm
JOIN LATERAL (
  SELECT *
  FROM public.reply_classifications r
  WHERE r.message_id = cm.id
  ORDER BY r.created_at DESC
  LIMIT 1
) rc ON true;

GRANT SELECT ON public.message_intelligence_v TO authenticated;
GRANT SELECT ON public.message_intelligence_v TO service_role;

COMMENT ON VIEW public.message_intelligence_v IS
'B3 canonical read-only view. SECURITY INVOKER: RLS delle tabelle sottostanti (channel_messages + reply_classifications) applica automaticamente isolamento utente. Una riga per message_id classificato (più recente per created_at). correlation_id = message_id.';
