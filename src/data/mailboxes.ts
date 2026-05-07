/**
 * DAL — Mailboxes (personali + condivise aziendali).
 * Solo letture e mutations CRUD; nessuna logica di business qui.
 */
import { untypedFrom } from "@/lib/supabaseUntyped";
import { supabase } from "@/integrations/supabase/client";

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

export async function listAccessibleMailboxes(operatorId?: string): Promise<AccessibleMailbox[]> {
  const { data, error } = await (supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: AccessibleMailbox[] | null; error: unknown }>;
  }).rpc("get_accessible_mailboxes", { p_operator_id: operatorId ?? null });
  if (error) throw error as Error;
  return data ?? [];
}

export async function listSharedMailboxes(): Promise<SharedMailbox[]> {
  const { data, error } = await untypedFrom("shared_mailboxes")
    .select(
      "id, slug, label, email, department, imap_host, imap_port, imap_user, smtp_host, smtp_port, smtp_user, reply_to, is_active, auto_grant, description, created_at, updated_at"
    )
    .is("deleted_at", null)
    .order("label", { ascending: true });
  if (error) throw error as Error;
  return (data ?? []) as SharedMailbox[];
}

export async function listOperatorMailboxAccess(operatorId: string): Promise<string[]> {
  const { data, error } = await untypedFrom("operator_mailbox_access")
    .select("shared_mailbox_id")
    .eq("operator_id", operatorId);
  if (error) throw error as Error;
  return ((data ?? []) as { shared_mailbox_id: string }[]).map((r) => r.shared_mailbox_id);
}

export async function setOperatorMailboxAccess(
  operatorId: string,
  mailboxIds: string[],
): Promise<void> {
  const current = await listOperatorMailboxAccess(operatorId);
  const toAdd = mailboxIds.filter((id) => !current.includes(id));
  const toRemove = current.filter((id) => !mailboxIds.includes(id));

  if (toAdd.length) {
    const { error } = await untypedFrom("operator_mailbox_access").insert(
      toAdd.map((id) => ({ operator_id: operatorId, shared_mailbox_id: id })),
    );
    if (error) throw error as Error;
  }
  if (toRemove.length) {
    const { error } = await untypedFrom("operator_mailbox_access")
      .delete()
      .eq("operator_id", operatorId)
      .in("shared_mailbox_id", toRemove);
    if (error) throw error as Error;
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
  const payload = { ...input, updated_at: new Date().toISOString() };
  const query = input.id
    ? untypedFrom("shared_mailboxes").update(payload).eq("id", input.id).select().maybeSingle()
    : untypedFrom("shared_mailboxes").insert(payload).select().maybeSingle();
  const { data, error } = await query;
  if (error) throw error as Error;
  return data as SharedMailbox;
}

export async function deleteSharedMailbox(id: string): Promise<void> {
  const { error } = await untypedFrom("shared_mailboxes").delete().eq("id", id);
  if (error) throw error as Error;
}