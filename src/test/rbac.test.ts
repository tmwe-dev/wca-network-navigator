import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock fns (hoisted) ────────────────────────────────
const mockFrom = vi.fn();
const mockGetSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...a: any[]) => mockFrom(...a),
    auth: { getSession: () => mockGetSession() },
  },
}));

vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (...a: any[]) => mockFrom(...a),
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

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
  updateMemberRole,
} from "@/data/rbac";

// ─── Helpers ────────────────────────────────────────────
function mockSession(userId: string | null) {
  if (userId) {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: userId } } },
    });
  } else {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });
  }
}

/**
 * Build a fluent chain mock. Every method returns the chain itself (for chaining).
 * The chain is also a thenable that resolves to `resolvedValue`, so awaiting
 * any tail of the chain yields the mocked result.
 */
function chain(_terminal: string, resolvedValue: any) {
  const methods = ["select", "insert", "update", "delete", "eq", "in", "or", "order", "single", "maybeSingle", "limit"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: Record<string, any> = {};
  // Make it thenable so `await untypedFrom("x").delete().eq().eq()` resolves
  obj.then = (resolve: (v: any) => void) => Promise.resolve(resolvedValue).then(resolve);
  for (const m of methods) {
    obj[m] = vi.fn().mockReturnValue(obj);
  }
  return obj;
}

describe("RBAC Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Roles ──────────────────────────────────────────────

  describe("fetchRoles", () => {
    it("should fetch all roles", async () => {
      const roles = [
        { id: "1", name: "Admin", description: "Admin role", is_system: true },
        { id: "2", name: "User", description: "User role", is_system: false },
      ];
      const c = chain("order", { data: roles, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchRoles();

      expect(result).toEqual(roles);
      expect(mockFrom).toHaveBeenCalledWith("roles");
      expect(c.select).toHaveBeenCalledWith("*");
      expect(c.order).toHaveBeenCalledWith("name");
    });

    it("should return empty array when no roles exist", async () => {
      const c = chain("order", { data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchRoles();
      expect(result).toEqual([]);
    });

    it("should throw error on database error", async () => {
      const c = chain("order", { data: null, error: new Error("Database error") });
      mockFrom.mockReturnValue(c);

      await expect(fetchRoles()).rejects.toThrow("Database error");
    });
  });

  // ─── fetchRoleWithPermissions ─────────────────────────

  describe("fetchRoleWithPermissions", () => {
    it("should fetch role with its permissions", async () => {
      const role = { id: "1", name: "Admin", description: "Admin role", is_system: true };
      const perm = { id: "p1", key: "create_user", description: "Create user", module: "users" };

      // First call: roles table -> select(*).eq(id).maybeSingle()
      const cRole = chain("maybeSingle", { data: role, error: null });
      // Second call: role_permissions table -> select(...).eq(role_id)
      const cPerms = chain("eq", { data: [{ permission_id: "p1", permissions: perm }], error: null });

      mockFrom.mockReturnValueOnce(cRole).mockReturnValueOnce(cPerms);

      const result = await fetchRoleWithPermissions("1");

      expect(result).toEqual({ ...role, permissions: [perm] });
      expect(mockFrom).toHaveBeenCalledWith("roles");
      expect(mockFrom).toHaveBeenCalledWith("role_permissions");
    });

    it("should return null when role not found", async () => {
      const c = chain("maybeSingle", { data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchRoleWithPermissions("999");
      expect(result).toBeNull();
    });

    it("should throw error when role fetch fails", async () => {
      const c = chain("maybeSingle", { data: null, error: new Error("Role fetch failed") });
      mockFrom.mockReturnValue(c);

      await expect(fetchRoleWithPermissions("1")).rejects.toThrow("Role fetch failed");
    });
  });

  // ─── createRole ───────────────────────────────────────

  describe("createRole", () => {
    it("should create a new role", async () => {
      const newRole = { id: "3", name: "Editor", description: "Editor role", is_system: false };
      const c = chain("single", { data: newRole, error: null });
      mockFrom.mockReturnValue(c);

      const result = await createRole("Editor", "Editor role", false);

      expect(result).toEqual(newRole);
      expect(c.insert).toHaveBeenCalledWith({ name: "Editor", description: "Editor role", is_system: false });
    });

    it("should create role with default isSystem as false", async () => {
      const newRole = { id: "4", name: "Viewer", description: "Viewer role", is_system: false };
      const c = chain("single", { data: newRole, error: null });
      mockFrom.mockReturnValue(c);

      const result = await createRole("Viewer", "Viewer role");

      expect(result).toEqual(newRole);
      expect(c.insert).toHaveBeenCalledWith({ name: "Viewer", description: "Viewer role", is_system: false });
    });

    it("should throw error when role creation fails", async () => {
      const c = chain("single", { data: null, error: new Error("Insert failed") });
      mockFrom.mockReturnValue(c);

      await expect(createRole("Test")).rejects.toThrow("Insert failed");
    });
  });

  // ─── updateRole ───────────────────────────────────────

  describe("updateRole", () => {
    it("should update a role", async () => {
      const updated = { id: "1", name: "SuperAdmin", description: "Super Admin", is_system: true };
      const c = chain("single", { data: updated, error: null });
      mockFrom.mockReturnValue(c);

      const result = await updateRole("1", { name: "SuperAdmin", description: "Super Admin" });

      expect(result).toEqual(updated);
      expect(c.update).toHaveBeenCalledWith({ name: "SuperAdmin", description: "Super Admin" });
    });

    it("should throw error when update fails", async () => {
      const c = chain("single", { data: null, error: new Error("Update failed") });
      mockFrom.mockReturnValue(c);

      await expect(updateRole("1", { name: "Updated" })).rejects.toThrow("Update failed");
    });
  });

  // ─── deleteRole ───────────────────────────────────────

  describe("deleteRole", () => {
    it("should delete a non-system role", async () => {
      // First call: select is_system -> maybeSingle
      const cCheck = chain("maybeSingle", { data: { is_system: false }, error: null });
      // Second call: delete().eq()
      const cDel = chain("eq", { error: null });
      mockFrom.mockReturnValueOnce(cCheck).mockReturnValueOnce(cDel);

      await expect(deleteRole("2")).resolves.not.toThrow();
    });

    it("should not delete a system role", async () => {
      const c = chain("maybeSingle", { data: { is_system: true }, error: null });
      mockFrom.mockReturnValue(c);

      await expect(deleteRole("1")).rejects.toThrow("Cannot delete system role");
    });

    it("should throw error when role check fails", async () => {
      const c = chain("maybeSingle", { data: null, error: new Error("Check failed") });
      mockFrom.mockReturnValue(c);

      await expect(deleteRole("1")).rejects.toThrow("Check failed");
    });
  });

  // ─── Permissions ──────────────────────────────────────

  describe("fetchPermissions", () => {
    it("should fetch all permissions", async () => {
      const perms = [
        { id: "p1", key: "create_user", description: "Create user", module: "users" },
        { id: "p2", key: "delete_user", description: "Delete user", module: "users" },
      ];
      const c = chain("order", { data: perms, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchPermissions();

      expect(result).toEqual(perms);
      expect(mockFrom).toHaveBeenCalledWith("permissions");
      expect(c.order).toHaveBeenCalledWith("module, key");
    });

    it("should return empty array when no permissions exist", async () => {
      const c = chain("order", { data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchPermissions();
      expect(result).toEqual([]);
    });

    it("should throw error on database error", async () => {
      const c = chain("order", { data: null, error: new Error("Fetch permissions failed") });
      mockFrom.mockReturnValue(c);

      await expect(fetchPermissions()).rejects.toThrow("Fetch permissions failed");
    });
  });

  // ─── Role Permissions ─────────────────────────────────

  describe("fetchRolePermissions", () => {
    it("should fetch permissions for a role", async () => {
      const perm = { id: "p1", key: "create_user", description: "Create user", module: "users" };
      const c = chain("eq", { data: [{ permission_id: "p1", permissions: perm }], error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchRolePermissions("1");
      expect(result).toEqual([perm]);
    });

    it("should return empty array when no permissions found", async () => {
      const c = chain("eq", { data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchRolePermissions("1");
      expect(result).toEqual([]);
    });

    it("should throw error on database error", async () => {
      const c = chain("eq", { data: null, error: new Error("Fetch role permissions failed") });
      mockFrom.mockReturnValue(c);

      await expect(fetchRolePermissions("1")).rejects.toThrow("Fetch role permissions failed");
    });
  });

  describe("assignPermission", () => {
    it("should assign permission to role", async () => {
      const c = chain("insert", { data: null, error: null });
      mockFrom.mockReturnValue(c);

      await expect(assignPermission("1", "p1")).resolves.not.toThrow();
      expect(c.insert).toHaveBeenCalledWith({ role_id: "1", permission_id: "p1" });
    });

    it("should ignore duplicate constraint error (code 23505)", async () => {
      const c = chain("insert", { data: null, error: { code: "23505", message: "Duplicate" } });
      mockFrom.mockReturnValue(c);

      await expect(assignPermission("1", "p1")).resolves.not.toThrow();
    });

    it("should throw error for non-duplicate errors", async () => {
      const dbError = new Error("Insert failed");
      Object.assign(dbError, { code: "22P02" });
      const c = chain("insert", { data: null, error: dbError });
      mockFrom.mockReturnValue(c);

      await expect(assignPermission("1", "p1")).rejects.toThrow("Insert failed");
    });
  });

  describe("removePermission", () => {
    it("should remove permission from role", async () => {
      // delete().eq(role_id).eq(permission_id) — last eq is terminal
      const c = chain("eq", { error: null });
      mockFrom.mockReturnValue(c);

      await expect(removePermission("1", "p1")).resolves.not.toThrow();
    });

    it("should throw error on database error", async () => {
      const c = chain("eq", { error: new Error("Delete failed") });
      mockFrom.mockReturnValue(c);

      await expect(removePermission("1", "p1")).rejects.toThrow("Delete failed");
    });
  });

  // ─── User Roles ───────────────────────────────────────

  describe("fetchUserRoles", () => {
    it("should fetch roles for current user when no userId provided", async () => {
      mockSession("user123");
      const role = { id: "1", name: "Admin", description: "Admin", is_system: true };
      const c = chain("eq", { data: [{ role_id: "1", roles: role }], error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchUserRoles();

      expect(result).toEqual([role]);
    });

    it("should fetch roles for specific user when userId provided", async () => {
      const role = { id: "2", name: "User", description: "User", is_system: false };
      const c = chain("eq", { data: [{ role_id: "2", roles: role }], error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchUserRoles("user456");

      expect(result).toEqual([role]);
    });

    it("should return empty array when user not authenticated", async () => {
      mockSession(null);

      const result = await fetchUserRoles();
      expect(result).toEqual([]);
    });

    it("should throw error on database error", async () => {
      const c = chain("eq", { data: null, error: new Error("Query failed") });
      mockFrom.mockReturnValue(c);

      await expect(fetchUserRoles("user123")).rejects.toThrow("Query failed");
    });
  });

  describe("assignUserRole", () => {
    it("should assign role to user", async () => {
      mockSession("currentUser1");
      const c = chain("insert", { data: null, error: null });
      mockFrom.mockReturnValue(c);

      await expect(assignUserRole("user456", "role1")).resolves.not.toThrow();
      expect(c.insert).toHaveBeenCalledWith({ user_id: "user456", role_id: "role1", assigned_by: "currentUser1" });
    });

    it("should ignore duplicate constraint error", async () => {
      mockSession("currentUser1");
      const c = chain("insert", { data: null, error: { code: "23505" } });
      mockFrom.mockReturnValue(c);

      await expect(assignUserRole("user456", "role1")).resolves.not.toThrow();
    });

    it("should throw error for non-duplicate errors", async () => {
      mockSession("currentUser1");
      const dbError = new Error("Insert failed");
      Object.assign(dbError, { code: "22P02" });
      const c = chain("insert", { data: null, error: dbError });
      mockFrom.mockReturnValue(c);

      await expect(assignUserRole("user456", "role1")).rejects.toThrow("Insert failed");
    });
  });

  describe("removeUserRole", () => {
    it("should remove role from user", async () => {
      const c = chain("eq", { error: null });
      mockFrom.mockReturnValue(c);

      await expect(removeUserRole("user123", "role1")).resolves.not.toThrow();
    });

    it("should throw error on database error", async () => {
      const c = chain("eq", { error: new Error("Delete failed") });
      mockFrom.mockReturnValue(c);

      await expect(removeUserRole("user123", "role1")).rejects.toThrow("Delete failed");
    });
  });

  // ─── checkUserPermission ──────────────────────────────

  describe("checkUserPermission", () => {
    it("should return true when user is admin", async () => {
      mockSession("user123");
      // First call: admin check -> maybeSingle returns adminRow
      const cAdmin = chain("maybeSingle", { data: { role: "admin" }, error: null });
      mockFrom.mockReturnValueOnce(cAdmin);

      const result = await checkUserPermission("create_user");
      expect(result).toBe(true);
    });

    it("should return true when user has permission via role", async () => {
      mockSession("user123");

      // 1. Admin check -> no admin row
      const cAdmin = chain("maybeSingle", { data: null, error: null });
      // 2. User roles -> role_id list
      const cUserRoles = chain("eq", { data: [{ role_id: "role1" }], error: null });
      // 3. Permission lookup -> permission id
      const cPerm = chain("maybeSingle", { data: { id: "perm1" }, error: null });
      // 4. Role permissions check -> found
      const cRolePerms = chain("limit", { data: [{ id: "rp1" }], error: null });

      mockFrom
        .mockReturnValueOnce(cAdmin)
        .mockReturnValueOnce(cUserRoles)
        .mockReturnValueOnce(cPerm)
        .mockReturnValueOnce(cRolePerms);

      const result = await checkUserPermission("create_user");
      expect(result).toBe(true);
    });

    it("should return false when user does not have permission", async () => {
      mockSession("user123");

      const cAdmin = chain("maybeSingle", { data: null, error: null });
      const cUserRoles = chain("eq", { data: [{ role_id: "role1" }], error: null });
      const cPerm = chain("maybeSingle", { data: { id: "perm1" }, error: null });
      const cRolePerms = chain("limit", { data: [], error: null });

      mockFrom
        .mockReturnValueOnce(cAdmin)
        .mockReturnValueOnce(cUserRoles)
        .mockReturnValueOnce(cPerm)
        .mockReturnValueOnce(cRolePerms);

      const result = await checkUserPermission("delete_user");
      expect(result).toBe(false);
    });

    it("should return false when user not authenticated", async () => {
      mockSession(null);

      const result = await checkUserPermission("any_permission");
      expect(result).toBe(false);
    });

    it("should return false when user has no roles", async () => {
      mockSession("user123");

      const cAdmin = chain("maybeSingle", { data: null, error: null });
      // roleError -> returns false
      const cUserRoles = chain("eq", { data: [], error: null });

      mockFrom.mockReturnValueOnce(cAdmin).mockReturnValueOnce(cUserRoles);

      const result = await checkUserPermission("some_permission");
      expect(result).toBe(false);
    });

    it("should return false when permission key not found", async () => {
      mockSession("user123");

      const cAdmin = chain("maybeSingle", { data: null, error: null });
      const cUserRoles = chain("eq", { data: [{ role_id: "role1" }], error: null });
      const cPerm = chain("maybeSingle", { data: null, error: null });

      mockFrom.mockReturnValueOnce(cAdmin).mockReturnValueOnce(cUserRoles).mockReturnValueOnce(cPerm);

      const result = await checkUserPermission("nonexistent");
      expect(result).toBe(false);
    });
  });

  // ─── Teams (deprecated stubs) ─────────────────────────

  describe("fetchTeams", () => {
    it("should return empty array (deprecated)", async () => {
      const result = await fetchTeams();
      expect(result).toEqual([]);
    });
  });

  describe("createTeam", () => {
    it("should throw error (deprecated)", async () => {
      await expect(createTeam("Team")).rejects.toThrow('Table "teams" not available in schema');
    });
  });

  describe("updateTeam", () => {
    it("should throw error (deprecated)", async () => {
      await expect(updateTeam("t1", { name: "Updated" })).rejects.toThrow('Table "teams" not available in schema');
    });
  });

  describe("deleteTeam", () => {
    it("should throw error (deprecated)", async () => {
      await expect(deleteTeam("t1")).rejects.toThrow('Table "teams" not available in schema');
    });
  });

  // ─── Team Members ─────────────────────────────────────

  describe("fetchTeamMembers", () => {
    it("should fetch team members", async () => {
      const members = [
        { team_id: "t1", user_id: "u1", role: "owner", joined_at: "2024-01-01T00:00:00Z" },
        { team_id: "t1", user_id: "u2", role: "member", joined_at: "2024-01-02T00:00:00Z" },
      ];
      const c = chain("order", { data: members, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchTeamMembers("t1");

      expect(result).toEqual(members);
      expect(mockFrom).toHaveBeenCalledWith("team_members");
    });

    it("should return empty array when no members", async () => {
      const c = chain("order", { data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchTeamMembers("t1");
      expect(result).toEqual([]);
    });

    it("should throw error on database error", async () => {
      const c = chain("order", { data: null, error: new Error("Query failed") });
      mockFrom.mockReturnValue(c);

      await expect(fetchTeamMembers("t1")).rejects.toThrow("Query failed");
    });
  });

  describe("addTeamMember", () => {
    it("should add member to team", async () => {
      const c = chain("insert", { data: null, error: null });
      mockFrom.mockReturnValue(c);

      await expect(addTeamMember("t1", "u1", "member")).resolves.not.toThrow();
      expect(c.insert).toHaveBeenCalledWith({ team_id: "t1", user_id: "u1", role: "member" });
    });

    it("should use default role when not specified", async () => {
      const c = chain("insert", { data: null, error: null });
      mockFrom.mockReturnValue(c);

      await addTeamMember("t1", "u1");
      expect(c.insert).toHaveBeenCalledWith({ team_id: "t1", user_id: "u1", role: "member" });
    });

    it("should ignore duplicate constraint error", async () => {
      const c = chain("insert", { data: null, error: { code: "23505" } });
      mockFrom.mockReturnValue(c);

      await expect(addTeamMember("t1", "u1")).resolves.not.toThrow();
    });

    it("should throw error for non-duplicate errors", async () => {
      const dbError = new Error("Insert failed");
      Object.assign(dbError, { code: "22P02" });
      const c = chain("insert", { data: null, error: dbError });
      mockFrom.mockReturnValue(c);

      await expect(addTeamMember("t1", "u1")).rejects.toThrow("Insert failed");
    });
  });

  describe("removeTeamMember", () => {
    it("should remove member from team", async () => {
      const c = chain("eq", { error: null });
      mockFrom.mockReturnValue(c);

      await expect(removeTeamMember("t1", "u1")).resolves.not.toThrow();
    });

    it("should throw error on delete failure", async () => {
      const c = chain("eq", { error: new Error("Delete failed") });
      mockFrom.mockReturnValue(c);

      await expect(removeTeamMember("t1", "u1")).rejects.toThrow("Delete failed");
    });
  });

  describe("updateMemberRole", () => {
    it("should update team member role", async () => {
      const c = chain("eq", { error: null });
      mockFrom.mockReturnValue(c);

      await expect(updateMemberRole("t1", "u1", "admin")).resolves.not.toThrow();
      expect(c.update).toHaveBeenCalledWith({ role: "admin" });
    });

    it("should throw error on update failure", async () => {
      const c = chain("eq", { error: new Error("Update failed") });
      mockFrom.mockReturnValue(c);

      await expect(updateMemberRole("t1", "u1", "admin")).rejects.toThrow("Update failed");
    });
  });
});
