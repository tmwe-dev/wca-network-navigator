-- Dedup email_sender_groups: keep the row with the highest sort_order per nome_gruppo
-- (the most recent/active seed), migrate any FK refs from address rules, then drop dupes.

DO $$
DECLARE
  v_keep_id uuid;
  v_dup_id uuid;
  v_name text;
BEGIN
  FOR v_name IN
    SELECT nome_gruppo
    FROM public.email_sender_groups
    GROUP BY nome_gruppo
    HAVING count(*) > 1
  LOOP
    -- Survivor: highest sort_order (tiebreak: most recent created_at)
    SELECT id INTO v_keep_id
    FROM public.email_sender_groups
    WHERE nome_gruppo = v_name
    ORDER BY sort_order DESC, created_at DESC
    LIMIT 1;

    FOR v_dup_id IN
      SELECT id
      FROM public.email_sender_groups
      WHERE nome_gruppo = v_name AND id <> v_keep_id
    LOOP
      -- Migrate any address-rule references
      UPDATE public.email_address_rules
      SET group_id = v_keep_id
      WHERE group_id = v_dup_id;

      DELETE FROM public.email_sender_groups WHERE id = v_dup_id;
    END LOOP;
  END LOOP;
END $$;

-- Prevent future duplicates: unique on lower(nome_gruppo) (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS email_sender_groups_nome_gruppo_lower_uniq
  ON public.email_sender_groups (lower(nome_gruppo));
