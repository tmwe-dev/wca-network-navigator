import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CampaignJob {
  id: string;
  partner_id: string;
  company_name: string;
  country_code: string;
  country_name: string;
  city: string | null;
  email: string | null;
  phone: string | null;
  job_type: "email" | "call";
  status: "pending" | "in_progress" | "completed" | "skipped";
  assigned_to: string | null;
  notes: string | null;
  batch_id: string;
  created_at: string;
  completed_at: string | null;
}

export interface PartnerContact {
  id: string;
  partner_id: string;
  name: string;
  title: string | null;
  email: string | null;
  direct_phone: string | null;
  mobile: string | null;
  is_primary: boolean | null;
}

export function useCampaignJobs(batchId?: string | null) {
  return useQuery({
    queryKey: ["campaign-jobs", batchId],
    queryFn: async () => {
      let q = supabase
        .from("campaign_jobs")
        .select("*")
        .order("created_at", { ascending: true });
      if (batchId) q = q.eq("batch_id", batchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CampaignJob[];
    },
    staleTime: 5_000,
    refetchInterval: 8_000,
  });
}

export function useJobContacts(partnerIds: string[]) {
  return useQuery({
    queryKey: ["job-contacts", partnerIds],
    queryFn: async () => {
      if (!partnerIds.length) return {} as Record<string, PartnerContact[]>;
      const { data, error } = await supabase
        .from("partner_contacts")
        .select("id, partner_id, name, title, email, direct_phone, mobile, is_primary")
        .in("partner_id", partnerIds);
      if (error) throw error;
      const map: Record<string, PartnerContact[]> = {};
      (data || []).forEach((c) => {
        if (!map[c.partner_id]) map[c.partner_id] = [];
        map[c.partner_id].push(c as PartnerContact);
      });
      return map;
    },
    enabled: partnerIds.length > 0,
  });
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateCampaignJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobs: Omit<CampaignJob, "id" | "created_at" | "completed_at" | "status" | "assigned_to" | "notes">[]) => {
      const { data, error } = await supabase
        .from("campaign_jobs")
        .insert(jobs as any)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-jobs"] }),
  });
}

export function useUpdateCampaignJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CampaignJob> & { id: string }) => {
      const { error } = await supabase
        .from("campaign_jobs")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-jobs"] }),
  });
}
