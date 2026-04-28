/**
 * @deprecated Table 'teams' does not exist in current schema (types.ts).
 * The table exists in Supabase migrations (20260422180200_lovable102_rbac.sql) but
 * TypeScript types have not been generated. Team functions will log warnings and return early.
 *
 * Data Access Layer — RBAC (Role-Based Access Control)
 * Single source of truth for all RBAC-related queries.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { untypedFrom } from "@/lib/supabaseUntyped";
import { createLogger } from "@/lib/log";

const log = createLogger("rbac");

const TEAMS_TABLE_WARNING = 'Table "teams" is not included in supabase/types.ts. Table exists in DB but type definitions are missing.';

// ─── Types ──────────────────────────────────────────────

// Local type definitions for tables that may not be in Supabase schema
export interface Role {
  id: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  module?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Permission {
  id: string;
  key: string;
  description?: string | null;
  module?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RolePermission {
  id?: string;
  role_id: string;
  permission_id: string;
  created_at?: string;
}

type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
export interface UserRole extends UserRoleRow {}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  owner_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface TeamMember {
  id?: string;
  team_id?: string;
  user_id: string;
  role?: string | null;
  joined_at?: string;
  created_at?: string;
  name?: string;
  email?: string | null;
  is_active?: boolean;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface UserWithRoles {
  user_id: string;
  roles: Role[];
}

// Internal helpers — narrow row shapes used by the relational lookups
interface RolePermissionRow {
  permissions?: Permission | null;
}
interface UserRoleJoinRow {
  roles?: Role | null;
}
interface UserRoleIdRow {
  role_id: string;
}

// ─── Roles ──────────────────────────────────────────────

/**
 * Fetch all roles
 */
export async function fetchRoles(): Promise<Role[]> {
  const { data, error } = await untypedFrom("roles")
    .select("*")
    .order("name");
  if (error) throw error;
  return data || [];
}

/**
 * Fetch a single role with its permissions
 */
export async function fetchRoleWithPermissions(roleId: string): Promise<RoleWithPermissions | null> {
  const { data: role, error: roleError } = await untypedFrom("roles")
    .select("*")
    .eq("id", roleId)
    .maybeSingle();
  if (roleError) throw roleError;
  if (!role) return null;

  const { data: permissions, error: permError } = await untypedFrom("role_permissions")
    .select("permission_id, permissions(id, key, description, module)")
    .eq("role_id", roleId);
  if (permError) throw permError;

  const perms = ((permissions ?? []) as RolePermissionRow[])
    .map((rp) => rp.permissions ?? null)
    .filter((p): p is Permission => p !== null);

  return { ...role, permissions: perms };
}

/**
 * Create a new role
 */
