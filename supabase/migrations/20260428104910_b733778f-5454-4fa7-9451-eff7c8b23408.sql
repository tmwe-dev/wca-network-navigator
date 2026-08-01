-- ============================================================================
-- 1. prompt_versions: snapshot immutabili di operative_prompts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.operative_prompts(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  user_id uuid NOT NULL,
  operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  -- Snapshot dei campi del prompt al momento della versione
  name text NOT NULL,
  context text NOT NULL,
  objective text NOT NULL,
  procedure text NOT NULL,
  criteria text NOT NULL,
  examples text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  priority integer NOT NULL,
  is_active boolean NOT NULL,
  -- Metadata snapshot
  change_reason text,
  changed_by_operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id 
  ON public.prompt_versions (prompt_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_user_id 
  ON public.prompt_versions (user_id, created_at DESC);

-- Trigger: snapshot automatico ad ogni INSERT/UPDATE su operative_prompts
CREATE OR REPLACE FUNCTION public.snapshot_operative_prompt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version integer;
BEGIN
  -- Skip se nessun campo "rilevante" è cambiato (per UPDATE)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.name = OLD.name
       AND NEW.context = OLD.context
       AND NEW.objective = OLD.objective
       AND NEW.procedure = OLD.procedure
       AND NEW.criteria = OLD.criteria
       AND NEW.examples = OLD.examples
       AND NEW.tags = OLD.tags
       AND NEW.priority = OLD.priority
       AND NEW.is_active = OLD.is_active
    THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM public.prompt_versions
    WHERE prompt_id = NEW.id;

  INSERT INTO public.prompt_versions (
    prompt_id, version_number, user_id, operator_id,
    name, context, objective, procedure, criteria, examples,
    tags, priority, is_active, changed_by_operator_id
  ) VALUES (
    NEW.id, next_version, NEW.user_id, NEW.operator_id,
    NEW.name, NEW.context, NEW.objective, NEW.procedure, NEW.criteria, NEW.examples,
    NEW.tags, NEW.priority, NEW.is_active, get_current_operator_id()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_operative_prompt ON public.operative_prompts;
CREATE TRIGGER trg_snapshot_operative_prompt
  AFTER INSERT OR UPDATE ON public.operative_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_operative_prompt();

-- RLS: versioni IMMUTABILI (solo SELECT)
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_versions_select_team"
  ON public.prompt_versions FOR SELECT
  TO authenticated
  USING (
    (operator_id IS NULL) 
    OR (operator_id = ANY (get_effective_operator_ids()))
  );

-- Nessuna policy INSERT/UPDATE/DELETE: solo il trigger SECURITY DEFINER può scrivere.
-- Questo rende le versioni un audit trail immutabile.

-- ============================================================================
-- 2. prompt_test_cases: casi di test per i prompt operativi
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.prompt_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.operative_prompts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  operator_id uuid DEFAULT get_current_operator_id() REFERENCES public.operators(id) ON DELETE SET NULL,
  -- Definizione del test
  name text NOT NULL,
  description text,
  -- Input simulato (es. partner_data, email_subject, channel, ecc.)
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Criteri di successo (regex / keyword / required_phrases / forbidden_phrases)
  expected_contains text[] NOT NULL DEFAULT '{}',
  expected_not_contains text[] NOT NULL DEFAULT '{}',
  expected_regex text,
  -- Modello e parametri opzionali (override del default)
  model text DEFAULT 'google/gemini-2.5-flash-lite',
  temperature numeric DEFAULT 0.3,
  -- Severity: critical (blocca deploy), warning (alert), info (log)
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_test_cases_prompt_id 
  ON public.prompt_test_cases (prompt_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_prompt_test_cases_user_id 
  ON public.prompt_test_cases (user_id);

ALTER TABLE public.prompt_test_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_test_cases_select_team"
  ON public.prompt_test_cases FOR SELECT
  TO authenticated
  USING (
    (operator_id IS NULL) 
    OR (operator_id = ANY (get_effective_operator_ids()))
  );

CREATE POLICY "prompt_test_cases_insert_team"
  ON public.prompt_test_cases FOR INSERT
  TO authenticated
  WITH CHECK (
    (operator_id IS NULL) 
    OR (operator_id = ANY (get_effective_operator_ids()))
  );

CREATE POLICY "prompt_test_cases_update_team"
  ON public.prompt_test_cases FOR UPDATE
  TO authenticated
  USING (
    (operator_id IS NULL) 
    OR (operator_id = ANY (get_effective_operator_ids()))
  );

CREATE POLICY "prompt_test_cases_delete_team"
  ON public.prompt_test_cases FOR DELETE
  TO authenticated
  USING (
    (operator_id IS NULL) 
    OR (operator_id = ANY (get_effective_operator_ids()))
  );

CREATE TRIGGER update_prompt_test_cases_updated_at
  BEFORE UPDATE ON public.prompt_test_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. prompt_test_runs: storico esecuzioni
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.prompt_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id uuid NOT NULL REFERENCES public.prompt_test_cases(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES public.operative_prompts(id) ON DELETE CASCADE,
  prompt_version_id uuid REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  triggered_by_operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  -- Risultato
  status text NOT NULL CHECK (status IN ('passed', 'failed', 'error', 'skipped')),
  ai_output text,
  failure_reasons text[] DEFAULT '{}',
  -- Performance / cost
  model_used text,
  tokens_input integer,
  tokens_output integer,
  duration_ms integer,
  -- Trigger source: 'manual', 'on-prompt-edit', 'scheduled', 'pre-deploy'
  trigger_source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_test_runs_test_case 
  ON public.prompt_test_runs (test_case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_test_runs_prompt 
  ON public.prompt_test_runs (prompt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_test_runs_status 
  ON public.prompt_test_runs (status, created_at DESC) WHERE status IN ('failed', 'error');

ALTER TABLE public.prompt_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_test_runs_select_team"
  ON public.prompt_test_runs FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT user_id FROM public.prompt_test_cases tc
      WHERE tc.id = prompt_test_runs.test_case_id
        AND ((tc.operator_id IS NULL) OR (tc.operator_id = ANY (get_effective_operator_ids())))
    )
  );

-- INSERT delle run è gestito dalla edge function via service_role
-- (nessuna policy INSERT per authenticated)

-- ============================================================================
-- 4. Helper: rollback a una versione precedente
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rollback_prompt_to_version(
  p_prompt_id uuid,
  p_version_number integer,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot record;
  v_caller_op uuid := get_current_operator_id();
BEGIN
  -- Verifica accesso al prompt (deve appartenere al team del caller)
  IF NOT EXISTS (
    SELECT 1 FROM public.operative_prompts
    WHERE id = p_prompt_id
      AND ((operator_id IS NULL) OR (operator_id = ANY (get_effective_operator_ids())))
  ) THEN
    RAISE EXCEPTION 'access_denied: prompt not visible to current operator';
  END IF;

  SELECT * INTO v_snapshot
    FROM public.prompt_versions
    WHERE prompt_id = p_prompt_id AND version_number = p_version_number;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'version_not_found: prompt % version %', p_prompt_id, p_version_number;
  END IF;

  UPDATE public.operative_prompts SET
    name = v_snapshot.name,
    context = v_snapshot.context,
    objective = v_snapshot.objective,
    procedure = v_snapshot.procedure,
    criteria = v_snapshot.criteria,
    examples = v_snapshot.examples,
    tags = v_snapshot.tags,
    priority = v_snapshot.priority,
    is_active = v_snapshot.is_active,
    updated_at = now()
  WHERE id = p_prompt_id;

  -- La nuova versione viene creata automaticamente dal trigger.
  -- Aggiungiamo il change_reason all'ultimo snapshot.
  UPDATE public.prompt_versions
    SET change_reason = COALESCE(p_reason, 'Rollback to version ' || p_version_number)
    WHERE prompt_id = p_prompt_id
      AND version_number = (SELECT MAX(version_number) FROM public.prompt_versions WHERE prompt_id = p_prompt_id);

  RETURN p_prompt_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rollback_prompt_to_version(uuid, integer, text) TO authenticated;