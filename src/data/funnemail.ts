/**
 * DAL — Funnemail (per-group AI policy + actions log)
 *
 * `funnemail_enabled` / `funnemail_policy` (email_sender_groups) e
 * `funnemail_actions_log` sono presenti nei tipi generati: query tipizzate.
 */
import { supabase } from "@/integrations/supabase/client";
import { toJsonValue } from "@/lib/jsonGuards";

export interface FunnemailPolicy {
  enabled?: boolean;
  actions?: Array<"tag_only" | "deep_search" | "draft_reply" | "crm_update" | "imap_action">;
  min_confidence?: number;
  deep_search?: {
    trigger?: "always" | "if_unknown_or_stale" | "never";
    stale_days?: number;
    level?: "scout" | "detective" | "sherlock";
  };
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
    .select("id, nome_gruppo, colore, icon, classification_hint, funnemail_enabled, funnemail_policy")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("nome_gruppo", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    nome_gruppo: r.nome_gruppo,
    colore: r.colore,
    icon: r.icon,
    classification_hint: r.classification_hint,
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
    .update({ funnemail_enabled: enabled, funnemail_policy: toJsonValue(policy) })
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

function toRecord(json: unknown): Record<string, unknown> {
  return typeof json === "object" && json !== null && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
}

export async function listFunnemailActions(limit = 50): Promise<FunnemailActionLogRow[]> {
  const { data, error } = await supabase
    .from("funnemail_actions_log")
    .select("id, message_id, group_id, from_address, partner_id, action, status, payload, error, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    message_id: r.message_id,
    group_id: r.group_id,
    from_address: r.from_address,
    partner_id: r.partner_id,
    action: r.action,
    status: r.status,
    payload: toRecord(r.payload),
    error: r.error,
    created_at: r.created_at,
  }));
}
