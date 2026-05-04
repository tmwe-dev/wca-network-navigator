CREATE OR REPLACE FUNCTION public.on_inbound_message()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_outreach_id uuid; v_partner_id uuid; v_contact_id uuid;
  v_activity_id uuid; v_canale_it text;
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;

  IF NEW.in_reply_to IS NOT NULL THEN
    SELECT oq.id, oq.partner_id INTO v_outreach_id, v_partner_id
    FROM public.outreach_queue oq
    JOIN public.channel_messages cm ON cm.from_address = oq.recipient_email
    WHERE cm.message_id_external = NEW.in_reply_to AND oq.status IN ('sent','delivered')
    ORDER BY oq.processed_at DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_outreach_id IS NULL AND NEW.partner_id IS NOT NULL THEN
    SELECT oq.id, oq.partner_id INTO v_outreach_id, v_partner_id
    FROM public.outreach_queue oq
    WHERE oq.partner_id = NEW.partner_id AND oq.status IN ('sent','delivered')
    ORDER BY oq.processed_at DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_outreach_id IS NULL AND NEW.from_address IS NOT NULL THEN
    SELECT oq.id, oq.partner_id INTO v_outreach_id, v_partner_id
    FROM public.outreach_queue oq
    WHERE oq.recipient_email = NEW.from_address AND oq.status IN ('sent','delivered')
    ORDER BY oq.processed_at DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_outreach_id IS NOT NULL THEN
    UPDATE public.outreach_queue
    SET status='replied', replied_at=now(), reply_message_id=NEW.id
    WHERE id = v_outreach_id;
  END IF;

  v_partner_id := COALESCE(v_partner_id, NEW.partner_id);

  IF v_partner_id IS NOT NULL THEN
    SELECT pc.id INTO v_contact_id FROM public.partner_contacts pc
    WHERE pc.partner_id = v_partner_id AND (pc.email = NEW.from_address OR NEW.from_address IS NULL)
    LIMIT 1;
    IF v_contact_id IS NOT NULL THEN
      UPDATE public.outreach_schedules
      SET status='skipped', last_error='risposta ricevuta su '||NEW.channel, updated_at=now()
      WHERE contact_id = v_contact_id AND action IN ('followup','check_reply') AND status='pending';
    END IF;
  END IF;

  v_canale_it := CASE NEW.channel
    WHEN 'email' THEN 'email' WHEN 'whatsapp' THEN 'WhatsApp'
    WHEN 'linkedin' THEN 'LinkedIn' WHEN 'sms' THEN 'SMS'
    ELSE NEW.channel END;

  INSERT INTO public.activities (
    partner_id, source_type, source_id,
    activity_type, title, description,
    status, priority, due_date, user_id
  ) VALUES (
    v_partner_id, 'partner', COALESCE(v_partner_id, NEW.id),
    'follow_up',
    'Risposta ' || v_canale_it || ': ' || COALESCE(NEW.subject, '(senza oggetto)'),
    'Messaggio in arrivo da ' || COALESCE(NEW.from_address, 'mittente sconosciuto') || ' (' || v_canale_it || ')',
    'pending', 'high', now(), NEW.user_id
  ) RETURNING id INTO v_activity_id;

  RETURN NEW;
END;
$function$;