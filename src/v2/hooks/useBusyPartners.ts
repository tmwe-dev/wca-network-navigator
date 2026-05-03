/**
 * useBusyPartners — restituisce i partner_id attualmente "occupati"
 * (coda outreach, campagne pendenti, cockpit, bozze email non spedite).
 *
 * Usato dalle liste (Network/CRM/Prospects) per nascondere i record
 * già in lavorazione, in coordinamento col filtro "Senza circuito di attesa".
 */
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { findBusyPartnerIds } from "@/data/partnerBusy";
import { queryKeys } from "@/lib/queryKeys";

const BUSY_CHANGED_EVENT = "v2:busy-partners-changed";

/** Emit ovunque dopo aver modificato outreach_queue/campaign_jobs/cockpit_queue/email_drafts. */
export function emitBusyPartnersChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BUSY_CHANGED_EVENT));
}

export interface UseBusyPartnersResult {
  busy: Set<string>;
  isLoading: boolean;
}

export function useBusyPartners(): UseBusyPartnersResult {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.v2.busyPartners,
    queryFn: () => findBusyPartnerIds(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => qc.invalidateQueries({ queryKey: queryKeys.v2.busyPartners });
    window.addEventListener(BUSY_CHANGED_EVENT, handler);
    return () => window.removeEventListener(BUSY_CHANGED_EVENT, handler);
  }, [qc]);
  return { busy: data ?? new Set<string>(), isLoading };
}

export function useInvalidateBusyPartners(): () => void {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.v2.busyPartners });
  };
}