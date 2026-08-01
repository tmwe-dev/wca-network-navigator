
-- 1. Helper RPC: idempotent upsert del service-role key in Vault.
--    Esposto solo al service-role (chiamato dall'edge function admin-only).
CREATE OR REPLACE FUNCTION public.install_funnemail_vault_key(p_value text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'funnemail_trigger_service_role_key';
  IF v_id IS NULL THEN
    v_id := vault.create_secret(p_value, 'funnemail_trigger_service_role_key', 'Used by on_inbound_message trigger to call classify-inbound-message');
  ELSE
    PERFORM vault.update_secret(v_id, p_value);
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.install_funnemail_vault_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.install_funnemail_vault_key(text) TO service_role;

-- 2. Patch del trigger: legge il service-role key da Vault invece che da
--    current_setting('app.settings.service_role_key') (NULL in produzione).
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

  -- Invocazione classificatore v2 multicanale (fail-safe).
  -- FIX: legge il service-role key dal Vault invece che da current_setting (NULL).
  IF NOT v_skip_activity THEN
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
      -- fail-safe: la mail entra comunque
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

  INSERT INTO public.activities (
    user_id, partner_id, contact_id, type, channel,
    title, body, source_type, source_id, occurred_at, status
  ) VALUES (
    NEW.user_id,
    v_partner_id,
    v_contact_id,
    'inbound_message',
    NEW.channel,
    'Risposta ' || v_canale_it || COALESCE(' da ' || NEW.from_address, ''),
    LEFT(COALESCE(NEW.subject || E'\n', '') || COALESCE(NEW.body_text, ''), 4000),
    CASE WHEN v_partner_id IS NOT NULL THEN 'partner' ELSE 'channel_message' END,
    COALESCE(v_partner_id, NEW.id),
    COALESCE(NEW.received_at, now()),
    'completed'
  )
  RETURNING id INTO v_activity_id;

  RETURN NEW;
END;
$function$;
