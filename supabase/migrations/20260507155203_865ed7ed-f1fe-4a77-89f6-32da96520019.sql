-- 1) Dedup tutte le righe duplicate (qualunque key) tenendo la più recente
DELETE FROM public.app_settings a
USING public.app_settings b
WHERE a.ctid < b.ctid
  AND a.key = b.key;

-- 2) Vincolo di unicità sulla chiave (evita futuri duplicati)
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_key_unique UNIQUE (key);

-- 3) Inserimento impostazioni auto-sync LinkedIn lente
INSERT INTO public.app_settings (key, value) VALUES
  ('linkedin_auto_sync_enabled', 'true'),
  ('linkedin_read_times_per_day', '3'),
  ('linkedin_read_start_hour', '9'),
  ('linkedin_read_end_hour', '19')
ON CONFLICT (key) DO NOTHING;