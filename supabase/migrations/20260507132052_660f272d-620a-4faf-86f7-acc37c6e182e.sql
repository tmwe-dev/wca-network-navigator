
-- ============================================================
-- 1. Trigger: sync operators.is_admin <-> user_roles.role='admin'
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_operator_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_admin IS TRUE THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'admin'::app_role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_operator_admin_role ON public.operators;
CREATE TRIGGER trg_sync_operator_admin_role
AFTER INSERT OR UPDATE OF is_admin, user_id ON public.operators
FOR EACH ROW
EXECUTE FUNCTION public.sync_operator_admin_role();

-- ============================================================
-- 2. handle_new_user: also create operator row
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_display text;
  v_email   text;
BEGIN
  v_email := lower(coalesce(NEW.email, ''));
  v_display := coalesce(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(v_email, '@', 1),
    v_email
  );

  INSERT INTO public.profiles (user_id, display_name, onboarding_completed)
  VALUES (NEW.id, v_display, false)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 100)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_transactions (user_id, amount, operation, description)
  VALUES (NEW.id, 100, 'topup', 'Crediti di benvenuto');

  -- Bind/create operator row by email if free, otherwise by user_id
  IF v_email <> '' THEN
    -- Adopt orphan operator with same email
    UPDATE public.operators
       SET user_id = NEW.id, updated_at = now()
     WHERE lower(email) = v_email
       AND user_id IS NULL;

    -- If still no operator row for this user, insert one (skip if email already taken by another user)
    IF NOT EXISTS (SELECT 1 FROM public.operators WHERE user_id = NEW.id) THEN
      IF NOT EXISTS (SELECT 1 FROM public.operators WHERE lower(email) = v_email) THEN
        INSERT INTO public.operators (user_id, name, email, is_admin, is_active)
        VALUES (NEW.id, v_display, v_email, false, true);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Reconcile: consolidate Jose duplicate (jose@tmwe.local -> jose@tmwe.it)
-- ============================================================
DO $$
DECLARE
  v_canonical uuid;
  v_legacy    uuid;
BEGIN
  SELECT id INTO v_canonical FROM auth.users WHERE lower(email) = 'jose@tmwe.it' LIMIT 1;
  SELECT id INTO v_legacy    FROM auth.users WHERE lower(email) = 'jose@tmwe.local' LIMIT 1;

  IF v_canonical IS NOT NULL AND v_legacy IS NOT NULL AND v_canonical <> v_legacy THEN
    -- Move operator row from legacy to canonical (only if canonical has none)
    IF NOT EXISTS (SELECT 1 FROM public.operators WHERE user_id = v_canonical) THEN
      UPDATE public.operators
         SET user_id = v_canonical,
             email   = 'jose@tmwe.it',
             is_admin = true,
             is_active = true,
             updated_at = now()
       WHERE user_id = v_legacy;
    END IF;

    -- Revoke legacy tokens
    DELETE FROM public.tmwe_user_tokens WHERE user_id = v_legacy;
  END IF;
END $$;

-- ============================================================
-- 4. Backfill operator rows for existing auth.users
-- ============================================================
INSERT INTO public.operators (user_id, name, email, is_admin, is_active)
SELECT
  au.id,
  coalesce(p.display_name, split_part(lower(au.email), '@', 1), lower(au.email)),
  lower(au.email),
  false,
  true
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE au.email IS NOT NULL
  AND au.email <> ''
  AND NOT EXISTS (SELECT 1 FROM public.operators o WHERE o.user_id = au.id)
  AND NOT EXISTS (SELECT 1 FROM public.operators o WHERE lower(o.email) = lower(au.email));

-- Adopt any orphan operator rows whose email matches an auth user
UPDATE public.operators o
   SET user_id = au.id, updated_at = now()
  FROM auth.users au
 WHERE o.user_id IS NULL
   AND lower(o.email) = lower(au.email);

-- ============================================================
-- 5. Backfill user_roles from operators.is_admin (idempotent)
-- ============================================================
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role
  FROM public.operators
 WHERE is_admin = true AND user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove stale admin roles for users whose operator row says non-admin
DELETE FROM public.user_roles ur
 WHERE ur.role = 'admin'::app_role
   AND EXISTS (
     SELECT 1 FROM public.operators o
      WHERE o.user_id = ur.user_id AND o.is_admin = false
   );

-- ============================================================
-- 6. Force re-onboarding for users who never completed the wizard
--    (proxy: missing display_name OR display_name equals raw email)
-- ============================================================
UPDATE public.profiles p
   SET onboarding_completed = false
  FROM auth.users au
 WHERE p.user_id = au.id
   AND p.onboarding_completed = true
   AND (
        p.display_name IS NULL
     OR p.display_name = ''
     OR lower(p.display_name) = lower(au.email)
   );
