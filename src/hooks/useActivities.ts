/**
 * React Query hooks for Activities — thin wrappers around src/data/activities.ts
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  findActivitiesForPartner,
  findAllActivities,
  createActivities,
  updateActivity,
  deleteActivities,
  activityKeys,
  invalidateActivityCache,
} from "@/data/activities";
import { supabase } from "@/integrations/supabase/client";
import type { Activity, AllActivity, SourceMeta } from "@/data/activities";
import { queryKeys } from "@/lib/queryKeys";

// Re-export types for backward compat
export type { Activity, AllActivity, SourceMeta };

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

export function useActivitiesForPartner(partnerId: string | null) {
  return useQuery({
    queryKey: partnerId ? activityKeys.forPartner(partnerId) : ["noop"],
    queryFn: () => findActivitiesForPartner(partnerId!),
    enabled: !!partnerId,
  });
}

export function useCreateActivities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createActivities,
    onSuccess: () => invalidateActivityCache(qc),
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: "pending" | "in_progress" | "completed" | "cancelled"; completed_at?: string | null; selected_contact_id?: string | null }) => {
      await updateActivity(id, updates);
    },
    onSuccess: () => invalidateActivityCache(qc),
  });
}

export function useAllActivities() {
  return useQuery({
    queryKey: activityKeys.all,
    queryFn: () => findAllActivities(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/**
 * Shared contact-fetching hook used by ActivitiesTab, CampaignJobs, ContactListPanel.
 */
export function useContactsForPartners(partnerIds: string[]) {
  return useQuery({
    queryKey: queryKeys.partnerContacts.map(partnerIds),
    queryFn: async () => {
      if (!partnerIds.length) return {} as Record<string, PartnerContactRecord[]>;
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteActivities,
    onSuccess: () => invalidateActivityCache(qc),
  });
}
