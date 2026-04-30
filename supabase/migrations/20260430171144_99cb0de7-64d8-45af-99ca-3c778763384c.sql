
-- =====================================================
-- TMWE / findair Integration — MVP schema
-- =====================================================

-- 1. Cached OAuth token (single row, edge-functions only)
CREATE TABLE public.tmwe_oauth_token (
  id           int  PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token text NOT NULL,
  token_type   text NOT NULL DEFAULT 'Bearer',
  expires_at   timestamptz NOT NULL,
  scope        text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tmwe_oauth_token ENABLE ROW LEVEL SECURITY;
-- No policies: only SERVICE_ROLE bypasses RLS, frontend cannot read.

-- 2. Quote snapshots (audit; soft-delete)
CREATE TABLE public.tmwe_quotes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request       jsonb NOT NULL,
  response      jsonb NOT NULL,
  tmwe_listino  text,
  total_amount  numeric,
  currency      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
ALTER TABLE public.tmwe_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tmwe_quotes_select_own
  ON public.tmwe_quotes FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY tmwe_quotes_insert_own
  ON public.tmwe_quotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY tmwe_quotes_update_own
  ON public.tmwe_quotes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX tmwe_quotes_partner_idx ON public.tmwe_quotes(partner_id) WHERE deleted_at IS NULL;
CREATE INDEX tmwe_quotes_user_idx    ON public.tmwe_quotes(user_id)    WHERE deleted_at IS NULL;

CREATE TRIGGER soft_delete_trigger
  BEFORE DELETE ON public.tmwe_quotes
  FOR EACH ROW EXECUTE FUNCTION public.trg_soft_delete();

-- 3. Shipment mirror (soft-delete)
CREATE TABLE public.tmwe_shipments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tmwe_id         text NOT NULL UNIQUE,
  partner_id      uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'draft',
  awb             text,
  tracking_url    text,
  payload         jsonb NOT NULL,
  last_synced_at  timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
ALTER TABLE public.tmwe_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tmwe_shipments_select_own
  ON public.tmwe_shipments FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY tmwe_shipments_insert_own
  ON public.tmwe_shipments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY tmwe_shipments_update_own
  ON public.tmwe_shipments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX tmwe_shipments_partner_idx ON public.tmwe_shipments(partner_id) WHERE deleted_at IS NULL;
CREATE INDEX tmwe_shipments_status_idx  ON public.tmwe_shipments(status)     WHERE deleted_at IS NULL;

CREATE TRIGGER soft_delete_trigger
  BEFORE DELETE ON public.tmwe_shipments
  FOR EACH ROW EXECUTE FUNCTION public.trg_soft_delete();

-- 4. Webhook events log (append-only, edge-functions only)
CREATE TABLE public.tmwe_webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   text NOT NULL,
  tmwe_id      text,
  payload      jsonb NOT NULL,
  signature_ok boolean NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tmwe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: only SERVICE_ROLE; UI fetches via edge function (audit centralizzato).
CREATE INDEX tmwe_webhook_events_type_idx ON public.tmwe_webhook_events(event_type);
CREATE INDEX tmwe_webhook_events_tmwe_idx ON public.tmwe_webhook_events(tmwe_id) WHERE tmwe_id IS NOT NULL;

-- Idempotency: prevent duplicate event processing
CREATE UNIQUE INDEX tmwe_webhook_events_dedup_idx
  ON public.tmwe_webhook_events(event_type, tmwe_id, received_at);

-- 5. Anagrafica cache (read by all authenticated users, write only via service role)
CREATE TABLE public.tmwe_anagrafica_cache (
  id_anagrafica  text PRIMARY KEY,
  rag_soc        text,
  tipo           text,
  pi_cf          text,
  payload        jsonb NOT NULL,
  fetched_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tmwe_anagrafica_cache ENABLE ROW LEVEL SECURITY;

-- Authenticated-only read (mai anonymous), no write/update/delete client-side
CREATE POLICY tmwe_anagra_cache_select_authenticated
  ON public.tmwe_anagrafica_cache FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX tmwe_anagra_cache_rag_soc_idx ON public.tmwe_anagrafica_cache USING gin (to_tsvector('simple', coalesce(rag_soc, '')));
CREATE INDEX tmwe_anagra_cache_pi_cf_idx   ON public.tmwe_anagrafica_cache(pi_cf) WHERE pi_cf IS NOT NULL;

-- 6. Partner ↔ TMWE anagrafica link (opt-in)
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS tmwe_anagrafica_id text;
CREATE INDEX IF NOT EXISTS partners_tmwe_anagrafica_idx
  ON public.partners(tmwe_anagrafica_id)
  WHERE tmwe_anagrafica_id IS NOT NULL;

-- 7. updated_at triggers (use existing standard helper if present, otherwise inline)
CREATE OR REPLACE FUNCTION public.tmwe_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tmwe_quotes_updated_at
  BEFORE UPDATE ON public.tmwe_quotes
  FOR EACH ROW EXECUTE FUNCTION public.tmwe_set_updated_at();

CREATE TRIGGER tmwe_shipments_updated_at
  BEFORE UPDATE ON public.tmwe_shipments
  FOR EACH ROW EXECUTE FUNCTION public.tmwe_set_updated_at();

CREATE TRIGGER tmwe_oauth_token_updated_at
  BEFORE UPDATE ON public.tmwe_oauth_token
  FOR EACH ROW EXECUTE FUNCTION public.tmwe_set_updated_at();
