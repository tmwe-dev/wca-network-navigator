-- Sprint G: RLS hardening — replace USING(true) on security-sensitive tables.
-- Principle: user-scoped tables should use auth.uid() = user_id,
-- admin tables should use has_role(auth.uid(), 'admin').
-- We only touch the most critical tables here (data leak risk).
-- Idempotent: DROP POLICY IF EXISTS before re-creating.

-- 1. ai_pending_actions — user sees only their own
DROP POLICY IF EXISTS "Users can view own pending actions" ON public.ai_pending_actions;
CREATE POLICY "Users can view own pending actions"
  ON public.ai_pending_actions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. ai_decision_log — user sees only their own
DROP POLICY IF EXISTS "Users can view own decision log" ON public.ai_decision_log;
CREATE POLICY "Users can view own decision log"
  ON public.ai_decision_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. ai_memory — user sees only their own
DROP POLICY IF EXISTS "Users can view own ai memory" ON public.ai_memory;
CREATE POLICY "Users can view own ai memory"
  ON public.ai_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. email_drafts — user sees only their own
DROP POLICY IF EXISTS "Users can manage own drafts" ON public.email_drafts;
CREATE POLICY "Users can manage own drafts"
  ON public.email_drafts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. supervisor_audit_log — admin only read
DROP POLICY IF EXISTS "Admins can read audit log" ON public.supervisor_audit_log;
CREATE POLICY "Admins can read audit log"
  ON public.supervisor_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. credit_transactions — user sees only their own
DROP POLICY IF EXISTS "Users can view own credit transactions" ON public.credit_transactions;
CREATE POLICY "Users can view own credit transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. dispatch_integrity_report — admin only
DROP POLICY IF EXISTS "Admins read dispatch reports" ON public.dispatch_integrity_report;
CREATE POLICY "Admins read dispatch reports"
  ON public.dispatch_integrity_report FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 8. Add rate_limit_violations table for tracking abuse
CREATE TABLE IF NOT EXISTS public.rate_limit_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  endpoint text NOT NULL,
  violation_count int NOT NULL DEFAULT 1,
  first_violation_at timestamptz NOT NULL DEFAULT now(),
  last_violation_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false
);

ALTER TABLE public.rate_limit_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read rate limit violations"
  ON public.rate_limit_violations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service insert rate limit violations"
  ON public.rate_limit_violations FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 9. Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_user
  ON public.rate_limit_violations(user_id, resolved)
  WHERE resolved = false;
