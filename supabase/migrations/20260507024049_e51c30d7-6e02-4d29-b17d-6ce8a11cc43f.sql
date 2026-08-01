-- Fase 5 Brand Voice: pointer ai canonical_id KB brand-voice
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS voice_example_for text[] DEFAULT '{}'::text[];

ALTER TABLE public.funnemail_autoresponder_templates
  ADD COLUMN IF NOT EXISTS voice_example_for text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.email_templates.voice_example_for IS
  'Lista canonical_id KB brand-voice di cui questo template è esempio (es. brand-voice/tone-base, brand-voice/channel-deltas/email). Reversibile, nullable.';

COMMENT ON COLUMN public.funnemail_autoresponder_templates.voice_example_for IS
  'Lista canonical_id KB brand-voice di cui questo template è esempio. Usato dal Brand Voice Dashboard.';

-- Indice GIN per ricerca rapida "tutti i template che esemplificano X"
CREATE INDEX IF NOT EXISTS idx_email_templates_voice_example_for
  ON public.email_templates USING GIN (voice_example_for);

CREATE INDEX IF NOT EXISTS idx_funnemail_autoresp_voice_example_for
  ON public.funnemail_autoresponder_templates USING GIN (voice_example_for);