/**
 * DAL — Sidebar unread/pending badge counts
 */
import { supabase } from "@/integrations/supabase/client";

export interface UnreadCountsMailboxFilter {
  readonly kind: "personal" | "shared";
  readonly mailbox_id: string;
}

export interface UnreadCountsRaw {
  readonly unreadMessages: number;
  readonly pendingTasks: number;
  readonly pendingQueue: number;
}

/** Alias di compatibilità per i consumer esistenti. */
export type UnreadCountsResult = UnreadCountsRaw;

export async function fetchUnreadCounts(activeMailbox: UnreadCountsMailboxFilter | null = null): Promise<UnreadCountsRaw> {
  let msgQuery = supabase
    .from("channel_messages")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .eq("direction", "inbound")
    .not("hidden_by_rule", "is", true);
  if (activeMailbox?.kind === "personal") {
    msgQuery = msgQuery.is("mailbox_id", null);
  } else if (activeMailbox?.kind === "shared") {
    msgQuery = msgQuery.eq("mailbox_id", activeMailbox.mailbox_id);
  }
  const [msgRes, taskRes, queueRes] = await Promise.all([
    msgQuery,
    supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null),
    supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return {
    unreadMessages: msgRes.count ?? 0,
    pendingTasks: taskRes.count ?? 0,
    pendingQueue: queueRes.count ?? 0,
  };
}
