-- TMWE: link partner ⇄ cliente ERP, snapshot, fatturato mensile, audit

-- 1) tmwe_partner_links
CREATE TABLE IF NOT EXISTS public.tmwe_partner_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  tmwe_client_id text NOT NULL,
  tmwe_vat text,
  match_confidence text NOT NULL CHECK (match_confidence IN ('exact_vat','vies','manual','name_fuzzy')),
  linked_by_user_id uuid,
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tmwe_partner_links_partner_unique UNIQUE (partner_id),
  CONSTRAINT tmwe_partner_links_client_unique UNIQUE (tmwe_client_id)
);
CREATE INDEX IF NOT EXISTS idx_tmwe_partner_links_client ON public.tmwe_partner_links(tmwe_client_id);

ALTER TABLE public.tmwe_partner_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read tmwe links"
  ON public.tmwe_partner_links FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE solo via service role (edge functions). Nessuna policy = nessun accesso authenticated.

-- 2) tmwe_customer_snapshot
CREATE TABLE IF NOT EXISTS public.tmwe_customer_snapshot (
  tmwe_client_id text PRIMARY KEY,
  denomination text,
  vat text,
  is_active boolean NOT NULL DEFAULT true,
  assigned_price_list_id text,
  assigned_price_list_name text,
  raw_payload jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tmwe_snapshot_vat ON public.tmwe_customer_snapshot(vat);
CREATE INDEX IF NOT EXISTS idx_tmwe_snapshot_active ON public.tmwe_customer_snapshot(is_active);

ALTER TABLE public.tmwe_customer_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read tmwe snapshots"
  ON public.tmwe_customer_snapshot FOR SELECT
  TO authenticated
  USING (true);

-- 3) tmwe_revenue_monthly
CREATE TABLE IF NOT EXISTS public.tmwe_revenue_monthly (
  tmwe_client_id text NOT NULL,
  year smallint NOT NULL,
  month smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  revenue_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  invoices_count integer NOT NULL DEFAULT 0,
  services_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tmwe_client_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_tmwe_revenue_client ON public.tmwe_revenue_monthly(tmwe_client_id);

ALTER TABLE public.tmwe_revenue_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read tmwe revenue"
  ON public.tmwe_revenue_monthly FOR SELECT
  TO authenticated
  USING (true);

-- 4) tmwe_request_audit
CREATE TABLE IF NOT EXISTS public.tmwe_request_audit (
  id bigserial PRIMARY KEY,
  op_name text NOT NULL,
  identity text NOT NULL,
  caller_user_id uuid,
  partner_id uuid,
  status integer NOT NULL,
  latency_ms integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tmwe_audit_created ON public.tmwe_request_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tmwe_audit_op ON public.tmwe_request_audit(op_name);

ALTER TABLE public.tmwe_request_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read tmwe audit"
  ON public.tmwe_request_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));