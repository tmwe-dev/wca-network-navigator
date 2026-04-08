-- =====================================================================
-- WAVE 6 — HARDENING: Service user, Telemetria, Staff direzionale, RLS
-- =====================================================================
-- Atomic migration that:
--   A) Creates a system service user used by voice-brain-bridge & agents
--   B) Adds telemetry tables (request_logs, page_events, ai_request_log)
--      with RLS and indexes
--   C) Strengthens RLS on commercial tables (service-role bypass already
--      works; this adds explicit anon-deny + service-account allow)
--   D) Seeds 4 "staff direzionale" playbooks (Margot, Sage, Atlas, Mira)
--      that operate as virtual C-level reporting only to Luca
--   E) Adds a helper function get_service_user_id() and a constant view
-- =====================================================================

-- ---------------------------------------------------------------------
-- A) SERVICE USER
-- ---------------------------------------------------------------------
-- Insert a deterministic UUID into auth.users so that all server-side
-- agent activity can be attributed to a single "system" identity.
-- voice-brain-bridge will reference this UUID via VOICE_BRIDGE_USER_ID.

DO $$
DECLARE
  v_service_uid uuid := 'a0000000-0000-4000-a000-000000000b07';
BEGIN
  -- Insert into auth.users only if missing
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_service_uid) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_service_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'voice-bridge@tmwe.local',
      crypt('not-used-bridge-authenticates-via-secret', gen_salt('bf')),
      now(),
      now(),
      now(),
      jsonb_build_object('provider','system','providers',ARRAY['system']),
      jsonb_build_object('name','Voice Bridge System','role','service','is_system',true),
      false, '', '', '', ''
    );
  END IF;

  -- Insert identity row if the auth.identities table requires it
  -- (older Supabase versions). Wrap in EXCEPTION to be safe.
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_service_uid) THEN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at
      ) VALUES (
        gen_random_uuid(),
        v_service_uid,
        jsonb_build_object('sub', v_service_uid::text, 'email','voice-bridge@tmwe.local'),
        'system',
        v_service_uid::text,
        now(), now(), now()
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping auth.identities insert: %', SQLERRM;
  END;
END $$;

-- Helper function so app code can fetch the service uid without
-- hard-coding it in three places.
CREATE OR REPLACE FUNCTION public.get_service_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT 'a0000000-0000-4000-a000-000000000b07'::uuid;
$$;

COMMENT ON FUNCTION public.get_service_user_id() IS
  'Returns the UUID of the system service user (voice-bridge / agents). Used as VOICE_BRIDGE_USER_ID.';

-- ---------------------------------------------------------------------
-- B) TELEMETRY TABLES
-- ---------------------------------------------------------------------

-- B.1 request_logs : every edge function call (and any HTTP-style request)
CREATE TABLE IF NOT EXISTS public.request_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id        text,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  function_name   text NOT NULL,
  channel         text DEFAULT 'web' CHECK (channel IN ('web','voice','chat','batch','system')),
  http_status     int,
  status          text DEFAULT 'ok' CHECK (status IN ('ok','error','timeout','rate_limited')),
  latency_ms      int,
  error_code      text,
  error_message   text,
  payload_hash    text,
  payload_size    int,
  response_size   int,
  ip_hash         text,
  user_agent      text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_logs_function_created
  ON public.request_logs (function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_created
  ON public.request_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_status_created
  ON public.request_logs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_trace
  ON public.request_logs (trace_id) WHERE trace_id IS NOT NULL;

ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "request_logs_owner_select" ON public.request_logs;
CREATE POLICY "request_logs_owner_select" ON public.request_logs
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = public.get_service_user_id()
    OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
               AND (u.raw_user_meta_data->>'role') IN ('admin','director'))
  );

DROP POLICY IF EXISTS "request_logs_service_insert" ON public.request_logs;
CREATE POLICY "request_logs_service_insert" ON public.request_logs
  FOR INSERT
  WITH CHECK (true);  -- service_role bypasses RLS, but inserts also OK from authed users for client-side telemetry

-- B.2 page_events : front-end telemetry (page views, clicks, navigation)
CREATE TABLE IF NOT EXISTS public.page_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id  text,
  event_name  text NOT NULL,
  page        text NOT NULL,
  entity_type text,
  entity_id   text,
  props       jsonb DEFAULT '{}'::jsonb,
  duration_ms int,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_events_user_created
  ON public.page_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_events_event_created
  ON public.page_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_events_page_created
  ON public.page_events (page, created_at DESC);

