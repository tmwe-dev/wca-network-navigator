CREATE OR REPLACE FUNCTION public.on_inbound_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_outreach_id uuid;
  v_partner_id uuid;
  v_contact_id uuid;
  v_mission_id uuid;
  v_activity_id uuid;
BEGIN
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  -- Strategy 1: Match via in_reply_to / thread_id
  IF NEW.in_reply_to IS NOT NULL THEN
    SELECT oq.id, oq.partner_id
    INTO v_outreach_id, v_partner_id
    FROM public.outreach_queue oq
    JOIN public.channel_messages cm ON cm.from_address = oq.recipient_email
    WHERE cm.message_id_external = NEW.in_reply_to
      AND oq.status IN ('sent', 'delivered')
    ORDER BY oq.processed_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- Strategy 2: Match via partner_id + channel
  IF v_outreach_id IS NULL AND NEW.partner_id IS NOT NULL THEN
    SELECT oq.id, oq.partner_id
    INTO v_outreach_id, v_partner_id
    FROM public.outreach_queue oq
    WHERE oq.partner_id = NEW.partner_id
      AND oq.status IN ('sent', 'delivered')
    ORDER BY oq.processed_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- Strategy 3: Match via from_address (email)
  IF v_outreach_id IS NULL AND NEW.from_address IS NOT NULL THEN
    SELECT oq.id, oq.partner_id
    INTO v_outreach_id, v_partner_id
    FROM public.outreach_queue oq
    WHERE oq.recipient_email = NEW.from_address
      AND oq.status IN ('sent', 'delivered')
    ORDER BY oq.processed_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_outreach_id IS NOT NULL THEN
    UPDATE public.outreach_queue
    SET status = 'replied',
        replied_at = now(),
        reply_message_id = NEW.id
    WHERE id = v_outreach_id;
  END IF;

  v_partner_id := COALESCE(v_partner_id, NEW.partner_id);

  IF v_partner_id IS NOT NULL THEN
    SELECT pc.id INTO v_contact_id
    FROM public.partner_contacts pc
    WHERE pc.partner_id = v_partner_id
      AND (pc.email = NEW.from_address OR NEW.from_address IS NULL)
    LIMIT 1;

    IF v_contact_id IS NOT NULL THEN
      SELECT os.mission_id INTO v_mission_id
      FROM public.outreach_schedules os
      WHERE os.contact_id = v_contact_id
        AND os.status = 'pending'
      LIMIT 1;

      UPDATE public.outreach_schedules
      SET status = 'skipped',
          last_error = 'reply received on ' || NEW.channel,
          updated_at = now()
      WHERE contact_id = v_contact_id
        AND action IN ('followup', 'check_reply')
        AND status = 'pending';
    END IF;
  END IF;

  INSERT INTO public.activities (
    partner_id, source_type, source_id,
    activity_type, title, description,
    status, priority, due_date, user_id
  ) VALUES (
    v_partner_id, 'partner',
    COALESCE(v_partner_id::text, NEW.id::text),
    'follow_up',
    'Reply received (' || NEW.channel || '): ' || COALESCE(NEW.subject, '(no subject)'),
    'Inbound ' || NEW.channel || ' from ' || COALESCE(NEW.from_address, 'unknown'),
    'pending', 'high', now(), NEW.user_id
  )
  RETURNING id INTO v_activity_id;

  RETURN NEW;
END;
$function$;