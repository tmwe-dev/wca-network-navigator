
-- Sprint 1.3: previeni duplicati esatti attivi
CREATE UNIQUE INDEX IF NOT EXISTS operative_prompts_active_unique_idx
ON public.operative_prompts (user_id, context, name)
WHERE is_active = true;

-- Sprint 3.1: ai_interaction_log accetta 'edge_ai'
ALTER TABLE public.ai_interaction_log
DROP CONSTRAINT IF EXISTS ai_interaction_log_interaction_type_check;

ALTER TABLE public.ai_interaction_log
ADD CONSTRAINT ai_interaction_log_interaction_type_check
CHECK (interaction_type = ANY (ARRAY[
  'chat_text'::text,
  'voice_tts'::text,
  'voice_conversation'::text,
  'voice_stt'::text,
  'edge_ai'::text
]));
