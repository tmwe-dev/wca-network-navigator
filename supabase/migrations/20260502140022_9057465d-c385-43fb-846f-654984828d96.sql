UPDATE public.app_settings
SET value = 'true'
WHERE key = 'journalist_optimus_enabled' AND value <> 'true';