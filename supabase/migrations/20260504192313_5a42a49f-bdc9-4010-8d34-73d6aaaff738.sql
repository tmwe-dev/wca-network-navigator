
-- =========================================================
-- TMWE Integration: tokens, OAuth state, audit
-- =========================================================

-- 1. System tokens (S2S client_credentials cache)
CREATE TABLE IF NOT EXISTS public.tmwe_system_tokens (
  id boolean PRIMARY KEY DEFAULT true,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tmwe_system_tokens_singleton CHECK (id = true)
);

ALTER TABLE public.tmwe_system_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: service role only

-- 2. User tokens (per-operator OAuth Authorization Code)
CREATE TABLE IF NOT EXISTS public.tmwe_user_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tmwe_user_id bigint NOT NULL UNIQUE,
  tmwe_email text,
  tmwe_company text,
  tmwe_vat_number text,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE public.tmwe_user_tokens ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated:
-- tokens are accessed only via service role from edge functions.

-- 2b. Public view: metadata only (no tokens), scoped to owner
CREATE OR REPLACE VIEW public.tmwe_user_connections_v
WITH (security_invoker = true) AS
SELECT
  user_id,
  tmwe_user_id,
  tmwe_email,
  tmwe_company,
  tmwe_vat_number,
  scopes,
  connected_at,
  last_used_at,
  expires_at,
  (expires_at > now()) AS token_valid
FROM public.tmwe_user_tokens
WHERE user_id = auth.uid();

GRANT SELECT ON public.tmwe_user_connections_v TO authenticated;

-- 3. OAuth state (CSRF protection, 5 min TTL)
CREATE TABLE IF NOT EXISTS public.tmwe_oauth_state (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes')
);

ALTER TABLE public.tmwe_oauth_state ENABLE ROW LEVEL SECURITY;
-- service role only

CREATE INDEX IF NOT EXISTS idx_tmwe_oauth_state_expires_at
  ON public.tmwe_oauth_state(expires_at);

-- 4. Proxy audit (lightweight per-call log)
CREATE TABLE IF NOT EXISTS public.tmwe_proxy_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tmwe_user_id bigint,
  op text NOT NULL,
  identity text NOT NULL,
  status_code int,
  latency_ms int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tmwe_proxy_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tmwe_proxy_audit_owner_select"
  ON public.tmwe_proxy_audit FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_tmwe_proxy_audit_user_created
  ON public.tmwe_proxy_audit(user_id, created_at DESC);
