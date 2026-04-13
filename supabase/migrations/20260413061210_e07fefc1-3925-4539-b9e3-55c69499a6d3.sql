-- Storage bucket for AI knowledge backups
INSERT INTO storage.buckets (id, name, public) VALUES ('ai-backups', 'ai-backups', false)
ON CONFLICT DO NOTHING;

-- RLS: service role full access
CREATE POLICY "Service role full access on ai-backups" ON storage.objects
FOR ALL USING (bucket_id = 'ai-backups' AND auth.role() = 'service_role');

-- RLS: users can read their own backups
CREATE POLICY "Users read own ai-backups" ON storage.objects
FOR SELECT USING (
  bucket_id = 'ai-backups'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Multi-operator foundation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS operator_role text DEFAULT 'operator';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_config jsonb DEFAULT '{}';

COMMENT ON COLUMN public.profiles.operator_role IS 'Role for multi-operator access: admin, operator, viewer';
COMMENT ON COLUMN public.profiles.ai_config IS 'Per-operator AI configuration: tone, language, autonomy level, preferred providers';