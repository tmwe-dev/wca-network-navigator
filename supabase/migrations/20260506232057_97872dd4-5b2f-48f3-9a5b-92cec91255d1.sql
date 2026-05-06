-- P2: Disattiva prompt operativi duplicati per (context, name, tags), mantenendo solo il più recente per ciascun gruppo.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY context, name, tags
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS rn
  FROM public.operative_prompts
  WHERE is_active = true
)
UPDATE public.operative_prompts p
SET is_active = false,
    updated_at = now()
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;