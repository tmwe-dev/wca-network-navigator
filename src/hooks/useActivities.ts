import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
        partner_id: string;
        assigned_to?: string | null;
        activity_type: "send_email" | "phone_call" | "add_to_campaign" | "meeting" | "follow_up" | "other";
        title: string;
        description?: string;
        priority?: string;
        due_date?: string | null;
      }[]
    ) => {
      const { data, error } = await supabase
        .from("activities")
        .insert(activities as any)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: "pending" | "in_progress" | "completed" | "cancelled"; completed_at?: string | null; selected_contact_id?: string | null }) => {
      const { error } = await supabase
        .from("activities")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["all-activities"] });
    },
  });
}

export interface AllActivity {
  id: string;
  partner_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  selected_contact_id: string | null;
  campaign_batch_id: string | null;
  created_at: string;
  completed_at: string | null;
  partners: {
    company_name: string;
    country_code: string;
    country_name: string;
    city: string;
  } | null;
  team_members: { name: string } | null;
  selected_contact: {
    id: string;
    name: string;
    email: string | null;
    direct_phone: string | null;
    mobile: string | null;
    title: string | null;
  } | null;
}

export function useAllActivities() {
  return useQuery({
    queryKey: ["all-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(`
          *,
          partners(company_name, country_code, country_name, city),
          team_members(name),
          selected_contact:partner_contacts!activities_selected_contact_id_fkey(id, name, email, direct_phone, mobile, title)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AllActivity[];
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useContactsForPartners(partnerIds: string[]) {
  return useQuery({
    queryKey: ["partner-contacts-map", partnerIds],
    queryFn: async () => {
      if (!partnerIds.length) return {} as Record<string, { id: string; name: string; email: string | null; direct_phone: string | null; mobile: string | null; title: string | null }[]>;
      const { data, error } = await supabase
        .from("partner_contacts")
        .select("id, partner_id, name, email, direct_phone, mobile, title")
        .in("partner_id", partnerIds);
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      (data || []).forEach((c) => {
        if (!map[c.partner_id]) map[c.partner_id] = [];
        map[c.partner_id].push(c);
      });
      return map;
    },
    enabled: partnerIds.length > 0,
  });
}
