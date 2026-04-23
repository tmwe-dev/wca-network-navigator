-- LOVABLE-89/90: Decision Engine + Approval Flow
ALTER TABLE ai_pending_actions ADD COLUMN IF NOT EXISTS autonomy_level text DEFAULT 'suggest';
ALTER TABLE ai_pending_actions ADD COLUMN IF NOT EXISTS execute_after timestamptz;
ALTER TABLE ai_pending_actions ADD COLUMN IF NOT EXISTS priority smallint DEFAULT 5;

CREATE INDEX IF NOT EXISTS idx_pending_ready_execute
  ON ai_pending_actions(status, execute_after)
  WHERE status = 'approved' AND execute_after IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pending_expires
  ON ai_pending_actions(status, expires_at)
  WHERE status = 'pending';