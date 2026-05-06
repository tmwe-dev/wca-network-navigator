/**
 * DAL — Funnemail message status (stati job estesi).
 *
 * 6 stati: nuovo | in_lavorazione | in_attesa | da_smistare | risolto | archiviato.
 * Tabella creata dopo la rigenerazione dei tipi: cast espliciti.
 */
import { supabase } from "@/integrations/supabase/client";

export type FunnemailJobStatus =
  | "nuovo"
  | "in_lavorazione"
  | "in_attesa"
  | "da_smistare"
  | "risolto"
  | "archiviato";

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

type AnyFrom = (t: string) => {
  select: (cols: string) => {
    is?: (col: string, val: null) => unknown;
    eq?: (col: string, val: unknown) => unknown;
    order?: (col: string, opts?: { ascending?: boolean }) => unknown;
  };
  upsert: (row: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<{ error: unknown }>;
};

const fromAny = supabase.from as unknown as AnyFrom;

export async function listStatusesForGroup(groupId?: string | null): Promise<FunnemailStatusRow[]> {
  let q = (supabase.from as unknown as (t: string) => any)(TABLE)
    .select("message_id, group_id, status, status_reason, changed_by, changed_at, user_id")
    .is("deleted_at", null);
  if (groupId) q = q.eq("group_id", groupId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FunnemailStatusRow[];
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

  const { error } = await fromAny(TABLE).upsert(
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
  const { data, error } = await (supabase.from as unknown as (t: string) => any)(HISTORY_TABLE)
    .select("*")
    .eq("message_id", messageId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FunnemailStatusHistoryRow[];
}

export async function listSortingQueue(): Promise<FunnemailStatusRow[]> {
  const { data, error } = await (supabase.from as unknown as (t: string) => any)(
    "funnemail_sorting_queue",
  )
    .select("*")
    .order("changed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FunnemailStatusRow[];
}

export async function countSortingQueue(): Promise<number> {
  const { count, error } = await (supabase.from as unknown as (t: string) => any)(
    "funnemail_sorting_queue",
  )
    .select("message_id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}