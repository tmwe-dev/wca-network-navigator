/**
 * Data Access Layer — RBAC (Role-Based Access Control)
 * Single source of truth for all RBAC-related queries.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

// ─── Roles ──────────────────────────────────────────────

/**
 * Fetch all roles
 */
export async function fetchRoles(): Promise<Role[]> {
  const { data, error } = await (supabase as any)
    .from("roles")
    .select("*")
    .order("name");
  if (error) throw error;
  return data || [];
}

/**
 * Fetch a single role with its permissions
 */
export async function fetchRoleWithPermissions(roleId: string): Promise<RoleWithPermissions | null> {
  const { data: role, error: roleError } = await (supabase as any)
    .from("roles")
    .select("*")
    .eq("id", roleId)
    .single();
  if (roleError) throw roleError;
  if (!role) return null;

  const { data: permissions, error: permError } = await (supabase as any)
    .from("role_permissions")
    .select("permission_id, permissions(id, key, description, module)")
    .eq("role_id", roleId);
  if (permError) throw permError;

  const perms = (permissions || [])
    .map((rp: any) => rp.permissions)
    .filter((p: any) => p !== null) as Permission[];

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
  const { data, error } = await (supabase as any)
    .from("roles")
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
  const { data, error } = await (supabase as any)
    .from("roles")
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
  const { data: role, error: fetchError } = await (supabase as any)
    .from("roles")
    .select("is_system")
    .eq("id", roleId)
    .single();
  if (fetchError) throw fetchError;
  if (role?.is_system) {
    throw new Error("Cannot delete system role");
  }

  const { error } = await (supabase as any).from("roles").delete().eq("id", roleId);
  if (error) throw error;
}

// ─── Permissions ────────────────────────────────────────

/**
 * Fetch all permissions
 */
export async function fetchPermissions(): Promise<Permission[]> {
  const { data, error } = await (supabase as any)
    .from("permissions")
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
  const { data, error } = await (supabase as any)
    .from("role_permissions")
    .select("permission_id, permissions(id, key, description, module)")
    .eq("role_id", roleId);
  if (error) throw error;

  return (data || [])
    .map((rp: any) => rp.permissions)
    .filter((p: any) => p !== null) as Permission[];
}

/**
 * Assign a permission to a role
 */
export async function assignPermission(roleId: string, permissionId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("role_permissions")
    .insert({ role_id: roleId, permission_id: permissionId });
  if (error && error.code !== "23505") throw error; // Ignore unique constraint
}

/**
 * Remove a permission from a role
 */
export async function removePermission(roleId: string, permissionId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("role_permissions")
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

  const { data, error } = await (supabase as any)
    .from("user_roles")
    .select("role_id, roles(id, name, description, is_system)")
    .eq("user_id", targetUserId);
  if (error) throw error;

  return (data || [])
    .map((ur: any) => ur.roles)
    .filter((r: any) => r !== null) as Role[];
}

/**
 * Assign a role to a user
 */
export async function assignUserRole(userId: string, roleId: string): Promise<void> {
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  const { error } = await (supabase as any)
    .from("user_roles")
    .insert({ user_id: userId, role_id: roleId, assigned_by: user?.id });
  if (error && error.code !== "23505") throw error; // Ignore unique constraint
}

/**
 * Remove a role from a user
 */
export async function removeUserRole(userId: string, roleId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("user_roles")
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
  const { data: userRoles, error: roleError } = await (supabase as any)
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id);
  if (roleError) throw roleError;

  const roleIds = (userRoles || []).map((ur: any) => ur.role_id);
  if (!roleIds.length) return false;

  // Fetch permission ID
  const { data: permission, error: permError } = await (supabase as any)
    .from("permissions")
    .select("id")
    .eq("key", permissionKey)
    .single();
  if (permError) throw permError;
  if (!permission) return false;

  // Check if any of user's roles have this permission
  const { data: rolePerms, error: checkError } = await (supabase as any)
    .from("role_permissions")
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
 */
export async function fetchTeams(): Promise<Team[]> {
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  if (!user) return [];

  const { data, error } = await (supabase as any)
    .from("teams")
    .select("*")
    .or(`owner_id.eq.${user.id},id.in.(SELECT team_id FROM team_members WHERE user_id = ${user.id})`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Create a new team
 */
export async function createTeam(name: string, description?: string): Promise<Team> {
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await (supabase as any)
    .from("teams")
    .insert({ name, description, owner_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update a team
 */
export async function updateTeam(
  teamId: string,
  updates: { name?: string; description?: string }
): Promise<Team> {
  const { data, error } = await (supabase as any)
    .from("teams")
    .update(updates)
    .eq("id", teamId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete a team
 */
export async function deleteTeam(teamId: string): Promise<void> {
  const { error } = await (supabase as any).from("teams").delete().eq("id", teamId);
  if (error) throw error;
}

// ─── Team Members ───────────────────────────────────────

/**
 * Fetch members of a team
 */
export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await (supabase as any)
    .from("team_members")
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
  const { error } = await (supabase as any)
    .from("team_members")
    .insert({ team_id: teamId, user_id: userId, role });
  if (error && error.code !== "23505") throw error; // Ignore unique constraint
}

/**
 * Remove a user from a team
 */
export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Update team member role
 */
export async function updateMemberRole(teamId: string, userId: string, role: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("team_members")
    .update({ role })
    .eq("team_id", teamId)
    .eq("user_id", userId);
  if (error) throw error;
}
