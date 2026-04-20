-- Visibilità globale agenti: tutti gli operatori autenticati vedono tutti gli agenti.
-- Mantengo write/delete ristretti a chi possiede l'agente (o admin).

DROP POLICY IF EXISTS agents_select_own ON public.agents;

CREATE POLICY agents_select_all_authenticated
  ON public.agents
  FOR SELECT
  TO authenticated
  USING (true);
