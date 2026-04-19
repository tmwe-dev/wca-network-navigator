-- Soft-delete esplicito dei duplicati restanti, mantenendo l'id più piccolo (ordinamento stabile) per titolo.
WITH ranked AS (
  SELECT id, title,
    row_number() OVER (PARTITION BY title ORDER BY id ASC) AS rn
  FROM public.kb_entries
  WHERE 'agent_prompt_guide' = ANY(tags)
    AND is_active = true
)
UPDATE public.kb_entries
SET is_active = false, updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);