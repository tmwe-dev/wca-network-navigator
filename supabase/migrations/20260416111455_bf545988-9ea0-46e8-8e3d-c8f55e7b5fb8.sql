-- Infrastruttura impersonation multi-tenant.
-- 1. impersonation_log: audit di chi indossa chi
-- 2. get_current_operator_id(): operator corrispondente a auth.uid(), no impersonation
-- 3. get_active_operator_id(): legge session setting app.active_operator_id se presente e l'user è admin; altrimenti operator di auth.uid()
-- 4. get_effective_operator_ids(): array di operator.id visibili in master mode (tutti se admin+master, singolo altrimenti)

CREATE TABLE IF NOT EXISTS public.impersonation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  target_operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('start', 'stop', 'master_on', 'master_off')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.impersonation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read impersonation_log"
  ON public.impersonation_log FOR SELECT
  TO authenticated
  USING (public.is_operator_admin());

CREATE POLICY "Admins can insert impersonation_log"
  ON public.impersonation_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator_admin() AND actor_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_impersonation_log_actor ON public.impersonation_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_log_target ON public.impersonation_log (target_operator_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_current_operator_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.operators WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_active_operator_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active text;
  v_active_uuid uuid;
  v_caller_is_admin boolean;
BEGIN
  v_caller_is_admin := public.is_operator_admin();
  IF v_caller_is_admin THEN
    v_active := current_setting('app.active_operator_id', true);
    IF v_active IS NOT NULL AND v_active <> '' THEN
      BEGIN
        v_active_uuid := v_active::uuid;
        RETURN v_active_uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RETURN public.get_current_operator_id();
      END;
    END IF;
  END IF;
  RETURN public.get_current_operator_id();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_effective_operator_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master text;
  v_is_admin boolean;
BEGIN
  v_is_admin := public.is_operator_admin();
  v_master := current_setting('app.master_mode', true);
  IF v_is_admin AND v_master = 'true' THEN
    RETURN ARRAY(SELECT id FROM public.operators WHERE is_active = true);
  END IF;
  RETURN ARRAY[public.get_active_operator_id()];
END;
$$;