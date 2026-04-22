import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchRoles,
  fetchRoleWithPermissions,
  createRole,
  updateRole,
  deleteRole,
  fetchPermissions,
  fetchRolePermissions,
  assignPermission,
  removePermission,
  fetchUserRoles,
  assignUserRole,
  removeUserRole,
  checkUserPermission,
  fetchTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  fetchTeamMembers,
  addTeamMember,
  removeTeamMember,
} from "@/data/rbac";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockEq = vi.fn();
  const mockIn = vi.fn();
  const mockOr = vi.fn();
  const mockOrder = vi.fn();
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: vi.fn(),
      },
    },
    mockFrom,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockEq,
    mockIn,
    mockOr,
    mockOrder,
    mockSingle,
    mockMaybeSingle,
  };
});

import { supabase } from "@/integrations/supabase/client";

describe("RBAC Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── Roles Tests ───────────────────────────────────────

  describe("fetchRoles", () => {
    it("should fetch all roles with success", async () => {
      const mockRoles = [
        { id: "1", name: "Admin", description: "Admin role", is_system: true },
        { id: "2", name: "User", description: "User role", is_system: false },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRoles, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await fetchRoles();

      expect(result).toEqual(mockRoles);
      expect(supabase.from).toHaveBeenCalledWith("roles");
      expect(mockChain.select).toHaveBeenCalledWith("*");
      expect(mockChain.order).toHaveBeenCalledWith("name");
    });

    it("should return empty array when no roles exist", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await fetchRoles();

      expect(result).toEqual([]);
    });

    it("should throw error on database error", async () => {
      const dbError = new Error("Database error");

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(fetchRoles()).rejects.toThrow("Database error");
    });
  });

  describe("fetchRoleWithPermissions", () => {
    it("should fetch role with its permissions", async () => {
      const mockRole = { id: "1", name: "Admin", description: "Admin role", is_system: true };
      const mockPermissions = [{ id: "p1", key: "create_user", description: "Create user", module: "users" }];
      const mockRolePermissions = [{ permission_id: "p1", permissions: mockPermissions[0] }];

      const mockSelectRole = vi.fn().mockReturnThis();
      const mockEqRole = vi.fn().mockResolvedValue({ data: mockRole, error: null });
      const mockSelectPerms = vi.fn().mockReturnThis();
      const mockEqPerms = vi.fn().mockResolvedValue({ data: mockRolePermissions, error: null });

      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: mockSelectRole,
          eq: mockEqRole,
        } as any)
        .mockReturnValueOnce({
          select: mockSelectPerms,
          eq: mockEqPerms,
        } as any);

      const result = await fetchRoleWithPermissions("1");

      expect(result).toEqual({ ...mockRole, permissions: mockPermissions });
      expect(supabase.from).toHaveBeenCalledWith("roles");
      expect(supabase.from).toHaveBeenCalledWith("role_permissions");
    });

    it("should return null when role not found", async () => {
      const mockSelectRole = vi.fn().mockReturnThis();
      const mockEqRole = vi.fn().mockResolvedValue({ data: null, error: null });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelectRole,
        eq: mockEqRole,
      } as any);

      const result = await fetchRoleWithPermissions("999");

      expect(result).toBeNull();
    });

    it("should throw error when role fetch fails", async () => {
      const dbError = new Error("Role fetch failed");

      const mockSelectRole = vi.fn().mockReturnThis();
      const mockEqRole = vi.fn().mockResolvedValue({ data: null, error: dbError });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelectRole,
        eq: mockEqRole,
      } as any);

      await expect(fetchRoleWithPermissions("1")).rejects.toThrow("Role fetch failed");
    });
  });

  describe("createRole", () => {
    it("should create a new role", async () => {
      const newRole = { id: "3", name: "Editor", description: "Editor role", is_system: false };

      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: newRole, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await createRole("Editor", "Editor role", false);

      expect(result).toEqual(newRole);
      expect(mockChain.insert).toHaveBeenCalledWith({ name: "Editor", description: "Editor role", is_system: false });
    });

    it("should create role with default isSystem as false", async () => {
      const newRole = { id: "4", name: "Viewer", description: "Viewer role", is_system: false };

      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: newRole, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await createRole("Viewer", "Viewer role");

      expect(result).toEqual(newRole);
      expect(mockChain.insert).toHaveBeenCalledWith({ name: "Viewer", description: "Viewer role", is_system: false });
    });

    it("should throw error when role creation fails", async () => {
      const dbError = new Error("Insert failed");

      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(createRole("Test")).rejects.toThrow("Insert failed");
    });
  });

  describe("updateRole", () => {
    it("should update a role", async () => {
      const updatedRole = { id: "1", name: "SuperAdmin", description: "Super Admin", is_system: true };

      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedRole, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await updateRole("1", { name: "SuperAdmin", description: "Super Admin" });

      expect(result).toEqual(updatedRole);
      expect(mockChain.update).toHaveBeenCalledWith({ name: "SuperAdmin", description: "Super Admin" });
    });

    it("should throw error when update fails", async () => {
      const dbError = new Error("Update failed");

      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(updateRole("1", { name: "Updated" })).rejects.toThrow("Update failed");
    });
  });

  describe("deleteRole", () => {
    it("should delete a non-system role", async () => {
      const mockChainSelect = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { is_system: false }, error: null }),
      };

      const mockChainDelete = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockChainSelect as any)
        .mockReturnValueOnce(mockChainDelete as any);

      await expect(deleteRole("2")).resolves.not.toThrow();
    });

    it("should not delete a system role", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { is_system: true }, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(deleteRole("1")).rejects.toThrow("Cannot delete system role");
    });

    it("should throw error when role check fails", async () => {
      const dbError = new Error("Check failed");

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(deleteRole("1")).rejects.toThrow("Check failed");
    });
  });

  // ─── Permissions Tests ──────────────────────────────────

  describe("fetchPermissions", () => {
    it("should fetch all permissions", async () => {
      const mockPermissions = [
        { id: "p1", key: "create_user", description: "Create user", module: "users" },
        { id: "p2", key: "delete_user", description: "Delete user", module: "users" },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockPermissions, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await fetchPermissions();

      expect(result).toEqual(mockPermissions);
      expect(supabase.from).toHaveBeenCalledWith("permissions");
      expect(mockChain.order).toHaveBeenCalledWith("module, key");
    });

    it("should return empty array when no permissions exist", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await fetchPermissions();

      expect(result).toEqual([]);
    });

    it("should throw error on database error", async () => {
      const dbError = new Error("Fetch permissions failed");

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(fetchPermissions()).rejects.toThrow("Fetch permissions failed");
    });
  });

  // ─── Role Permissions Tests ────────────────────────────

  describe("fetchRolePermissions", () => {
    it("should fetch permissions for a role", async () => {
      const mockPermissions = [
        { id: "p1", key: "create_user", description: "Create user", module: "users" },
      ];

      const mockRolePermissions = [{ permission_id: "p1", permissions: mockPermissions[0] }];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockRolePermissions, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await fetchRolePermissions("1");

      expect(result).toEqual(mockPermissions);
    });

    it("should return empty array when no permissions found", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await fetchRolePermissions("1");

      expect(result).toEqual([]);
    });

    it("should throw error on database error", async () => {
      const dbError = new Error("Fetch role permissions failed");

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(fetchRolePermissions("1")).rejects.toThrow("Fetch role permissions failed");
    });
  });

  describe("assignPermission", () => {
    it("should assign permission to role", async () => {
      const mockChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(assignPermission("1", "p1")).resolves.not.toThrow();
      expect(mockChain.insert).toHaveBeenCalledWith({ role_id: "1", permission_id: "p1" });
    });

    it("should ignore duplicate constraint error (code 23505)", async () => {
      const mockChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "Duplicate" } }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(assignPermission("1", "p1")).resolves.not.toThrow();
    });

    it("should throw error for non-duplicate errors", async () => {
      const dbError = new Error("Insert failed");
      Object.assign(dbError, { code: "22P02" });

      const mockChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(assignPermission("1", "p1")).rejects.toThrow("Insert failed");
    });
  });

  describe("removePermission", () => {
    it("should remove permission from role", async () => {
      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      const chainInstance = {
        ...mockChain,
        delete: mockChain.delete,
        eq: mockChain.eq,
      };

      mockChain.eq.mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(removePermission("1", "p1")).resolves.not.toThrow();
    });

    it("should throw error on database error", async () => {
      const dbError = new Error("Delete failed");

      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(removePermission("1", "p1")).rejects.toThrow("Delete failed");
    });
  });

  // ─── User Roles Tests ───────────────────────────────────

  describe("fetchUserRoles", () => {
    it("should fetch roles for current user when no userId provided", async () => {
      const mockRoles = [{ id: "1", name: "Admin", description: "Admin", is_system: true }];
      const mockUserRoles = [{ role_id: "1", roles: mockRoles[0] }];
      const mockUser = { id: "user123", email: "test@test.com" };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null } as any);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockUserRoles, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await fetchUserRoles();

      expect(result).toEqual(mockRoles);
      expect(supabase.auth.getUser).toHaveBeenCalled();
    });

    it("should fetch roles for specific user when userId provided", async () => {
      const mockRoles = [{ id: "2", name: "User", description: "User", is_system: false }];
      const mockUserRoles = [{ role_id: "2", roles: mockRoles[0] }];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockUserRoles, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await fetchUserRoles("user456");

      expect(result).toEqual(mockRoles);
    });

    it("should return empty array when user not authenticated", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as any);

      const result = await fetchUserRoles();

      expect(result).toEqual([]);
    });

    it("should throw error on database error", async () => {
      const dbError = new Error("Query failed");

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(fetchUserRoles("user123")).rejects.toThrow("Query failed");
    });
  });

  describe("assignUserRole", () => {
    it("should assign role to user", async () => {
      const mockUser = { id: "user123", email: "test@test.com" };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null } as any);

      const mockChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(assignUserRole("user456", "role1")).resolves.not.toThrow();
      expect(mockChain.insert).toHaveBeenCalledWith({ user_id: "user456", role_id: "role1", assigned_by: "user123" });
    });

    it("should ignore duplicate constraint error", async () => {
      const mockUser = { id: "user123", email: "test@test.com" };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null } as any);

      const mockChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(assignUserRole("user456", "role1")).resolves.not.toThrow();
    });

    it("should throw error for non-duplicate errors", async () => {
      const mockUser = { id: "user123", email: "test@test.com" };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null } as any);

      const dbError = new Error("Insert failed");
      Object.assign(dbError, { code: "22P02" });

      const mockChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(assignUserRole("user456", "role1")).rejects.toThrow("Insert failed");
    });
  });

  describe("removeUserRole", () => {
    it("should remove role from user", async () => {
      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      mockChain.eq.mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(removeUserRole("user123", "role1")).resolves.not.toThrow();
    });

    it("should throw error on database error", async () => {
      const dbError = new Error("Delete failed");

      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(removeUserRole("user123", "role1")).rejects.toThrow("Delete failed");
    });
  });

  describe("checkUserPermission", () => {
    it("should return true when user has permission", async () => {
      const mockUser = { id: "user123", email: "test@test.com" };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null } as any);

      const mockChainUserRoles = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [{ role_id: "role1" }], error: null }),
      };

      const mockChainPermission = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "perm1" }, error: null }),
      };

      const mockChainRolePerms = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: "rp1" }], error: null }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockChainUserRoles as any)
        .mockReturnValueOnce(mockChainPermission as any)
        .mockReturnValueOnce(mockChainRolePerms as any);

      const result = await checkUserPermission("create_user");

      expect(result).toBe(true);
    });

    it("should return false when user does not have permission", async () => {
      const mockUser = { id: "user123", email: "test@test.com" };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null } as any);

      const mockChainUserRoles = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [{ role_id: "role1" }], error: null }),
      };

      const mockChainPermission = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "perm1" }, error: null }),
      };

      const mockChainRolePerms = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(mockChainUserRoles as any)
        .mockReturnValueOnce(mockChainPermission as any)
        .mockReturnValueOnce(mockChainRolePerms as any);

      const result = await checkUserPermission("delete_user");

      expect(result).toBe(false);
    });

    it("should return false when user not authenticated", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as any);

      const result = await checkUserPermission("any_permission");

      expect(result).toBe(false);
    });

    it("should return false when user has no roles", async () => {
      const mockUser = { id: "user123", email: "test@test.com" };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null } as any);

      const mockChainUserRoles = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChainUserRoles as any);

      const result = await checkUserPermission("some_permission");

      expect(result).toBe(false);
    });
  });

  // ─── Teams Tests ────────────────────────────────────────

  describe("fetchTeams", () => {
    it("should fetch teams for current user", async () => {
      const mockUser = { id: "user123", email: "test@test.com" };
      const mockTeams = [
        { id: "t1", name: "Team A", description: "Team A", owner_id: "user123", created_at: "2024-01-01T00:00:00Z" },
      ];

      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null } as any);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockTeams, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await fetchTeams();

      expect(result).toEqual(mockTeams);
    });

    it("should return empty array when user not authenticated", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as any);

      const result = await fetchTeams();

      expect(result).toEqual([]);
    });

    it("should throw error on database error", async () => {
      const mockUser = { id: "user123", email: "test@test.com" };
      const dbError = new Error("Fetch teams failed");

      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null } as any);

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(fetchTeams()).rejects.toThrow("Fetch teams failed");
    });
  });

  describe("createTeam", () => {
    it("should create a new team", async () => {
      const mockUser = { id: "user123", email: "test@test.com" };
      const newTeam = { id: "t1", name: "New Team", description: "New Team", owner_id: "user123", created_at: "2024-01-01T00:00:00Z" };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null } as any);

      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: newTeam, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await createTeam("New Team", "New Team");

      expect(result).toEqual(newTeam);
    });

    it("should throw error when user not authenticated", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as any);

      await expect(createTeam("Team")).rejects.toThrow("Not authenticated");
    });

    it("should throw error when team creation fails", async () => {
      const mockUser = { id: "user123", email: "test@test.com" };
      const dbError = new Error("Insert failed");

      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null } as any);

      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(createTeam("Team")).rejects.toThrow("Insert failed");
    });
  });

  describe("updateTeam", () => {
    it("should update a team", async () => {
      const updatedTeam = { id: "t1", name: "Updated Team", description: "Updated", owner_id: "user123", created_at: "2024-01-01T00:00:00Z" };

      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedTeam, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await updateTeam("t1", { name: "Updated Team" });

      expect(result).toEqual(updatedTeam);
    });

    it("should throw error on update failure", async () => {
      const dbError = new Error("Update failed");

      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(updateTeam("t1", { name: "Updated" })).rejects.toThrow("Update failed");
    });
  });

  describe("deleteTeam", () => {
    it("should delete a team", async () => {
      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(deleteTeam("t1")).resolves.not.toThrow();
    });

    it("should throw error on delete failure", async () => {
      const dbError = new Error("Delete failed");

      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(deleteTeam("t1")).rejects.toThrow("Delete failed");
    });
  });

  describe("fetchTeamMembers", () => {
    it("should fetch team members", async () => {
      const mockMembers = [
        { team_id: "t1", user_id: "u1", role: "owner", joined_at: "2024-01-01T00:00:00Z" },
        { team_id: "t1", user_id: "u2", role: "member", joined_at: "2024-01-02T00:00:00Z" },
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockMembers, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await fetchTeamMembers("t1");

      expect(result).toEqual(mockMembers);
    });

    it("should return empty array when no members", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const result = await fetchTeamMembers("t1");

      expect(result).toEqual([]);
    });

    it("should throw error on database error", async () => {
      const dbError = new Error("Query failed");

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(fetchTeamMembers("t1")).rejects.toThrow("Query failed");
    });
  });

  describe("addTeamMember", () => {
    it("should add member to team", async () => {
      const mockChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(addTeamMember("t1", "u1", "member")).resolves.not.toThrow();
      expect(mockChain.insert).toHaveBeenCalledWith({ team_id: "t1", user_id: "u1", role: "member" });
    });

    it("should use default role when not specified", async () => {
      const mockChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await addTeamMember("t1", "u1");

      expect(mockChain.insert).toHaveBeenCalledWith({ team_id: "t1", user_id: "u1", role: "member" });
    });

    it("should ignore duplicate constraint error", async () => {
      const mockChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(addTeamMember("t1", "u1")).resolves.not.toThrow();
    });

    it("should throw error for non-duplicate errors", async () => {
      const dbError = new Error("Insert failed");
      Object.assign(dbError, { code: "22P02" });

      const mockChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(addTeamMember("t1", "u1")).rejects.toThrow("Insert failed");
    });
  });

  describe("removeTeamMember", () => {
    it("should remove member from team", async () => {
      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      mockChain.eq.mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(removeTeamMember("t1", "u1")).resolves.not.toThrow();
    });

    it("should throw error on delete failure", async () => {
      const dbError = new Error("Delete failed");

      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: dbError }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await expect(removeTeamMember("t1", "u1")).rejects.toThrow("Delete failed");
    });
  });
});
