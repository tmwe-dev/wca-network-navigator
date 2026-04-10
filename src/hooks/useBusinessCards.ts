import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type BCInsert = Database["public"]["Tables"]["business_cards"]["Insert"];
type BCUpdate = Database["public"]["Tables"]["business_cards"]["Update"];

const BC_KEY = ["business-cards"] as const;
const BC_MATCHES_KEY = ["business-card-matches"] as const;

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
  raw_data: any;
  lead_status: string;
}

/** Returns a Set of partner_ids that have at least one matched business card */
export function useBusinessCardPartnerMatches() {
  return useQuery({
    queryKey: [...BC_MATCHES_KEY, "partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_cards")
        .select("matched_partner_id")
        .not("matched_partner_id", "is", null);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.matched_partner_id));
    },
    staleTime: 60_000,
  });
}

/** Returns a Set of contact_ids that have at least one matched business card */
export function useBusinessCardContactMatches() {
  return useQuery({
    queryKey: [...BC_MATCHES_KEY, "contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_cards")
        .select("matched_contact_id")
        .not("matched_contact_id", "is", null);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.matched_contact_id));
    },
    staleTime: 60_000,
  });
}

export interface BusinessCardWithPartner extends BusinessCard {
  partner?: {
    id: string;
    company_name: string;
    logo_url: string | null;
    company_alias: string | null;
    enrichment_data: any;
    country_code: string | null;
  } | null;
}

export function useBusinessCards(filters?: { event_name?: string; match_status?: string }) {
  return useQuery({
    queryKey: [...BC_KEY, filters],
    queryFn: async () => {
      let q = supabase
        .from("business_cards")
        .select("*, partner:matched_partner_id(id, company_name, logo_url, company_alias, enrichment_data, country_code, lead_status)")
        .order("created_at", { ascending: false });
      if (filters?.event_name) q = q.ilike("event_name", `%${filters.event_name}%`);
      if (filters?.match_status) q = q.eq("match_status", filters.match_status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as BusinessCardWithPartner[];
    },
  });
}

export function useCreateBusinessCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (card: Partial<BusinessCard> & { user_id: string }) => {
      const { error } = await supabase.from("business_cards").insert(card as BCInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BC_KEY });
      qc.invalidateQueries({ queryKey: BC_MATCHES_KEY });
    },
  });
}

export function useUpdateBusinessCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<BusinessCard>) => {
      const { error } = await supabase.from("business_cards").update(updates as BCUpdate).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BC_KEY });
      qc.invalidateQueries({ queryKey: BC_MATCHES_KEY });
    },
  });
}