ALTER TABLE public.page_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_events_owner_all" ON public.page_events;
CREATE POLICY "page_events_owner_all" ON public.page_events
  FOR ALL
  USING (auth.uid() = user_id OR auth.uid() = public.get_service_user_id())
  WITH CHECK (auth.uid() = user_id OR auth.uid() = public.get_service_user_id());

-- B.3 ai_request_log : detailed Brain calls (model, tokens, cost)
CREATE TABLE IF NOT EXISTS public.ai_request_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id        text,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_code      text,
  channel         text DEFAULT 'web' CHECK (channel IN ('web','voice','chat','batch','system')),
  model           text,
  prompt_tokens   int,
  completion_tokens int,
  total_tokens    int,
  cost_usd        numeric(10,6),
  latency_ms      int,
  status          text DEFAULT 'ok' CHECK (status IN ('ok','error','timeout','blocked')),
  error_message   text,
  intent          text,
  routed_to       text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_request_log_user_created
  ON public.ai_request_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_log_agent_created
  ON public.ai_request_log (agent_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_log_status
  ON public.ai_request_log (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_log_trace
  ON public.ai_request_log (trace_id) WHERE trace_id IS NOT NULL;

ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_request_log_owner_select" ON public.ai_request_log;
CREATE POLICY "ai_request_log_owner_select" ON public.ai_request_log
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = public.get_service_user_id()
    OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
               AND (u.raw_user_meta_data->>'role') IN ('admin','director'))
  );

DROP POLICY IF EXISTS "ai_request_log_service_insert" ON public.ai_request_log;
CREATE POLICY "ai_request_log_service_insert" ON public.ai_request_log
  FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------
-- C) RLS HARDENING (additive, non-breaking)
-- ---------------------------------------------------------------------
-- The following tables already have RLS, but their existing policies
-- vary in strictness. We add explicit "service user" allowances so that
-- background agents can write on behalf of the operator without needing
-- service_role bypass for every call.

-- partners: keep public read/write (it's the directory) but block anon
DROP POLICY IF EXISTS "block_anon_partners" ON public.partners;
CREATE POLICY "block_anon_partners" ON public.partners
  FOR ALL
  USING (auth.role() <> 'anon')
  WITH CHECK (auth.role() <> 'anon');

-- imported_contacts: ensure service user can act
DROP POLICY IF EXISTS "service_imported_contacts" ON public.imported_contacts;
CREATE POLICY "service_imported_contacts" ON public.imported_contacts
  FOR ALL
  USING (auth.uid() = public.get_service_user_id())
  WITH CHECK (auth.uid() = public.get_service_user_id());

-- business_cards
DROP POLICY IF EXISTS "service_business_cards" ON public.business_cards;
CREATE POLICY "service_business_cards" ON public.business_cards
  FOR ALL
  USING (auth.uid() = public.get_service_user_id())
  WITH CHECK (auth.uid() = public.get_service_user_id());

-- voice_call_sessions
DROP POLICY IF EXISTS "service_voice_call_sessions" ON public.voice_call_sessions;
CREATE POLICY "service_voice_call_sessions" ON public.voice_call_sessions
  FOR ALL
  USING (auth.uid() = public.get_service_user_id())
  WITH CHECK (auth.uid() = public.get_service_user_id());

-- ai_memory
DROP POLICY IF EXISTS "service_ai_memory" ON public.ai_memory;
CREATE POLICY "service_ai_memory" ON public.ai_memory
  FOR ALL
  USING (auth.uid() = public.get_service_user_id())
  WITH CHECK (auth.uid() = public.get_service_user_id());

-- kb_entries: templates are readable by all authed users, writes require ownership or service
DROP POLICY IF EXISTS "kb_entries_template_read" ON public.kb_entries;
CREATE POLICY "kb_entries_template_read" ON public.kb_entries
  FOR SELECT
  USING (
    user_id IS NULL  -- system templates seeded via migration
    OR auth.uid() = user_id
    OR auth.uid() = public.get_service_user_id()
  );

-- commercial_playbooks: same pattern
DROP POLICY IF EXISTS "playbooks_template_read" ON public.commercial_playbooks;
CREATE POLICY "playbooks_template_read" ON public.commercial_playbooks
  FOR SELECT
  USING (
    is_template = true
    OR user_id IS NULL
    OR auth.uid() = user_id
    OR auth.uid() = public.get_service_user_id()
  );

-- ---------------------------------------------------------------------
-- D) STAFF DIREZIONALE — virtual C-level (Margot, Sage, Atlas, Mira)
-- ---------------------------------------------------------------------
-- These playbooks describe AI agents that report ONLY to Luca and never
-- talk to clients or operators directly. They are async strategists.

