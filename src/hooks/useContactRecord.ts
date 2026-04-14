import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { updatePartner } from "@/data/partners";
import { updateContact } from "@/data/contacts";
import { updateProspect } from "@/data/prospects";
import { updateBusinessCard } from "@/data/businessCards";
import type { RecordSourceType } from "@/contexts/ContactDrawerContext";

export interface UnifiedRecord {
  sourceType: RecordSourceType;
  sourceId: string;
  companyName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  position: string | null;
  website: string | null;
  leadStatus: string;
  note: string | null;
  enrichmentData: Record<string, unknown> | null;
  deepSearchAt: string | null;
  createdAt: string;
  lastInteractionAt: string | null;
  interactionCount: number;
  linkedinUrl: string | null;
  companyAlias: string | null;
  contactAlias: string | null;
  partnerId: string | null;
  raw: Record<string, unknown> | null;
}

export function useContactRecord(sourceType: RecordSourceType | null, sourceId: string | null) {
  return useQuery({
    queryKey: ["contact-record", sourceType, sourceId],
    queryFn: async (): Promise<UnifiedRecord | null> => {
      if (!sourceType || !sourceId) return null;

      if (sourceType === "partner") {
        const { data: p, error } = await supabase
          .from("partners")
          .select("*, partner_contacts(*), partner_social_links(*)")
          .eq("id", sourceId)
          .single();
        if (error || !p) return null;
        const contacts = (p as Record<string, unknown>).partner_contacts as Array<Record<string, unknown>> | undefined;
        const socialLinks = (p as Record<string, unknown>).partner_social_links as Array<Record<string, unknown>> | undefined;
        const primary = contacts?.find(c => c.is_primary) || contacts?.[0];
        const liLink = socialLinks?.find(l => l.platform === "linkedin");
        return {
          sourceType: "partner", sourceId,
          companyName: p.company_name,
          contactName: (primary?.name as string) || "",
          email: (primary?.email as string) || p.email,
          phone: (primary?.direct_phone as string) || p.phone,
          mobile: (primary?.mobile as string) || p.mobile,
          country: p.country_name, city: p.city, address: p.address,
          position: (primary?.title as string) || null,
          website: p.website, leadStatus: p.lead_status,
          note: p.profile_description,
          enrichmentData: (p.enrichment_data as Record<string, unknown>) ?? null,
          deepSearchAt: p.enriched_at, createdAt: p.created_at || "",
          lastInteractionAt: p.last_interaction_at, interactionCount: p.interaction_count,
          linkedinUrl: (liLink?.url as string) || null,
          companyAlias: p.company_alias,
          contactAlias: (primary?.contact_alias as string) || null,
          partnerId: p.id, raw: p,
        };
      }

      if (sourceType === "contact") {
        const { data: c, error } = await supabase
          .from("imported_contacts")
          .select("*")
          .eq("id", sourceId)
          .single();
        if (error || !c) return null;
        const ed = (c.enrichment_data as unknown) || {};
        return {
          sourceType: "contact", sourceId,
          companyName: c.company_name || "", contactName: c.name || "",
          email: c.email, phone: c.phone, mobile: c.mobile,
          country: c.country, city: c.city, address: c.address,
          position: c.position, website: (ed.company_website as string) || null,
          leadStatus: c.lead_status, note: c.note,
          enrichmentData: (c.enrichment_data as Record<string, unknown>) ?? null,
          deepSearchAt: c.deep_search_at as string | null, createdAt: c.created_at,
          lastInteractionAt: c.last_interaction_at as string | null, interactionCount: c.interaction_count as number,
          linkedinUrl: (ed.linkedin_profile_url as string) || (ed.linkedin_url as string) || null,
          companyAlias: c.company_alias as string | null, contactAlias: c.contact_alias as string | null,
          partnerId: null, raw: c as unknown as Record<string, unknown>,
        };
      }

      if (sourceType === "prospect") {
        const { data: pr, error } = await supabase
          .from("prospects")
          .select("*, prospect_contacts(*)")
          .eq("id", sourceId)
          .single();
        if (error || !pr) return null;
        const p = pr as unknown;
        const pc = p.prospect_contacts?.[0];
        return {
          sourceType: "prospect", sourceId,
          companyName: String(p.ragione_sociale || p.company_name || ""),
          contactName: String(pc?.name || ""),
          email: (p.email || pc?.email || null) as string | null, phone: (pc?.phone || null) as string | null, mobile: null,
          country: "Italia", city: (p.sede_legale || null) as string | null, address: null,
          position: (pc?.role || null) as string | null, website: (p.website || null) as string | null,
          leadStatus: String(p.lead_status || "new"), note: null,
          enrichmentData: (p.enrichment_data as Record<string, unknown>) ?? null,
          deepSearchAt: null, createdAt: String(p.created_at),
          lastInteractionAt: (p.last_interaction_at || null) as string | null,
          interactionCount: Number(p.interaction_count || 0),
          linkedinUrl: (pc?.linkedin_url || null) as string | null,
          companyAlias: null, contactAlias: null, partnerId: null, raw: p as Record<string, unknown>,
        };
      }

      if (sourceType === "bca") {
        const { data: bc, error } = await supabase
          .from("business_cards")
          .select("*")
          .eq("id", sourceId)
          .single();
        if (error || !bc) return null;
        return {
          sourceType: "bca", sourceId,
          companyName: bc.company_name || "", contactName: bc.contact_name || "",
          email: bc.email, phone: bc.phone, mobile: bc.mobile,
          country: bc.location, city: null, address: null,
          position: bc.position, website: null,
          leadStatus: bc.match_status || "pending", note: bc.notes,
          enrichmentData: (bc.raw_data as Record<string, unknown>) ?? null,
          deepSearchAt: null, createdAt: bc.created_at,
          lastInteractionAt: null, interactionCount: 0,
          linkedinUrl: null, companyAlias: null, contactAlias: null,
          partnerId: bc.matched_partner_id, raw: bc,
        };
      }

      return null;
    },
    enabled: !!sourceType && !!sourceId,
    staleTime: 5_000,
  });
}

export function useUpdateContactRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceType, sourceId, updates }: {
      sourceType: RecordSourceType;
      sourceId: string;
      updates: Record<string, unknown>;
    }) => {
      if (sourceType === "partner") {
        await updatePartner(sourceId, updates);
      } else if (sourceType === "contact") {
        await updateContact(sourceId, updates);
      } else if (sourceType === "prospect") {
        await updateProspect(sourceId, updates);
      } else if (sourceType === "bca") {
        await updateBusinessCard(sourceId, updates);
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["contact-record", vars.sourceType, vars.sourceId] });
    },
  });
}
