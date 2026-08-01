CREATE TABLE IF NOT EXISTS public.edge_function_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,
  status_code integer NOT NULL,
  duration_ms integer,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  user_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_logs_function ON public.edge_function_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_edge_logs_created ON public.edge_function_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_logs_success ON public.edge_function_logs(success) WHERE success = false;

ALTER TABLE public.edge_function_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own logs" ON public.edge_function_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_operator_admin());

CREATE POLICY "Service can insert logs" ON public.edge_function_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);