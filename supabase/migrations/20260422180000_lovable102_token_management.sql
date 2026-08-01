-- Token usage tracking table
CREATE TABLE IF NOT EXISTS ai_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  model text,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  cost_estimate numeric(10,6) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "token_usage_user" ON ai_token_usage FOR ALL USING (user_id = auth.uid());
CREATE INDEX idx_token_usage_user_date ON ai_token_usage(user_id, created_at);
CREATE INDEX idx_token_usage_function ON ai_token_usage(function_name, created_at);

-- Update app_settings table to include user_id column if not exists
ALTER TABLE app_settings ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT NULL;

-- Create unique constraint for user_id + key (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_user_key ON app_settings(user_id, key) WHERE user_id IS NOT NULL;

-- Insert default token settings for existing users
INSERT INTO app_settings (key, value, user_id)
SELECT 'ai_daily_token_limit', '500000', id FROM auth.users
ON CONFLICT (user_id, key) DO NOTHING;

INSERT INTO app_settings (key, value, user_id)
SELECT 'ai_monthly_token_limit', '10000000', id FROM auth.users
ON CONFLICT (user_id, key) DO NOTHING;

-- Per-function limits
INSERT INTO app_settings (key, value, user_id)
SELECT 'ai_max_tokens_generate_email', '1500', id FROM auth.users
ON CONFLICT (user_id, key) DO NOTHING;

INSERT INTO app_settings (key, value, user_id)
SELECT 'ai_max_tokens_generate_outreach', '1200', id FROM auth.users
ON CONFLICT (user_id, key) DO NOTHING;

INSERT INTO app_settings (key, value, user_id)
SELECT 'ai_max_tokens_improve_email', '1500', id FROM auth.users
ON CONFLICT (user_id, key) DO NOTHING;

INSERT INTO app_settings (key, value, user_id)
SELECT 'ai_max_tokens_classify_email', '300', id FROM auth.users
ON CONFLICT (user_id, key) DO NOTHING;

INSERT INTO app_settings (key, value, user_id)
SELECT 'ai_max_tokens_ai_assistant', '2048', id FROM auth.users
ON CONFLICT (user_id, key) DO NOTHING;

INSERT INTO app_settings (key, value, user_id)
SELECT 'ai_max_tokens_daily_briefing', '1000', id FROM auth.users
ON CONFLICT (user_id, key) DO NOTHING;

-- Timing settings
INSERT INTO app_settings (key, value, user_id)
SELECT 'ai_rate_limit_per_minute', '20', id FROM auth.users
ON CONFLICT (user_id, key) DO NOTHING;

INSERT INTO app_settings (key, value, user_id)
SELECT 'ai_cooldown_between_calls_ms', '500', id FROM auth.users
ON CONFLICT (user_id, key) DO NOTHING;
