ALTER TABLE public.extension_dispatch_queue
  ADD COLUMN IF NOT EXISTS scheduled_for timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_dispatch_queue_scheduled
  ON public.extension_dispatch_queue (status, scheduled_for)
  WHERE status = 'pending';

COMMENT ON COLUMN public.extension_dispatch_queue.scheduled_for IS
  'When NULL, message is ready to be dispatched. When set in future, extension should defer dispatch until this time. Used for rate-limited bulk sends (e.g. LinkedIn 3/hour).';