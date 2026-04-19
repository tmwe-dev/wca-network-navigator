-- Dedup KB entries con tag 'agent_prompt_guide': mantiene 1 riga per titolo (la più recente per created_at), soft-delete le altre tramite DELETE (intercettato dal trigger soft-delete globale).
WITH ranked AS (
  SELECT id, title,
    row_number() OVER (PARTITION BY title ORDER BY created_at DESC, id DESC) AS rn
  FROM public.kb_entries
  WHERE 'agent_prompt_guide' = ANY(tags)
    AND is_active = true
)
DELETE FROM public.kb_entries
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);