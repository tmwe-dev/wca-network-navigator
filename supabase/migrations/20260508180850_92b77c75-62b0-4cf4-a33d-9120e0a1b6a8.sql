CREATE OR REPLACE FUNCTION public.funnemail_decisions_to_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.funnemail_message_status (
    message_id, user_id, status, sub_status, status_reason, changed_by, changed_at
  )
  VALUES (
    NEW.message_id, NEW.user_id, 'classified', NEW.suggested_action,
    'auto: classify decision (conf=' || COALESCE(NEW.confidence::TEXT, 'n/a') || ')',
    NEW.user_id, now()
  )
  ON CONFLICT (message_id) DO UPDATE SET
    status = 'classified',
    sub_status = EXCLUDED.sub_status,
    status_reason = EXCLUDED.status_reason,
    changed_by = EXCLUDED.changed_by,
    changed_at = now(),
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.funnemail_actions_to_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'success' THEN
    UPDATE public.funnemail_message_status
    SET sub_status = NEW.action,
        status_reason = 'auto: action ' || NEW.action || ' applied',
        changed_at = now(),
        updated_at = now()
    WHERE message_id = NEW.message_id;
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO public.funnemail_message_status (message_id, user_id, status, sub_status, status_reason, changed_by, changed_at)
SELECT DISTINCT ON (d.message_id)
  d.message_id, d.user_id, 'classified', d.suggested_action,
  'backfill: classify decision', d.user_id, now()
FROM public.funnemail_decisions d
LEFT JOIN public.funnemail_message_status s ON s.message_id = d.message_id
WHERE s.message_id IS NULL AND d.user_id IS NOT NULL
ORDER BY d.message_id, d.created_at DESC
ON CONFLICT (message_id) DO NOTHING;