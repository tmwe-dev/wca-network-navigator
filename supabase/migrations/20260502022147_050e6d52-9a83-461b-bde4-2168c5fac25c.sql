
-- ============================================================================
-- AI Interaction Log: registro unificato di tutte le chat AI (testo + voce)
-- e feedback per ottimizzazione prompt
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_interaction_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  operator_id UUID,
  -- 'chat_text' = chat AI testuale, 'voice_tts' = TTS one-shot,
  -- 'voice_conversation' = ElevenLabs conversational, 'voice_stt' = trascrizione utente
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('chat_text','voice_tts','voice_conversation','voice_stt')),
  surface TEXT,                    -- es: 'home_ai_prompt', 'agent_chat', 'staff_chat', 'global_voice_fab'
  conversation_id UUID,            -- raggruppa messaggi della stessa conv
  agent_id UUID,                   -- se proveniente da un agente custom
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL,           -- testo (utente parlato/scritto, o risposta AI)
  model_id TEXT,                   -- es: gemini-2.5-flash, eleven_multilingual_v2
  voice_id TEXT,                   -- es: FGY2WhTYpPnrIDTdsKH5
  language TEXT,                   -- es: 'it', 'en'
  duration_ms INTEGER,             -- durata audio o latenza generazione
  tokens_in INTEGER,
  tokens_out INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_context TEXT,               -- url/route da cui è partita
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_log_user_created ON public.ai_interaction_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_log_conv ON public.ai_interaction_log(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_log_type ON public.ai_interaction_log(interaction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_log_surface ON public.ai_interaction_log(surface);

ALTER TABLE public.ai_interaction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_read_own_ai_log"
ON public.ai_interaction_log FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "owners_insert_ai_log"
ON public.ai_interaction_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Service role bypass è automatico

-- ============================================================================
-- Feedback messaggi (thumbs up/down + note) per loop di ottimizzazione prompt
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_message_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interaction_id UUID NOT NULL REFERENCES public.ai_interaction_log(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),  -- -1 = sbagliato, 1 = ok
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (interaction_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_fb_interaction ON public.ai_message_feedback(interaction_id);
CREATE INDEX IF NOT EXISTS idx_ai_fb_negative ON public.ai_message_feedback(rating, created_at DESC) WHERE rating = -1;

ALTER TABLE public.ai_message_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_read_feedback"
ON public.ai_message_feedback FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "owners_write_feedback"
ON public.ai_message_feedback FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owners_update_feedback"
ON public.ai_message_feedback FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owners_delete_feedback"
ON public.ai_message_feedback FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
