/**
 * DAL — authorized_users (whitelist di accesso alla piattaforma).
 * Estratto da `AdminUsersPanel` e `AdminUsersPage` (batch DAL).
 * Payload, filtri, ordinamenti e semantica errori invariati rispetto
 * ai chiamanti originali.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AuthorizedUserRow {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
}

const SELECT = "id, email, display_name, is_active, last_login_at, login_count, created_at";

/** Lista completa ordinata per data di creazione crescente. Errori propagati. */
export async function findAuthorizedUsers(): Promise<AuthorizedUserRow[]> {
  const { data, error } = await supabase
    .from("authorized_users")
    .select(SELECT)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AuthorizedUserRow[];
}

/** Inserisce un indirizzo in whitelist. Errori propagati. */
export async function insertAuthorizedUser(params: { email: string; displayName: string | null }): Promise<void> {
  const { error } = await supabase
    .from("authorized_users")
    .insert([{ email: params.email, display_name: params.displayName }]);
  if (error) throw error;
}

/** Attiva/disattiva un utente autorizzato. Errori propagati. */
export async function setAuthorizedUserActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("authorized_users").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

/** Rimuove un utente dalla whitelist. Errori propagati. */
export async function deleteAuthorizedUser(id: string): Promise<void> {
  const { error } = await supabase.from("authorized_users").delete().eq("id", id);
  if (error) throw error;
}
