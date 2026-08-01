-- PR-2 Step B: User-scoped extension session tables
CREATE TABLE IF NOT EXISTS public.user_wca_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cookie TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  has_aspx_auth BOOLEAN NOT NULL DEFAULT false,
  has_wca_cookie BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.user_ra_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cookie TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.user_linkedin_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cookie_encrypted TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.user_wca_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ra_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_linkedin_sessions ENABLE ROW LEVEL SECURITY;

-- Owner-only RLS (service-role bypasses by default in Supabase)
CREATE POLICY "wca_sess_owner_select" ON public.user_wca_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wca_sess_owner_insert" ON public.user_wca_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wca_sess_owner_update" ON public.user_wca_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "wca_sess_owner_delete" ON public.user_wca_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "ra_sess_owner_select" ON public.user_ra_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ra_sess_owner_insert" ON public.user_ra_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ra_sess_owner_update" ON public.user_ra_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ra_sess_owner_delete" ON public.user_ra_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "li_sess_owner_select" ON public.user_linkedin_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "li_sess_owner_insert" ON public.user_linkedin_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "li_sess_owner_update" ON public.user_linkedin_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "li_sess_owner_delete" ON public.user_linkedin_sessions FOR DELETE USING (auth.uid() = user_id);