/**
 * Shared side-effects for email sending.
 * Used by both send-email (direct) and process-email-queue (batch)
 * to ensure consistent state updates across all sending paths.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface EmailSideEffectParams {
  supabase: SupabaseClient;
  partner_id: string;
  user_id: string;
  subject: string;
  to: string;
  html: string;
  agent_id?: string;
  source_meta?: Record<string, unknown>;
  message_id_external?: string;
  thread_id?: string;
}

export async function logEmailSideEffects({
  supabase,
  partner_id,
  user_id,
  subject,
  to,
  html,
  agent_id,
  source_meta,
  message_id_external,
  thread_id,
}: EmailSideEffectParams): Promise<void> {
  const now = new Date().toISOString();

  // 1. Log interaction
  await supabase.from("interactions").insert({
    partner_id,
    user_id,
    interaction_type: "email",
    subject: `Email a ${to}: ${subject}`,
    notes: html,
    interaction_date: now,
  });

  // 2. Create activity record
  await supabase.from("activities").insert({
    user_id,
    source_type: "partner",
    source_id: partner_id,
    partner_id,
    activity_type: "send_email",
    title: `Email inviata: ${subject || "Senza oggetto"}`,
    description: `Email inviata a ${to}`,
    email_subject: subject,
    email_body: html,
    status: "completed",
    completed_at: now,
    sent_at: now,
    priority: "medium",
    ...(agent_id ? { executed_by_agent_id: agent_id } : {}),
    ...(source_meta ? { source_meta } : {}),
    ...(message_id_external ? { message_id_external } : {}),
    ...(thread_id ? { thread_id } : {}),
  });

  // 3. Update partner: escalate lead_status from 'new' to 'contacted'
  await supabase
    .from("partners")
    .update({
      lead_status: "contacted",
      last_interaction_at: now,
    })
    .eq("id", partner_id)
    .eq("lead_status", "new");

  // 4. Atomically increment interaction count (avoids race condition)
  await supabase.rpc("increment_partner_interaction", { p_partner_id: partner_id });
}
