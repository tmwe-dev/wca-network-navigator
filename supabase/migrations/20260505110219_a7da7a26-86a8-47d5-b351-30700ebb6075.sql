-- ─────────────────────────────────────────────────────────────────────
-- ROLLBACK dedup errata 2026-05-05 (PARTITION senza user_id)
-- Riattiva tutto ciò che la migration precedente aveva soft-deprecato.
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.operative_prompts
SET deprecated_at = NULL,
    deprecated_reason = NULL
WHERE deprecated_reason = 'auto-dedup 2026-05-05: kept latest per (context,name)'
  AND deprecated_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- DEDUP CORRETTA — per (user_id, context, name)
-- Conserva solo il record updated_at più recente all'interno dello stesso utente.
-- ─────────────────────────────────────────────────────────────────────
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, context, name
           ORDER BY updated_at DESC, id DESC
         ) AS rn
  FROM public.operative_prompts
  WHERE deprecated_at IS NULL
    AND user_id IS NOT NULL
)
UPDATE public.operative_prompts op
SET deprecated_at = now(),
    deprecated_reason = 'auto-dedup-per-user-2026-05-05: kept latest per (user_id,context,name)'
FROM ranked r
WHERE op.id = r.id
  AND r.rn > 1;