export async function createRole(
  name: string,
  description?: string,
  isSystem: boolean = false
): Promise<Role> {
  const { data, error } = await untypedFrom("roles")
    .insert({ name, description, is_system: isSystem })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update a role
 */
export async function updateRole(
  roleId: string,
  updates: { name?: string; description?: string }
): Promise<Role> {
  const { data, error } = await untypedFrom("roles")
    .update(updates)
    .eq("id", roleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete a role (cannot delete system roles)
 */
export async function deleteRole(roleId: string): Promise<void> {
  const { data: role, error: fetchError } = await untypedFrom("roles")
    .select("is_system")
    .eq("id", roleId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (role?.is_system) {
    throw new Error("Cannot delete system role");
  }

  const { error } = await untypedFrom("roles").delete().eq("id", roleId);
  if (error) throw error;
}

// ─── Permissions ────────────────────────────────────────

/**
 * Fetch all permissions
 */
export async function fetchPermissions(): Promise<Permission[]> {
  const { data, error } = await untypedFrom("permissions")
    .select("*")
    .order("module, key");
  if (error) throw error;
  return data || [];
}

// ─── Role Permissions ───────────────────────────────────

/**
 * Fetch permissions for a role
 */
export async function fetchRolePermissions(roleId: string): Promise<Permission[]> {
  const { data, error } = await untypedFrom("role_permissions")
    .select("permission_id, permissions(id, key, description, module)")
    .eq("role_id", roleId);
  if (error) throw error;

  return ((data ?? []) as RolePermissionRow[])
    .map((rp) => rp.permissions ?? null)
    .filter((p): p is Permission => p !== null);
}

/**
 * Assign a permission to a role
 */
export async function assignPermission(roleId: string, permissionId: string): Promise<void> {
  const { error } = await untypedFrom("role_permissions")
    .insert({ role_id: roleId, permission_id: permissionId });
  if (error && error.code !== "23505") throw error; // Ignore unique constraint
}

/**
 * Remove a permission from a role
 */
export async function removePermission(roleId: string, permissionId: string): Promise<void> {
  const { error } = await untypedFrom("role_permissions")
    .delete()
    .eq("role_id", roleId)
    .eq("permission_id", permissionId);
  if (error) throw error;
}

// ─── User Roles ─────────────────────────────────────────

/**
 * Fetch roles for a user
 */
export async function fetchUserRoles(userId?: string): Promise<Role[]> {
  const targetUserId = userId || (await supabase.auth.getSession()).data.session?.user?.id;
  if (!targetUserId) return [];

  const { data, error } = await untypedFrom("user_roles")
    .select("role_id, roles(id, name, description, is_system)")
    .eq("user_id", targetUserId);
  if (error) throw error;

  return ((data ?? []) as UserRoleJoinRow[])
    .map((ur) => ur.roles ?? null)
    .filter((r): r is Role => r !== null);
}

/**
 * Assign a role to a user
 */
export async function assignUserRole(userId: string, roleId: string): Promise<void> {
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  const { error } = await untypedFrom("user_roles")
    .insert({ user_id: userId, role_id: roleId, assigned_by: user?.id });
  if (error && error.code !== "23505") throw error; // Ignore unique constraint
}

/**
 * Remove a role from a user
 */
export async function removeUserRole(userId: string, roleId: string): Promise<void> {
  const { error } = await untypedFrom("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role_id", roleId);
  if (error) throw error;
}

// ─── Permissions Check ──────────────────────────────────

/**
 * Check if current user has a specific permission
 */
export async function checkUserPermission(permissionKey: string): Promise<boolean> {
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  if (!user) return false;

  // Fetch user's roles
  const { data: userRoles, error: roleError } = await untypedFrom("user_roles")
    .select("role_id")
    .eq("user_id", user.id);
  if (roleError) throw roleError;

  const roleIds = ((userRoles ?? []) as UserRoleIdRow[]).map((ur) => ur.role_id);
  if (!roleIds.length) return false;

  // Fetch permission ID
  const { data: permission, error: permError } = await untypedFrom("permissions")
    .select("id")
    .eq("key", permissionKey)
    .maybeSingle();
  if (permError) throw permError;
  if (!permission) return false;

  // Check if any of user's roles have this permission
  const { data: rolePerms, error: checkError } = await untypedFrom("role_permissions")
    .select("id")
    .eq("permission_id", permission.id)
    .in("role_id", roleIds)
    .limit(1);
  if (checkError) throw checkError;

  return (rolePerms?.length ?? 0) > 0;
}

// ─── Teams ──────────────────────────────────────────────

/**
 * Fetch all teams for current user
 * @deprecated Table 'teams' not in schema. This function will not execute.
 */
export async function fetchTeams(): Promise<Team[]> {
  log.warn(TEAMS_TABLE_WARNING);
  return [];
}

/**
 * Create a new team
 * @deprecated Table 'teams' not in schema. This function will not execute.
 */
export async function createTeam(_name: string, _description?: string): Promise<Team> {
  log.warn(TEAMS_TABLE_WARNING);
  throw new Error('createTeam: Table "teams" not available in schema');
}

/**
 * Update a team
 * @deprecated Table 'teams' not in schema. This function will not execute.
 */
export async function updateTeam(
  _teamId: string,
  _updates: { name?: string; description?: string }
): Promise<Team> {
  log.warn(TEAMS_TABLE_WARNING);
  throw new Error('updateTeam: Table "teams" not available in schema');
}

/**
 * Delete a team
 * @deprecated Table 'teams' not in schema. This function will not execute.
 */
export async function deleteTeam(_teamId: string): Promise<void> {
  log.warn(TEAMS_TABLE_WARNING);
  throw new Error('deleteTeam: Table "teams" not available in schema');
}

// ─── Team Members ───────────────────────────────────────

/**
 * Fetch members of a team
 */
export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await untypedFrom("team_members")
    .select("*")
    .eq("team_id", teamId)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Add a user to a team
 */
export async function addTeamMember(teamId: string, userId: string, role: string = "member"): Promise<void> {
  const { error } = await untypedFrom("team_members")
    .insert({ team_id: teamId, user_id: userId, role });
  if (error && error.code !== "23505") throw error; // Ignore unique constraint
}

/**
 * Remove a user from a team
 */
export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const { error } = await untypedFrom("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Update team member role
 */
export async function updateMemberRole(teamId: string, userId: string, role: string): Promise<void> {
  const { error } = await untypedFrom("team_members")
    .update({ role })
    .eq("team_id", teamId)
    .eq("user_id", userId);
  if (error) throw error;
}
