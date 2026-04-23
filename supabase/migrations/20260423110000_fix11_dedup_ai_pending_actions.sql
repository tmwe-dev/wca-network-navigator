-- FIX 11: Add dedup_key to ai_pending_actions to prevent duplicate pending actions.
-- The system can create the same action multiple times (e.g., two "send_email" for the
-- same partner in the same day). This adds a computed dedup key and a partial unique index
-- on (user_id, dedup_key) WHERE status = 'pending', so only one pending action per
-- user+partner+type+day can exist.

-- Step 1: Add nullable column
ALTER TABLE public.ai_pending_actions
  ADD COLUMN IF NOT EXISTS dedup_key text;

-- Step 2: Backfill existing rows
UPDATE public.ai_pending_actions
SET dedup_key = action_type || ':' || COALESCE(partner_id::text, 'no-partner') || ':' || to_char(created_at, 'YYYY-MM-DD')
WHERE dedup_key IS NULL;

-- Step 3: Create partial unique index (only pending actions must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_pending_actions_dedup
  ON public.ai_pending_actions (user_id, dedup_key)
  WHERE status = 'pending';

-- Step 4: Add a trigger to auto-populate dedup_key on insert
CREATE OR REPLACE FUNCTION public.set_ai_pending_action_dedup_key()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.dedup_key IS NULL THEN
    NEW.dedup_key := NEW.action_type || ':' || COALESCE(NEW.partner_id::text, 'no-partner') || ':' || to_char(COALESCE(NEW.created_at, now()), 'YYYY-MM-DD');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_dedup_key ON public.ai_pending_actions;
CREATE TRIGGER trg_set_dedup_key
  BEFORE INSERT ON public.ai_pending_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ai_pending_action_dedup_key();
