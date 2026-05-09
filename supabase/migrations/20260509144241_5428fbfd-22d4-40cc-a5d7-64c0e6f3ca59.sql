-- Trigger di blindatura: ogni INSERT su channel_messages (linkedin) popola linkedin_addresses

CREATE OR REPLACE FUNCTION public.tg_channel_messages_to_linkedin_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_addr TEXT;
  v_name TEXT;
  v_slug TEXT;
  v_url  TEXT;
  v_headline TEXT;
  v_msg_at TIMESTAMPTZ;
  v_payload JSONB;
  v_match TEXT;
BEGIN
  -- Filtri base
  IF NEW.channel <> 'linkedin' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.direction NOT IN ('inbound','outbound') THEN
    RETURN NEW;
  END IF;

  v_payload := COALESCE(NEW.raw_payload, '{}'::jsonb);

  IF NEW.direction = 'inbound' THEN
    v_addr := NEW.from_address;
    v_name := NEW.from_name;
  ELSE
    v_addr := NEW.to_address;
    v_name := NEW.to_name;
  END IF;

  -- Deriva profile_slug da fonti affidabili (mai dal nome)
  v_slug := NULLIF(trim(COALESCE(
    v_payload->>'profileSlug',
    v_payload->>'profileId',
    v_payload->>'linkedinId'
  )), '');

  IF v_slug IS NULL THEN
    -- Prova a estrarre /in/<slug> da address o da URL nel payload
    FOREACH v_match IN ARRAY ARRAY[
      v_addr,
      v_payload->>'profileUrl',
      v_payload->>'threadUrl'
    ]
    LOOP
      IF v_match IS NULL THEN CONTINUE; END IF;
      v_slug := substring(v_match FROM '/in/([^/?#]+)');
      IF v_slug IS NOT NULL AND length(v_slug) > 0 THEN
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Scarta address sporchi (es. "me", "name:Mario", null, vuoti)
  IF v_slug IS NULL OR length(v_slug) = 0 THEN
    RETURN NEW;
  END IF;
  IF v_slug ILIKE 'name:%' OR v_slug = 'me' THEN
    RETURN NEW;
  END IF;

  v_url := COALESCE(
    v_payload->>'profileUrl',
    CASE WHEN v_addr ILIKE 'http%/in/%' THEN v_addr ELSE NULL END,
    'https://www.linkedin.com/in/' || v_slug
  );

  v_headline := NULLIF(trim(COALESCE(v_payload->>'headline', '')), '');
  v_msg_at := COALESCE(NEW.email_date, NEW.created_at, now());

  BEGIN
    PERFORM public.upsert_linkedin_address(
      NEW.user_id,
      NEW.operator_id,
      v_slug,
      v_url,
      NULLIF(trim(COALESCE(v_name, '')), ''),
      v_headline,
      NEW.direction,
      v_msg_at
    );
  EXCEPTION WHEN OTHERS THEN
    -- Best-effort: non bloccare mai l'INSERT del messaggio per un errore di rubrica
    RAISE WARNING 'tg_channel_messages_to_linkedin_address failed for msg %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS channel_messages_to_linkedin_address ON public.channel_messages;

CREATE TRIGGER channel_messages_to_linkedin_address
  AFTER INSERT ON public.channel_messages
  FOR EACH ROW
  WHEN (NEW.channel = 'linkedin' AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public.tg_channel_messages_to_linkedin_address();

COMMENT ON FUNCTION public.tg_channel_messages_to_linkedin_address() IS
  'Popola linkedin_addresses ad ogni INSERT su channel_messages (channel=linkedin). Best-effort: non blocca l''INSERT in caso di errore. Skip se slug non derivabile da fonti affidabili.';