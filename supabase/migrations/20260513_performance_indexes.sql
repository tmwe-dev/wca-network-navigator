-- Sprint I.3 — Additional composite indexes for hot query patterns
-- identified via edge-function logs and React Query refetch analysis.

-- Pending-actions: status + action_type + executed_at for the drainer
-- and the "recently executed" UI panel.
CREATE INDEX IF NOT EXISTS idx_pending_actions_status
  ON ai_pending_actions(status, action_type, executed_at);

-- Channel messages: partner conversation view sorted by most recent.
CREATE INDEX IF NOT EXISTS idx_channel_messages_partner
  ON channel_messages(partner_id, created_at DESC);

-- Email classifications: owner feed sorted by newest first.
CREATE INDEX IF NOT EXISTS idx_email_classifications_owner
  ON email_classifications(created_at DESC, owner_id);
