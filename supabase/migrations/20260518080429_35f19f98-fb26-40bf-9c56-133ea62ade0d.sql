-- Tabella per il routing AI per scope (modificabile da UI senza redeploy)
CREATE TABLE IF NOT EXISTS public.ai_routing_config (
  scope text PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('anthropic','openai','google','lovable')),
  model text NOT NULL,
  tier text CHECK (tier IN ('heavy','standard','light','vision','embeddings')),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.ai_routing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_routing_config_read_authenticated"
  ON public.ai_routing_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ai_routing_config_write_admin_insert"
  ON public.ai_routing_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ai_routing_config_write_admin_update"
  ON public.ai_routing_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ai_routing_config_write_admin_delete"
  ON public.ai_routing_config FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER trg_ai_routing_config_updated_at
  BEFORE UPDATE ON public.ai_routing_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default mapping
INSERT INTO public.ai_routing_config (scope, provider, model, tier, notes) VALUES
  -- HEAVY: reasoning, agenti, classify complessa
  ('agent_loop',                'anthropic', 'claude-sonnet-4-5',   'heavy',    'Multi-tool agent reasoning'),
  ('agent_execute',             'anthropic', 'claude-sonnet-4-5',   'heavy',    'Agent execution multi-step'),
  ('agentic_decide',            'anthropic', 'claude-sonnet-4-5',   'heavy',    'Decisioni agentiche'),
  ('ai_assistant',              'anthropic', 'claude-sonnet-4-5',   'heavy',    'Assistant principale chat'),
  ('classify_inbound_message',  'anthropic', 'claude-sonnet-4-5',   'heavy',    'Classificazione email inbound (lead status)'),
  ('classify_email_response',   'anthropic', 'claude-sonnet-4-5',   'heavy',    'Classificazione risposte email'),
  ('journalist_review',         'anthropic', 'claude-sonnet-4-5',   'heavy',    'Editorial review obbligatorio email/WA/LI'),
  ('sherlock_extract',          'anthropic', 'claude-sonnet-4-5',   'heavy',    'Sherlock investigator deep search'),
  ('super_mario',               'anthropic', 'claude-sonnet-4-5',   'heavy',    'Super Mario orchestrator'),
  ('analyze_partner',           'anthropic', 'claude-sonnet-4-5',   'heavy',    'Analisi partner completa'),
  ('optimus_analyze',           'anthropic', 'claude-sonnet-4-5',   'heavy',    'Optimus deep analysis'),
  ('finder_api_chat',           'anthropic', 'claude-sonnet-4-5',   'heavy',    'Finder API chat semantica'),
  ('harmonize_proposal_chat',   'anthropic', 'claude-sonnet-4-5',   'heavy',    'Harmonize proposal chat'),

  -- STANDARD: generazione contenuti commerciali
  ('generate_email',            'openai',    'gpt-4o',              'standard', 'Generazione email commerciale'),
  ('generate_outreach',         'openai',    'gpt-4o',              'standard', 'Generazione outreach WA/LI/Email'),
  ('improve_email',             'openai',    'gpt-4o',              'standard', 'Miglioramento bozza email'),
  ('refine_classification_rule','openai',    'gpt-4o',              'standard', 'Refine regole classificazione'),
  ('ai_query_planner',          'openai',    'gpt-4o',              'standard', 'Query planner SQL semantico'),
  ('prompt_copilot_chat',       'openai',    'gpt-4o',              'standard', 'Prompt Lab copilot'),
  ('agent_prompt_refiner',      'openai',    'gpt-4o',              'standard', 'Refine prompt agenti'),
  ('enrich_partner_website',    'openai',    'gpt-4o',              'standard', 'Enrich website partner'),
  ('funnemail_classify',        'openai',    'gpt-4o',              'standard', 'Funnemail classifier deterministico'),
  ('funnemail_auto_route',      'openai',    'gpt-4o',              'standard', 'Funnemail auto routing'),
  ('funnemail_scout_sender',    'openai',    'gpt-4o',              'standard', 'Funnemail scout sender'),
  ('run_funnemail_eval',        'openai',    'gpt-4o',              'standard', 'Funnemail eval'),

  -- LIGHT: classificazione semplice, riassunti, alias
  ('suggest_email_groups',      'google',    'gemini-2.5-flash',    'light',    'Suggest email groups (classifier)'),
  ('categorize_content',        'google',    'gemini-2.5-flash',    'light',    'Categorizzazione contenuti'),
  ('classify_inbound_content',  'google',    'gemini-2.5-flash',    'light',    'Classify generico inbound'),
  ('learn_from_group_correction','google',   'gemini-2.5-flash',    'light',    'Learning loop correzioni gruppi'),
  ('generate_aliases',          'google',    'gemini-2.5-flash',    'light',    'Generazione alias contatti'),
  ('kb_intake_analyze',         'google',    'gemini-2.5-flash',    'light',    'KB intake analyzer'),
  ('summarizer',                'google',    'gemini-2.5-flash',    'light',    'Summarizer conversazioni'),
  ('refresh_conversation_context','google',  'gemini-2.5-flash',    'light',    'Refresh contesto conversazione'),
  ('simulate_funnemail_classify','google',   'gemini-2.5-flash',    'light',    'Simulate funnemail classify'),
  ('process_ai_import',         'google',    'gemini-2.5-flash',    'light',    'Process AI import'),
  ('analyze_import_structure',  'google',    'gemini-2.5-flash',    'light',    'Analyze import structure'),
  ('agent_simulate',            'google',    'gemini-2.5-flash',    'light',    'Agent simulator dry-run'),
  ('prompt_test_runner',        'google',    'gemini-2.5-flash',    'light',    'Prompt regression test runner'),
  ('analysis_tools',            'google',    'gemini-2.5-flash',    'light',    'Analysis tools (agent)'),

  -- VISION: OCR e parsing immagini
  ('parse_business_card',       'google',    'gemini-2.5-flash',    'vision',   'OCR business card'),
  ('ai_match_business_cards',   'google',    'gemini-2.5-flash',    'vision',   'Match BC partner'),
  ('whatsapp_ai_extract',       'google',    'gemini-2.5-flash',    'vision',   'WA AI extract'),
  ('linkedin_ai_extract',       'google',    'gemini-2.5-flash',    'vision',   'LinkedIn AI extract'),
  ('parse_profile_ai',          'google',    'gemini-2.5-flash',    'vision',   'Parse profilo AI'),

  -- EMBEDDINGS: dedicato (gestito da _shared/embeddings.ts)
  ('embeddings',                'openai',    'text-embedding-3-small', 'embeddings', 'Embeddings RAG/KB/memory — dim 1536')
ON CONFLICT (scope) DO NOTHING;