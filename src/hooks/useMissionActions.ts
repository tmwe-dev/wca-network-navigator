import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MissionAction {
  id: string;
  mission_id: string;
  user_id: string;
  action_type: string;
  action_label: string;
  status: string;
  idempotency_key: string | null;
  danger_level: string;
  position: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  recovery_log: any[];
  metadata: Record<string, any>;
  created_at: string;
}

export interface MissionPlan {
  interpretation: string;
  dangerLevel: "safe" | "moderate" | "critical";
  actions: { type: string; label: string; details?: string }[];
  summary: string;
  totalContacts: number;
  idempotencyKey: string;
}

function generateIdempotencyKey(data: Record<string, any>): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const day = new Date().toISOString().slice(0, 10);
  return `mission-${day}-${Math.abs(hash).toString(36)}`;
}

export function useMissionActions(missionId?: string) {
  const qc = useQueryClient();
  const key = ["mission-actions", missionId];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!missionId) return [];
      const { data, error } = await supabase
        .from("mission_actions")
        .select("*")
        .eq("mission_id", missionId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MissionAction[];
    },
    enabled: !!missionId,
  });

  const createActions = useMutation({
    mutationFn: async (input: {
      missionId: string;
      plan: MissionPlan;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      // Check idempotency
      const { data: existing } = await supabase
        .from("mission_actions")
        .select("id")
        .eq("idempotency_key", input.plan.idempotencyKey)
        .eq("user_id", user.id)
        .limit(1) as any;

      if (existing && existing.length > 0) {
        throw new Error("Questa missione è già stata pianificata");
      }

      const rows = input.plan.actions.map((a, i) => ({
        mission_id: input.missionId,
        user_id: user.id,
        action_type: a.type,
        action_label: a.label,
        status: "planned",
        idempotency_key: `${input.plan.idempotencyKey}-${i}`,
        danger_level: input.plan.dangerLevel,
        position: i,
        metadata: { details: a.details || "" } as any,
        recovery_log: [] as any,
      }));

      const { data, error } = await supabase
        .from("mission_actions")
        .insert(rows as any)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toast.error(e.message),
  });

  const approveAll = useMutation({
    mutationFn: async (actionMissionId: string) => {
      const { error } = await supabase
        .from("mission_actions")
        .update({ status: "approved" } as any)
        .eq("mission_id", actionMissionId)
        .eq("status", "planned") as any;
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Piano approvato"); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelAll = useMutation({
    mutationFn: async (actionMissionId: string) => {
      const { error } = await supabase
        .from("mission_actions")
        .update({ status: "cancelled" } as any)
        .eq("mission_id", actionMissionId)
        .in("status", ["planned", "approved"]) as any;
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.info("Piano annullato"); },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    actions: query.data ?? [],
    isLoading: query.isLoading,
    createActions,
    approveAll,
    cancelAll,
    generateIdempotencyKey,
  };
}

export function useActiveMissions() {
  return useQuery({
    queryKey: ["active-mission-actions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("mission_actions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["planned", "approved", "executing"])
        .order("created_at", { ascending: false })
        .limit(50) as any;
      if (error) throw error;
      return (data ?? []) as unknown as MissionAction[];
    },
    refetchInterval: 10000,
  });
}
