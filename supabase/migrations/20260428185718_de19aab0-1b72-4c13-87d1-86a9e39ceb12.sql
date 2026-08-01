-- ──────────────────────────────────────────────────────────────────────
-- ai_runtime_traces — Trace Console events (frontend observability)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE public.ai_runtime_traces (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL,
  correlation_id  uuid        NOT NULL,
  ts              timestamptz NOT NULL DEFAULT now(),
  type            text        NOT NULL,           -- 'ai.invoke' | 'edge.invoke' | 'db.query' | 'flow.step' | 'manual'
  scope           text,                           -- ai_scope_registry scope or feature scope
  source          text,                           -- caller component/hook label
  route           text,                           -- pathname when emitted
  status          text,                           -- 'success' | 'error' | 'pending' | http code as string
  duration_ms     integer,
  payload_summary jsonb       NOT NULL DEFAULT '{}'::jsonb,
  error           jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_runtime_traces_user_ts ON public.ai_runtime_traces (user_id, ts DESC);
CREATE INDEX idx_ai_runtime_traces_corr ON public.ai_runtime_traces (correlation_id);
CREATE INDEX idx_ai_runtime_traces_type_ts ON public.ai_runtime_traces (type, ts DESC);

-- RLS
ALTER TABLE public.ai_runtime_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners can read own traces"
  ON public.ai_runtime_traces
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins can read all traces"
  ON public.ai_runtime_traces
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "owners can insert own traces"
  ON public.ai_runtime_traces
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE / DELETE policies → insert-only

-- ──────────────────────────────────────────────────────────────────────
-- Retention: pulizia tracce > 7 giorni (cron giornaliero alle 03:15 UTC)
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_old_runtime_traces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ai_runtime_traces
  WHERE ts < (now() - interval '7 days');
END;
$$;

-- pg_cron schedule (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-runtime-traces') THEN
    PERFORM cron.unschedule('purge-runtime-traces');
  END IF;
  PERFORM cron.schedule(
    'purge-runtime-traces',
    '15 3 * * *',
    $cron$ SELECT public.purge_old_runtime_traces(); $cron$
  );
EXCEPTION WHEN undefined_table THEN
  -- cron schema non disponibile (es. ambiente locale): salta lo schedule
  NULL;
END $$;