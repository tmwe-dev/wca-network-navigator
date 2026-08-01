-- 1) Action taxonomy enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'funnemail_action_type') THEN
    CREATE TYPE public.funnemail_action_type AS ENUM (
      'tag_only',
      'deep_search',
      'draft_reply',
      'crm_update',
      'imap_action',
      'escalate',
      'autoresponder',
      'snooze'
    );
  END IF;
END$$;

-- 2) Estensione log per action_type + idempotency_key
ALTER TABLE public.funnemail_actions_log
  ADD COLUMN IF NOT EXISTS action_type public.funnemail_action_type,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS funnemail_actions_log_idem_uq
  ON public.funnemail_actions_log (message_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Backfill action_type dai record esistenti (best-effort: action testuale → enum se valida)
UPDATE public.funnemail_actions_log
SET action_type = action::public.funnemail_action_type
WHERE action_type IS NULL
  AND action IN ('tag_only','deep_search','draft_reply','crm_update','imap_action','escalate','autoresponder','snooze');

-- 3) Per-user policy overrides
CREATE TABLE IF NOT EXISTS public.funnemail_policy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global','group','domain','sender')),
  match_value TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS funnemail_policy_user_scope_idx
  ON public.funnemail_policy (user_id, scope, priority);

CREATE UNIQUE INDEX IF NOT EXISTS funnemail_policy_unique_match
  ON public.funnemail_policy (user_id, scope, COALESCE(match_value, ''))
  WHERE deleted_at IS NULL;

ALTER TABLE public.funnemail_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own funnemail policy" ON public.funnemail_policy;
CREATE POLICY "Users view own funnemail policy"
  ON public.funnemail_policy
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own funnemail policy" ON public.funnemail_policy;
CREATE POLICY "Users insert own funnemail policy"
  ON public.funnemail_policy
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own funnemail policy" ON public.funnemail_policy;
CREATE POLICY "Users update own funnemail policy"
  ON public.funnemail_policy
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own funnemail policy" ON public.funnemail_policy;
CREATE POLICY "Users delete own funnemail policy"
  ON public.funnemail_policy
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_funnemail_policy_updated
  BEFORE UPDATE ON public.funnemail_policy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Helper: risolve la policy effettiva per un mittente di un utente
-- (priorità: sender > domain > group > global). Ritorna la più prioritaria abilitata.
CREATE OR REPLACE FUNCTION public.resolve_funnemail_policy(
  p_user_id UUID,
  p_from_address TEXT,
  p_group_id UUID DEFAULT NULL
)
RETURNS TABLE (scope TEXT, match_value TEXT, policy JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dom AS (
    SELECT lower(split_part(p_from_address, '@', 2)) AS d
  )
  SELECT fp.scope, fp.match_value, fp.policy
  FROM public.funnemail_policy fp, dom
  WHERE fp.user_id = p_user_id
    AND fp.enabled = true
    AND fp.deleted_at IS NULL
    AND (
      (fp.scope = 'sender' AND lower(fp.match_value) = lower(p_from_address))
      OR (fp.scope = 'domain' AND lower(fp.match_value) = dom.d)
      OR (fp.scope = 'group'  AND p_group_id IS NOT NULL AND fp.match_value = p_group_id::text)
      OR (fp.scope = 'global')
    )
  ORDER BY
    CASE fp.scope
      WHEN 'sender' THEN 1
      WHEN 'domain' THEN 2
      WHEN 'group'  THEN 3
      WHEN 'global' THEN 4
    END,
    fp.priority ASC
  LIMIT 1;
$$;