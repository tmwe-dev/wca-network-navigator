
CREATE TABLE IF NOT EXISTS public.pipeline_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id uuid NOT NULL,
  parent_trace_id uuid NULL,
  entity_type text NOT NULL,
  entity_id text NULL,
  entity_label text NULL,
  step_name text NOT NULL,
  step_order int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'started',
  error_message text NULL,
  input_summary jsonb NULL,
  output_summary jsonb NULL,
  ai_model text NULL,
  ai_scope text NULL,
  duration_ms int NULL,
  operator_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_traces_trace_id ON public.pipeline_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_traces_entity ON public.pipeline_traces(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_traces_step ON public.pipeline_traces(step_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_traces_created ON public.pipeline_traces(created_at DESC);

ALTER TABLE public.pipeline_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read pipeline_traces"
  ON public.pipeline_traces FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth insert pipeline_traces"
  ON public.pipeline_traces FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "service_role all pipeline_traces"
  ON public.pipeline_traces FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_traces;
