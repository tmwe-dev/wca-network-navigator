ALTER TABLE public.app_settings ALTER COLUMN user_id DROP NOT NULL;

INSERT INTO public.app_settings (user_id, key, value) VALUES
  (NULL, 'linkedin_daily_limit', '50'),
  (NULL, 'linkedin_hourly_limit', '3'),
  (NULL, 'linkedin_send_start_hour', '9'),
  (NULL, 'linkedin_send_end_hour', '19'),
  (NULL, 'linkedin_min_delay_seconds', '45'),
  (NULL, 'linkedin_max_delay_seconds', '180'),
  (NULL, 'linkedin_bulk_max', '50')
ON CONFLICT (user_id, key) DO NOTHING;