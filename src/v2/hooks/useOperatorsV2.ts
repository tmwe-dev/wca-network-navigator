/**
 * useOperatorsV2 — Operators management
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchOperators } from "@/v2/io/supabase/queries/operators";
import { toggleOperatorAdmin } from "@/v2/io/supabase/mutations/operators";
import { isOk } from "@/v2/core/domain/result";
import type { Operator } from "@/v2/core/domain/entities";
import { queryKeys } from "@/lib/queryKeys";

export function useOperatorsV2() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.v2.operators,
    queryFn: async (): Promise<readonly Operator[]> => {
      const result = await fetchOperators();
      return isOk(result) ? result.value : [];
    },
  });

  const toggleAdminMut = useMutation({
    mutationFn: ({ id, isAdmin }: { id: string; isAdmin: boolean }) =>
      toggleOperatorAdmin(id, isAdmin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.v2.operators }),
  });

  return { ...query, toggleAdmin: toggleAdminMut.mutate };
}
