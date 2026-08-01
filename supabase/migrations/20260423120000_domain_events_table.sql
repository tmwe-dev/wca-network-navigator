-- Domain Events table — persistent event store for Process Manager architecture.
-- Every state-changing action publishes a typed DomainEvent here.
-- Process Managers subscribe and react. This is the single source of truth
-- for "what happened" in the system.

CREATE TABLE IF NOT EXISTS public.domain_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id      uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_type    text NOT NULL,
  correlation_id uuid NOT NULL,
  causation_id  uuid,
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  actor_type    text NOT NULL CHECK (actor_type IN ('user', 'system', 'cron', 'ai_agent', 'trigger')),
  actor_name    text NOT NULL DEFAULT 'unknown',
  payload       jsonb NOT NULL DEFAULT '{}',
  metadata      jsonb,
  processed     boolean NOT NULL DEFAULT false,
  processed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_domain_events_type ON public.domain_events (event_type);
CREATE INDEX IF NOT EXISTS idx_domain_events_correlation ON public.domain_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_user ON public.domain_events (user_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_unprocessed ON public.domain_events (event_type, created_at)
  WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_domain_events_partner ON public.domain_events
  USING gin ((payload->'partnerId'));
CREATE INDEX IF NOT EXISTS idx_domain_events_created ON public.domain_events (created_at DESC);

-- RLS
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own events"
  ON public.domain_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role inserts events"
  ON public.domain_events FOR INSERT
  WITH CHECK (true);

-- Partition hint: if table grows past 10M rows, partition by event_type or created_at month.
COMMENT ON TABLE public.domain_events IS 'Typed domain event store — foundation for Process Manager architecture. Every state change is an event.';
