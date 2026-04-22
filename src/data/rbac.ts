/**
 * Data Access Layer — RBAC (Role-Based Access Control)
 * Single source of truth for all RBAC-related queries.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// ─── Types ──────────────────────────────────────────────

type RoleRow = Database["public"]["Tables"]["roles"]["Row"];
type PermissionRow = Database["public"]["Tables"]["permissions"]["Row"];
type RolePermissionRow = Database["public"]["Tables"]["role_permissions"]["Row"];
type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type TeamMemberRow = Database["public"]["Tables"]["team_members"]["Row"];

export interface Role extends RoleRow {}
export interface Permission extends PermissionRow {}
export interface RolePermission extends RolePermissionRow {}
export interface UserRole extends UserRoleRow {}
export interface Team extends TeamRow {}
export interface TeamMember extends TeamMemberRow {}

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
  const { data, error } = await supabase
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
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("*")
    .eq("id", roleId)
    .single();
  if (roleError) throw roleError;
  if (!role) return null;

  const { data: permissions, error: permError } = await supabase
    .from("role_permissions")
    .select("permission_id, permissions(id, key, description, module)")
    .eq("role_id", roleId);
  if (permError) throw permError;

  const perms = (permissions || [])
    .map((rp) => rp.permissions)
    .filter((p) => p !== null) as Permission[];

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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { data: role, error: fetchError } = await supabase
    .from("roles")
    .select("is_system")
    .eq("id", roleId)
    .single();
  if (fetchError) throw fetchError;
  if (role?.is_system) {
    throw new Error("Cannot delete system role");
  }

  const { error } = await supabase.from("roles").delete().eq("id", roleId);
  if (error) throw error;
}

// ─── Permissions ────────────────────────────────────────

/**
 * Fetch all permissions
 */
export async function fetchPermissions(): Promise<Permission[]> {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_id, permissions(id, key, description, module)")
    .eq("role_id", roleId);
  if (error) throw error;

  return (data || [])
    .map((rp) => rp.permissions)
    .filter((p) => p !== null) as Permission[];
}

/**
 * Assign a permission to a role
 */
export async function assignPermission(roleId: string, permissionId: string): Promise<void> {
  const { error } = await supabase
    .from("role_permissions")
    .insert({ role_id: roleId, permission_id: permissionId });
  if (error && error.code !== "23505") throw error; // Ignore unique constraint
}

/**
 * Remove a permission from a role
 */
export async function removePermission(roleId: string, permissionId: string): Promise<void> {
  const { error } = await supabase
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
  const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!targetUserId) return [];

  const { data, error } = await supabase
    .from("user_roles")
    .select("role_id, roles(id, name, description, is_system)")
    .eq("user_id", targetUserId);
  if (error) throw error;

  return (data || [])
    .map((ur) => ur.roles)
    .filter((r) => r !== null) as Role[];
}

/**
 * Assign a role to a user
 */
export async function assignUserRole(userId: string, roleId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role_id: roleId, assigned_by: user?.id });
  if (error && error.code !== "23505") throw error; // Ignore unique constraint
}

/**
 * Remove a role from a user
 */
export async function removeUserRole(userId: string, roleId: string): Promise<void> {
  const { error } = await supabase
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Fetch user's roles
  const { data: userRoles, error: roleError } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id);
  if (roleError) throw roleError;

  const roleIds = (userRoles || []).map((ur) => ur.role_id);
  if (!roleIds.length) return false;

  // Fetch permission ID
  const { data: permission, error: permError } = await supabase
    .from("permissions")
    .select("id")
    .eq("key", permissionKey)
    .single();
  if (permError) throw permError;
  if (!permission) return false;

  // Check if any of user's roles have this permission
  const { data: rolePerms, error: checkError } = await supabase
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) throw error;
}

// ─── Team Members ───────────────────────────────────────

/**
 * Fetch members of a team
 */
export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
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
  const { error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: userId, role });
  if (error && error.code !== "23505") throw error; // Ignore unique constraint
}

/**
 * Remove a user from a team
 */
export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase
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
  const { error } = await supabase
    .from("team_members")
    .update({ role })
    .eq("team_id", teamId)
    .eq("user_id", userId);
  if (error) throw error;
}
