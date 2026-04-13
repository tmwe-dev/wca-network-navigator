CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  error_type text NOT NULL,
  error_message text,
  error_stack text,
  component_stack text,
  page_url text,
  edge_function_name text,
  http_status integer,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own errors" ON public.app_error_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert errors" ON public.app_error_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin sees all errors" ON public.app_error_logs FOR SELECT TO authenticated USING (public.is_operator_admin());

CREATE INDEX idx_error_logs_created ON public.app_error_logs(created_at DESC);
CREATE INDEX idx_error_logs_type ON public.app_error_logs(error_type);