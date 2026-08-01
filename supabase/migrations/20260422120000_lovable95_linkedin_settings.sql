-- LOVABLE-95: Move hardcoded LinkedIn operation limits to app_settings table
-- This allows administrators to adjust limits without code changes

-- Insert default values for LinkedIn operation limits
-- Using INSERT with ON CONFLICT to avoid overwriting any existing custom values
INSERT INTO public.app_settings (user_id, key, value) VALUES
  -- Daily limit: 50 messages per day
  (NULL, 'linkedin_daily_limit', '50'),
  -- Hourly limit: 3 messages per hour
  (NULL, 'linkedin_hourly_limit', '3'),
  -- Operating window start hour (CET): 9:00 AM
  (NULL, 'linkedin_send_start_hour', '9'),
  -- Operating window end hour (CET): 19:00 (7:00 PM)
  (NULL, 'linkedin_send_end_hour', '19'),
  -- Minimum delay between messages (seconds): 45
  (NULL, 'linkedin_min_delay_seconds', '45'),
  -- Maximum delay between messages (seconds): 180
  (NULL, 'linkedin_max_delay_seconds', '180'),
  -- Maximum messages per bulk batch: 50
  (NULL, 'linkedin_bulk_max', '50')
ON CONFLICT (user_id, key) DO NOTHING;
