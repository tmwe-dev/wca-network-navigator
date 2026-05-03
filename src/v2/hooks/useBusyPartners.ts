/**
 * useBusyPartners — restituisce i partner_id attualmente "occupati"
 * (coda outreach, campagne pendenti, cockpit, bozze email non spedite).
 *
 * Usato dalle liste (Network/CRM/Prospects) per nascondere i record
 * già in lavorazione, in coordinamento col filtro "Senza circuito di attesa".
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { findBusyPartnerIds } from "@/data/partnerBusy";
import { queryKeys } from "@/lib/queryKeys";

export interface UseBusyPartnersResult {
  busy: Set<string>;
  isLoading: boolean;
}

export function useBusyPartners(): UseBusyPartnersResult {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.v2.busyPartners,
    queryFn: () => findBusyPartnerIds(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  return { busy: data ?? new Set<string>(), isLoading };
}

export function useInvalidateBusyPartners(): () => void {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.v2.busyPartners });
  };
}