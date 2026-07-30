import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { findCampaignJobsByBatch, updateCampaignJobById, deleteCampaignJobsByIds } from "@/data/campaignJobs";
import { findAllEmailTemplates } from "@/data/emailTemplates";


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
    queryKey: queryKeys.campaigns.jobs(batchId),
    queryFn: async () => {
      if (!batchId) return [] as CampaignJob[];
      return findCampaignJobsByBatch<CampaignJob>(batchId);
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
      return findAllEmailTemplates();
    },
  });
}

export function useUpdateCampaignJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CampaignJob> & { id: string }) => {
      await updateCampaignJobById(id, updates);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.campaigns.jobs() }),
  });
}

export function useDeleteCampaignJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await deleteCampaignJobsByIds(ids);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.campaigns.jobs() });
      qc.invalidateQueries({ queryKey: queryKeys.activities.allActivities });
    },
  });
}
