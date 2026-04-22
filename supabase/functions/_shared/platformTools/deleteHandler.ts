/**
 * deleteHandler.ts - Record deletion tool handlers
 * Handles: delete records
 */

import { supabase } from "./supabaseClient.ts";

export async function handleDeleteRecords(
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const table = String(args.table);
  const ids = args.ids as string[];
  const valid = ["partners", "prospects", "activities", "reminders"];
  if (!valid.includes(table)) return { error: `Tabella non valida: ${table}` };

  const { error } = await supabase
    .from(table as "partners")
    .delete()
    .eq("user_id", userId)
    .in("id", ids);
  return error ? { error: error.message } : { success: true, deleted: ids.length };
}
