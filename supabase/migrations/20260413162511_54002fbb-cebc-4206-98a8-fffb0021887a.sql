DROP POLICY IF EXISTS "Service can insert logs" ON public.edge_function_logs;
CREATE POLICY "Users can insert own logs" ON public.edge_function_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);