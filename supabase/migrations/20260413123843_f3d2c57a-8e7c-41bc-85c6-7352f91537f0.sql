-- Add missing columns to email_sender_groups
ALTER TABLE public.email_sender_groups
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_action TEXT CHECK (auto_action IN ('none','archive','label','forward','spam','delete')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS auto_action_params JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Add missing columns to email_address_rules
ALTER TABLE public.email_address_rules
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.email_sender_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_email_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_suggested_group TEXT,
  ADD COLUMN IF NOT EXISTS ai_suggestion_confidence REAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_suggestion_accepted BOOLEAN;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_address_rules_group ON public.email_address_rules(group_id);
CREATE INDEX IF NOT EXISTS idx_email_address_rules_uncategorized ON public.email_address_rules(user_id) WHERE group_id IS NULL;

-- RPC for domain pattern detection
CREATE OR REPLACE FUNCTION public.check_domain_group_pattern(p_user_id UUID, p_domain TEXT, p_min_count INT DEFAULT 3)
RETURNS TABLE(group_name TEXT, group_id UUID, count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT ear.group_name, ear.group_id, COUNT(*) as count
  FROM email_address_rules ear
  WHERE ear.user_id = p_user_id
    AND ear.email_address LIKE '%@' || p_domain
    AND ear.group_id IS NOT NULL
  GROUP BY ear.group_name, ear.group_id
  HAVING COUNT(*) >= p_min_count
  ORDER BY count DESC
  LIMIT 1;
$$;