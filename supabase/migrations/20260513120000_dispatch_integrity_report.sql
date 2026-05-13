-- Sprint B: Dispatch Integrity Report table
-- Stores audit results of ai_pending_actions coherence checks.
CREATE TABLE public.dispatch_integrity_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  window_hours int NOT NULL DEFAULT 72,
  total_executed int NOT NULL,
  missing_channel_message int NOT NULL,
  missing_activity int NOT NULL,
  missing_partner_touch int NOT NULL,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_integrity_report ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read integrity report"
  ON public.dispatch_integrity_report FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service insert integrity report"
  ON public.dispatch_integrity_report FOR INSERT
  TO service_role
  WITH CHECK (true);
