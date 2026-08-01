
-- 1. shared_mailboxes table
CREATE TABLE public.shared_mailboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  email text NOT NULL UNIQUE,
  department text NOT NULL,
  imap_host text DEFAULT 'imaps.aruba.it',
  imap_port integer DEFAULT 993,
  imap_user text,
  imap_password_encrypted text,
  smtp_host text DEFAULT 'smtps.aruba.it',
  smtp_port integer DEFAULT 465,
  smtp_user text,
  smtp_password_encrypted text,
  reply_to text,
  is_active boolean NOT NULL DEFAULT true,
  auto_grant boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.shared_mailboxes ENABLE ROW LEVEL SECURITY;

-- All authenticated operators can read metadata (selector needs it).
-- Sensitive credential columns are hidden via a SECURITY DEFINER function used by the edge.
CREATE POLICY "shared_mailboxes_select_all_authenticated"
  ON public.shared_mailboxes FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "shared_mailboxes_admin_insert"
  ON public.shared_mailboxes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator_admin());

CREATE POLICY "shared_mailboxes_admin_update"
  ON public.shared_mailboxes FOR UPDATE
  TO authenticated
  USING (public.is_operator_admin())
  WITH CHECK (public.is_operator_admin());

CREATE POLICY "shared_mailboxes_admin_delete"
  ON public.shared_mailboxes FOR DELETE
  TO authenticated
  USING (public.is_operator_admin());

CREATE TRIGGER trg_shared_mailboxes_updated_at
  BEFORE UPDATE ON public.shared_mailboxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. operator_mailbox_access table
CREATE TABLE public.operator_mailbox_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  shared_mailbox_id uuid NOT NULL REFERENCES public.shared_mailboxes(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operator_id, shared_mailbox_id)
);

ALTER TABLE public.operator_mailbox_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oma_select_own_or_admin"
  ON public.operator_mailbox_access FOR SELECT
  TO authenticated
  USING (
    public.is_operator_admin()
    OR operator_id = ANY (public.get_effective_operator_ids())
  );

CREATE POLICY "oma_admin_insert"
  ON public.operator_mailbox_access FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator_admin());

CREATE POLICY "oma_admin_delete"
  ON public.operator_mailbox_access FOR DELETE
  TO authenticated
  USING (public.is_operator_admin());

CREATE INDEX idx_oma_operator ON public.operator_mailbox_access(operator_id);
CREATE INDEX idx_oma_mailbox ON public.operator_mailbox_access(shared_mailbox_id);

-- 3. get_accessible_mailboxes function
CREATE OR REPLACE FUNCTION public.get_accessible_mailboxes(p_operator_id uuid DEFAULT NULL)
RETURNS TABLE(
  kind text,
  mailbox_id uuid,
  email text,
  label text,
  department text,
  is_default boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_op_id uuid;
  v_is_admin boolean;
BEGIN
  v_op_id := COALESCE(p_operator_id, public.get_current_operator_id());
  v_is_admin := public.is_operator_admin();

  -- personal mailbox of the operator
  RETURN QUERY
    SELECT 'personal'::text,
           o.id,
           o.email,
           COALESCE(o.name, o.email) AS label,
           'personal'::text,
           true
    FROM public.operators o
    WHERE o.id = v_op_id;

  -- shared mailboxes (admin sees all active; others only granted ones)
  IF v_is_admin THEN
    RETURN QUERY
      SELECT 'shared'::text,
             sm.id,
             sm.email,
             sm.label,
             sm.department,
             false
      FROM public.shared_mailboxes sm
      WHERE sm.is_active = true AND sm.deleted_at IS NULL
      ORDER BY sm.label;
  ELSE
    RETURN QUERY
      SELECT 'shared'::text,
             sm.id,
             sm.email,
             sm.label,
             sm.department,
             false
      FROM public.shared_mailboxes sm
      JOIN public.operator_mailbox_access oma ON oma.shared_mailbox_id = sm.id
      WHERE sm.is_active = true
        AND sm.deleted_at IS NULL
        AND oma.operator_id = v_op_id
      ORDER BY sm.label;
  END IF;
END;
$$;

-- 4. Trigger: auto-grant default mailboxes on operator creation
CREATE OR REPLACE FUNCTION public.on_operator_created_grant_default_mailboxes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.operator_mailbox_access(operator_id, shared_mailbox_id, granted_by)
  SELECT NEW.id, sm.id, NEW.id
  FROM public.shared_mailboxes sm
  WHERE sm.auto_grant = true
    AND sm.is_active = true
    AND sm.deleted_at IS NULL
  ON CONFLICT (operator_id, shared_mailbox_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_grant_default_mailboxes
  AFTER INSERT ON public.operators
  FOR EACH ROW EXECUTE FUNCTION public.on_operator_created_grant_default_mailboxes();

-- 5. shared_mailbox_id on email_sync_state
ALTER TABLE public.email_sync_state
  ADD COLUMN shared_mailbox_id uuid REFERENCES public.shared_mailboxes(id) ON DELETE CASCADE;

CREATE INDEX idx_email_sync_state_shared_mailbox
  ON public.email_sync_state(shared_mailbox_id)
  WHERE shared_mailbox_id IS NOT NULL;

-- 6. Seed default shared mailboxes
INSERT INTO public.shared_mailboxes(slug, label, email, department, auto_grant, description)
VALUES
  ('booking', 'Booking', 'booking@tmwe.it', 'booking', true,
   'Posta operativa preventivi: accessibile a tutti gli operatori autorizzati.'),
  ('amministrazione', 'Amministrazione', 'amministrazione@tmwe.it', 'admin', false,
   'Posta amministrativa: accessibile solo a operatori autorizzati dall''admin.')
ON CONFLICT (slug) DO NOTHING;

-- 7. Backfill: grant booking access to all existing operators
INSERT INTO public.operator_mailbox_access(operator_id, shared_mailbox_id)
SELECT o.id, sm.id
FROM public.operators o
CROSS JOIN public.shared_mailboxes sm
WHERE sm.auto_grant = true
  AND sm.is_active = true
  AND o.is_active = true
ON CONFLICT (operator_id, shared_mailbox_id) DO NOTHING;
