/**
 * Soft-delete helpers.
 *
 * Standard del progetto: nessuna tabella business viene mai eliminata fisicamente.
 * Tutti i "delete" passano da questi helper che eseguono UPDATE deleted_at = now().
 *
 * Vedi mem://constraints/no-physical-delete (creato in seguito).
 */
import { supabase } from "@/integrations/supabase/client";

// Lista bianca delle tabelle che supportano soft-delete (hanno colonne deleted_at + deleted_by)
export type SoftDeletableTable =
  | "imported_contacts"
  | "partners"
  | "partner_contacts"
  | "business_cards"
  | "activities"
  | "reminders"
  | "agents"
  | "outreach_missions"
  | "outreach_queue"
  | "mission_actions"
  | "channel_messages"
  | "kb_entries"
  | "ai_memory"
  | "email_address_rules"
  | "import_logs";

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function softDelete(table: SoftDeletableTable, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const uid = await currentUserId();
  // Cast a any: la colonna deleted_at esiste su tutte le tabelle elencate ma i tipi
  // generati da Supabase potrebbero non riflettere ancora il nuovo schema.
  const { error } = await supabase
    .from(table as never)
    .update({ deleted_at: new Date().toISOString(), deleted_by: uid } as never)
    .in("id", ids);
  if (error) throw error;
}

export async function softDeleteOne(table: SoftDeletableTable, id: string): Promise<void> {
  return softDelete(table, [id]);
}

export async function restore(table: SoftDeletableTable, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from(table as never)
    .update({ deleted_at: null, deleted_by: null } as never)
    .in("id", ids);
  if (error) throw error;
}
