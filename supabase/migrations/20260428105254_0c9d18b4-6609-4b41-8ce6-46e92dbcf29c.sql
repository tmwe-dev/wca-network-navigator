CREATE TABLE IF NOT EXISTS public.edge_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('error','perf','warn','info','metric')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('debug','info','warn','error','critical')),
  message TEXT,
  duration_ms INTEGER,
  status_code INTEGER,
  user_id UUID,
  context JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_metrics_created_at ON public.edge_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_metrics_function ON public.edge_metrics (function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_metrics_event_severity ON public.edge_metrics (event_type, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_metrics_user ON public.edge_metrics (user_id, created_at DESC) WHERE user_id IS NOT NULL;

ALTER TABLE public.edge_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "edge_metrics_admin_read" ON public.edge_metrics;
CREATE POLICY "edge_metrics_admin_read" ON public.edge_metrics
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT policy: only service role (edge functions) can write.

COMMENT ON TABLE public.edge_metrics IS 'Structured logging and metrics from edge functions. Written via service role, readable only by admins.';