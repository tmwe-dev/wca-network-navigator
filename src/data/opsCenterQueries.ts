/**
 * DAL — Queries for useOperationsCenter.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AgentTasksRow = Database["public"]["Tables"]["agent_tasks"]["Row"];
type EmailQueueRow = Database["public"]["Tables"]["email_campaign_queue"]["Row"];
type ActivitiesRow = Database["public"]["Tables"]["activities"]["Row"];

export type OpsAgentTaskRow = Pick<
  AgentTasksRow,
  "id" | "agent_id" | "description" | "status" | "task_type" | "created_at" | "started_at" | "completed_at" | "result_summary"
>;

export async function getOpsCenterAgentTasks(): Promise<OpsAgentTaskRow[]> {
  const { data, error } = await supabase
    .from("agent_tasks")
    .select("id, agent_id, description, status, task_type, created_at, started_at, completed_at, result_summary")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getAgentNamesByIds(agentIds: string[]): Promise<Record<string, { name: string; emoji: string }>> {
  const agentMap: Record<string, { name: string; emoji: string }> = {};
  if (agentIds.length === 0) return agentMap;
  const { data, error } = await supabase.from("agents").select("id, name, avatar_emoji").in("id", agentIds);
  if (error) throw error;
  (data || []).forEach((a) => {
    agentMap[a.id] = { name: a.name, emoji: a.avatar_emoji };
  });
  return agentMap;
}

export type OpsEmailQueueRow = Pick<
  EmailQueueRow,
  "id" | "recipient_email" | "recipient_name" | "subject" | "status" | "scheduled_at" | "sent_at" | "error_message" | "created_at" | "opened_at" | "open_count"
>;

export async function getOpsCenterEmailQueue(): Promise<OpsEmailQueueRow[]> {
  const { data, error } = await supabase
    .from("email_campaign_queue")
    .select("id, recipient_email, recipient_name, subject, status, scheduled_at, sent_at, error_message, created_at, opened_at, open_count")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export interface OpsActivityRow {
  id: string;
  title: string;
  activity_type: string;
  status: string;
  scheduled_at: string | null;
  due_date: string | null;
  email_subject: string | null;
  sent_at: string | null;
  created_at: string;
  partners: { company_name: string } | null;
}

export async function getOpsCenterActivities(): Promise<OpsActivityRow[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("id, title, activity_type, status, scheduled_at, due_date, email_subject, sent_at, created_at, partners(company_name)")
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as OpsActivityRow[];
}
