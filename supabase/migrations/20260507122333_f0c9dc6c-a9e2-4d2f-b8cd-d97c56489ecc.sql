ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_number text;
COMMENT ON COLUMN public.profiles.whatsapp_number IS 'WhatsApp number in E.164 (aziendale)';

-- Update TMWE handle_new_user-like backfill: copy display_name and phone from auth metadata if missing
UPDATE public.profiles p
SET display_name = COALESCE(p.display_name, u.raw_user_meta_data->>'display_name')
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.display_name IS NULL OR p.display_name = '')
  AND u.raw_user_meta_data->>'display_name' IS NOT NULL;