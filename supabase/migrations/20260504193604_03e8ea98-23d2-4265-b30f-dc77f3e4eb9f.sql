
ALTER TABLE public.tmwe_oauth_state
  ADD COLUMN IF NOT EXISTS intent text NOT NULL DEFAULT 'connect'
    CHECK (intent IN ('connect','login'));

ALTER TABLE public.tmwe_oauth_state
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_via_tmwe boolean NOT NULL DEFAULT false;
