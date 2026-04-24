CREATE OR REPLACE FUNCTION public.get_system_diagnostics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_agent_pending int := 0;
  v_email_queue_pending int := 0;
  v_extension_pending int := 0;
  v_cron_active int := 0;
  v_last_sync timestamptz;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  BEGIN
    SELECT COUNT(*) INTO v_agent_pending FROM public.agent_tasks WHERE status = 'pending';
  EXCEPTION WHEN undefined_table THEN v_agent_pending := -1;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_email_queue_pending FROM public.email_campaign_queue WHERE status = 'pending';
  EXCEPTION WHEN undefined_table THEN v_email_queue_pending := -1;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_extension_pending FROM public.extension_dispatch_queue WHERE status = 'pending';
  EXCEPTION WHEN undefined_table THEN v_extension_pending := -1;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_cron_active FROM cron.job WHERE active = true;
  EXCEPTION WHEN OTHERS THEN v_cron_active := -1;
  END;

  BEGIN
    SELECT MAX(created_at) INTO v_last_sync FROM public.email_sync_jobs WHERE status = 'completed';
  EXCEPTION WHEN undefined_table THEN v_last_sync := NULL;
  END;

  RETURN jsonb_build_object(
    'agent_tasks_pending', v_agent_pending,
    'email_queue_pending', v_email_queue_pending,
    'extension_pending', v_extension_pending,
    'cron_active', v_cron_active,
    'last_email_sync', v_last_sync,
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_system_diagnostics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_system_diagnostics() TO authenticated;