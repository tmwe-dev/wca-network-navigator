/**
 * Data Access Layer — RBAC (Role-Based Access Control)
 * Single source of truth for all RBAC-related queries.
 *
 * SCHEMA LIVE (verificato su information_schema):
 *  - `user_roles(id, user_id, role app_role, created_at)` — il ruolo è un
 *    ENUM PER NOME (`admin` | `moderator` | `user`), NON una FK `role_id`.
 *  - `roles(id, name, description, is_system, ...)` — catalogo del modello
 *    granulare, popolato con `admin` / `manager` / `operator` / `viewer`.
 *  - `permissions`, `role_permissions` — esistono e sono tipizzati.
 *  - `teams` NON esiste. `team_members` esiste ma con uno schema diverso
 *    (id, name, email, role, is_active, created_at): niente `team_id` né
 *    `user_id`, quindi non modella l'appartenenza a un team.
 *
 * Il modello granulare della migrazione 20260422180200_lovable102_rbac.sql
 * (colonne `role_id`, `assigned_by`, `team_id`, `joined_at`) non è mai stato
 * applicato. Le query scritte contro quelle colonne fallivano a runtime con
 * PostgREST 42703. Qui il ponte è esplicito e onesto: `user_roles.role` viene
 * risolto verso `roles.name`. Ruoli non rappresentabili nell'enum `app_role`
 * non sono assegnabili e la funzione fallisce in modo chiuso invece di
 * scrivere un valore che il database rifiuterebbe.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ASSIGNABLE_APP_ROLES: readonly AppRole[] = ["admin", "moderator", "user"];

function toAppRole(roleName: string): AppRole | null {
  return (ASSIGNABLE_APP_ROLES as readonly string[]).includes(roleName) ? (roleName as AppRole) : null;
}

/**
 * `teams` non esiste nello schema live: l'intera feature Team è inattiva.
 * Le letture restituiscono vuoto, le mutazioni falliscono in modo chiuso.
 */
const TEAMS_UNAVAILABLE = 'La feature Team non è disponibile: la tabella "teams" non esiste nello schema del database.';

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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
  const { data, error } = await supabase.from("roles").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(mapRole);
}

type RoleRow = Database["public"]["Tables"]["roles"]["Row"];
type PermissionRow = Database["public"]["Tables"]["permissions"]["Row"];

function mapRole(row: RoleRow): Role {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    is_system: row.is_system ?? false,
    created_at: row.created_at ?? undefined,
  };
}

function mapPermission(row: PermissionRow): Permission {
  return {
    id: row.id,
    key: row.key,
    description: row.description,
    module: row.module,
    created_at: row.created_at ?? undefined,
  };
}

/**
 * Fetch a single role with its permissions
 */
export async function fetchRoleWithPermissions(roleId: string): Promise<RoleWithPermissions | null> {
  const { data: role, error: roleError } = await supabase.from("roles").select("*").eq("id", roleId).maybeSingle();
  if (roleError) throw roleError;
  if (!role) return null;

  const perms = await fetchRolePermissions(roleId);
  return { ...mapRole(role), permissions: perms };
}

/**
 * Create a new role
 */
export async function createRole(name: string, description?: string, isSystem: boolean = false): Promise<Role> {
  const { data, error } = await supabase
    .from("roles")
    .insert({ name, description, is_system: isSystem })
    .select()
    .single();
  if (error) throw error;
  return mapRole(data);
}

/**
 * Update a role
 */
export async function updateRole(roleId: string, updates: { name?: string; description?: string }): Promise<Role> {
  const { data, error } = await supabase.from("roles").update(updates).eq("id", roleId).select().single();
  if (error) throw error;
  return mapRole(data);
}

/**
 * Delete a role (cannot delete system roles)
 */
export async function deleteRole(roleId: string): Promise<void> {
  const { data: role, error: fetchError } = await supabase
    .from("roles")
    .select("is_system")
    .eq("id", roleId)
    .maybeSingle();
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
  const { data, error } = await supabase.from("permissions").select("*").order("module, key");
  if (error) throw error;
  return (data ?? []).map(mapPermission);
}

// ─── Role Permissions ───────────────────────────────────

/**
 * Fetch permissions for a role
 */
export async function fetchRolePermissions(roleId: string): Promise<Permission[]> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_id, permissions(id, key, description, module, created_at)")
    .eq("role_id", roleId);
  if (error) throw error;

  // Inferenza relazionale dai tipi generati: `permissions` è già tipizzato
  // come `PermissionRow | null`, quindi nessuna asserzione è necessaria.
  return (data ?? [])
    .map((rp) => rp.permissions)
    .filter((p): p is PermissionRow => p != null)
    .map(mapPermission);
}

/**
 * Assign a permission to a role
 */
