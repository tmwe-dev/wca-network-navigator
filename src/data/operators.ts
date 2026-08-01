/**
 * DAL — operators.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OperatorRow = Database["public"]["Tables"]["operators"]["Row"];
type OperatorInsert = Database["public"]["Tables"]["operators"]["Insert"];
type OperatorUpdate = Database["public"]["Tables"]["operators"]["Update"];

export async function findAllOperators(): Promise<OperatorRow[]> {
  const { data, error } = await supabase
    .from("operators")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function findOperatorByUserId(userId: string): Promise<OperatorRow | null> {
  const { data, error } = await supabase
    .from("operators")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function updateOperator(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("operators")
    .update(patch as OperatorUpdate)
    .eq("id", id);
  if (error) throw error;
}

export async function insertOperator(row: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("operators").insert(row as OperatorInsert);
  if (error) throw error;
}

export async function deleteOperator(id: string): Promise<void> {
  const { error } = await supabase.from("operators").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Flag amministratore dell'operatore collegato a un utente auth.
 * Semantica preservata dai chiamanti originali (AdminUsers*): errore
 * Supabase ignorato, `null` quando non esiste un record operatore.
 */
export async function findOperatorAdminFlag(userId: string): Promise<{ is_admin: boolean } | null> {
  const { data } = await supabase
    .from("operators")
    .select("is_admin")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

export interface OperatorOnboardingPatch {
  name: string;
  whatsapp_phone: string | null;
  linkedin_profile_url: string | null;
  is_active: boolean;
}

/** Aggiorna l'operatore collegato a un utente al termine dell'onboarding. Ritorna il numero di righe toccate. */
export async function updateOperatorForOnboarding(userId: string, patch: OperatorOnboardingPatch): Promise<number> {
  const { error, count } = await supabase
    .from("operators")
    .update(patch as OperatorUpdate, { count: "exact" })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}
