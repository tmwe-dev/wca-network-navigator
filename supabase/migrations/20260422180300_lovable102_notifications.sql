-- Notifications and Push Subscriptions
-- Lovable #102 — Notification System with Push Notifications

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text NOT NULL CHECK (type IN ('email_received', 'deal_stage_change', 'ai_completed', 'system_error', 'outreach_reply', 'reminder')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  read boolean DEFAULT false,
  dismissed boolean DEFAULT false,
  action_url text,
  entity_type text CHECK (entity_type IN ('partner', 'contact', 'deal', 'email', NULL)),
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_user" ON notifications
  FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type, created_at);
CREATE INDEX idx_notifications_user_type ON notifications(user_id, type);
CREATE INDEX idx_notifications_entity ON notifications(entity_type, entity_id);

-- Push subscription storage
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_sub_user" ON push_subscriptions
  FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO anon, authenticated;
