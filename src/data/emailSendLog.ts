/**
 * DAL — email_send_log
 * RLS-scoped per user (auth.uid() = user_id).
 */
import { supabase } from "@/integrations/supabase/client";

export type EmailSendStatus = "sent" | "failed" | "bounced" | "rejected";
export type EmailSendMethod = "direct" | "queue" | "campaign" | "agent";

export interface EmailSendLogRow {
  id: string;
  user_id: string;
  message_id: string | null;
  idempotency_key: string | null;
  recipient_email: string;
  subject: string;
  partner_id: string | null;
  activity_id: string | null;
  draft_id: string | null;
  campaign_queue_id: string | null;
  channel: string;
  send_method: EmailSendMethod;
  status: EmailSendStatus;
  error_message: string | null;
  sent_at: string;
}

export interface EmailSendLogStats {
  total: number;
  sent: number;
  failed: number;
  bounced: number;
  rejected: number;
  failureRate: number;
  recentErrors: Array<Pick<EmailSendLogRow, "id" | "recipient_email" | "subject" | "status" | "error_message" | "sent_at" | "send_method">>;
}

/**
 * Fetch logs in a date range. Deduplicates by message_id keeping latest sent_at.
 * Returns aggregate stats + last 10 errors for quick triage.
 */
export async function fetchEmailSendLogStats(sinceIso: string, untilIso?: string): Promise<EmailSendLogStats> {
  let query = supabase
    .from("email_send_log")
    .select("id, message_id, recipient_email, subject, status, error_message, sent_at, send_method")
    .gte("sent_at", sinceIso)
    .order("sent_at", { ascending: false })
    .limit(1000);

  if (untilIso) query = query.lte("sent_at", untilIso);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<Pick<EmailSendLogRow, "id" | "message_id" | "recipient_email" | "subject" | "status" | "error_message" | "sent_at" | "send_method">>;

  // Dedupe by message_id (keep latest = first because ordered DESC).
  const seen = new Set<string>();
  const dedup: typeof rows = [];
  for (const r of rows) {
    const key = r.message_id ?? `__nokey_${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(r);
  }

  const counters = { sent: 0, failed: 0, bounced: 0, rejected: 0 };
  for (const r of dedup) {
    if (r.status in counters) counters[r.status as keyof typeof counters] += 1;
  }
  const total = dedup.length;
  const failures = counters.failed + counters.bounced + counters.rejected;
  const failureRate = total > 0 ? failures / total : 0;

  const recentErrors = dedup
    .filter((r) => r.status !== "sent")
    .slice(0, 10);

  return {
    total,
    sent: counters.sent,
    failed: counters.failed,
    bounced: counters.bounced,
    rejected: counters.rejected,
    failureRate,
    recentErrors,
  };
}
