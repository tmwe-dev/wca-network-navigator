
-- Create agents table
CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'outreach',
  avatar_emoji text NOT NULL DEFAULT '🤖',
  system_prompt text NOT NULL DEFAULT '',
  knowledge_base jsonb NOT NULL DEFAULT '[]'::jsonb,
  elevenlabs_agent_id text,
  elevenlabs_voice_id text,
  assigned_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  schedule_config jsonb NOT NULL DEFAULT '{"mode": "manual"}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  stats jsonb NOT NULL DEFAULT '{"tasks_completed": 0, "emails_sent": 0, "calls_made": 0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agents"
  ON public.agents FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create agent_tasks table
CREATE TABLE public.agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  task_type text NOT NULL DEFAULT 'outreach',
  description text NOT NULL DEFAULT '',
  target_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  result_summary text,
  execution_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agent_tasks"
  ON public.agent_tasks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for agent_tasks (for live log updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_tasks;
