
ALTER TABLE public.channel_messages
  ADD COLUMN IF NOT EXISTS from_name TEXT,
  ADD COLUMN IF NOT EXISTS to_name TEXT;

UPDATE public.channel_messages
SET from_name = raw_payload->>'contact'
WHERE from_name IS NULL
  AND channel = 'whatsapp'
  AND raw_payload ? 'contact';

CREATE TABLE IF NOT EXISTS public.whatsapp_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  handle TEXT NOT NULL,
  phone_e164 TEXT,
  display_name TEXT,
  chat_thread_id TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  messages_in_count INTEGER NOT NULL DEFAULT 0,
  messages_out_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_direction TEXT,
  linked_partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  linked_partner_contact_id UUID REFERENCES public.partner_contacts(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'auto_inbound',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE (user_id, handle)
);

CREATE INDEX IF NOT EXISTS idx_wa_addr_display_name_trgm ON public.whatsapp_addresses USING gin (display_name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wa_addr_handle_trgm ON public.whatsapp_addresses USING gin (handle gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wa_addr_last_message ON public.whatsapp_addresses (last_message_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wa_addr_linked_partner ON public.whatsapp_addresses (linked_partner_id) WHERE linked_partner_id IS NOT NULL;

ALTER TABLE public.whatsapp_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_addr_select_shared" ON public.whatsapp_addresses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_addr_insert_shared" ON public.whatsapp_addresses
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wa_addr_update_shared" ON public.whatsapp_addresses
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wa_addr_delete_shared" ON public.whatsapp_addresses
  FOR DELETE TO authenticated USING (true);
CREATE POLICY "wa_addr_hide_soft_deleted" ON public.whatsapp_addresses AS RESTRICTIVE
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE TRIGGER wa_addr_updated_at
  BEFORE UPDATE ON public.whatsapp_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.linkedin_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  profile_slug TEXT NOT NULL,
  profile_url TEXT,
  display_name TEXT,
  headline TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  messages_in_count INTEGER NOT NULL DEFAULT 0,
  messages_out_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_direction TEXT,
  linked_partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  linked_partner_contact_id UUID REFERENCES public.partner_contacts(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'auto_inbound',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  UNIQUE (user_id, profile_slug)
);

CREATE INDEX IF NOT EXISTS idx_li_addr_display_name_trgm ON public.linkedin_addresses USING gin (display_name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_li_addr_slug_trgm ON public.linkedin_addresses USING gin (profile_slug gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_li_addr_last_message ON public.linkedin_addresses (last_message_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_li_addr_linked_partner ON public.linkedin_addresses (linked_partner_id) WHERE linked_partner_id IS NOT NULL;

ALTER TABLE public.linkedin_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "li_addr_select_shared" ON public.linkedin_addresses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "li_addr_insert_shared" ON public.linkedin_addresses
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "li_addr_update_shared" ON public.linkedin_addresses
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "li_addr_delete_shared" ON public.linkedin_addresses
  FOR DELETE TO authenticated USING (true);
CREATE POLICY "li_addr_hide_soft_deleted" ON public.linkedin_addresses AS RESTRICTIVE
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE TRIGGER li_addr_updated_at
  BEFORE UPDATE ON public.linkedin_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.upsert_whatsapp_address(
  p_user_id UUID,
  p_operator_id UUID,
  p_handle TEXT,
  p_phone_e164 TEXT,
  p_display_name TEXT,
  p_chat_thread_id TEXT,
  p_direction TEXT,
  p_message_at TIMESTAMPTZ
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_match_id UUID;
  v_match_partner UUID;
  v_in_inc INTEGER := CASE WHEN p_direction = 'inbound' THEN 1 ELSE 0 END;
  v_out_inc INTEGER := CASE WHEN p_direction = 'outbound' THEN 1 ELSE 0 END;
  v_source TEXT := CASE WHEN p_direction = 'outbound' THEN 'auto_outbound' ELSE 'auto_inbound' END;
BEGIN
  IF p_handle IS NULL OR length(trim(p_handle)) = 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.whatsapp_addresses (
    user_id, operator_id, handle, phone_e164, display_name, chat_thread_id,
    first_seen_at, last_seen_at, last_message_at, last_direction,
    messages_in_count, messages_out_count, source
  ) VALUES (
    p_user_id, p_operator_id, p_handle, p_phone_e164, p_display_name, p_chat_thread_id,
    COALESCE(p_message_at, now()), COALESCE(p_message_at, now()), p_message_at, p_direction,
    v_in_inc, v_out_inc, v_source
  )
  ON CONFLICT (user_id, handle) DO UPDATE SET
    last_seen_at = GREATEST(whatsapp_addresses.last_seen_at, COALESCE(EXCLUDED.last_message_at, now())),
    last_message_at = GREATEST(COALESCE(whatsapp_addresses.last_message_at, '1970-01-01'::timestamptz), COALESCE(EXCLUDED.last_message_at, now())),
    last_direction = EXCLUDED.last_direction,
    display_name = COALESCE(EXCLUDED.display_name, whatsapp_addresses.display_name),
    phone_e164 = COALESCE(EXCLUDED.phone_e164, whatsapp_addresses.phone_e164),
    chat_thread_id = COALESCE(EXCLUDED.chat_thread_id, whatsapp_addresses.chat_thread_id),
    messages_in_count = whatsapp_addresses.messages_in_count + v_in_inc,
    messages_out_count = whatsapp_addresses.messages_out_count + v_out_inc,
    updated_at = now()
  RETURNING id INTO v_id;

  IF p_phone_e164 IS NOT NULL THEN
    SELECT id, partner_id INTO v_match_id, v_match_partner
    FROM public.partner_contacts
    WHERE deleted_at IS NULL
      AND (mobile = p_phone_e164 OR direct_phone = p_phone_e164)
    LIMIT 1;

    IF v_match_id IS NOT NULL THEN
      UPDATE public.whatsapp_addresses
      SET linked_partner_contact_id = v_match_id,
          linked_partner_id = v_match_partner
      WHERE id = v_id AND linked_partner_id IS NULL;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_linkedin_address(
  p_user_id UUID,
  p_operator_id UUID,
  p_profile_slug TEXT,
  p_profile_url TEXT,
  p_display_name TEXT,
  p_headline TEXT,
  p_direction TEXT,
  p_message_at TIMESTAMPTZ
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_in_inc INTEGER := CASE WHEN p_direction = 'inbound' THEN 1 ELSE 0 END;
  v_out_inc INTEGER := CASE WHEN p_direction = 'outbound' THEN 1 ELSE 0 END;
  v_source TEXT := CASE WHEN p_direction = 'outbound' THEN 'auto_outbound' ELSE 'auto_inbound' END;
BEGIN
  IF p_profile_slug IS NULL OR length(trim(p_profile_slug)) = 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.linkedin_addresses (
    user_id, operator_id, profile_slug, profile_url, display_name, headline,
    first_seen_at, last_seen_at, last_message_at, last_direction,
    messages_in_count, messages_out_count, source
  ) VALUES (
    p_user_id, p_operator_id, p_profile_slug, p_profile_url, p_display_name, p_headline,
    COALESCE(p_message_at, now()), COALESCE(p_message_at, now()), p_message_at, p_direction,
    v_in_inc, v_out_inc, v_source
  )
  ON CONFLICT (user_id, profile_slug) DO UPDATE SET
    last_seen_at = GREATEST(linkedin_addresses.last_seen_at, COALESCE(EXCLUDED.last_message_at, now())),
    last_message_at = GREATEST(COALESCE(linkedin_addresses.last_message_at, '1970-01-01'::timestamptz), COALESCE(EXCLUDED.last_message_at, now())),
    last_direction = EXCLUDED.last_direction,
    display_name = COALESCE(EXCLUDED.display_name, linkedin_addresses.display_name),
    profile_url = COALESCE(EXCLUDED.profile_url, linkedin_addresses.profile_url),
    headline = COALESCE(EXCLUDED.headline, linkedin_addresses.headline),
    messages_in_count = linkedin_addresses.messages_in_count + v_in_inc,
    messages_out_count = linkedin_addresses.messages_out_count + v_out_inc,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_whatsapp_address(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_linkedin_address(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ) TO authenticated, service_role;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT user_id, operator_id, from_address AS handle,
           COALESCE(raw_payload->>'contact', from_name) AS display_name,
           direction, COALESCE(email_date, created_at) AS msg_at
    FROM public.channel_messages
    WHERE channel = 'whatsapp'
      AND deleted_at IS NULL
      AND from_address IS NOT NULL
      AND direction = 'inbound'
    ORDER BY created_at ASC
  LOOP
    PERFORM public.upsert_whatsapp_address(
      r.user_id, r.operator_id, r.handle, NULL, r.display_name, NULL, r.direction, r.msg_at
    );
  END LOOP;

  FOR r IN
    SELECT user_id, operator_id, to_address AS handle,
           to_name AS display_name,
           direction, COALESCE(email_date, created_at) AS msg_at
    FROM public.channel_messages
    WHERE channel = 'whatsapp'
      AND deleted_at IS NULL
      AND to_address IS NOT NULL
      AND direction = 'outbound'
    ORDER BY created_at ASC
  LOOP
    PERFORM public.upsert_whatsapp_address(
      r.user_id, r.operator_id, r.handle, NULL, r.display_name, NULL, r.direction, r.msg_at
    );
  END LOOP;
END $$;
