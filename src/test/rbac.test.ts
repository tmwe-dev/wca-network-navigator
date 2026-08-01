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
  //
  // Schema live: `user_roles(user_id, role app_role)` — il ruolo è un NOME,
  // non una FK. Il catalogo `roles` viene interrogato per nome.

  /** Dispatch dei chain mock per nome tabella. */
  function byTable(map: Record<string, any>) {
    mockFrom.mockImplementation((table: string) => {
      const c = map[table];
      if (!c) throw new Error(`Unexpected table queried: ${table}`);
      return c;
    });
  }

  describe("fetchUserRoles", () => {
    it("risolve i ruoli dell'utente corrente per nome sul catalogo roles", async () => {
      mockSession("user123");
      const catalogRow = { id: "1", name: "admin", description: "Admin", is_system: true };
      byTable({
        user_roles: chain("eq", { data: [{ role: "admin" }], error: null }),
        roles: chain("in", { data: [catalogRow], error: null }),
      });

      const result = await fetchUserRoles();

      expect(result).toEqual([{ ...catalogRow, created_at: undefined }]);
    });

    it("accetta un userId esplicito", async () => {
      const catalogRow = { id: "2", name: "user", description: "User", is_system: false };
      byTable({
        user_roles: chain("eq", { data: [{ role: "user" }], error: null }),
        roles: chain("in", { data: [catalogRow], error: null }),
      });

      const result = await fetchUserRoles("user456");
      expect(result).toEqual([{ ...catalogRow, created_at: undefined }]);
    });

    it("restituisce [] senza interrogare il catalogo quando l'utente non ha ruoli", async () => {
      const rolesChain = chain("in", { data: [], error: null });
      byTable({
        user_roles: chain("eq", { data: [], error: null }),
        roles: rolesChain,
      });

      const result = await fetchUserRoles("user456");
      expect(result).toEqual([]);
      expect(rolesChain.select).not.toHaveBeenCalled();
    });

    it("restituisce [] quando l'utente non è autenticato", async () => {
      mockSession(null);
      const result = await fetchUserRoles();
      expect(result).toEqual([]);
    });

    it("propaga l'errore del database", async () => {
      byTable({ user_roles: chain("eq", { data: null, error: new Error("Query failed") }) });
      await expect(fetchUserRoles("user123")).rejects.toThrow("Query failed");
    });
  });

  describe("assignUserRole", () => {
    it("risolve l'id del catalogo nel nome enum e inserisce senza assigned_by", async () => {
      const userRoles = chain("insert", { data: null, error: null });
      byTable({
        roles: chain("maybeSingle", { data: { name: "admin" }, error: null }),
        user_roles: userRoles,
      });

      await expect(assignUserRole("user456", "role1")).resolves.not.toThrow();
      expect(userRoles.insert).toHaveBeenCalledWith({ user_id: "user456", role: "admin" });
    });

    it("ignora l'errore di vincolo di unicità", async () => {
      byTable({
        roles: chain("maybeSingle", { data: { name: "user" }, error: null }),
        user_roles: chain("insert", { data: null, error: { code: "23505" } }),
      });

      await expect(assignUserRole("user456", "role1")).resolves.not.toThrow();
    });

    it("propaga gli errori non di duplicazione", async () => {
      const dbError = new Error("Insert failed");
      Object.assign(dbError, { code: "22P02" });
      byTable({
        roles: chain("maybeSingle", { data: { name: "user" }, error: null }),
        user_roles: chain("insert", { data: null, error: dbError }),
      });

      await expect(assignUserRole("user456", "role1")).rejects.toThrow("Insert failed");
    });

    it("fallisce in modo chiuso per un ruolo non rappresentabile nell'enum app_role", async () => {
      const userRoles = chain("insert", { data: null, error: null });
      byTable({
        roles: chain("maybeSingle", { data: { name: "manager" }, error: null }),
        user_roles: userRoles,
      });

      await expect(assignUserRole("user456", "role1")).rejects.toThrow(/non è assegnabile/);
      expect(userRoles.insert).not.toHaveBeenCalled();
    });

    it("fallisce se il ruolo non esiste nel catalogo", async () => {
      byTable({ roles: chain("maybeSingle", { data: null, error: null }) });
      await expect(assignUserRole("user456", "ghost")).rejects.toThrow(/inesistente/);
    });
  });

  describe("removeUserRole", () => {
    it("cancella per nome del ruolo", async () => {
      const userRoles = chain("eq", { error: null });
      byTable({
        roles: chain("maybeSingle", { data: { name: "moderator" }, error: null }),
        user_roles: userRoles,
      });

      await expect(removeUserRole("user123", "role1")).resolves.not.toThrow();
      expect(userRoles.eq).toHaveBeenCalledWith("role", "moderator");
    });

    it("propaga l'errore del database", async () => {
      byTable({
        roles: chain("maybeSingle", { data: { name: "admin" }, error: null }),
        user_roles: chain("eq", { error: new Error("Delete failed") }),
      });

      await expect(removeUserRole("user123", "role1")).rejects.toThrow("Delete failed");
    });
  });

  // ─── checkUserPermission ──────────────────────────────

  describe("checkUserPermission", () => {
    it("concede tutto agli admin senza consultare il catalogo", async () => {
      mockSession("user123");
      const rolesChain = chain("in", { data: [], error: null });
      byTable({
        user_roles: chain("eq", { data: [{ role: "admin" }], error: null }),
        roles: rolesChain,
      });

      expect(await checkUserPermission("create_user")).toBe(true);
      expect(rolesChain.select).not.toHaveBeenCalled();
    });

    it("concede il permesso quando un ruolo dell'utente lo possiede", async () => {
      mockSession("user123");
      byTable({
        user_roles: chain("eq", { data: [{ role: "user" }], error: null }),
        roles: chain("in", { data: [{ id: "role1" }], error: null }),
        permissions: chain("maybeSingle", { data: { id: "perm1" }, error: null }),
        role_permissions: chain("limit", { data: [{ id: "rp1" }], error: null }),
      });

      expect(await checkUserPermission("create_user")).toBe(true);
    });

    it("nega il permesso quando nessun ruolo lo possiede", async () => {
      mockSession("user123");
      byTable({
        user_roles: chain("eq", { data: [{ role: "user" }], error: null }),
        roles: chain("in", { data: [{ id: "role1" }], error: null }),
        permissions: chain("maybeSingle", { data: { id: "perm1" }, error: null }),
        role_permissions: chain("limit", { data: [], error: null }),
      });

      expect(await checkUserPermission("delete_user")).toBe(false);
    });

    it("nega il permesso a utenti non autenticati", async () => {
      mockSession(null);
      expect(await checkUserPermission("any_permission")).toBe(false);
    });

    it("nega il permesso quando l'utente non ha ruoli", async () => {
      mockSession("user123");
      byTable({ user_roles: chain("eq", { data: [], error: null }) });
      expect(await checkUserPermission("some_permission")).toBe(false);
    });

    it("fail closed: nega il permesso se la lettura dei ruoli fallisce", async () => {
      mockSession("user123");
      byTable({ user_roles: chain("eq", { data: null, error: new Error("RLS") }) });
      expect(await checkUserPermission("some_permission")).toBe(false);
    });

    it("nega il permesso se la chiave permesso non esiste", async () => {
      mockSession("user123");
      byTable({
        user_roles: chain("eq", { data: [{ role: "user" }], error: null }),
        roles: chain("in", { data: [{ id: "role1" }], error: null }),
        permissions: chain("maybeSingle", { data: null, error: null }),
      });

      expect(await checkUserPermission("nonexistent")).toBe(false);
    });

    it("nega il permesso se il nome ruolo non è presente nel catalogo", async () => {
      mockSession("user123");
      byTable({
        user_roles: chain("eq", { data: [{ role: "moderator" }], error: null }),
        roles: chain("in", { data: [], error: null }),
      });

      expect(await checkUserPermission("create_user")).toBe(false);
    });
  });

  // ─── Teams: feature assente dallo schema live ─────────
  //
  // `teams` non esiste e `team_members` non modella l'appartenenza
  // (nessuna colonna team_id/user_id): letture vuote, mutazioni fail closed,
  // senza emettere query che il database rifiuterebbe.

  const TEAMS_MSG = /La feature Team non è disponibile/;

  describe("Teams", () => {
    it("fetchTeams restituisce [] senza query", async () => {
      expect(await fetchTeams()).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("createTeam fallisce in modo chiuso", async () => {
      await expect(createTeam("Team")).rejects.toThrow(TEAMS_MSG);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("updateTeam fallisce in modo chiuso", async () => {
      await expect(updateTeam("t1", { name: "Updated" })).rejects.toThrow(TEAMS_MSG);
    });

    it("deleteTeam fallisce in modo chiuso", async () => {
      await expect(deleteTeam("t1")).rejects.toThrow(TEAMS_MSG);
    });
  });

  describe("Team Members", () => {
    it("fetchTeamMembers restituisce [] senza query", async () => {
      expect(await fetchTeamMembers("t1")).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("addTeamMember fallisce in modo chiuso", async () => {
      await expect(addTeamMember("t1", "u1", "member")).rejects.toThrow(TEAMS_MSG);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("removeTeamMember fallisce in modo chiuso", async () => {
      await expect(removeTeamMember("t1", "u1")).rejects.toThrow(TEAMS_MSG);
    });

    it("updateMemberRole fallisce in modo chiuso", async () => {
      await expect(updateMemberRole("t1", "u1", "admin")).rejects.toThrow(TEAMS_MSG);
    });
  });
});
