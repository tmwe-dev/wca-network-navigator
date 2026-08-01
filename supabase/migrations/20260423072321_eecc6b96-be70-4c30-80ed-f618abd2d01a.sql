-- ROLES catalog
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_read" ON public.roles;
CREATE POLICY "roles_read" ON public.roles FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_roles_system ON public.roles(is_system);

-- PERMISSIONS catalog
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  description text,
  module text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissions_read" ON public.permissions;
CREATE POLICY "permissions_read" ON public.permissions FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module);

-- ROLE_PERMISSIONS junction
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_permissions_read" ON public.role_permissions;
CREATE POLICY "role_permissions_read" ON public.role_permissions FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);

-- Seed roles
INSERT INTO public.roles (id, name, description, is_system) VALUES
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 'admin',    'Amministratore totale - accesso completo', true),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'manager',  'Responsabile - gestione team e rapporti', true),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 'operator', 'Operatore - accesso base alle funzioni', true),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, 'viewer',   'Visualizzatore - accesso sola lettura', true)
ON CONFLICT (name) DO NOTHING;

-- Seed permissions
INSERT INTO public.permissions (key, description, module) VALUES
  ('contacts.view','Visualizza contatti','contacts'),
  ('contacts.create','Crea contatti','contacts'),
  ('contacts.edit','Modifica contatti','contacts'),
  ('contacts.delete','Elimina contatti','contacts'),
  ('contacts.export','Esporta contatti','contacts'),
  ('contacts.import','Importa contatti','contacts'),
  ('deals.view','Visualizza opportunità','deals'),
  ('deals.create','Crea opportunità','deals'),
  ('deals.edit','Modifica opportunità','deals'),
  ('deals.delete','Elimina opportunità','deals'),
  ('deals.manage_pipeline','Gestisci pipeline','deals'),
  ('analytics.view','Visualizza analitiche','analytics'),
  ('analytics.export','Esporta report analitiche','analytics'),
  ('analytics.manage_dashboards','Gestisci dashboard','analytics'),
  ('calendar.view','Visualizza calendario','calendar'),
  ('calendar.create','Crea eventi','calendar'),
  ('calendar.edit','Modifica eventi','calendar'),
  ('calendar.delete','Elimina eventi','calendar'),
  ('agents.view','Visualizza agenti','agents'),
  ('agents.manage','Gestisci agenti','agents'),
  ('agents.configure_prompts','Configura prompt','agents'),
  ('settings.view','Visualizza impostazioni','settings'),
  ('settings.edit','Modifica impostazioni','settings'),
  ('settings.manage_users','Gestisci utenti','settings'),
  ('settings.manage_roles','Gestisci ruoli','settings'),
  ('settings.manage_teams','Gestisci team','settings'),
  ('email.view','Visualizza email','email'),
  ('email.send','Invia email','email'),
  ('email.manage_templates','Gestisci template','email'),
  ('export.data','Esporta dati','export'),
  ('export.reports','Esporta report','export'),
  ('team.manage','Gestisci team','team')
ON CONFLICT (key) DO NOTHING;

-- Admin: tutti
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '550e8400-e29b-41d4-a716-446655440001'::uuid, id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Manager: tutto tranne user/role/team management
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '550e8400-e29b-41d4-a716-446655440002'::uuid, id FROM public.permissions
WHERE key NOT IN ('settings.manage_users','settings.manage_roles','settings.manage_teams')
ON CONFLICT DO NOTHING;

-- Operator: subset
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '550e8400-e29b-41d4-a716-446655440003'::uuid, id FROM public.permissions
WHERE key IN (
  'contacts.view','contacts.create','contacts.edit','contacts.export','contacts.import',
  'deals.view','deals.create','deals.edit','deals.manage_pipeline',
  'analytics.view','calendar.view','calendar.create','calendar.edit',
  'agents.view','settings.view','email.view','email.send','export.data'
) ON CONFLICT DO NOTHING;

-- Viewer: solo lettura
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '550e8400-e29b-41d4-a716-446655440004'::uuid, id FROM public.permissions
WHERE key IN ('contacts.view','deals.view','analytics.view','calendar.view','agents.view','settings.view','email.view')
ON CONFLICT DO NOTHING;