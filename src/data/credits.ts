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
