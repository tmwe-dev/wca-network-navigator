/**
 * DAL — agent_missions / agent_mission_events
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toRecord } from "@/lib/records";

type MissionUpdate = Database["public"]["Tables"]["agent_missions"]["Update"];
type MissionInsert = Database["public"]["Tables"]["agent_missions"]["Insert"];


type MissionDbRow = Database["public"]["Tables"]["agent_missions"]["Row"];
type MissionEventDbRow = Database["public"]["Tables"]["agent_mission_events"]["Row"];

/** Contratto missione per la UI: le colonne Json sono normalizzate a mappe. */
export interface AgentMissionRow {
  id: string;
  agent_id: string;
  title: string;
  goal_description: string | null;
  goal_type: string;
  kpi_target: Record<string, number | string>;
  kpi_current: Record<string, number>;
  budget: Record<string, number>;
  budget_consumed: Record<string, number>;
  approval_only_for: string[];
  status: string;
  autopilot: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface AgentMissionEventRow {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/** Mappa Json → numeri: le voci non numeriche vengono scartate. */
function numberMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(toRecord(value))) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) out[k] = Number(v);
  }
  return out;
}

/** Mappa Json → numeri o stringhe (i KPI target ammettono entrambi). */
function kpiTargetMap(value: unknown): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(toRecord(value))) {
    if (typeof v === "number" || typeof v === "string") out[k] = v;
  }
  return out;
}

function mapMissionRow(r: MissionDbRow): AgentMissionRow {
  return {
    id: r.id,
    agent_id: r.agent_id,
    title: r.title,
    goal_description: r.goal_description,
    goal_type: r.goal_type,
    kpi_target: kpiTargetMap(r.kpi_target),
    kpi_current: numberMap(r.kpi_current),
    budget: numberMap(r.budget),
    budget_consumed: numberMap(r.budget_consumed),
    approval_only_for: r.approval_only_for ?? [],
    status: r.status,
    autopilot: r.autopilot,
    created_at: r.created_at,
    started_at: r.started_at,
    completed_at: r.completed_at,
  };
}

function mapMissionEventRow(r: MissionEventDbRow): AgentMissionEventRow {
  return {
    id: r.id,
    event_type: r.event_type,
    payload: toRecord(r.payload),
    created_at: r.created_at,
  };
}

/**
 * Crea una missione autopilot.
 * Il payload è tipizzato sull'Insert generato: i campi obbligatori sono
 * `agent_id`, `title` e `owner_user_id`.
 */
export async function insertAgentMission(payload: MissionInsert): Promise<void> {
  const { error } = await supabase.from("agent_missions").insert(payload);
  if (error) throw error;
}

/** Tutte le missioni autopilot, più recenti prima (MissionsAutopilotPage). */
export async function findAllAgentMissions(): Promise<AgentMissionRow[]> {
  const { data, error } = await supabase
    .from("agent_missions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapMissionRow);
}

/** Eventi di una missione, più recenti prima. */
export async function findAgentMissionEvents(missionId: string, limit = 50): Promise<AgentMissionEventRow[]> {
  const { data, error } = await supabase
    .from("agent_mission_events")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapMissionEventRow);
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
