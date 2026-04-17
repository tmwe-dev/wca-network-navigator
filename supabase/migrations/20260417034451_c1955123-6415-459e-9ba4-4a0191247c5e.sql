-- Assicura colonne soft-delete anche su imported_contacts
ALTER TABLE public.imported_contacts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_imported_contacts_not_deleted
  ON public.imported_contacts (created_at DESC) WHERE deleted_at IS NULL;

-- Funzione trigger generica
CREATE OR REPLACE FUNCTION public.trg_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RETURN OLD;
  END IF;

  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;

  EXECUTE format(
    'UPDATE %I.%I SET deleted_at = now(), deleted_by = $1 WHERE id = $2',
    TG_TABLE_SCHEMA, TG_TABLE_NAME
  ) USING v_uid, OLD.id;

  RETURN NULL;
END;
$$;

-- Installa trigger e policy RESTRICTIVE su tutte le tabelle business
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'partners', 'partner_contacts', 'business_cards', 'activities', 'reminders',
    'agents', 'outreach_missions', 'outreach_queue', 'mission_actions',
    'channel_messages', 'kb_entries', 'ai_memory', 'email_address_rules',
    'import_logs', 'imported_contacts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS soft_delete_trigger ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER soft_delete_trigger BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trg_soft_delete()',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS hide_soft_deleted ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY hide_soft_deleted ON public.%I AS RESTRICTIVE FOR SELECT TO public USING (deleted_at IS NULL)',
      t
    );
  END LOOP;
END;
$$;
