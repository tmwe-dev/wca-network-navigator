-- ─────────────────────────────────────────────────────────────────────
-- PARTE 1 — Soft-deprecate duplicati operative_prompts
-- Strategia: per ogni (context, name) attivo non deprecato, tieni solo
-- il record con updated_at più recente; gli altri ricevono deprecated_at
-- e deprecated_reason. Reversibile via UPDATE … SET deprecated_at = NULL.
-- ─────────────────────────────────────────────────────────────────────
WITH ranked AS (
  SELECT id,
         context,
         name,
         updated_at,
         ROW_NUMBER() OVER (
           PARTITION BY context, name
           ORDER BY updated_at DESC, id DESC
         ) AS rn
  FROM public.operative_prompts
  WHERE deprecated_at IS NULL
    AND context IN ('classification', 'content-intelligence')
)
UPDATE public.operative_prompts op
SET deprecated_at = now(),
    deprecated_reason = 'auto-dedup 2026-05-05: kept latest per (context,name)'
FROM ranked r
WHERE op.id = r.id
  AND r.rn > 1;

-- ─────────────────────────────────────────────────────────────────────
-- PARTE 2 — Attivazione v2 inbound classifier via pg_net
-- Sostituisce on_inbound_message conservando 100% della logica esistente
-- (outreach replied, contact lookup, skip newsletter, activities insert)
-- e aggiungendo SOLO la chiamata fire-and-forget a classify-inbound-message.
-- ─────────────────────────────────────────────────────────────────────
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

  -- Filtri newsletter/spam/no-reply (restano attivi, immutati)
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

  -- ── NUOVO: invocazione fail-safe del classificatore v2 multicanale.
  --    Asincrono via pg_net; se l'estensione non c'è o l'edge fn fallisce,
  --    NON blocca l'inserimento del messaggio. Skip su messaggi marcati
  --    come newsletter/automatici (coerente con v_skip_activity).
  IF NOT v_skip_activity THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/classify-inbound-message',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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
    EXCEPTION WHEN OTHERS THEN
      -- fail-safe: la mail entra comunque, anche se il classificatore non parte
      NULL;
    END;
  END IF;

  IF v_skip_activity THEN
    RETURN NEW;
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
    v_partner_id,
    CASE WHEN v_partner_id IS NOT NULL THEN 'partner' ELSE 'channel_message' END,
    COALESCE(v_partner_id, NEW.id),
    'follow_up',
    'Risposta ' || v_canale_it || ': ' || COALESCE(NEW.subject, '(senza oggetto)'),
    'Messaggio in arrivo da ' || COALESCE(NEW.from_address, 'mittente sconosciuto') || ' (' || v_canale_it || ')',
    'pending', 'high', now(), NEW.user_id
  ) RETURNING id INTO v_activity_id;

  RETURN NEW;
END;
$function$;