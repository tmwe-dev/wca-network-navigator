CREATE TABLE IF NOT EXISTS public.blacklist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email text,
  domain text,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blacklist_has_target CHECK (email IS NOT NULL OR domain IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_blacklist_user_email ON public.blacklist (user_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_blacklist_user_domain ON public.blacklist (user_id, lower(domain));

ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own blacklist entries" ON public.blacklist;
CREATE POLICY "Users can view their own blacklist entries"
ON public.blacklist
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own blacklist entries" ON public.blacklist;
CREATE POLICY "Users can create their own blacklist entries"
ON public.blacklist
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own blacklist entries" ON public.blacklist;
CREATE POLICY "Users can update their own blacklist entries"
ON public.blacklist
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own blacklist entries" ON public.blacklist;
CREATE POLICY "Users can delete their own blacklist entries"
ON public.blacklist
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_blacklist_updated_at ON public.blacklist;
CREATE TRIGGER update_blacklist_updated_at
BEFORE UPDATE ON public.blacklist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();