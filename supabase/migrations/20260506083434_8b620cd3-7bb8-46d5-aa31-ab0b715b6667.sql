-- =========================================================
-- Funnemail Phase 2: Job Status, Sorting View, Reminders
-- =========================================================

-- ---------- 1. STATUS TABLE ----------
CREATE TABLE IF NOT EXISTS public.funnemail_message_status (
  message_id     text PRIMARY KEY,
  group_id       uuid NULL,
  status         text NOT NULL DEFAULT 'nuovo'
                   CHECK (status IN ('nuovo','in_lavorazione','in_attesa','da_smistare','risolto','archiviato')),
  status_reason  text NULL,
  changed_by     uuid NOT NULL,
  changed_at     timestamptz NOT NULL DEFAULT now(),
  user_id        uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_fms_group_status
  ON public.funnemail_message_status (group_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fms_status
  ON public.funnemail_message_status (status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.funnemail_message_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fms_select_all_auth" ON public.funnemail_message_status;
CREATE POLICY "fms_select_all_auth"
  ON public.funnemail_message_status FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "fms_insert_auth" ON public.funnemail_message_status;
CREATE POLICY "fms_insert_auth"
  ON public.funnemail_message_status FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND changed_by = auth.uid());

DROP POLICY IF EXISTS "fms_update_auth" ON public.funnemail_message_status;
CREATE POLICY "fms_update_auth"
  ON public.funnemail_message_status FOR UPDATE
  TO authenticated USING (auth.uid() IS NOT NULL)
  WITH CHECK (changed_by = auth.uid());

DROP TRIGGER IF EXISTS trg_fms_updated_at ON public.funnemail_message_status;
CREATE TRIGGER trg_fms_updated_at
  BEFORE UPDATE ON public.funnemail_message_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 2. STATUS HISTORY (audit append-only) ----------
CREATE TABLE IF NOT EXISTS public.funnemail_message_status_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   text NOT NULL,
  group_id     uuid NULL,
  from_status  text NULL,
  to_status    text NOT NULL,
  reason       text NULL,
  changed_by   uuid NOT NULL,
  changed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fmsh_message
  ON public.funnemail_message_status_history (message_id, changed_at DESC);

ALTER TABLE public.funnemail_message_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmsh_select_all_auth" ON public.funnemail_message_status_history;
CREATE POLICY "fmsh_select_all_auth"
  ON public.funnemail_message_status_history FOR SELECT
  TO authenticated USING (true);

-- nessuna insert/update/delete da client; solo via trigger SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.fms_history_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.funnemail_message_status_history
      (message_id, group_id, from_status, to_status, reason, changed_by, changed_at)
    VALUES (NEW.message_id, NEW.group_id, NULL, NEW.status, NEW.status_reason, NEW.changed_by, NEW.changed_at);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.funnemail_message_status_history
      (message_id, group_id, from_status, to_status, reason, changed_by, changed_at)
    VALUES (NEW.message_id, NEW.group_id, OLD.status, NEW.status, NEW.status_reason, NEW.changed_by, NEW.changed_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fms_history ON public.funnemail_message_status;
CREATE TRIGGER trg_fms_history
  AFTER INSERT OR UPDATE ON public.funnemail_message_status
  FOR EACH ROW EXECUTE FUNCTION public.fms_history_capture();

-- ---------- 3. SORTING VIEW ----------
CREATE OR REPLACE VIEW public.funnemail_sorting_queue
WITH (security_invoker=true) AS
SELECT
  s.message_id,
  s.group_id,
  s.status,
  s.status_reason,
  s.changed_by,
  s.changed_at,
  s.user_id
FROM public.funnemail_message_status s
WHERE s.deleted_at IS NULL
  AND s.status = 'da_smistare';

-- ---------- 4. REMINDERS ----------
CREATE TABLE IF NOT EXISTS public.funnemail_message_reminders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    text NOT NULL,
  group_id      uuid NULL,
  remind_at     timestamptz NOT NULL,
  note          text NULL,
  created_by    uuid NOT NULL,
  user_id       uuid NOT NULL,
  triggered_at  timestamptz NULL,
  dismissed_at  timestamptz NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_fmr_due
  ON public.funnemail_message_reminders (remind_at)
  WHERE triggered_at IS NULL AND dismissed_at IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fmr_message
  ON public.funnemail_message_reminders (message_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.funnemail_message_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmr_select_all_auth" ON public.funnemail_message_reminders;
CREATE POLICY "fmr_select_all_auth"
  ON public.funnemail_message_reminders FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "fmr_insert_auth" ON public.funnemail_message_reminders;
CREATE POLICY "fmr_insert_auth"
  ON public.funnemail_message_reminders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "fmr_update_auth" ON public.funnemail_message_reminders;
CREATE POLICY "fmr_update_auth"
  ON public.funnemail_message_reminders FOR UPDATE
  TO authenticated USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS trg_fmr_updated_at ON public.funnemail_message_reminders;
CREATE TRIGGER trg_fmr_updated_at
  BEFORE UPDATE ON public.funnemail_message_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 5. REALTIME ----------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.funnemail_message_status;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.funnemail_message_reminders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;