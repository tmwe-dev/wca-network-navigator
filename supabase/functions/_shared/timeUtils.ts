/**
 * Shared time utilities for consistent work-hours logic
 * across all edge functions (agent-autonomous-cycle, email-cron-sync, etc.)
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_WORK_START_HOUR = 6;
const DEFAULT_WORK_END_HOUR = 24;

/** Returns current hour in CET/CEST (Europe/Rome) */
export function getCETHour(): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(now), 10);
}

/** Check if current CET hour is outside configured work window */
export function isOutsideWorkHours(startHour: number, endHour: number): boolean {
  const hour = getCETHour();
  if (endHour <= startHour) return false; // misconfigured → never pause
  return hour < startHour || hour >= endHour;
}

/** Load work-hour settings from app_settings, with defaults */
export async function loadWorkHourSettings(supabase: SupabaseClient, userId?: string): Promise<{
  workStartHour: number;
  workEndHour: number;
}> {
  let query = supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["agent_work_start_hour", "agent_work_end_hour"]);
  if (userId) query = query.eq("user_id", userId);

  const { data: rows } = await query;

  const cfg: Record<string, string> = {};
  rows?.forEach((row: any) => { if (row.value) cfg[row.key] = row.value; });

  return {
    workStartHour: parseInt(cfg["agent_work_start_hour"] || String(DEFAULT_WORK_START_HOUR), 10),
    workEndHour: parseInt(cfg["agent_work_end_hour"] || String(DEFAULT_WORK_END_HOUR), 10),
  };
}
