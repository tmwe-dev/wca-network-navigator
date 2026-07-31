/**
 * DAL — email_sync_state
 */
import { supabase } from "@/integrations/supabase/client";

/** Reset del cursore di sync IMAP per un utente. Estratto da `useResetSync`. */
export async function resetEmailSyncState(userId: string): Promise<void> {
  const { error } = await supabase
    .from("email_sync_state")
    .update({ last_uid: 0, stored_uidvalidity: null })
    .eq("user_id", userId);
  if (error) throw error;
}
