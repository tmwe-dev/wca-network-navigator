-- Condividere a livello workspace: gruppi (già fatto), regole indirizzo, prompt operativi.
-- Aggiungo policy PERMISSIVE "shared" su email_address_rules e operative_prompts.
-- Le policy esistenti restano (sono PERMISSIVE, vengono OR-unite).

-- email_address_rules: shared read/write tra tutti gli operatori autenticati
DROP POLICY IF EXISTS ear_shared_select ON public.email_address_rules;
CREATE POLICY ear_shared_select ON public.email_address_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS ear_shared_insert ON public.email_address_rules;
CREATE POLICY ear_shared_insert ON public.email_address_rules
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS ear_shared_update ON public.email_address_rules;
CREATE POLICY ear_shared_update ON public.email_address_rules
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ear_shared_delete ON public.email_address_rules;
CREATE POLICY ear_shared_delete ON public.email_address_rules
  FOR DELETE TO authenticated USING (true);

-- operative_prompts: shared read/write tra tutti gli operatori autenticati
DROP POLICY IF EXISTS op_shared_select ON public.operative_prompts;
CREATE POLICY op_shared_select ON public.operative_prompts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS op_shared_insert ON public.operative_prompts;
CREATE POLICY op_shared_insert ON public.operative_prompts
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS op_shared_update ON public.operative_prompts;
CREATE POLICY op_shared_update ON public.operative_prompts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS op_shared_delete ON public.operative_prompts;
CREATE POLICY op_shared_delete ON public.operative_prompts
  FOR DELETE TO authenticated USING (true);