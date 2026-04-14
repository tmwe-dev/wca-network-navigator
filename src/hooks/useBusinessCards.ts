import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import {
  findBusinessCards, findMatchedPartnerIds, findMatchedContactIds,
  createBusinessCard, updateBusinessCard, businessCardKeys,
  invalidateBusinessCards,
} from "@/data/businessCards";

type BCInsert = Database["public"]["Tables"]["business_cards"]["Insert"];

export interface BusinessCard {
  id: string;
  user_id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  position: string | null;
  event_name: string | null;
  met_at: string | null;
  location: string | null;
  notes: string | null;
  photo_url: string | null;
  matched_partner_id: string | null;
  matched_contact_id: string | null;
  match_confidence: number;
  match_status: string;
  tags: string[];
  created_at: string;
  raw_data: Record<string, unknown>;
  lead_status: string;
}

/** Returns a Set of partner_ids that have at least one matched business card */
export function useBusinessCardPartnerMatches() {
  return useQuery({
    queryKey: [...businessCardKeys.matches, "partners"],
    queryFn: findMatchedPartnerIds,
    staleTime: 60_000,
  });
}

/** Returns a Set of contact_ids that have at least one matched business card */
export function useBusinessCardContactMatches() {
  return useQuery({
    queryKey: [...businessCardKeys.matches, "contacts"],
    queryFn: findMatchedContactIds,
    staleTime: 60_000,
  });
}

export interface BusinessCardWithPartner extends BusinessCard {
  partner?: {
    id: string;
    company_name: string;
    logo_url: string | null;
    company_alias: string | null;
    enrichment_data: Record<string, unknown>;
    country_code: string | null;
  } | null;
}

export function useBusinessCards(filters?: { event_name?: string; match_status?: string }) {
  return useQuery({
    queryKey: [...businessCardKeys.all, filters],
    queryFn: () => findBusinessCards(filters) as Promise<BusinessCardWithPartner[]>,
  });
}

export function useCreateBusinessCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (card: Partial<BusinessCard> & { user_id: string }) => {
      await createBusinessCard(card as BCInsert);
    },
    onSuccess: () => invalidateBusinessCards(qc),
  });
}

export function useUpdateBusinessCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<BusinessCard>) => {
      await updateBusinessCard(id, updates as unknown);
    },
    onSuccess: () => invalidateBusinessCards(qc),
  });
}
