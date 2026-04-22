-- ════════════════════════════════════════════════════════════════════════════════════════
-- AUDIT FIX: Replace overly permissive USING(true) RLS policies with proper user scoping
-- ════════════════════════════════════════════════════════════════════════════════════════
--
-- PROBLEM: Some tables with user_id columns had USING(true) policies on SELECT operations,
--          allowing any authenticated user to see ALL rows, not just their own data.
--
-- SOLUTION: Replace these with auth.uid() = user_id comparisons to properly scope access.
--
-- Identified problematic tables:
-- 1. agents - SELECT policy incorrectly allows full table scan (user_id column exists)
-- 2. sherlock_investigations - SELECT policy incorrectly allows full table scan (user_id column exists)
--
-- NOTE: Tables like email_templates, network_configs, blacklist_entries legitimately use
--       USING(true) because they are shared/reference data without user_id columns.
-- ════════════════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- FIX 1: agents table
-- Description: Agents are user-owned resources. SELECT should be scoped to current user's agents.
-- Previous bad policy: agents_select_all_authenticated with USING(true)
-- Issue: Allows any authenticated user to see all agents (potential data exposure)
-- ═══════════════════════════════════════════════════════════════

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "agents_select_all_authenticated" ON public.agents;

-- Create proper user-scoped policy for SELECT
CREATE POLICY "agents_select_own" ON public.agents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Ensure write policies are still user-scoped (these should already be correct from original migration)
-- Users can manage own agents policy should exist for ALL operations
-- Verify by checking: "Users can manage own agents" handles INSERT/UPDATE/DELETE

COMMENT ON POLICY "agents_select_own" ON public.agents IS
  'Users can only view their own agents. Fixed RLS audit issue: replaced USING(true) with proper user_id scoping.';

-- ═══════════════════════════════════════════════════════════════
-- FIX 2: sherlock_investigations table
-- Description: Investigations are user-owned audit records. SELECT should be scoped to current user.
-- Previous bad policy: "Authenticated can view investigations" with USING(true)
-- Issue: Allows any authenticated user to see all investigations from all users (data exposure)
-- Note: The INSERT policy already correctly uses auth.uid() = user_id
-- ═══════════════════════════════════════════════════════════════

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated can view investigations" ON public.sherlock_investigations;

-- Create proper user-scoped policy for SELECT
CREATE POLICY "Users can view own investigations" ON public.sherlock_investigations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view own investigations" ON public.sherlock_investigations IS
  'Users can only view their own investigations. Fixed RLS audit issue: replaced USING(true) with proper user_id scoping.';

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION NOTES
-- ═══════════════════════════════════════════════════════════════
--
-- The following tables were checked and confirmed to legitimately use USING(true):
--
-- SHARED/REFERENCE DATA (no user_id column):
-- - email_templates: System-wide email templates shared by all authenticated users
-- - network_configs: System configuration, same for all users
-- - blacklist_entries: Shared blocklist, same for all users
-- - blacklist_sync_log: Shared sync log, same for all users
-- - app_settings: System settings, same for all users
-- - directory_cache: Shared cache, same for all users
-- - partner_social_links: Partner reference data (no user_id column)
-- - team_members: Team reference data (no user_id column)
-- - activities: Partner activities (no user_id column, partnership-wide)
-- - partners, partner_contacts, etc.: All CRM reference data without user_id
--
-- SERVICE OPERATIONS (legitimately require USING(true) for backend services):
-- - voice_call_sessions: "Service inserts" and "Service updates" policies allow backend services
--   to manage call records independently of user_id (necessary for automated call handling)
-- - request_logs: "Service inserts" policy allows logging from service backend
-- - ai_request_log: "Service inserts" policy allows AI service to log requests
--
-- USER-SCOPED TABLES (already properly using auth.uid() or similar):
-- - commercial_playbooks, commercial_workflows: auth.uid() = user_id
-- - partner_workflow_state: auth.uid() = user_id
-- - reminders: user_id = auth.uid()
-- - imported_contacts: user_id = auth.uid()
-- - credit_transactions: user_id = auth.uid()
-- - voice_call_sessions SELECT: auth.uid() = user_id (service operations are separate policies)
-- - prospects (with user_id): Uses auth.uid() = user_id (added in separate migration)
