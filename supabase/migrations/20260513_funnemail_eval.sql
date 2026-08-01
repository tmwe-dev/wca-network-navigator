-- Sprint D: Funnemail Eval Dataset & Runs
-- Eval dataset stores labelled email examples for accuracy testing.
-- Eval runs track aggregate accuracy metrics per batch execution.

CREATE TABLE IF NOT EXISTS public.funnemail_eval_dataset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_subject text NOT NULL,
  email_body text NOT NULL,
  expected_category text NOT NULL,
  expected_intent text NOT NULL,
  expected_priority text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.funnemail_eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  dataset_size int NOT NULL,
  category_accuracy numeric(5,2),
  intent_accuracy numeric(5,2),
  priority_accuracy numeric(5,2),
  failures jsonb NOT NULL DEFAULT '[]'::jsonb
);
