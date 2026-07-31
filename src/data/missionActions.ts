/**
 * DAL — mission_actions.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MissionActionRow = Database["public"]["Tables"]["mission_actions"]["Row"];
export type MissionActionInsert = Database["public"]["Tables"]["mission_actions"]["Insert"];
type MissionActionUpdate = Database["public"]["Tables"]["mission_actions"]["Update"];

export async function findMissionActions(missionId: string): Promise<MissionActionRow[]> {
  const { data, error } = await supabase
    .from("mission_actions")
    .select("*")
    .eq("mission_id", missionId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** True se esiste già un piano con la stessa idempotency key per l'utente. */
export async function missionPlanExists(idempotencyKey: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("mission_actions")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .eq("user_id", userId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function insertMissionActions(rows: MissionActionInsert[]): Promise<MissionActionRow[]> {
  const { data, error } = await supabase.from("mission_actions").insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export async function approvePlannedMissionActions(missionId: string): Promise<void> {
  const { error } = await supabase
    .from("mission_actions")
    .update({ status: "approved" } satisfies MissionActionUpdate)
    .eq("mission_id", missionId)
    .eq("status", "planned");
  if (error) throw error;
}

export async function cancelMissionActions(missionId: string): Promise<void> {
  const { error } = await supabase
    .from("mission_actions")
    .update({ status: "cancelled" } satisfies MissionActionUpdate)
    .eq("mission_id", missionId)
    .in("status", ["planned", "approved"]);
  if (error) throw error;
}

export async function findActiveMissionActions(userId: string, limit = 50): Promise<MissionActionRow[]> {
  const { data, error } = await supabase
    .from("mission_actions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["planned", "approved", "executing"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Mission actions con cadenza attiva (planned/approved/executing) per un utente. */
export async function findScheduledMissionActionsWithCadence(userId: string, limit = 50): Promise<MissionActionRow[]> {
  const { data, error } = await supabase
    .from("mission_actions")
    .select("*")
    .eq("user_id", userId)
    .not("cadence_rule", "is", null)
    .in("status", ["planned", "approved", "executing"])
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
