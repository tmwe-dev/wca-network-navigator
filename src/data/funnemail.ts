/**
 * DAL — Funnemail (per-group AI policy + actions log)
 *
 * Le colonne `funnemail_enabled` / `funnemail_policy` su `email_sender_groups`
 * e la tabella `funnemail_actions_log` sono state create dopo la rigenerazione
 * dei tipi Supabase: usiamo `as unknown as` per i campi non ancora tipizzati.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FunnemailPolicy {
  enabled?: boolean;
  actions?: Array<"tag_only" | "deep_search" | "draft_reply" | "crm_update" | "imap_action">;
  min_confidence?: number;
  deep_search?: { trigger?: "always" | "if_unknown_or_stale" | "never"; stale_days?: number; level?: "scout" | "detective" | "sherlock" };
  draft_reply?: { tone?: string; agent_id?: string | null };
  crm_update?: { set_lead_status?: string | null; create_task?: boolean };
  imap_action?: { type?: string; params?: Record<string, unknown> };
}

export interface FunnemailGroupRow {
  id: string;
  nome_gruppo: string;
  colore: string | null;
  icon: string | null;
  funnemail_enabled: boolean;
  funnemail_policy: FunnemailPolicy;
  classification_hint?: string | null;
}

export async function listFunnemailGroups(): Promise<FunnemailGroupRow[]> {
  const { data, error } = await supabase
    .from("email_sender_groups")
    .select("id, nome_gruppo, colore, icon, classification_hint, funnemail_enabled, funnemail_policy" as unknown as "*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("nome_gruppo", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as FunnemailGroupRow[]).map((r) => ({
    ...r,
    funnemail_enabled: Boolean(r.funnemail_enabled),
    funnemail_policy: (r.funnemail_policy ?? {}) as FunnemailPolicy,
  }));
}

export async function updateFunnemailGroupPolicy(
  groupId: string,
  enabled: boolean,
  policy: FunnemailPolicy,
): Promise<void> {
  const { error } = await supabase
    .from("email_sender_groups")
    .update({ funnemail_enabled: enabled, funnemail_policy: policy } as unknown as never)
    .eq("id", groupId);
  if (error) throw error;
}

export interface FunnemailActionLogRow {
  id: string;
  message_id: string;
  group_id: string | null;
  from_address: string | null;
  partner_id: string | null;
  action: string;
  status: string;
  payload: Record<string, unknown>;
  error: string | null;
  created_at: string;
}

export async function listFunnemailActions(limit = 50): Promise<FunnemailActionLogRow[]> {
  const { data, error } = await supabase
    .from("funnemail_actions_log" as unknown as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FunnemailActionLogRow[];
}