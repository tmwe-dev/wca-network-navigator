
-- ═══ 1. commercial_playbooks ═══
CREATE TABLE IF NOT EXISTS public.commercial_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  workflow_code TEXT,
  prompt_template TEXT DEFAULT '',
  suggested_actions JSONB DEFAULT '[]'::jsonb,
  kb_tags TEXT[] DEFAULT '{}',
  priority INT DEFAULT 5,
  category TEXT DEFAULT 'general',
  is_template BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.commercial_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own + templates" ON public.commercial_playbooks FOR SELECT USING (auth.uid() = user_id OR is_template = true);
CREATE POLICY "Users insert own" ON public.commercial_playbooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own" ON public.commercial_playbooks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own" ON public.commercial_playbooks FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_playbooks_code ON public.commercial_playbooks (code);
CREATE INDEX idx_playbooks_user ON public.commercial_playbooks (user_id);

-- ═══ 2. commercial_workflows ═══
CREATE TABLE IF NOT EXISTS public.commercial_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'sales',
  gates JSONB DEFAULT '[]'::jsonb,
  is_template BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.commercial_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own + templates" ON public.commercial_workflows FOR SELECT USING (auth.uid() = user_id OR is_template = true);
CREATE POLICY "Users insert own" ON public.commercial_workflows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own" ON public.commercial_workflows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own" ON public.commercial_workflows FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_workflows_code ON public.commercial_workflows (code);

-- ═══ 3. partner_workflow_state ═══
CREATE TABLE IF NOT EXISTS public.partner_workflow_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  contact_id UUID,
  workflow_id UUID REFERENCES public.commercial_workflows(id) ON DELETE CASCADE NOT NULL,
  current_gate INT DEFAULT 0,
  status TEXT DEFAULT 'active',
  notes TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.partner_workflow_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own" ON public.partner_workflow_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own" ON public.partner_workflow_state FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own" ON public.partner_workflow_state FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own" ON public.partner_workflow_state FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_pws_partner ON public.partner_workflow_state (partner_id, status);
CREATE INDEX idx_pws_user ON public.partner_workflow_state (user_id, status);

-- ═══ 4. voice_call_sessions ═══
CREATE TABLE IF NOT EXISTS public.voice_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  external_call_id TEXT,
  agent_id TEXT,
  partner_id UUID,
  contact_id UUID,
  direction TEXT DEFAULT 'outbound',
  status TEXT DEFAULT 'active',
  caller_context JSONB DEFAULT '{}'::jsonb,
  transcript JSONB DEFAULT '[]'::jsonb,
  outcome TEXT,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.voice_call_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own" ON public.voice_call_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own" ON public.voice_call_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own" ON public.voice_call_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service inserts" ON public.voice_call_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Service updates" ON public.voice_call_sessions FOR UPDATE USING (true);
CREATE INDEX idx_vcs_external ON public.voice_call_sessions (external_call_id);
CREATE INDEX idx_vcs_user ON public.voice_call_sessions (user_id, status);

-- ═══ 5. request_logs ═══
CREATE TABLE IF NOT EXISTS public.request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT,
  user_id TEXT,
  function_name TEXT NOT NULL,
  channel TEXT DEFAULT 'web',
  http_status INT,
  status TEXT DEFAULT 'ok',
  latency_ms INT,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service inserts" ON public.request_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Users see own" ON public.request_logs FOR SELECT USING (user_id = auth.uid()::text);
CREATE INDEX idx_rlog_trace ON public.request_logs (trace_id);
CREATE INDEX idx_rlog_fn ON public.request_logs (function_name, created_at DESC);

-- ═══ 6. ai_request_log ═══
CREATE TABLE IF NOT EXISTS public.ai_request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT,
  user_id TEXT,
  agent_code TEXT,
  channel TEXT DEFAULT 'web',
  model TEXT,
  latency_ms INT,
  status TEXT DEFAULT 'ok',
  intent TEXT,
  error_message TEXT,
  total_tokens INT,
  routed_to TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service inserts" ON public.ai_request_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Users see own" ON public.ai_request_log FOR SELECT USING (user_id = auth.uid()::text);
CREATE INDEX idx_ailog_trace ON public.ai_request_log (trace_id);
CREATE INDEX idx_ailog_agent ON public.ai_request_log (agent_code, created_at DESC);

-- ═══ 7. ai_session_briefings ═══
CREATE TABLE IF NOT EXISTS public.ai_session_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_code TEXT NOT NULL,
  briefing_type TEXT DEFAULT 'daily',
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_session_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own" ON public.ai_session_briefings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own" ON public.ai_session_briefings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service inserts" ON public.ai_session_briefings FOR INSERT WITH CHECK (true);
CREATE INDEX idx_briefings_user ON public.ai_session_briefings (user_id, agent_code);

-- Triggers for updated_at
CREATE TRIGGER update_commercial_playbooks_updated_at BEFORE UPDATE ON public.commercial_playbooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_commercial_workflows_updated_at BEFORE UPDATE ON public.commercial_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_partner_workflow_state_updated_at BEFORE UPDATE ON public.partner_workflow_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_voice_call_sessions_updated_at BEFORE UPDATE ON public.voice_call_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
