-- Aggiorna trigger on_inbound_message:
--   1) Skip creazione activity per mittenti classificati come newsletter/spam/transactional/marketing/automation
--   2) Skip creazione activity se il subject ricade in pattern noti di notifiche automatiche
--   3) Se il match è solo per dominio (raw_payload->>'match_confidence' = 'domain' o 'domain_ambiguous')
--      crea l'activity SENZA partner_id, così l'agenda non afferma un'identità non verificata.

CREATE OR REPLACE FUNCTION public.on_inbound_message()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_outreach_id uuid; v_partner_id uuid; v_contact_id uuid;
  v_activity_id uuid; v_canale_it text;
  v_rule_category text;
  v_match_confidence text;
  v_skip_activity boolean := false;
  v_safe_partner_id uuid;
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;

  -- Outreach reply matching (invariato)
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

  -- ── NUOVO: filtro newsletter/spam/transactional ──
  -- 1) Categoria assegnata da email_address_rules (se esiste)
  IF NEW.from_address IS NOT NULL THEN
    SELECT category INTO v_rule_category
    FROM public.email_address_rules
    WHERE user_id = NEW.user_id AND email_address = NEW.from_address
    LIMIT 1;

    IF v_rule_category IS NOT NULL AND v_rule_category IN (
      'newsletter','transactional','marketing','spam','automation','promotion','notification','social'
    ) THEN
      v_skip_activity := true;
    END IF;
  END IF;

  -- 2) Pattern subject di notifiche automatiche
  IF NOT v_skip_activity AND NEW.subject IS NOT NULL THEN
    IF NEW.subject ~* '^(L''app di LinkedIn|Hai \d+ nuov[oi] (invit|messag)|.*newsletter|.*unsubscribe|.*Workflows GA|Cerotto sottile|.*€ per te|.*per la tua auto)' THEN
      v_skip_activity := true;
    END IF;
  END IF;

  -- 3) Mittenti tipici no-reply
  IF NOT v_skip_activity AND NEW.from_address IS NOT NULL THEN
    IF NEW.from_address ~* '(noreply|no-reply|donotreply|do-not-reply|notifications?@|mailer-daemon|postmaster@|bounce|newsletter@|news@|info@bizzmail)' THEN
      v_skip_activity := true;
    END IF;
  END IF;

  IF v_skip_activity THEN
    RETURN NEW;
  END IF;

  -- ── NUOVO: confidence del match ──
  v_match_confidence := COALESCE(NEW.raw_payload->>'match_confidence', 'exact');
  -- Solo per match esatti (email o contatto verificato) attribuiamo l'activity al partner.
  -- Per match per dominio (ambiguo), creiamo l'activity senza partner_id.
  IF v_match_confidence IN ('domain','domain_ambiguous') THEN
    v_safe_partner_id := NULL;
  ELSE
    v_safe_partner_id := v_partner_id;
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
    v_safe_partner_id,
    CASE WHEN v_safe_partner_id IS NOT NULL THEN 'partner' ELSE 'channel_message' END,
    COALESCE(v_safe_partner_id, NEW.id),
    'follow_up',
    'Risposta ' || v_canale_it || ': ' || COALESCE(NEW.subject, '(senza oggetto)'),
    'Messaggio in arrivo da ' || COALESCE(NEW.from_address, 'mittente sconosciuto') || ' (' || v_canale_it || ')'
      || CASE WHEN v_match_confidence IN ('domain','domain_ambiguous')
              THEN E'\nMittente da verificare: match per dominio, non per email esatta.'
              ELSE '' END,
    'pending', 'high', now(), NEW.user_id
  ) RETURNING id INTO v_activity_id;

  RETURN NEW;
END;
$function$;