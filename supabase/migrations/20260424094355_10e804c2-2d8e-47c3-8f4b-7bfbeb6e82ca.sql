
-- ============================================================
-- Pausa Sistema (admin only) + cleanup attività fantasma
-- ============================================================

-- 1) Tabella settings di sistema
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings admin read" ON public.system_settings;
CREATE POLICY "system_settings admin read" ON public.system_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "system_settings admin write" ON public.system_settings;
CREATE POLICY "system_settings admin write" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.system_settings(key, value)
VALUES ('paused', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2) RPC lettura stato pausa (esposta a tutti i loggati per banner UI)
CREATE OR REPLACE FUNCTION public.get_system_paused()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((value)::boolean, false)
  FROM public.system_settings
  WHERE key = 'paused';
$$;

-- 3) RPC toggle pausa: ferma cron + disabilita trigger inbound
CREATE OR REPLACE FUNCTION public.set_system_paused(p_paused boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_paused boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT public.get_system_paused() INTO v_was_paused;

  IF p_paused THEN
    -- ferma sync IMAP
    BEGIN PERFORM cron.unschedule('email_cron_sync_tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN PERFORM cron.unschedule('email-sync-worker');    EXCEPTION WHEN OTHERS THEN NULL; END;
    -- ferma classificazione automatica inbound
    EXECUTE 'ALTER TABLE public.channel_messages DISABLE TRIGGER trg_on_inbound_message';
  ELSE
    -- ri-abilita trigger
    EXECUTE 'ALTER TABLE public.channel_messages ENABLE TRIGGER trg_on_inbound_message';
    -- ri-schedula cron solo se non già presenti
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'email_cron_sync_tick') THEN
      PERFORM cron.schedule(
        'email_cron_sync_tick',
        '*/5 * * * *',
        public._cron_invoke_edge_sql('email-sync-worker')
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'email-sync-worker') THEN
      PERFORM cron.schedule(
        'email-sync-worker',
        '*/3 * * * *',
        public._cron_invoke_edge_sql('email-sync-worker')
      );
    END IF;
  END IF;

  INSERT INTO public.system_settings(key, value, updated_by, updated_at)
  VALUES ('paused', to_jsonb(p_paused), auth.uid(), now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();

  RETURN jsonb_build_object('paused', p_paused, 'previous', v_was_paused);
END;
$$;

-- 4) RPC pulizia attività fantasma generate dal trigger inbound
CREATE OR REPLACE FUNCTION public.purge_inbound_activities(p_only_orphans boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  IF p_only_orphans THEN
    DELETE FROM public.activities
    WHERE activity_type = 'follow_up'
      AND title LIKE 'Reply received%'
      AND status = 'pending'
      AND (
        partner_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.partners p WHERE p.id = activities.partner_id)
      );
  ELSE
    DELETE FROM public.activities
    WHERE activity_type = 'follow_up'
      AND title LIKE 'Reply received%'
      AND status = 'pending';
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('deleted', v_count, 'only_orphans', p_only_orphans);
END;
$$;

-- 5) Conteggio rapido per la conferma UI
CREATE OR REPLACE FUNCTION public.count_inbound_activities()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'orphans', COUNT(*) FILTER (
      WHERE partner_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.partners p WHERE p.id = a.partner_id)
    )
  )
  FROM public.activities a
  WHERE activity_type = 'follow_up'
    AND title LIKE 'Reply received%'
    AND status = 'pending';
$$;

GRANT EXECUTE ON FUNCTION public.get_system_paused() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_system_paused(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_inbound_activities(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_inbound_activities() TO authenticated;
