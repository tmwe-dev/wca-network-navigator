CREATE OR REPLACE FUNCTION public.funnemail_decisions_to_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
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