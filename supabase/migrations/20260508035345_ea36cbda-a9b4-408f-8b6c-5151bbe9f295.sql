
-- AI Test Hub: scenari test custom riusabili contro qualsiasi edge function AI.
CREATE TABLE IF NOT EXISTS public.ai_test_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  target_function TEXT NOT NULL,
  ai_scope TEXT NOT NULL DEFAULT 'lab',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  assertions JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_shared BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_test_scenarios_owner ON public.ai_test_scenarios(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_test_scenarios_category ON public.ai_test_scenarios(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_test_scenarios_target ON public.ai_test_scenarios(target_function) WHERE deleted_at IS NULL;

ALTER TABLE public.ai_test_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View shared or own scenarios"
  ON public.ai_test_scenarios FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (is_shared = true OR owner_id = auth.uid()));

CREATE POLICY "Insert own scenarios"
  ON public.ai_test_scenarios FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Update own scenarios"
  ON public.ai_test_scenarios FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Delete own scenarios"
  ON public.ai_test_scenarios FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER set_ai_test_scenarios_updated_at
  BEFORE UPDATE ON public.ai_test_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: scenari quick-start per finder-api e altri edge AI critici.
INSERT INTO public.ai_test_scenarios (owner_id, name, description, category, target_function, ai_scope, payload, assertions, tags, priority)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  s.name, s.description, s.category, s.target_function, s.ai_scope, s.payload::jsonb, s.assertions::jsonb, s.tags, s.priority
FROM (VALUES
  ('Finder API: profilo TMWE', 'Verifica che l''agente recuperi i dati profilo TMWE.', 'finder-api', 'finder-api-chat', 'finder_api',
    '{"messages":[{"role":"user","content":"Mostrami il mio profilo TMWE"}]}',
    '[{"type":"status_ok"},{"type":"response_min_length","value":20}]',
    ARRAY['finder','smoke'], 10),
  ('Finder API: tracking AWB', 'Tracking AWB di esempio.', 'finder-api', 'finder-api-chat', 'finder_api',
    '{"messages":[{"role":"user","content":"Tracking AWB 020-12345678"}]}',
    '[{"type":"status_ok"}]',
    ARRAY['finder'], 20),
  ('Finder API: ultime spedizioni', 'Ricerca ultime spedizioni utente.', 'finder-api', 'finder-api-chat', 'finder_api',
    '{"messages":[{"role":"user","content":"Le mie ultime spedizioni"}]}',
    '[{"type":"status_ok"}]',
    ARRAY['finder'], 30),
  ('Finder API: rubrica SPL Cargo', 'Cerca un partner nella rubrica.', 'finder-api', 'finder-api-chat', 'finder_api',
    '{"messages":[{"role":"user","content":"Cerca SPL Cargo nella rubrica"}]}',
    '[{"type":"status_ok"}]',
    ARRAY['finder'], 40),
  ('AI Assistant: smoke chat IT', 'Chat di base in italiano.', 'assistant', 'ai-assistant', 'lab',
    '{"messages":[{"role":"user","content":"Salutami in italiano in una sola frase."}],"context":"ai_test_hub"}',
    '[{"type":"status_ok"},{"type":"response_min_length","value":5}]',
    ARRAY['smoke'], 100),
  ('Generate Email: primo contatto IT', 'Email primo contatto generica.', 'email', 'generate-email', 'email',
    '{"standalone":true,"goal":"Primo contatto con freight forwarder italiano","oracle_type":"primo_contatto","oracle_tone":"professionale","use_kb":true,"quality":"fast","recipient_countries":"Italia"}',
    '[{"type":"status_ok"},{"type":"response_contains_key","value":"body"}]',
    ARRAY['email','smoke'], 50),
  ('Categorize content: sample', 'Classificazione contenuto.', 'classification', 'categorize-content', 'classify',
    '{"text":"Buongiorno, vorrei un preventivo per spedizione aerea Milano-Tokyo 500kg."}',
    '[{"type":"status_ok"}]',
    ARRAY['classify'], 200)
) AS s(name, description, category, target_function, ai_scope, payload, assertions, tags, priority)
WHERE NOT EXISTS (SELECT 1 FROM public.ai_test_scenarios WHERE name = s.name);
