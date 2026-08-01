
-- Add reply_to_email field to operators table
ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS reply_to_email text;

-- Insert commercial reply-to email setting (if not exists)
INSERT INTO public.app_settings (key, value)
VALUES ('commercial_reply_to_email', '')
ON CONFLICT (key) DO NOTHING;
