
-- Whitelist of authorized users
CREATE TABLE public.authorized_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  login_count INTEGER NOT NULL DEFAULT 0,
  added_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;

-- Only admin operators can manage authorized_users
CREATE POLICY "Admins can select authorized_users"
  ON public.authorized_users FOR SELECT
  TO authenticated
  USING (public.is_operator_admin());

CREATE POLICY "Admins can insert authorized_users"
  ON public.authorized_users FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator_admin());

CREATE POLICY "Admins can update authorized_users"
  ON public.authorized_users FOR UPDATE
  TO authenticated
  USING (public.is_operator_admin());

CREATE POLICY "Admins can delete authorized_users"
  ON public.authorized_users FOR DELETE
  TO authenticated
  USING (public.is_operator_admin());

-- Function to check if an email is authorized (used at login, SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_email_authorized(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.authorized_users
    WHERE lower(email) = lower(p_email)
      AND is_active = true
  );
$$;

-- Function to record a login (bump counter + timestamp)
CREATE OR REPLACE FUNCTION public.record_user_login(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.authorized_users
  SET last_login_at = now(),
      login_count = login_count + 1,
      updated_at = now()
  WHERE lower(email) = lower(p_email);
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_authorized_users_updated_at
  BEFORE UPDATE ON public.authorized_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
