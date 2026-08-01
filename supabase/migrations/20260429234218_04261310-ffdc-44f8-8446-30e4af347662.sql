-- Tabella ui_navigation_map per il Floating Co-Pilot
CREATE TABLE IF NOT EXISTS public.ui_navigation_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intent_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  examples TEXT[] NOT NULL DEFAULT '{}',
  path TEXT NOT NULL,
  default_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  modal TEXT,
  modal_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  category TEXT NOT NULL DEFAULT 'general',
  requires_confirmation BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_ui_navigation_map_category ON public.ui_navigation_map(category);
CREATE INDEX IF NOT EXISTS idx_ui_navigation_map_enabled ON public.ui_navigation_map(enabled);

ALTER TABLE public.ui_navigation_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ui_navigation_map readable by authenticated"
  ON public.ui_navigation_map
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ui_navigation_map insert admin"
  ON public.ui_navigation_map
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ui_navigation_map update admin"
  ON public.ui_navigation_map
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ui_navigation_map delete admin"
  ON public.ui_navigation_map
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ui_navigation_map_set_updated_at
  BEFORE UPDATE ON public.ui_navigation_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed iniziale
INSERT INTO public.ui_navigation_map (intent_key, label, description, examples, path, default_filters, modal, category, requires_confirmation) VALUES
  ('command.hub', 'Command Hub', 'Hub principale dell''assistente vocale con canvas e log', ARRAY['apri command','vai al command hub','torna a command'], '/v2/command', '{}'::jsonb, NULL, 'command', false),
  ('network.overview', 'Network Overview', 'Vista globale di tutti i network WCA', ARRAY['mostra il network','apri la rete','vai ai network'], '/v2/network', '{}'::jsonb, NULL, 'network', false),
  ('network.italy', 'Network Italia', 'Partner italiani del network', ARRAY['partner italiani','rete italia','mostrami l''italia'], '/v2/network/IT', '{}'::jsonb, NULL, 'network', false),
  ('network.italy.hot', 'Italia - Lead caldi', 'Partner italiani con lead status hot', ARRAY['italiani caldi','lead caldi italia','partner caldi in italia'], '/v2/network/IT', '{"leadStatus":"hot"}'::jsonb, NULL, 'network', false),
  ('network.usa', 'Network USA', 'Partner statunitensi', ARRAY['partner usa','america','rete americana'], '/v2/network/US', '{}'::jsonb, NULL, 'network', false),
  ('network.germany', 'Network Germania', 'Partner tedeschi', ARRAY['partner tedeschi','germania','rete tedesca'], '/v2/network/DE', '{}'::jsonb, NULL, 'network', false),
  ('network.france', 'Network Francia', 'Partner francesi', ARRAY['partner francesi','francia','rete francese'], '/v2/network/FR', '{}'::jsonb, NULL, 'network', false),
  ('network.uk', 'Network UK', 'Partner britannici', ARRAY['partner uk','inghilterra','regno unito'], '/v2/network/GB', '{}'::jsonb, NULL, 'network', false),
  ('network.spain', 'Network Spagna', 'Partner spagnoli', ARRAY['partner spagnoli','spagna'], '/v2/network/ES', '{}'::jsonb, NULL, 'network', false),
  ('network.china', 'Network Cina', 'Partner cinesi', ARRAY['partner cinesi','cina'], '/v2/network/CN', '{}'::jsonb, NULL, 'network', false),
  ('bca.overview', 'Business Cards', 'Tutti i biglietti da visita acquisiti', ARRAY['biglietti da visita','bca','le mie card'], '/v2/business-cards', '{}'::jsonb, NULL, 'bca', false),
  ('bca.recent', 'BCA recenti', 'Biglietti da visita aggiunti negli ultimi 7 giorni', ARRAY['bca recenti','ultimi biglietti'], '/v2/business-cards', '{"recent":"7d"}'::jsonb, NULL, 'bca', false),
  ('crm.contacts', 'CRM Contatti', 'Lista contatti CRM completa', ARRAY['crm','contatti','clienti'], '/v2/crm', '{}'::jsonb, NULL, 'crm', false),
  ('crm.manual', 'CRM contatti manuali', 'Solo contatti inseriti manualmente', ARRAY['contatti manuali','clienti manuali'], '/v2/crm', '{"origin":"manual"}'::jsonb, NULL, 'crm', false),
  ('crm.imported', 'CRM contatti importati', 'Solo contatti da import massivo', ARRAY['contatti importati','clienti import'], '/v2/crm', '{"origin":"import"}'::jsonb, NULL, 'crm', false),
  ('outreach.queue', 'Outreach Queue', 'Coda di outreach pianificato', ARRAY['outreach','coda outreach','campagne in coda'], '/v2/outreach/queue', '{}'::jsonb, NULL, 'outreach', false),
  ('outreach.pipeline', 'Pipeline Kanban', 'Pipeline commerciale a kanban', ARRAY['pipeline','kanban','deal pipeline'], '/v2/outreach/pipeline', '{}'::jsonb, NULL, 'outreach', false),
  ('outreach.compose', 'Nuova email outreach', 'Apri il composer per una nuova email', ARRAY['scrivi email','componi email','nuova email'], '/v2/outreach/compose', '{}'::jsonb, NULL, 'outreach', true),
  ('email.intelligence', 'Email Intelligence', 'Gestione regole email e learning loop', ARRAY['email intelligence','regole email','classificazione email'], '/v2/email-intelligence', '{}'::jsonb, NULL, 'email', false),
  ('email.inbox', 'Inbox unificato', 'Casella unificata multi-account', ARRAY['inbox','posta in arrivo','le mie email'], '/v2/email/inbox', '{}'::jsonb, NULL, 'email', false),
  ('promptlab.catalog', 'Prompt Catalog', 'Catalogo prompt operativi', ARRAY['catalogo prompt','prompt catalog','vedi prompt'], '/v2/prompt-lab/catalog', '{}'::jsonb, NULL, 'prompt-lab', false),
  ('promptlab.personas', 'Prompt Lab Personas', 'Gestione personas degli agenti', ARRAY['personas','agenti persona'], '/v2/prompt-lab/personas', '{}'::jsonb, NULL, 'prompt-lab', false),
  ('promptlab.capabilities', 'Prompt Lab Capabilities', 'Capabilities e tool whitelist', ARRAY['capabilities agenti','tool agenti'], '/v2/prompt-lab/capabilities', '{}'::jsonb, NULL, 'prompt-lab', false),
  ('promptlab.simulator', 'Prompt Lab Simulator', 'Simulatore comportamento agenti', ARRAY['simulatore agenti','simula agente'], '/v2/prompt-lab/simulator', '{}'::jsonb, NULL, 'prompt-lab', false),
  ('promptlab.navigation', 'Navigation Map', 'Mappa intent del Co-Pilot vocale', ARRAY['mappa navigazione','navigation map','intent copilot'], '/v2/prompt-lab/navigation', '{}'::jsonb, NULL, 'prompt-lab', false),
  ('staff.hub', 'Staff Direzionale', 'Hub staff e gestione operatori', ARRAY['staff','direzione','operatori'], '/staff-direzionale', '{}'::jsonb, NULL, 'staff', false),
  ('sherlock.console', 'Sherlock Investigator', 'Deep search a 3 livelli', ARRAY['sherlock','indaga','deep search'], '/v2/sherlock', '{}'::jsonb, NULL, 'investigator', false),
  ('agents.console', 'Agenti AI', 'Console di gestione agenti AI', ARRAY['agenti','ai agents','console agenti'], '/v2/agents', '{}'::jsonb, NULL, 'agents', false),
  ('settings.general', 'Impostazioni', 'Impostazioni generali della piattaforma', ARRAY['impostazioni','settings','preferenze'], '/v2/settings', '{}'::jsonb, NULL, 'settings', false),
  ('dashboard.global', 'Dashboard globale', 'KPI e metriche globali', ARRAY['dashboard','kpi','metriche'], '/v2/dashboard', '{}'::jsonb, NULL, 'dashboard', false)
ON CONFLICT (intent_key) DO NOTHING;