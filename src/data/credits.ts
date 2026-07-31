/**
 * DAL — user_credits & credit_transactions
 */
import { supabase } from "@/integrations/supabase/client";

export async function getUserCredits() {
  const { data, error } = await supabase.from("user_credits").select("balance, total_consumed").limit(1).maybeSingle();
  if (error) throw error;
  return data ?? { balance: 0, total_consumed: 0 };
}

export async function countCreditTransactions() {
  const { count, error } = await supabase.from("credit_transactions").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export interface CreditData {
  balance: number;
  total_consumed: number;
  updated_at: string;
}

/** Saldo/consumo crediti per uno specifico utente. */
export async function findUserCreditsById(userId: string): Promise<CreditData | null> {
  const { data, error } = await supabase
    .from("user_credits")
    .select("balance, total_consumed, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as CreditData | null;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  operation: string;
  description: string;
  created_at: string;
}

/** Transazioni credito di un utente a partire da una data. */
export async function findCreditTransactionsSince(userId: string, sinceIso: string): Promise<CreditTransaction[]> {
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("id, user_id, amount, operation, description, created_at")
    .eq("user_id", userId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CreditTransaction[];
}
