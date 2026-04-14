/**
 * DAL — outreach_queue
 */
import { supabase } from "@/integrations/supabase/client";

export async function findPendingOutreachItems(limit = 5) {
  const { data, error } = await supabase
    .from("outreach_queue")
    .select("id, channel, recipient_name, recipient_email, recipient_phone, recipient_linkedin_url, subject, body, status, attempts, max_attempts, priority, created_by")
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function updateOutreachItem(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("outreach_queue").update(updates as never).eq("id", id);
  if (error) throw error;
}

export async function getOutreachItemField(id: string, field: string) {
  const { data, error } = await supabase.from("outreach_queue").select(field).eq("id", id).single();
  if (error) throw error;
  return data;
}
