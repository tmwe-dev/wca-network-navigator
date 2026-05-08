-- Sprint 4: Scout cache per-utente
CREATE TABLE IF NOT EXISTS public.funnemail_scout_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_domain text NOT NULL,
  email_address text,
  is_known_partner boolean NOT NULL DEFAULT false,
  partner_id uuid,
  company_type text,
  country text,
  website text,
  role_guess text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric,
  scout_source text,
  cached_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS funnemail_scout_cache_uniq
  ON public.funnemail_scout_cache (user_id, COALESCE(lower(email_address), lower(email_domain)));

CREATE INDEX IF NOT EXISTS funnemail_scout_cache_expires_idx
  ON public.funnemail_scout_cache (expires_at);

ALTER TABLE public.funnemail_scout_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scout_cache_select_own"
  ON public.funnemail_scout_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "scout_cache_modify_own"
  ON public.funnemail_scout_cache FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER funnemail_scout_cache_updated_at
  BEFORE UPDATE ON public.funnemail_scout_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sprint 4: Routing rules composite
CREATE TABLE IF NOT EXISTS public.funnemail_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_group_id uuid,
  target_group_name text,
  confidence_threshold numeric NOT NULL DEFAULT 0.85,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  match_count integer NOT NULL DEFAULT 0,
  last_matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funnemail_routing_rules_user_priority_idx
  ON public.funnemail_routing_rules (user_id, enabled, priority);

ALTER TABLE public.funnemail_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "routing_rules_select_own"
  ON public.funnemail_routing_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "routing_rules_modify_own"
  ON public.funnemail_routing_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER funnemail_routing_rules_updated_at
  BEFORE UPDATE ON public.funnemail_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();