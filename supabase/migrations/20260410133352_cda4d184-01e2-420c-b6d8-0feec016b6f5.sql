
-- 1. Add user_id column (nullable initially for migration)
ALTER TABLE public.app_settings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Assign existing rows to the first auth user found (temporary - we'll let users recreate their own)
UPDATE public.app_settings SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;

-- 3. Make user_id NOT NULL
ALTER TABLE public.app_settings ALTER COLUMN user_id SET NOT NULL;

-- 4. Drop old unique constraint on key (if exists) and add composite unique
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_user_key_unique UNIQUE (user_id, key);

-- 5. Drop old permissive policies
DROP POLICY IF EXISTS "as_select" ON public.app_settings;
DROP POLICY IF EXISTS "as_insert" ON public.app_settings;
DROP POLICY IF EXISTS "as_update" ON public.app_settings;

-- 6. Create proper per-user RLS policies
CREATE POLICY "Users can view own settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON public.app_settings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 7. Index for fast lookups
CREATE INDEX idx_app_settings_user_id ON public.app_settings(user_id);