export async function assignPermission(roleId: string, permissionId: string): Promise<void> {
  const { error } = await supabase.from("role_permissions").insert({ role_id: roleId, permission_id: permissionId });
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
 * Ruoli assegnati a un utente.
 *
 * `user_roles` memorizza il ruolo PER NOME (enum `app_role`), non per FK:
 * i nomi vengono risolti sul catalogo `roles`. Un ruolo presente in
 * `user_roles` ma assente dal catalogo non produce una riga `Role`.
 */
export async function fetchUserRoles(userId?: string): Promise<Role[]> {
  const targetUserId = userId || (await supabase.auth.getSession()).data.session?.user?.id;
  if (!targetUserId) return [];

  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", targetUserId);
  if (error) throw error;

  const roleNames = (data ?? []).map((row) => row.role).filter((r): r is AppRole => r != null);
  if (!roleNames.length) return [];

  const { data: catalog, error: catalogError } = await supabase.from("roles").select("*").in("name", roleNames);
  if (catalogError) throw catalogError;

  return (catalog ?? []).map(mapRole);
}

/** Risolve un id del catalogo `roles` nel nome usato da `user_roles.role`. */
async function resolveAssignableRoleName(roleId: string): Promise<AppRole> {
  const { data, error } = await supabase.from("roles").select("name").eq("id", roleId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Ruolo "${roleId}" inesistente nel catalogo dei ruoli.`);

  const appRole = toAppRole(data.name);
  if (!appRole) {
    // Fail closed: il database accetta solo i valori dell'enum `app_role`.
    throw new Error(
      `Il ruolo "${data.name}" non è assegnabile: i valori ammessi sono ${ASSIGNABLE_APP_ROLES.join(", ")}.`,
    );
  }
  return appRole;
}

/**
 * Assegna un ruolo a un utente.
 * `assigned_by` non esiste nello schema live e non viene scritto.
 */
export async function assignUserRole(userId: string, roleId: string): Promise<void> {
  const role = await resolveAssignableRoleName(roleId);
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
  if (error && error.code !== "23505") throw error; // Ignore unique constraint
}

/**
 * Rimuove un ruolo da un utente.
 */
export async function removeUserRole(userId: string, roleId: string): Promise<void> {
  const role = await resolveAssignableRoleName(roleId);
  const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
  if (error) throw error;
}

// ─── Permissions Check ──────────────────────────────────

/**
 * Check if current user has a specific permission
 */
export async function checkUserPermission(permissionKey: string): Promise<boolean> {
  const {
    data: { session: __s },
  } = await supabase.auth.getSession();
  const user = __s?.user ?? null;
  if (!user) return false;

  // Fetch user's roles (per nome: vedi nota schema in testa al file).
  const { data: userRoles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  // Fail closed: senza ruoli leggibili non si concede alcun permesso.
  if (roleError) return false;

  const roleNames = (userRoles ?? []).map((row) => row.role).filter((r): r is AppRole => r != null);
  if (!roleNames.length) return false;

  // Admin shortcut: `app_role = 'admin'` bypassa l'RBAC granulare, che è
  // opzionale; un admin deve avere accesso pieno a prescindere dal catalogo.
  if (roleNames.includes("admin")) return true;

  // Risoluzione nome → id del catalogo per interrogare `role_permissions`.
  const { data: catalog, error: catalogError } = await supabase.from("roles").select("id").in("name", roleNames);
  if (catalogError) return false;

  const roleIds = (catalog ?? []).map((row) => row.id);
  if (!roleIds.length) return false;

  // Fetch permission ID
  const { data: permission, error: permError } = await supabase
    .from("permissions")
    .select("id")
    .eq("key", permissionKey)
    .maybeSingle();
  if (permError) throw permError;
  if (!permission) return false;

  // Check if any of user's roles have this permission
  const { data: rolePerms, error: checkError } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("permission_id", permission.id)
    .in("role_id", roleIds)
    .limit(1);
  if (checkError) throw checkError;

  return (rolePerms?.length ?? 0) > 0;
}

// ─── Teams ──────────────────────────────────────────────

/**
 * Elenco team dell'utente corrente.
 * `teams` non esiste nello schema live: nessun team può esistere.
 */
export async function fetchTeams(): Promise<Team[]> {
  return [];
}

/** Creazione team: non disponibile (tabella `teams` assente). */
export async function createTeam(_name: string, _description?: string): Promise<Team> {
  throw new Error(TEAMS_UNAVAILABLE);
}

/** Aggiornamento team: non disponibile (tabella `teams` assente). */
export async function updateTeam(_teamId: string, _updates: { name?: string; description?: string }): Promise<Team> {
  throw new Error(TEAMS_UNAVAILABLE);
}

/** Cancellazione team: non disponibile (tabella `teams` assente). */
export async function deleteTeam(_teamId: string): Promise<void> {
  throw new Error(TEAMS_UNAVAILABLE);
}

// ─── Team Members ───────────────────────────────────────
//
// `team_members` esiste ma senza `team_id`/`user_id`/`joined_at`: non modella
// l'appartenenza a un team e, senza la tabella `teams`, non esiste un team a
// cui riferirsi. Coerentemente con le funzioni Team sopra, le letture sono
// vuote e le mutazioni falliscono in modo chiuso, invece di emettere query
// che il database rifiuterebbe con 42703.

/** Membri di un team: sempre vuoto finché la feature Team non esiste a DB. */
export async function fetchTeamMembers(_teamId: string): Promise<TeamMember[]> {
  return [];
}

/** Aggiunta membro: non disponibile (feature Team assente dallo schema). */
export async function addTeamMember(_teamId: string, _userId: string, _role: string = "member"): Promise<void> {
  throw new Error(TEAMS_UNAVAILABLE);
}

/** Rimozione membro: non disponibile (feature Team assente dallo schema). */
export async function removeTeamMember(_teamId: string, _userId: string): Promise<void> {
  throw new Error(TEAMS_UNAVAILABLE);
}

/** Cambio ruolo membro: non disponibile (feature Team assente dallo schema). */
export async function updateMemberRole(_teamId: string, _userId: string, _role: string): Promise<void> {
  throw new Error(TEAMS_UNAVAILABLE);
}
