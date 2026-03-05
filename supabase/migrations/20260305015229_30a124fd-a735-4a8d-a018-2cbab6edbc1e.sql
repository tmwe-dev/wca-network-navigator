
ALTER TABLE public.import_logs ADD COLUMN IF NOT EXISTS group_name text;

-- Set default group_name from file_name for existing records
UPDATE public.import_logs SET group_name = REPLACE(REPLACE(REPLACE(file_name, '.csv', ''), '.xlsx', ''), '.xls', '') WHERE group_name IS NULL;