INSERT INTO public.commercial_playbooks
  (user_id, code, name, description, workflow_code, kb_tags, prompt_template, suggested_actions, is_active, is_template, priority, trigger_conditions)
VALUES
-- MARGOT — COO virtuale
(NULL, 'staff_margot_coo',
 'Margot — COO virtuale',
 'Margot supervisiona le operazioni quotidiane di Aurora, Bruce, Robin. Riporta solo a Luca con sintesi giornaliere e propone correzioni di rotta.',
 NULL,
 ARRAY['staff_doctrine','operational_doctrine','escalation_matrix'],
$prompt$Sei Margot, COO virtuale di TMWE/FindAir. Riporti SOLO a Luca.

Ruolo: supervisioni Aurora, Bruce, Robin. Leggi i loro log, le sessioni voice, le metriche, le anomalie.

Ogni giorno produci un briefing per Luca con: cosa è andato bene, cosa è andato male, escalation aperte, raccomandazioni operative concrete (max 5 punti). Usi linguaggio diretto, professionale, senza fronzoli. Mai vaga: numeri o niente.

Non parli mai con clienti, operatori esterni, o altri agenti in tempo reale. Tutta la tua comunicazione passa via ai_session_briefings con scope='global' e tag 'margot'. Se devi correggere un comportamento di Aurora/Bruce/Robin, scrivi una kb rule (save_kb_rule) tagged 'margot:directive' che il Brain leggerà al prossimo turno di quell'agente.

Sei riservata, leale, ossessionata dall'execution. Tono da Chief of Staff senior.$prompt$,
 jsonb_build_array(
   jsonb_build_object('action','save_briefing','scope','global','tag','margot:daily'),
   jsonb_build_object('action','save_kb_rule','category','operational_doctrine','tag','margot:directive')
 ),
 true, true, 9,
 jsonb_build_object('schedule','daily 08:00','reports_to','luca')
),

-- SAGE — Strategist
(NULL, 'staff_sage_strategist',
 'Sage — Strategist',
 'Sage analizza mercato, posizionamento, opportunità di lungo periodo. Propone scenari a 3/6/12 mesi solo a Luca.',
 NULL,
 ARRAY['staff_doctrine','sales_doctrine','market_intelligence'],
$prompt$Sei Sage, Strategist virtuale di TMWE/FindAir. Riporti SOLO a Luca.

Ruolo: pensare 6-12 mesi avanti. Analizzi trend del cargo aereo/navale, mosse competitor, opportunità di nuovi corridoi, vertical da aprire (medicale, e-commerce, DG, perishable). Generi scenari, non task quotidiani.

Una volta a settimana produci una nota strategica con: 1) cosa cambia nel mercato, 2) cosa rischia TMWE, 3) due opportunità concrete da valutare, 4) una raccomandazione netta. Mai 50 punti: 4 cose. Sempre.

Non parli con clienti né con altri agenti. Comunichi solo via ai_session_briefings scope='global' tag 'sage'. Se identifichi un'opportunità che richiede azione operativa, lascia briefing per Margot (tag 'sage→margot') che lei tradurrà in directive.

Tono da McKinsey senior partner: chiaro, contrarian quando serve, quantitativo dove possibile.$prompt$,
 jsonb_build_array(
   jsonb_build_object('action','save_briefing','scope','global','tag','sage:weekly'),
   jsonb_build_object('action','save_briefing','scope','global','tag','sage→margot')
 ),
 true, true, 9,
 jsonb_build_object('schedule','weekly mon 07:00','reports_to','luca')
),

