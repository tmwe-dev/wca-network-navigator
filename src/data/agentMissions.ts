/**
 * DAL — agent_missions / agent_mission_events
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { untypedFrom } from "@/lib/supabaseUntyped";

type MissionUpdate = Database["public"]["Tables"]["agent_missions"]["Update"];

/**
 * Crea una missione autopilot.
 * DRIFT: l'Insert generato richiede `owner_user_id` (non `user_id`) e il payload
 * del wizard usa campi più larghi della shape generata: resta su `untypedFrom`
 * finché la deriva di colonne non viene riconciliata.
 */
export async function insertAgentMission(payload: Record<string, unknown>): Promise<void> {
  const { error } = await untypedFrom("agent_missions").insert(payload);
  if (error) throw error;
}

/** Tutte le missioni autopilot, più recenti prima (MissionsAutopilotPage). */
export async function findAllAgentMissions(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("agent_missions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Eventi di una missione, più recenti prima. */
export async function findAgentMissionEvents(missionId: string, limit = 50): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("agent_mission_events")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Aggiorna lo stato (ed eventuali altri campi) di una missione. */
export async function updateAgentMissionFields(id: string, updates: MissionUpdate): Promise<void> {
  const { error } = await supabase.from("agent_missions").update(updates).eq("id", id);
  if (error) throw error;
}

export interface MissionOverviewRow {
  id: string;
  title: string | null;
  goal_type: string | null;
  status: string | null;
  autopilot: boolean | null;
  kpi_target: number | null;
  kpi_current: number | null;
  budget: number | null;
  budget_consumed: number | null;
}

/** Elenco missioni con colonne ridotte + count, per il tool "list-missions". */
export async function findAgentMissionsOverview(limit = 40): Promise<{ rows: MissionOverviewRow[]; count: number | null }> {
  const { data, error, count } = await supabase
    .from("agent_missions")
    .select(
      "id,title,goal_type,status,autopilot,kpi_target,kpi_current,budget,budget_consumed",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return { rows: (data ?? []) as MissionOverviewRow[], count: count ?? null };
}

/** Titolo di una missione per id (mission-control tool). */
export async function findAgentMissionTitleById(id: string): Promise<{ title?: string } | null> {
  const { data } = await supabase.from("agent_missions").select("title").eq("id", id).maybeSingle();
  return data as { title?: string } | null;
}

/** Missione la cui titolo contiene il termine indicato (mission-control tool). */
export async function findAgentMissionByTitleLike(term: string): Promise<{ id: string; title: string } | null> {
  const { data } = await supabase
    .from("agent_missions")
    .select("id,title")
    .ilike("title", `%${term}%`)
    .limit(1)
    .maybeSingle();
  return data as { id: string; title: string } | null;
}
