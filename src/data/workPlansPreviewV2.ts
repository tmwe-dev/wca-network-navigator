/**
 * DAL — anteprima globale ai_work_plans (Staff hub, no filtro user).
 */
import { supabase } from "@/integrations/supabase/client";

export interface WorkPlanPreviewRow {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly current_step: number | null;
  readonly created_at: string;
}

export async function findRecentWorkPlansPreview(limit = 10): Promise<WorkPlanPreviewRow[]> {
  const { data, error } = await supabase
    .from("ai_work_plans")
    .select("id, title, status, current_step, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
