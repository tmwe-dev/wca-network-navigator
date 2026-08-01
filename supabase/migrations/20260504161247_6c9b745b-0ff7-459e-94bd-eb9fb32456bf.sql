DROP POLICY IF EXISTS cockpit_queue_delete_own ON public.cockpit_queue;
CREATE POLICY cockpit_queue_delete_all_authenticated
  ON public.cockpit_queue FOR DELETE
  TO authenticated
  USING (true);