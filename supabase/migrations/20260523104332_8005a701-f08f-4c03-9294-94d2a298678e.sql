-- AI extract cache: deduplica chiamate sherlock-extract con stessi input
CREATE TABLE IF NOT EXISTS public.ai_extract_cache (
  cache_key TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_ai_extract_cache_expires ON public.ai_extract_cache(expires_at);

ALTER TABLE public.ai_extract_cache ENABLE ROW LEVEL SECURITY;

-- Solo service role accede (edge functions). Nessuna policy = nessun accesso da client.
-- (RLS abilitato, zero policy = lockdown totale lato client; service_role bypassa RLS by design)

COMMENT ON TABLE public.ai_extract_cache IS
  'Cache risultati AI extraction (sherlock-extract) per chiave hash(url+prompt+fields). TTL 7gg. Accesso solo via service_role.';