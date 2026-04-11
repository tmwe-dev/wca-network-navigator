/**
 * useBusinessCardsV2 — Business cards management
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBusinessCards, fetchBusinessCardsByPartner } from "@/v2/io/supabase/queries/business-cards";
import { createBusinessCard, updateBusinessCardMatch } from "@/v2/io/supabase/mutations/business-cards";
import { isOk } from "@/v2/core/domain/result";
import type { BusinessCard } from "@/v2/core/domain/entities";
import type { Database } from "@/integrations/supabase/types";

export function useBusinessCardsV2(partnerId?: string) {
  const queryClient = useQueryClient();
  const key = ["v2", "business-cards", partnerId ?? "all"];

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<readonly BusinessCard[]> => {
      const result = partnerId
        ? await fetchBusinessCardsByPartner(partnerId)
        : await fetchBusinessCards();
      return isOk(result) ? result.value : [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: Database["public"]["Tables"]["business_cards"]["Insert"]) =>
      createBusinessCard(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v2", "business-cards"] }),
  });

  const updateMatchMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Database["public"]["Tables"]["business_cards"]["Update"] }) =>
      updateBusinessCardMatch(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v2", "business-cards"] }),
  });

  return { ...query, createCard: createMutation.mutate, updateMatch: updateMatchMutation.mutate };
}
