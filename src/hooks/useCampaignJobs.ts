import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

type CJInsert = Database["public"]["Tables"]["campaign_jobs"]["Insert"];
type CJUpdate = Database["public"]["Tables"]["campaign_jobs"]["Update"];

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

// PartnerContact type re-exported from useActivities for backward compat
export type { PartnerContactRecord as PartnerContact } from "./useActivities";

// useJobContacts is now deprecated — use useContactsForPartners from useActivities instead
export { useContactsForPartners as useJobContacts } from "./useActivities";

export function useCampaignJobs(batchId?: string | null) {
  return useQuery({
    queryKey: ["campaign-jobs", batchId],
    queryFn: async () => {
      if (!batchId) return [] as CampaignJob[];
      const { data, error } = await supabase
        .from("campaign_jobs")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CampaignJob[];
    },
    enabled: !!batchId,
    staleTime: 5_000,
    refetchInterval: batchId ? 8_000 : false,
  });
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: queryKeys.email.templates,
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
        .insert(jobs as CJInsert[])
        .select();
      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-jobs"] });
      qc.invalidateQueries({ queryKey: queryKeys.activities.allActivities });
    },
  });
}

export function useUpdateCampaignJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CampaignJob> & { id: string }) => {
      const { error } = await supabase
        .from("campaign_jobs")
        .update(updates as CJUpdate)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-jobs"] }),
  });
}

export function useDeleteCampaignJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("campaign_jobs")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-jobs"] });
      qc.invalidateQueries({ queryKey: queryKeys.activities.allActivities });
    },
  });
}
