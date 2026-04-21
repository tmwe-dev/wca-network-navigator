/**
 * DAL — commercial_playbooks
 */
import { supabase } from "@/integrations/supabase/client";

export interface CommercialPlaybook {
  id: string;
  user_id: string;
  code: string;
  name: string;
  description: string | null;
  trigger_conditions: Record<string, unknown> | null;
  workflow_code: string | null;
  prompt_template: string | null;
  suggested_actions: Record<string, unknown> | null;
  kb_tags: string[] | null;
  priority: number | null;
  category: string | null;
  is_template: boolean | null;
  is_active: boolean | null;
}

export async function findCommercialPlaybooks(userId: string): Promise<CommercialPlaybook[]> {
  const { data, error } = await supabase
    .from("commercial_playbooks")
    .select("*")
    .eq("user_id", userId)
    .order("priority", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CommercialPlaybook[];
}

export async function updateCommercialPlaybook(id: string, patch: Partial<CommercialPlaybook>): Promise<void> {
  const { error } = await supabase.from("commercial_playbooks").update(patch).eq("id", id);
  if (error) throw error;
}