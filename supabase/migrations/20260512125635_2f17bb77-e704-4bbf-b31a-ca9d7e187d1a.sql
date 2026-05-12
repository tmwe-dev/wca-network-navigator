CREATE OR REPLACE FUNCTION public.on_inbound_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_outreach_id uuid; v_partner_id uuid; v_contact_id uuid;
  v_activity_id uuid; v_canale_it text;
  v_rule_category text;
  v_skip_activity boolean := false;
  v_skip_ai_classify boolean := false;
  v_service_key text;
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

  -- Filtri newsletter/spam/no-reply
  IF NEW.from_address IS NOT NULL THEN
    SELECT category INTO v_rule_category
    FROM public.email_address_rules
    WHERE email_address = lower(NEW.from_address)
    LIMIT 1;
    IF v_rule_category IS NOT NULL AND v_rule_category IN (
      'newsletter','transactional','marketing','spam','automation','promotion','notification','social'
    ) THEN
      v_skip_activity := true;
    END IF;
  END IF;

  IF NOT v_skip_activity AND NEW.subject IS NOT NULL THEN
    IF NEW.subject ~* '^(L''app di LinkedIn|Hai \d+ nuov[oi] (invit|messag)|.*newsletter|.*unsubscribe|.*Workflows GA|Cerotto sottile|.*€ per te|.*per la tua auto)' THEN
      v_skip_activity := true;
    END IF;
  END IF;

  IF NOT v_skip_activity AND NEW.from_address IS NOT NULL THEN
    IF NEW.from_address ~* '(noreply|no-reply|donotreply|do-not-reply|notifications?@|mailer-daemon|postmaster@|bounce|newsletter@|news@|info@bizzmail)' THEN
      v_skip_activity := true;
    END IF;
  END IF;

  -- Guardia anti-backfill: NON classificare con AI le mail storiche o già lette.
  -- Funnemail nasce per smistare le mail NUOVE e NON LETTE; le mail vecchie
  -- vengono solo importate, non analizzate (vedi audit gestione email 2026-05-12).
  IF NEW.read_at IS NOT NULL THEN
    v_skip_ai_classify := true;  -- già letta (flag \Seen sul server IMAP)
  ELSIF NEW.email_date IS NOT NULL AND NEW.email_date < (now() - interval '48 hours') THEN
    v_skip_ai_classify := true;  -- backfill storico (>48h)
  END IF;

  -- Classificatore Funnemail v2 multicanale (fail-safe, key letto da Vault)
  IF NOT v_skip_activity AND NOT v_skip_ai_classify THEN
    BEGIN
      SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets
      WHERE name = 'funnemail_trigger_service_role_key'
      LIMIT 1;

      IF v_service_key IS NOT NULL AND length(v_service_key) > 0 THEN
        PERFORM net.http_post(
          url := 'https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/classify-inbound-message',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'message_id', NEW.id,
            'channel', NEW.channel,
            'from_address', NEW.from_address,
            'subject', NEW.subject,
            'body_text', NEW.body_text,
            'partner_id', v_partner_id,
            'user_id', NEW.user_id
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF v_skip_activity THEN
    RETURN NEW;
  END IF;

  v_canale_it := CASE NEW.channel
    WHEN 'email' THEN 'email' WHEN 'whatsapp' THEN 'WhatsApp'
    WHEN 'linkedin' THEN 'LinkedIn' WHEN 'sms' THEN 'SMS'
    WHEN 'voice' THEN 'voce' ELSE NEW.channel
  END;

  BEGIN
    INSERT INTO public.activities (
      user_id, partner_id, selected_contact_id, activity_type,
      title, description, source_type, source_id, source_meta, status, created_at
    ) VALUES (
      NEW.user_id,
      v_partner_id,
      v_contact_id,
      'inbound_message',
      'Risposta ' || v_canale_it || COALESCE(' da ' || NEW.from_address, ''),
      LEFT(COALESCE(NEW.subject || E'\n', '') || COALESCE(NEW.body_text, ''), 4000),
      CASE WHEN v_partner_id IS NOT NULL THEN 'partner' ELSE 'channel_message' END,
      COALESCE(v_partner_id, NEW.id),
      jsonb_build_object('channel', NEW.channel, 'channel_message_id', NEW.id),
      'completed',
      COALESCE(NEW.email_date, now())
    )
    RETURNING id INTO v_activity_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;