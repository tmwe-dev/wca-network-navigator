-- Sprint C.2: Deduplicate operative_prompts (136 → ~54 distinct active)
-- Soft-delete duplicates, keeping only the most recently updated per name.
WITH ranked AS (
  SELECT id, name, updated_at,
         ROW_NUMBER() OVER (PARTITION BY name ORDER BY updated_at DESC, created_at DESC) AS rn
  FROM public.operative_prompts
  WHERE is_active = true AND deleted_at IS NULL
)
UPDATE public.operative_prompts op
SET deleted_at = now(), is_active = false
FROM ranked r
WHERE op.id = r.id AND r.rn > 1;
