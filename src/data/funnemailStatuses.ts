/**
 * DAL — Funnemail message status (stati job estesi).
 *
 * 6 stati: nuovo | in_lavorazione | in_attesa | da_smistare | risolto | archiviato.
 */
import { supabase } from "@/integrations/supabase/client";

export type FunnemailJobStatus = "nuovo" | "in_lavorazione" | "in_attesa" | "da_smistare" | "risolto" | "archiviato";

export const FUNNEMAIL_JOB_STATUSES: FunnemailJobStatus[] = [
  "nuovo",
  "in_lavorazione",
  "in_attesa",
  "da_smistare",
  "risolto",
  "archiviato",
];

export const FUNNEMAIL_JOB_STATUS_LABELS: Record<FunnemailJobStatus, string> = {
  nuovo: "Nuovo",
  in_lavorazione: "In lavorazione",
  in_attesa: "In attesa",
  da_smistare: "Da smistare",
  risolto: "Risolto",
  archiviato: "Archiviato",
};

/** Tailwind classes (semantic tokens, no hardcoded colors). */
export const FUNNEMAIL_JOB_STATUS_CLASSES: Record<FunnemailJobStatus, string> = {
  nuovo: "bg-muted text-muted-foreground border-border",
  in_lavorazione: "bg-primary/10 text-primary border-primary/30",
  in_attesa: "bg-warning/10 text-warning border-warning/30",
  da_smistare: "bg-accent text-accent-foreground border-accent",
  risolto: "bg-success/10 text-success border-success/30",
  archiviato: "bg-muted/60 text-muted-foreground border-border",
};

export interface FunnemailStatusRow {
  message_id: string;
  group_id: string | null;
  status: FunnemailJobStatus;
  status_reason: string | null;
  changed_by: string;
  changed_at: string;
  user_id: string;
}

export interface FunnemailStatusHistoryRow {
  id: string;
  message_id: string;
  group_id: string | null;
  from_status: FunnemailJobStatus | null;
  to_status: FunnemailJobStatus;
  reason: string | null;
  changed_by: string;
  changed_at: string;
}

const TABLE = "funnemail_message_status" as const;
const HISTORY_TABLE = "funnemail_message_status_history" as const;

/** Narrowing runtime esplicito: valida che uno status generico appartenga alla union. */
function toJobStatus(value: string): FunnemailJobStatus {
  return (FUNNEMAIL_JOB_STATUSES as string[]).includes(value) ? (value as FunnemailJobStatus) : "nuovo";
}

export async function listStatusesForGroup(groupId?: string | null): Promise<FunnemailStatusRow[]> {
  let q = supabase
    .from(TABLE)
    .select("message_id, group_id, status, status_reason, changed_by, changed_at, user_id")
    .is("deleted_at", null);
  if (groupId) q = q.eq("group_id", groupId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    message_id: row.message_id,
    group_id: row.group_id,
    status: toJobStatus(row.status),
    status_reason: row.status_reason,
    changed_by: row.changed_by,
    changed_at: row.changed_at,
    user_id: row.user_id,
  }));
}

export async function setMessageStatus(args: {
  messageId: string;
  groupId?: string | null;
  status: FunnemailJobStatus;
  reason?: string | null;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  const { error } = await supabase.from(TABLE).upsert(
    {
      message_id: args.messageId,
      group_id: args.groupId ?? null,
      status: args.status,
      status_reason: args.reason ?? null,
      changed_by: uid,
      changed_at: new Date().toISOString(),
      user_id: uid,
    },
    { onConflict: "message_id" },
  );
  if (error) throw error as Error;
}

export async function listStatusHistory(messageId: string): Promise<FunnemailStatusHistoryRow[]> {
  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select("*")
    .eq("message_id", messageId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    message_id: row.message_id,
    group_id: row.group_id,
    from_status: row.from_status == null ? null : toJobStatus(row.from_status),
    to_status: toJobStatus(row.to_status),
    reason: row.reason,
    changed_by: row.changed_by,
    changed_at: row.changed_at,
  }));
}

export async function listSortingQueue(): Promise<FunnemailStatusRow[]> {
  const { data, error } = await supabase
    .from("funnemail_sorting_queue")
    .select("*")
    .order("changed_at", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter(
      (
        row,
      ): row is typeof row & {
        message_id: string;
        changed_by: string;
        changed_at: string;
        status: string;
        user_id: string;
      } =>
        row.message_id != null &&
        row.changed_by != null &&
        row.changed_at != null &&
        row.status != null &&
        row.user_id != null,
    )
    .map((row) => ({
      message_id: row.message_id,
      group_id: row.group_id,
      status: toJobStatus(row.status),
      status_reason: row.status_reason,
      changed_by: row.changed_by,
      changed_at: row.changed_at,
      user_id: row.user_id,
    }));
}

export async function countSortingQueue(): Promise<number> {
  const { count, error } = await supabase
    .from("funnemail_sorting_queue")
    .select("message_id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
