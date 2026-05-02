-- ═══════════════════════════════════════════════════════════════
-- COMMAND JOBS — Persistent work units for the Command system
-- Inspired by swiftpack-studio's import_jobs + gate-machine pattern
-- ═══════════════════════════════════════════════════════════════

-- Enums for job lifecycle
DO $$ BEGIN
  CREATE TYPE public.command_job_status AS ENUM (
    'open', 'in_progress', 'awaiting_approval', 'paused', 'done', 'error', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.command_job_phase AS ENUM (
    'discovery', 'planning', 'awaiting_approval', 'executing', 'review', 'done'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.command_job_step_status AS ENUM (
    'pending', 'running', 'awaiting_approval', 'done', 'error', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── command_jobs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.command_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL DEFAULT public.get_current_operator_id(),
  conversation_id UUID REFERENCES public.command_conversations(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  goal TEXT,
  origin_prompt TEXT,

  status public.command_job_status NOT NULL DEFAULT 'open',
  phase public.command_job_phase NOT NULL DEFAULT 'discovery',

  -- Contextual snapshot: filters, partner ids, last query result, etc.
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- AI-curated short summary, refreshed by the orchestrator
  ai_summary TEXT,
  -- Optional structured progress (e.g. {steps_done: 2, steps_total: 5})
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Free-form tags (e.g. ["malta","invito","partner"]) for grouping
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_command_jobs_user_status
  ON public.command_jobs (user_id, status, last_activity_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_command_jobs_operator
  ON public.command_jobs (operator_id, last_activity_at DESC)
  WHERE deleted_at IS NULL AND operator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_command_jobs_conversation
  ON public.command_jobs (conversation_id)
  WHERE conversation_id IS NOT NULL;

-- ── command_job_steps ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.command_job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.command_jobs(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,

  tool_id TEXT,
  status public.command_job_step_status NOT NULL DEFAULT 'pending',

  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  ai_reasoning TEXT,
  error_message TEXT,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (job_id, step_number)
);

CREATE INDEX IF NOT EXISTS ix_command_job_steps_job
  ON public.command_job_steps (job_id, step_number);

-- ── updated_at trigger ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.command_jobs_touch_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  -- bump activity unless caller already did
  IF NEW.last_activity_at = OLD.last_activity_at THEN
    NEW.last_activity_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_command_jobs_touch ON public.command_jobs;
CREATE TRIGGER trg_command_jobs_touch
  BEFORE UPDATE ON public.command_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.command_jobs_touch_updated();

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.command_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_job_steps ENABLE ROW LEVEL SECURITY;

-- command_jobs: ownership via operator OR direct user_id
DROP POLICY IF EXISTS command_jobs_select ON public.command_jobs;
CREATE POLICY command_jobs_select ON public.command_jobs
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR operator_id IS NULL
      OR operator_id = ANY (public.get_effective_operator_ids())
    )
  );

DROP POLICY IF EXISTS command_jobs_insert ON public.command_jobs;
CREATE POLICY command_jobs_insert ON public.command_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      operator_id IS NULL
      OR operator_id = ANY (public.get_effective_operator_ids())
    )
  );

DROP POLICY IF EXISTS command_jobs_update ON public.command_jobs;
CREATE POLICY command_jobs_update ON public.command_jobs
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR operator_id = ANY (public.get_effective_operator_ids())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR operator_id = ANY (public.get_effective_operator_ids())
  );

DROP POLICY IF EXISTS command_jobs_delete ON public.command_jobs;
CREATE POLICY command_jobs_delete ON public.command_jobs
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR operator_id = ANY (public.get_effective_operator_ids())
  );

-- command_job_steps: inherit access from parent job
DROP POLICY IF EXISTS command_job_steps_select ON public.command_job_steps;
CREATE POLICY command_job_steps_select ON public.command_job_steps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.command_jobs j
      WHERE j.id = command_job_steps.job_id
        AND j.deleted_at IS NULL
        AND (
          j.user_id = auth.uid()
          OR j.operator_id IS NULL
          OR j.operator_id = ANY (public.get_effective_operator_ids())
        )
    )
  );

DROP POLICY IF EXISTS command_job_steps_insert ON public.command_job_steps;
CREATE POLICY command_job_steps_insert ON public.command_job_steps
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.command_jobs j
      WHERE j.id = command_job_steps.job_id
        AND (
          j.user_id = auth.uid()
          OR j.operator_id = ANY (public.get_effective_operator_ids())
        )
    )
  );

DROP POLICY IF EXISTS command_job_steps_update ON public.command_job_steps;
CREATE POLICY command_job_steps_update ON public.command_job_steps
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.command_jobs j
      WHERE j.id = command_job_steps.job_id
        AND (
          j.user_id = auth.uid()
          OR j.operator_id = ANY (public.get_effective_operator_ids())
        )
    )
  );

DROP POLICY IF EXISTS command_job_steps_delete ON public.command_job_steps;
CREATE POLICY command_job_steps_delete ON public.command_job_steps
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.command_jobs j
      WHERE j.id = command_job_steps.job_id
        AND (
          j.user_id = auth.uid()
          OR j.operator_id = ANY (public.get_effective_operator_ids())
        )
    )
  );