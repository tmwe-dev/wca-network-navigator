/**
 * React Query hooks for RBAC — thin wrappers around src/data/rbac.ts
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchRoles,
  fetchPermissions,
  fetchRolePermissions,
  fetchUserRoles,
  fetchTeams,
  fetchTeamMembers,
  checkUserPermission,
  assignUserRole,
  removeUserRole,
  assignPermission,
  removePermission,
  addTeamMember,
  removeTeamMember,
  updateMemberRole,
  createRole,
  updateRole,
  deleteRole,
  createTeam,
  updateTeam,
  deleteTeam,
  type Role,
  type Permission,
  type UserRole,
  type Team,
  type TeamMember,
} from "@/data/rbac";

// Re-export types
export type { Role, Permission, UserRole, Team, TeamMember };

// ─── Roles ──────────────────────────────────────────────

/**
 * Fetch all roles
 */
export function useRoles() {
  return useQuery({
    queryKey: queryKeys.rbac.roles,
    queryFn: fetchRoles,
  });
}

/**
 * Create a new role
 */
export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description, isSystem }: { name: string; description?: string; isSystem?: boolean }) =>
      createRole(name, description, isSystem),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.roles });
    },
  });
}

/**
 * Update a role
 */
export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, updates }: { roleId: string; updates: { name?: string; description?: string } }) =>
      updateRole(roleId, updates),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.roles });
      qc.invalidateQueries({ queryKey: queryKeys.rbac.role(data.id) });
    },
  });
}

/**
 * Delete a role
 */
export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.roles });
    },
  });
}

// ─── Permissions ────────────────────────────────────────

/**
 * Fetch all permissions
 */
export function usePermissions() {
  return useQuery({
    queryKey: queryKeys.rbac.permissions,
    queryFn: fetchPermissions,
  });
}

// ─── Role Permissions ───────────────────────────────────

/**
 * Fetch permissions for a specific role
 */
export function useRolePermissions(roleId: string) {
  return useQuery({
    queryKey: queryKeys.rbac.rolePermissions(roleId),
    queryFn: () => fetchRolePermissions(roleId),
    enabled: !!roleId,
  });
}

/**
 * Assign a permission to a role
 */
export function useAssignPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      assignPermission(roleId, permissionId),
    onSuccess: (_, { roleId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.rolePermissions(roleId) });
      qc.invalidateQueries({ queryKey: queryKeys.rbac.role(roleId) });
    },
  });
}

/**
 * Remove a permission from a role
 */
export function useRemovePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      removePermission(roleId, permissionId),
    onSuccess: (_, { roleId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.rolePermissions(roleId) });
      qc.invalidateQueries({ queryKey: queryKeys.rbac.role(roleId) });
    },
  });
}

// ─── User Roles ─────────────────────────────────────────

/**
 * Fetch roles for the current user (or a specific user)
 */
export function useUserRoles(userId?: string) {
  return useQuery({
    queryKey: queryKeys.rbac.userRoles(userId),
    queryFn: () => fetchUserRoles(userId),
  });
}

/**
 * Assign a role to a user
 */
export function useAssignUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => assignUserRole(userId, roleId),
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.userRoles(userId) });
    },
  });
}

/**
 * Remove a role from a user
 */
export function useRemoveUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => removeUserRole(userId, roleId),
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.userRoles(userId) });
    },
  });
}

// ─── Teams ──────────────────────────────────────────────

/**
 * Fetch all teams accessible to the current user
 */
export function useTeams() {
  return useQuery({
    queryKey: queryKeys.rbac.teams,
    queryFn: fetchTeams,
  });
}

/**
 * Create a new team
 */
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) => createTeam(name, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.teams });
    },
  });
}

/**
 * Update a team
 */
export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, updates }: { teamId: string; updates: { name?: string; description?: string } }) =>
      updateTeam(teamId, updates),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.teams });
      qc.invalidateQueries({ queryKey: queryKeys.rbac.team(data.id) });
    },
  });
}

/**
 * Delete a team
 */
export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.teams });
    },
  });
}

// ─── Team Members ───────────────────────────────────────

/**
 * Fetch members of a team
 */
export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: queryKeys.rbac.teamMembers(teamId),
    queryFn: () => fetchTeamMembers(teamId),
    enabled: !!teamId,
  });
}

/**
 * Add a member to a team
 */
export function useAddTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId, role }: { teamId: string; userId: string; role?: string }) =>
      addTeamMember(teamId, userId, role),
    onSuccess: (_, { teamId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.teamMembers(teamId) });
      qc.invalidateQueries({ queryKey: queryKeys.rbac.teams });
    },
  });
}

/**
 * Remove a member from a team
 */
export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => removeTeamMember(teamId, userId),
    onSuccess: (_, { teamId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.teamMembers(teamId) });
      qc.invalidateQueries({ queryKey: queryKeys.rbac.teams });
    },
  });
}

/**
 * Update a team member's role
 */
export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId, role }: { teamId: string; userId: string; role: string }) =>
      updateMemberRole(teamId, userId, role),
    onSuccess: (_, { teamId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.rbac.teamMembers(teamId) });
    },
  });
}

// ─── Permission Checks ──────────────────────────────────

/**
 * Hook to check if current user has a specific permission
 * Returns { hasPermission, isLoading }
 */
export function useHasPermission(permissionKey: string) {
  const { data: hasPermission = false, isLoading, error } = useQuery({
    queryKey: queryKeys.rbac.hasPermission(permissionKey),
    queryFn: () => checkUserPermission(permissionKey),
    retry: 1,
  });

  return {
    hasPermission,
    isLoading,
    error,
  };
}

/**
 * Hook to check permission and optionally redirect
 * Returns { hasPermission, isLoading, shouldRedirect }
 */
export function useRequirePermission(permissionKey: string) {
  const { hasPermission, isLoading, error } = useHasPermission(permissionKey);

  return {
    hasPermission,
    isLoading,
    error,
    shouldRedirect: !isLoading && !hasPermission,
  };
}
