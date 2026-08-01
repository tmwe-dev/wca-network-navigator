
DROP POLICY IF EXISTS "outreach_queue_select_all_authenticated" ON public.outreach_queue;
DROP POLICY IF EXISTS "outreach_queue_select_scoped" ON public.outreach_queue;

CREATE POLICY "outreach_queue_select_scoped"
  ON public.outreach_queue FOR SELECT TO authenticated
  USING (
    operator_id = ANY(public.get_effective_operator_ids())
    OR created_by = auth.uid()::text
    OR user_id = auth.uid()
  );
