/**
 * useCreditsV2 — Credit balance and transactions
 */
import { useQuery } from "@tanstack/react-query";
import { fetchCreditTransactions, fetchCreditBalance } from "@/v2/io/supabase/queries/credit-transactions";
import { isOk } from "@/v2/core/domain/result";
import type { CreditTransaction } from "@/v2/core/domain/entities";
import { supabase } from "@/integrations/supabase/client";

export function useCreditsV2() {
  const balanceQuery = useQuery({
    queryKey: ["v2", "credit-balance"],
    queryFn: async (): Promise<number> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const result = await fetchCreditBalance(user.id);
      return isOk(result) ? result.value : 0;
    },
  });

  const transactionsQuery = useQuery({
    queryKey: ["v2", "credit-transactions"],
    queryFn: async (): Promise<readonly CreditTransaction[]> => {
      const result = await fetchCreditTransactions();
      return isOk(result) ? result.value : [];
    },
  });

  return {
    balance: balanceQuery.data ?? 0,
    isLoadingBalance: balanceQuery.isLoading,
    transactions: transactionsQuery.data ?? [],
    isLoadingTransactions: transactionsQuery.isLoading,
  };
}
