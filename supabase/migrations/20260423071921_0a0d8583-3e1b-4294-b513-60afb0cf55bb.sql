DROP POLICY IF EXISTS "agents_select_all_authenticated" ON public.agents;

DROP POLICY IF EXISTS "agents_select_own" ON public.agents;
CREATE POLICY "agents_select_own" ON public.agents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON POLICY "agents_select_own" ON public.agents IS
  'Users can only view their own agents. Fixed RLS audit issue: replaced USING(true) with proper user_id scoping.';

DROP POLICY IF EXISTS "Authenticated can view investigations" ON public.sherlock_investigations;

DROP POLICY IF EXISTS "Users can view own investigations" ON public.sherlock_investigations;
CREATE POLICY "Users can view own investigations" ON public.sherlock_investigations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view own investigations" ON public.sherlock_investigations IS
  'Users can only view their own investigations. Fixed RLS audit issue: replaced USING(true) with proper user_id scoping.';