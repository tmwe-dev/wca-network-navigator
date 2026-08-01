-- RBAC (Role-Based Access Control) System
-- Comprehensive roles, permissions, teams, and access management

-- ───────────────────────────────────────────────────────────────
-- Roles Table
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read" ON roles FOR SELECT USING (true);
CREATE INDEX idx_roles_system ON roles(is_system);

-- ───────────────────────────────────────────────────────────────
-- Permissions Table
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  description text,
  module text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_read" ON permissions FOR SELECT USING (true);
CREATE INDEX idx_permissions_module ON permissions(module);

-- ───────────────────────────────────────────────────────────────
-- Role Permissions Junction Table
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_read" ON role_permissions FOR SELECT USING (true);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- ───────────────────────────────────────────────────────────────
-- User Roles Junction Table
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_own_read" ON user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_roles_admin" ON user_roles FOR ALL USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE name = 'admin')));
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- ───────────────────────────────────────────────────────────────
-- Teams Table
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_owner_all" ON teams FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "teams_member_read" ON teams FOR SELECT USING (id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE INDEX idx_teams_owner ON teams(owner_id);

-- ───────────────────────────────────────────────────────────────
-- Team Members Junction Table
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_members_owner" ON team_members FOR ALL USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));
CREATE POLICY "team_members_member_read" ON team_members FOR SELECT USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- ───────────────────────────────────────────────────────────────
-- Seed System Roles
-- ───────────────────────────────────────────────────────────────
INSERT INTO roles (id, name, description, is_system) VALUES
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 'admin', 'Amministratore totale - accesso completo', true),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'manager', 'Responsabile - gestione team e rapporti', true),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 'operator', 'Operatore - accesso base alle funzioni', true),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, 'viewer', 'Visualizzatore - accesso sola lettura', true)
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────
-- Seed Permissions
-- ───────────────────────────────────────────────────────────────
INSERT INTO permissions (key, description, module) VALUES
  -- Contacts module
  ('contacts.view', 'Visualizza contatti', 'contacts'),
  ('contacts.create', 'Crea contatti', 'contacts'),
  ('contacts.edit', 'Modifica contatti', 'contacts'),
  ('contacts.delete', 'Elimina contatti', 'contacts'),
  ('contacts.export', 'Esporta contatti', 'contacts'),
  ('contacts.import', 'Importa contatti', 'contacts'),

  -- Deals module
  ('deals.view', 'Visualizza opportunità', 'deals'),
  ('deals.create', 'Crea opportunità', 'deals'),
  ('deals.edit', 'Modifica opportunità', 'deals'),
  ('deals.delete', 'Elimina opportunità', 'deals'),
  ('deals.manage_pipeline', 'Gestisci pipeline', 'deals'),

  -- Analytics module
  ('analytics.view', 'Visualizza analitiche', 'analytics'),
  ('analytics.export', 'Esporta report analitiche', 'analytics'),
  ('analytics.manage_dashboards', 'Gestisci dashboard', 'analytics'),

  -- Calendar module
  ('calendar.view', 'Visualizza calendario', 'calendar'),
  ('calendar.create', 'Crea eventi', 'calendar'),
  ('calendar.edit', 'Modifica eventi', 'calendar'),
  ('calendar.delete', 'Elimina eventi', 'calendar'),

  -- Agents module
  ('agents.view', 'Visualizza agenti', 'agents'),
  ('agents.manage', 'Gestisci agenti', 'agents'),
  ('agents.configure_prompts', 'Configura prompt', 'agents'),

  -- Settings module
  ('settings.view', 'Visualizza impostazioni', 'settings'),
  ('settings.edit', 'Modifica impostazioni', 'settings'),
  ('settings.manage_users', 'Gestisci utenti', 'settings'),
  ('settings.manage_roles', 'Gestisci ruoli', 'settings'),
  ('settings.manage_teams', 'Gestisci team', 'settings'),

  -- Email module
  ('email.view', 'Visualizza email', 'email'),
  ('email.send', 'Invia email', 'email'),
  ('email.manage_templates', 'Gestisci template', 'email'),

  -- Export module
  ('export.data', 'Esporta dati', 'export'),
  ('export.reports', 'Esporta report', 'export'),

  -- Team module
  ('team.manage', 'Gestisci team', 'team')
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────
-- Seed Role Permissions
-- ───────────────────────────────────────────────────────────────
-- Admin role: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '550e8400-e29b-41d4-a716-446655440001'::uuid, id FROM permissions
ON CONFLICT DO NOTHING;

-- Manager role: most permissions except user management
INSERT INTO role_permissions (role_id, permission_id)
SELECT '550e8400-e29b-41d4-a716-446655440002'::uuid, id FROM permissions
WHERE key NOT IN (
  'settings.manage_users',
  'settings.manage_roles',
  'settings.manage_teams'
)
ON CONFLICT DO NOTHING;

-- Operator role: basic read and create/edit permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '550e8400-e29b-41d4-a716-446655440003'::uuid, id FROM permissions
WHERE key IN (
  'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.export', 'contacts.import',
  'deals.view', 'deals.create', 'deals.edit', 'deals.manage_pipeline',
  'analytics.view',
  'calendar.view', 'calendar.create', 'calendar.edit',
  'agents.view',
  'settings.view',
  'email.view', 'email.send',
  'export.data'
)
ON CONFLICT DO NOTHING;

-- Viewer role: read-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '550e8400-e29b-41d4-a716-446655440004'::uuid, id FROM permissions
WHERE key IN (
  'contacts.view',
  'deals.view',
  'analytics.view',
  'calendar.view',
  'agents.view',
  'settings.view',
  'email.view'
)
ON CONFLICT DO NOTHING;
