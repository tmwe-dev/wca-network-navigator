/**
 * DAL — Email Content Intelligence (Strato 2).
 *
 * Lettura dei record `email_content_intelligence`: lettura intelligente
 * del contenuto delle mail in arrivo. NESSUNA logica, solo SELECT.
 */
import { untypedFrom } from "@/lib/supabaseUntyped";
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

/** Lettura singola per message_id (può non esistere se non ancora classificata). */
export async function fetchContentIntelligence(
  messageId: string,
): Promise<EmailContentIntelligenceRow | null> {
  const { data, error } = await untypedFrom("email_content_intelligence")
    .select("*")
    .eq("message_id", messageId)
    .maybeSingle();
  if (error) {
    log.warn("fetchContentIntelligence error", { error: error.message });
    return null;
  }
  return (data as EmailContentIntelligenceRow | null) ?? null;
}

/** Bulk per N message_ids — usato dalla list view per i badge. */
export async function fetchContentIntelligenceBulk(
  messageIds: string[],
): Promise<Record<string, EmailContentIntelligenceRow>> {
  if (messageIds.length === 0) return {};
  const { data, error } = await untypedFrom("email_content_intelligence")
    .select("*")
    .in("message_id", messageIds);
  if (error) {
    log.warn("fetchContentIntelligenceBulk error", { error: error.message });
    return {};
  }
  const map: Record<string, EmailContentIntelligenceRow> = {};
  for (const row of (data ?? []) as EmailContentIntelligenceRow[]) {
    if (row.message_id) map[row.message_id] = row;
  }
  return map;
}