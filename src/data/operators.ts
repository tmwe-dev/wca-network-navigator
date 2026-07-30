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
