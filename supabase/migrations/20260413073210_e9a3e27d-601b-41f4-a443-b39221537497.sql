
-- STEP 1: Extend email_address_rules
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS auto_action text DEFAULT 'none';
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS auto_action_params jsonb DEFAULT '{}';
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS ai_confidence_threshold numeric(3,2) DEFAULT 0.85;
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS auto_execute boolean DEFAULT false;
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS preferred_channel text DEFAULT 'email';
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS tone_override text;
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS topics_to_emphasize text[] DEFAULT '{}';
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS topics_to_avoid text[] DEFAULT '{}';
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS interaction_count integer DEFAULT 0;
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz;
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS success_rate numeric(5,2) DEFAULT 0;
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- STEP 2: Create email_classifications table
CREATE TABLE IF NOT EXISTS email_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_address text NOT NULL,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  contact_id uuid,
  subject text,
  body_preview text,
  direction text NOT NULL DEFAULT 'inbound',
  category text NOT NULL DEFAULT 'uncategorized',
  confidence numeric(3,2) NOT NULL DEFAULT 0,
  ai_summary text,
  keywords text[] DEFAULT '{}',
  urgency text DEFAULT 'normal',
  sentiment text DEFAULT 'neutral',
  detected_patterns text[] DEFAULT '{}',
  reasoning text,
  action_suggested text,
  source_activity_id uuid,
  classified_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_classification UNIQUE(user_id, email_address, source_activity_id)
);

ALTER TABLE email_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own classifications" ON email_classifications FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_classifications_user ON email_classifications(user_id);
CREATE INDEX IF NOT EXISTS idx_classifications_email ON email_classifications(email_address);
CREATE INDEX IF NOT EXISTS idx_classifications_category ON email_classifications(user_id, category);
CREATE INDEX IF NOT EXISTS idx_classifications_partner ON email_classifications(partner_id) WHERE partner_id IS NOT NULL;

-- STEP 3: Create contact_conversation_context table
CREATE TABLE IF NOT EXISTS contact_conversation_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_address text NOT NULL,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  contact_id uuid,
  last_exchanges jsonb DEFAULT '[]',
  conversation_summary text,
  interaction_count integer DEFAULT 0,
  last_interaction_at timestamptz,
  dominant_sentiment text DEFAULT 'neutral',
  response_rate numeric(5,2) DEFAULT 0,
  avg_response_time_hours numeric(8,2),
  preferred_language text DEFAULT 'it',
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_conversation_ctx UNIQUE(user_id, email_address)
);

ALTER TABLE contact_conversation_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversation context" ON contact_conversation_context FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_conv_ctx_user ON contact_conversation_context(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_ctx_email ON contact_conversation_context(email_address);
CREATE INDEX IF NOT EXISTS idx_conv_ctx_partner ON contact_conversation_context(partner_id) WHERE partner_id IS NOT NULL;

-- STEP 4: Create ai_decision_log table
CREATE TABLE IF NOT EXISTS ai_decision_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  contact_id uuid,
  email_address text,
  decision_type text NOT NULL,
  input_context jsonb DEFAULT '{}',
  ai_reasoning text,
  decision_output jsonb DEFAULT '{}',
  confidence numeric(3,2),
  model_used text,
  tokens_used integer,
  was_auto_executed boolean DEFAULT false,
  user_review text,
  user_correction text,
  execution_time_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_decision_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own decisions" ON ai_decision_log FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_decisions_user ON ai_decision_log(user_id);
CREATE INDEX IF NOT EXISTS idx_decisions_type ON ai_decision_log(user_id, decision_type);
CREATE INDEX IF NOT EXISTS idx_decisions_partner ON ai_decision_log(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_created ON ai_decision_log(created_at DESC);

-- STEP 5: Create ai_pending_actions table
CREATE TABLE IF NOT EXISTS ai_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  decision_log_id uuid REFERENCES ai_decision_log(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  contact_id uuid,
  email_address text,
  action_type text NOT NULL,
  action_payload jsonb DEFAULT '{}',
  suggested_content text,
  reasoning text,
  confidence numeric(3,2),
  source text DEFAULT 'ai_classifier',
  status text DEFAULT 'pending',
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  executed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pending actions" ON ai_pending_actions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pending_user_status ON ai_pending_actions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_partner ON ai_pending_actions(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_created ON ai_pending_actions(created_at DESC);

-- STEP 6: Extend mission_actions for cadence scheduling
ALTER TABLE mission_actions ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE mission_actions ADD COLUMN IF NOT EXISTS cadence_rule jsonb DEFAULT NULL;
ALTER TABLE mission_actions ADD COLUMN IF NOT EXISTS trigger_condition text;
ALTER TABLE mission_actions ADD COLUMN IF NOT EXISTS parent_action_id uuid REFERENCES mission_actions(id) ON DELETE SET NULL;
ALTER TABLE mission_actions ADD COLUMN IF NOT EXISTS classification_id uuid;

CREATE INDEX IF NOT EXISTS idx_mission_actions_scheduled ON mission_actions(scheduled_at) WHERE scheduled_at IS NOT NULL AND status = 'pending';
