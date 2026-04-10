import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type MissionActionRow = Database["public"]["Tables"]["mission_actions"]["Row"];
type MissionActionInsert = Database["public"]["Tables"]["mission_actions"]["Insert"];
type MissionActionUpdate = Database["public"]["Tables"]["mission_actions"]["Update"];

export type MissionAction = MissionActionRow;

export interface MissionPlan {
  interpretation: string;
  dangerLevel: "safe" | "moderate" | "critical";
  actions: { type: string; label: string; details?: string }[];
  summary: string;
  totalContacts: number;
  idempotencyKey: string;
}

function generateIdempotencyKey(data: Record<string, unknown>): string {
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
      return data ?? [];
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
        .limit(1);

      if (existing && existing.length > 0) {
        throw new Error("Questa missione è già stata pianificata");
      }

      const rows: MissionActionInsert[] = input.plan.actions.map((a, i) => ({
        mission_id: input.missionId,
        user_id: user.id,
        action_type: a.type,
        action_label: a.label,
        status: "planned",
        idempotency_key: `${input.plan.idempotencyKey}-${i}`,
        danger_level: input.plan.dangerLevel,
        position: i,
        metadata: { details: a.details || "" },
        recovery_log: [],
      }));

      const { data, error } = await supabase
        .from("mission_actions")
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });

  const approveAll = useMutation({
    mutationFn: async (actionMissionId: string) => {
      const { error } = await supabase
        .from("mission_actions")
        .update({ status: "approved" } satisfies MissionActionUpdate)
        .eq("mission_id", actionMissionId)
        .eq("status", "planned");
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Piano approvato"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelAll = useMutation({
    mutationFn: async (actionMissionId: string) => {
      const { error } = await supabase
        .from("mission_actions")
        .update({ status: "cancelled" } satisfies MissionActionUpdate)
        .eq("mission_id", actionMissionId)
        .in("status", ["planned", "approved"]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.info("Piano annullato"); },
    onError: (e: Error) => toast.error(e.message),
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
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10000,
  });
}
