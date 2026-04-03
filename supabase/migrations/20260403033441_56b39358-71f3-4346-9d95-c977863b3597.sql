-- 1. Create operators table
CREATE TABLE public.operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  avatar_url text,
  imap_host text DEFAULT 'imaps.aruba.it',
  imap_user text,
  imap_password_encrypted text,
  smtp_host text DEFAULT 'smtps.aruba.it',
  smtp_user text,
  smtp_password_encrypted text,
  smtp_port integer DEFAULT 465,
  whatsapp_phone text,
  linkedin_profile_url text,
  is_admin boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  invited_by uuid,
  invited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read operators (shared data)
CREATE POLICY "Authenticated users can read operators"
  ON public.operators FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete operators
CREATE OR REPLACE FUNCTION public.is_operator_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.operators
    WHERE user_id = auth.uid() AND is_admin = true
  )
$$;

CREATE POLICY "Admins can insert operators"
  ON public.operators FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator_admin() OR NOT EXISTS (SELECT 1 FROM public.operators));

CREATE POLICY "Admins can update operators"
  ON public.operators FOR UPDATE
  TO authenticated
  USING (public.is_operator_admin() OR user_id = auth.uid());

CREATE POLICY "Admins can delete operators"
  ON public.operators FOR DELETE
  TO authenticated
  USING (public.is_operator_admin());

CREATE TRIGGER update_operators_updated_at
  BEFORE UPDATE ON public.operators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add operator_id to channel_messages
ALTER TABLE public.channel_messages
  ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_channel_messages_operator
  ON public.channel_messages (operator_id) WHERE operator_id IS NOT NULL;