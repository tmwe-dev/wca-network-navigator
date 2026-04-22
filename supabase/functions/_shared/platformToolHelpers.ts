/**
 * platformToolHelpers.ts — Shared utilities for tool handlers.
 *
 * Partner resolution, type definitions, and common Supabase client setup.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { escapeLike } from "./sqlEscape.ts";

export const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── Local interfaces for query row shapes ──
export interface CountryStatRow {
  country_code: string;
  total_partners: number;
  with_profile: number;
  without_profile: number;
  with_email: number;
  with_phone: number;
}

export interface DirectoryCountRow {
  country_code: string;
  member_count: number;
}

export interface PartnerSummary {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  phone: string | null;
  rating: number | null;
  wca_id: number | null;
  website: string | null;
  profile_description: string | null;
  raw_profile_markdown: string | null;
  is_favorite: boolean;
  office_type: string | null;
  lead_status: string | null;
}

export interface ServiceRow {
  service_category: string;
}

export interface DownloadJobRow {
  id: string;
  country_name: string;
  status: string;
  current_index: number;
  total_count: number;
  contacts_found_count: number;
  error_message: string | null;
  created_at: string;
}

export interface EmailQueueRow {
  id: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_email: string;
  subject: string;
}

export interface AgentTaskRow {
  id: string;
  agent_id: string;
  description: string;
  status: string;
  task_type: string;
  created_at: string;
  result_summary: string | null;
}

export interface ActivityRow {
  id: string;
  title: string;
  status: string;
  activity_type: string;
  scheduled_at: string | null;
  due_date: string | null;
  source_meta: Record<string, unknown> | null;
  partner_id: string | null;
  priority: string;
  created_at: string;
  description: string | null;
}

export interface ChannelMessageRow {
  id: string;
  channel: string;
  direction: string;
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body_text: string | null;
  email_date: string | null;
  read_at: string | null;
  partner_id: string | null;
  category: string | null;
  created_at: string;
  thread_id?: string | null;
  in_reply_to?: string | null;
}

export interface AgentRow {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  stats: Record<string, unknown>;
  avatar_emoji: string;
  updated_at: string;
}

export interface WorkPlanStep {
  index?: number;
  title?: string;
  description?: string;
  status?: string;
}

export interface HoldingItem {
  id: string;
  source: string;
  name: string;
  country: string;
  city?: string;
  email: string | null;
  status: string;
  days_waiting: number;
  interactions?: number;
}

export async function resolvePartnerId(
  args: Record<string, unknown>,
): Promise<{ id: string; name: string } | null> {
  if (args.partner_id) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .eq("id", args.partner_id)
      .single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  if (args.company_name) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .ilike("company_name", `%${escapeLike(args.company_name as string)}%`)
      .limit(1)
      .single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  return null;
}
