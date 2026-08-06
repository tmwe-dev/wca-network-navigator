/**
 * DAL — Mailboxes (personali + condivise aziendali).
 * Solo letture e mutations CRUD; nessuna logica di business qui.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SharedMailboxRow = Database["public"]["Tables"]["shared_mailboxes"]["Row"];
type SharedMailboxInsert = Database["public"]["Tables"]["shared_mailboxes"]["Insert"];
type SharedMailboxUpdate = Database["public"]["Tables"]["shared_mailboxes"]["Update"];

export type MailboxKind = "personal" | "shared";

export interface AccessibleMailbox {
  kind: MailboxKind;
  mailbox_id: string;
  email: string;
  label: string;
  department: string;
  is_default: boolean;
}

export interface SharedMailbox {
  id: string;
  slug: string;
  label: string;
  email: string;
  department: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_user: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  reply_to: string | null;
  is_active: boolean;
  auto_grant: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function toMailboxKind(value: string): MailboxKind {
  return value === "shared" ? "shared" : "personal";
}

export async function listAccessibleMailboxes(operatorId?: string): Promise<AccessibleMailbox[]> {
  const { data, error } = await supabase.rpc(
    "get_accessible_mailboxes",
    operatorId ? { p_operator_id: operatorId } : {},
  );
  if (error) throw error;
  return (data ?? []).map((row) => ({
    kind: toMailboxKind(row.kind),
    mailbox_id: row.mailbox_id,
    email: row.email,
    label: row.label,
    department: row.department,
    is_default: row.is_default,
  }));
}

function mapSharedMailbox(row: SharedMailboxRow): SharedMailbox {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    email: row.email,
    department: row.department,
    imap_host: row.imap_host,
    imap_port: row.imap_port,
    imap_user: row.imap_user,
    smtp_host: row.smtp_host,
    smtp_port: row.smtp_port,
    smtp_user: row.smtp_user,
    reply_to: row.reply_to,
    is_active: row.is_active,
    auto_grant: row.auto_grant,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listSharedMailboxes(): Promise<SharedMailbox[]> {
  const { data, error } = await supabase
    .from("shared_mailboxes")
    .select("*")
    .is("deleted_at", null)
    .order("label", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapSharedMailbox);
}

export async function listOperatorMailboxAccess(operatorId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("operator_mailbox_access")
    .select("shared_mailbox_id")
    .eq("operator_id", operatorId);
  if (error) throw error;
  return (data ?? []).map((r) => r.shared_mailbox_id);
}

export async function setOperatorMailboxAccess(operatorId: string, mailboxIds: string[]): Promise<void> {
  const current = await listOperatorMailboxAccess(operatorId);
  const toAdd = mailboxIds.filter((id) => !current.includes(id));
  const toRemove = current.filter((id) => !mailboxIds.includes(id));

  if (toAdd.length) {
    const { error } = await supabase
      .from("operator_mailbox_access")
      .insert(toAdd.map((id) => ({ operator_id: operatorId, shared_mailbox_id: id })));
    if (error) throw error;
  }
  if (toRemove.length) {
    const { error } = await supabase
      .from("operator_mailbox_access")
      .delete()
      .eq("operator_id", operatorId)
      .in("shared_mailbox_id", toRemove);
    if (error) throw error;
  }
}

export interface SharedMailboxUpsert {
  id?: string;
  slug: string;
  label: string;
  email: string;
  department: string;
  imap_host?: string | null;
  imap_port?: number | null;
  imap_user?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  reply_to?: string | null;
  is_active?: boolean;
  auto_grant?: boolean;
  description?: string | null;
}

export async function upsertSharedMailbox(input: SharedMailboxUpsert): Promise<SharedMailbox> {
  const { id, ...fields } = input;
  const updated_at = new Date().toISOString();
  if (id) {
    const patch: SharedMailboxUpdate = { ...fields, updated_at };
    const { data, error } = await supabase.from("shared_mailboxes").update(patch).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Mailbox non trovata");
    return mapSharedMailbox(data);
  }
  const row: SharedMailboxInsert = { ...fields, updated_at };
  const { data, error } = await supabase.from("shared_mailboxes").insert(row).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Inserimento mailbox fallito");
  return mapSharedMailbox(data);
}

export async function deleteSharedMailbox(id: string): Promise<void> {
  const { error } = await supabase.from("shared_mailboxes").delete().eq("id", id);
  if (error) throw error;
}
