DELETE FROM public.email_attachments;
DELETE FROM public.channel_messages WHERE channel = 'email';
UPDATE public.email_sync_state SET last_uid = 0, last_sync_at = NULL;