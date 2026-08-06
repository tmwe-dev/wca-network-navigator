/**
 * DAL — folder/IMAP operations su `channel_messages` (canale email).
 *
 * Estratto da `useEmailFolderActions` durante la campagna DAL: l'hook non
 * deve conoscere né tabelle né shape PostgREST.
 */
import { supabase } from "@/integrations/supabase/client";

export interface DbFolderCount {
  folder: string;
  count: number;
}

/** Conteggio messaggi inbound visibili per cartella (aggregazione client-side). */
export async function fetchDbFolderCounts(): Promise<DbFolderCount[]> {
  const { data, error } = await supabase
    .from("channel_messages")
    .select("folder")
    .eq("channel", "email")
    .eq("direction", "inbound")
    .eq("hidden_by_rule", false);
  if (error) throw error;
  const counts = new Map<string, number>();
  (data ?? []).forEach((row: { folder: string | null }) => {
    const f = row.folder || "INBOX";
    counts.set(f, (counts.get(f) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([folder, count]) => ({ folder, count }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
}

/** Nasconde i messaggi indicati (soft-hide via `hidden_by_rule`). */
export async function hideChannelMessagesByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("channel_messages").update({ hidden_by_rule: true }).in("id", ids);
  if (error) throw error;
}

/** Aggiorna la cartella (ed eventualmente nasconde) per id messaggio. */
export async function setChannelMessagesFolderByIds(ids: string[], folder: string, hide = false): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("channel_messages")
    .update({ folder, ...(hide ? { hidden_by_rule: true } : {}) })
    .in("id", ids);
  if (error) throw error;
}

/** Aggiorna la cartella (ed eventualmente nasconde) per UID IMAP. */
export async function setChannelMessagesFolderByUids(uids: number[], folder: string, hide = false): Promise<void> {
  if (uids.length === 0) return;
  const { error } = await supabase
    .from("channel_messages")
    .update({ folder, ...(hide ? { hidden_by_rule: true } : {}) })
    .in("imap_uid", uids);
  if (error) throw error;
}

/** Id messaggi inbound di un mittente esatto. */
export async function findInboundMessageIdsByAddress(address: string, limit = 500): Promise<string[]> {
  const { data, error } = await supabase
    .from("channel_messages")
    .select("id")
    .eq("from_address", address)
    .eq("channel", "email")
    .eq("direction", "inbound")
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((m: { id: string }) => m.id);
}

/** Id messaggi inbound provenienti da un dominio. */
export async function findInboundMessageIdsByDomain(domain: string, limit = 500): Promise<string[]> {
  const { data, error } = await supabase
    .from("channel_messages")
    .select("id")
    .eq("channel", "email")
    .eq("direction", "inbound")
    .ilike("from_address", `%@${domain}`)
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((m: { id: string }) => m.id);
}
