import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];
type ActivityUpdate = Database["public"]["Tables"]["activities"]["Update"];

export interface Activity {
  id: string;
  partner_id: string;
  assigned_to: string | null;
  activity_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  team_members?: { name: string } | null;
}

export function useActivitiesForPartner(partnerId: string | null) {
  return useQuery({
    queryKey: ["activities", partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from("activities")
        .select("*, team_members(name)")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Activity[];
    },
    enabled: !!partnerId,
  });
}

export function useCreateActivities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      activities: {
        partner_id?: string | null;
        source_type?: "partner" | "prospect" | "contact";
        source_id?: string;
        assigned_to?: string | null;
        activity_type: "send_email" | "phone_call" | "add_to_campaign" | "meeting" | "follow_up" | "other";
        title: string;
        description?: string | null;
        priority?: string;
        due_date?: string | null;
        scheduled_at?: string | null;
        campaign_batch_id?: string | null;
      }[]
    ) => {
      // Clean "none" values and ensure source fields
      const cleaned = activities.map(a => ({
        ...a,
        assigned_to: a.assigned_to === "none" ? null : a.assigned_to,
        source_type: a.source_type || "partner",
        source_id: a.source_id || a.partner_id,
      }));
      const { data, error } = await supabase
        .from("activities")
        .insert(cleaned as ActivityInsert[])
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["all-activities"] });
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: "pending" | "in_progress" | "completed" | "cancelled"; completed_at?: string | null; selected_contact_id?: string | null }) => {
      const { error } = await supabase
        .from("activities")
        .update(updates as ActivityUpdate)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["all-activities"] });
    },
  });
}

export interface SourceMeta {
  company_name?: string;
  contact_name?: string;
  email?: string;
  country?: string;
  country_code?: string;
  city?: string;
  website?: string;
  position?: string;
}

export interface AllActivity {
  id: string;
  partner_id: string | null;
  source_type: "partner" | "prospect" | "contact";
  source_id: string;
  source_meta: SourceMeta;
  activity_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  selected_contact_id: string | null;
  campaign_batch_id: string | null;
  executed_by_agent_id: string | null;
  created_at: string;
  completed_at: string | null;
  partners: {
    company_name: string;
    company_alias: string | null;
    country_code: string;
    country_name: string;
    city: string;
    enriched_at: string | null;
    website: string | null;
    logo_url: string | null;
    email: string | null;
  } | null;
  team_members: { name: string } | null;
  selected_contact: {
    id: string;
    name: string;
    email: string | null;
    direct_phone: string | null;
    mobile: string | null;
    title: string | null;
    contact_alias: string | null;
  } | null;
  email_subject: string | null;
  email_body: string | null;
}

export function useAllActivities() {
  return useQuery({
    queryKey: ["all-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(`
          *,
          partners(company_name, company_alias, country_code, country_name, city, enriched_at, website, logo_url, email),
          team_members(name),
          selected_contact:partner_contacts!activities_selected_contact_id_fkey(id, name, email, direct_phone, mobile, title, contact_alias)
        `)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as unknown as AllActivity[];
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export interface PartnerContactRecord {
  id: string;
  partner_id: string;
  name: string;
  email: string | null;
  direct_phone: string | null;
  mobile: string | null;
  title: string | null;
  is_primary: boolean | null;
  contact_alias: string | null;
}

/**
 * Shared contact-fetching hook used by ActivitiesTab, CampaignJobs, ContactListPanel.
 * Single source of truth — replaces the old useJobContacts.
 */
export function useContactsForPartners(partnerIds: string[]) {
  return useQuery({
    queryKey: ["partner-contacts-map", partnerIds],
    queryFn: async () => {
      if (!partnerIds.length) return {} as Record<string, PartnerContactRecord[]>;
      
      // Batch .in() calls in chunks of 100 to avoid URL length limits
      const CHUNK = 100;
      const allData: PartnerContactRecord[] = [];
      for (let i = 0; i < partnerIds.length; i += CHUNK) {
        const chunk = partnerIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("partner_contacts")
          .select("id, partner_id, name, email, direct_phone, mobile, title, is_primary, contact_alias")
          .in("partner_id", chunk);
        if (error) throw error;
        if (data) allData.push(...data);
      }
      
      const map: Record<string, PartnerContactRecord[]> = {};
      allData.forEach((c) => {
        if (!map[c.partner_id]) map[c.partner_id] = [];
        map[c.partner_id].push(c as PartnerContactRecord);
      });
      return map;
    },
    enabled: partnerIds.length > 0,
  });
}

export function useDeleteActivities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("activities")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-activities"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}
