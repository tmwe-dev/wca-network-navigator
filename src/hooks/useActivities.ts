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
    mutationFn: async ({ id, ...updates }: { id: string; status?: "pending" | "in_progress" | "completed" | "cancelled"; completed_at?: string | null }) => {
      const { error } = await supabase
        .from("activities")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}
