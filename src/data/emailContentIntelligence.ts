/**
 * DAL — Email Content Intelligence (Strato 2).
 *
 * Lettura dei record `email_content_intelligence`: lettura intelligente
 * del contenuto delle mail in arrivo. NESSUNA logica, solo SELECT.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { createLogger } from "@/lib/log";

const log = createLogger("emailContentIntelligence");

export interface SuggestedAction {
  type: string;
  label?: string;
  color?: string;
  title?: string;
  due_in_hours?: number;
  assignee_role?: string;
  next?: string;
  reason?: string;
  template_hint?: string;
  [key: string]: unknown;
}

export interface EmailContentIntelligenceRow {
  id: string;
  message_id: string;
  user_id: string | null;
  partner_id: string | null;
  from_address: string | null;
  content_label: string;
  intent_summary: string;
  business_value: string | null;
  urgency: string | null;
  target_role: string | null;
  continuity: Record<string, unknown>;
  reasoning: string | null;
  confidence: number;
  suggested_actions: SuggestedAction[];
  model: string | null;
  context_summary: Record<string, unknown>;
  pending_action_ids: string[];
  created_at: string;
  updated_at: string;
}

type ContentIntelligenceRow = Database["public"]["Tables"]["email_content_intelligence"]["Row"];

function mapRow(row: ContentIntelligenceRow): EmailContentIntelligenceRow {
  return {
    id: row.id,
    message_id: row.message_id,
    user_id: row.user_id,
    partner_id: row.partner_id,
    from_address: row.from_address,
    content_label: row.content_label,
    intent_summary: row.intent_summary,
    business_value: row.business_value,
    urgency: row.urgency,
    target_role: row.target_role,
    continuity: (row.continuity ?? {}) as Record<string, unknown>,
    reasoning: row.reasoning,
    confidence: row.confidence,
    suggested_actions: (Array.isArray(row.suggested_actions)
      ? row.suggested_actions
      : []) as unknown as SuggestedAction[],
    model: row.model,
    context_summary: (row.context_summary ?? {}) as Record<string, unknown>,
    pending_action_ids: row.pending_action_ids ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Lettura singola per message_id (può non esistere se non ancora classificata). */
export async function fetchContentIntelligence(messageId: string): Promise<EmailContentIntelligenceRow | null> {
  const { data, error } = await supabase
    .from("email_content_intelligence")
    .select("*")
    .eq("message_id", messageId)
    .maybeSingle();
  if (error) {
    log.warn("fetchContentIntelligence error", { error: error.message });
    return null;
  }
  return data ? mapRow(data) : null;
}

/** Bulk per N message_ids — usato dalla list view per i badge. */
export async function fetchContentIntelligenceBulk(
  messageIds: string[],
): Promise<Record<string, EmailContentIntelligenceRow>> {
  if (messageIds.length === 0) return {};
  const { data, error } = await supabase.from("email_content_intelligence").select("*").in("message_id", messageIds);
  if (error) {
    log.warn("fetchContentIntelligenceBulk error", { error: error.message });
    return {};
  }
  const map: Record<string, EmailContentIntelligenceRow> = {};
  for (const row of data ?? []) {
    const mapped = mapRow(row);
    if (mapped.message_id) map[mapped.message_id] = mapped;
  }
  return map;
}
