UPDATE public.email_sync_state s
SET last_uid = sub.max_uid,
    updated_at = now()
FROM (
  SELECT user_id, MAX(imap_uid) AS max_uid
  FROM public.channel_messages
  WHERE channel = 'email' AND imap_uid IS NOT NULL
  GROUP BY user_id
) sub
WHERE s.user_id = sub.user_id
  AND s.last_uid < sub.max_uid;