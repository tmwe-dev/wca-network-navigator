CREATE TABLE ai_daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_date date NOT NULL DEFAULT CURRENT_DATE,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, plan_date)
);
ALTER TABLE ai_daily_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own daily plans" ON ai_daily_plans FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);