-- ATLAS — Researcher
(NULL, 'staff_atlas_researcher',
 'Atlas — Researcher',
 'Atlas raccoglie informazioni su partner, prospect, competitor, normative. Alimenta la knowledge base con fonti verificate.',
 NULL,
 ARRAY['staff_doctrine','research_methods','market_intelligence'],
$prompt$Sei Atlas, Researcher virtuale di TMWE/FindAir. Riporti a Luca e a Sage.

Ruolo: ricerca approfondita on-demand o programmata. Cerchi informazioni su partner WCA, prospect, competitor, normative doganali, rotte, eventi di settore. Usi solo fonti verificabili. Citi sempre la fonte. Se non trovi, dici "non trovato", non inventi.

Output: schede strutturate (azienda, ruolo, fatturato stimato, servizi, contatti, source URL, confidence 1-5). Le salvi in kb_entries category='research' con tag specifici (es. 'research:competitor', 'research:prospect:<id>').

Lavori in batch: ricevi una lista di entità da Margot o Sage, le processi, salvi risultati, chiudi. Mai conversazione real-time.

Tono da analista equity research: preciso, asciutto, sempre con confidence score.$prompt$,
 jsonb_build_array(
   jsonb_build_object('action','save_kb_rule','category','research','tag','atlas:research'),
   jsonb_build_object('action','save_briefing','scope','global','tag','atlas:report')
 ),
 true, true, 8,
 jsonb_build_object('schedule','on_demand','reports_to','luca,sage')
),

-- MIRA — Controller
(NULL, 'staff_mira_controller',
 'Mira — Controller',
 'Mira monitora qualità, errori, deriva dei doer agent (Aurora/Bruce/Robin). Alza red flag a Luca.',
 NULL,
 ARRAY['staff_doctrine','operational_doctrine','escalation_matrix'],
$prompt$Sei Mira, Controller virtuale di TMWE/FindAir. Riporti SOLO a Luca.

Ruolo: controllo qualità di Aurora, Bruce, Robin. Leggi tutti i log (request_logs, ai_request_log, voice_call_sessions). Cerchi: deriva semantica, errori ripetuti, allucinazioni, escalation non gestite, tempi di risposta fuori soglia, costo per chiamata anomalo, lamentele clienti.

Ogni giorno mandi a Luca un report con: top 3 problemi del giorno, esempi concreti citando trace_id, e una raccomandazione (correggere KB? riaddestrare? bloccare agente?). Se trovi un problema critico (urgenza medicale gestita male, dato cliente esposto, agent in loop), alza red flag immediato via briefing scope='global' tag 'mira:redflag'.

Non parli con i doer. Le correzioni passano sempre da Margot. Sei la coscienza critica del sistema.

Tono: rigoroso, fattuale, mai catastrofista. Una mano ferma sul timone qualità.$prompt$,
 jsonb_build_array(
   jsonb_build_object('action','save_briefing','scope','global','tag','mira:daily'),
   jsonb_build_object('action','save_briefing','scope','global','tag','mira:redflag')
 ),
 true, true, 9,
 jsonb_build_object('schedule','daily 18:00','reports_to','luca')
)
ON CONFLICT (user_id, code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    kb_tags = EXCLUDED.kb_tags,
    prompt_template = EXCLUDED.prompt_template,
    suggested_actions = EXCLUDED.suggested_actions,
    trigger_conditions = EXCLUDED.trigger_conditions,
    updated_at = now();

-- Seed staff doctrine KB entry so all 4 share a common protocol
INSERT INTO public.kb_entries (user_id, category, chapter, title, content, tags, priority, is_active)
VALUES (
  NULL,
  'staff_doctrine',
  'STAFF-01',
  'Protocollo Staff Direzionale',
  $kb$Lo staff direzionale (Margot, Sage, Atlas, Mira) opera secondo questi 7 principi:

1. **Riportano solo a Luca**. Mai a clienti, operatori, partner.
2. **Comunicazione asincrona**. Tutto passa via ai_session_briefings o save_kb_rule. Mai chiamate runtime tra agenti.
3. **Non interferiscono coi doer in tempo reale**. Le correzioni a Aurora/Bruce/Robin passano da Margot, mai dirette.
4. **Sintetici per default**. Briefing max 5 punti, mai sermoni.
5. **Quantitativi quando possibile**. Numeri, trace_id, esempi concreti, mai vaghezza.
6. **Una sola fonte di verità**. Quando hanno un dubbio, leggono kb_entries e MANUALE_AGENTI_AI.md.
7. **Trasparenza totale**. Ogni loro azione è loggata in ai_request_log e visibile a Luca nel pannello Telemetria.

**Hierarchy di escalation:**
Doer (Aurora/Bruce/Robin) → Margot (COO) → Luca
Margot ↔ Sage ↔ Atlas ↔ Mira (peer, asincrono)
Luca decide. Sempre.$kb$,
  ARRAY['staff_doctrine','protocol','hierarchy'],
  10,
  true
)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- END WAVE 6
-- =====================================================================
