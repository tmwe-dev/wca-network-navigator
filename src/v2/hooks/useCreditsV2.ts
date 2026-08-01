/**
 * useCreditsV2 — Credit balance and transactions
 */
import { useQuery } from "@tanstack/react-query";
import { fetchCreditTransactions, fetchCreditBalance } from "@/v2/io/supabase/queries/credit-transactions";
import { isOk } from "@/v2/core/domain/result";
import type { CreditTransaction } from "@/v2/core/domain/entities";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export function useCreditsV2() {
  const balanceQuery = useQuery({
    queryKey: queryKeys.v2.creditBalance,
    queryFn: async (): Promise<number> => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) return 0;
      const result = await fetchCreditBalance(user.id);
      return isOk(result) ? result.value : 0;
    },
  });

  const transactionsQuery = useQuery({
    queryKey: queryKeys.v2.creditTransactions,
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
