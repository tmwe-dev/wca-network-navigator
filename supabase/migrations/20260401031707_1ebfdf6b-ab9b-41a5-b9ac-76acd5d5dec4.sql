-- Add agent branding fields
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS signature_html text,
  ADD COLUMN IF NOT EXISTS signature_image_url text,
  ADD COLUMN IF NOT EXISTS voice_call_url text;

-- Mark activities executed by AI agents
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS executed_by_agent_id uuid;