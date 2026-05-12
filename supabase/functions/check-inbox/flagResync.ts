/**
 * flagResync.ts — Sincronizza il flag \Seen del server IMAP per le mail
 * che nel nostro DB risultano ancora unread (read_at IS NULL).
 *
 * Filosofia minima:
 * - Solo UNREAD locali → carico contenuto trascurabile (decine di messaggi).
 * - Solo FLAGS, niente body/header → costo IMAP bassissimo.
 * - Best-effort: fallimenti non interrompono il flusso di check-inbox.
 *
 * Casi gestiti:
 * - Mail letta su un altro client → marca read_at = now() locale.
 * - UID non più presente nella INBOX (spostata/cancellata altrove) →
 *   nessuna azione distruttiva (no soft-delete) — la mail resta come
 *   storico, semplicemente non viene marcata come letta.
 */

interface ImapExec {
  executeCommand(cmd: string): Promise<(string | Uint8Array)[]>;
}

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

const WINDOW_DAYS = 60;
const MAX_UIDS = 500;
const CHUNK_SIZE = 100;

interface UnreadRow {
  id: string;
  imap_uid: number;
}

function parseSeenFromFetchResponse(
  lines: (string | Uint8Array)[],
): Set<number> {
  const seenUids = new Set<number>();
  for (const line of lines) {
    if (typeof line !== "string") continue;
    // es: * 12 FETCH (UID 345 FLAGS (\Seen \Recent))
    const uidMatch = line.match(/UID\s+(\d+)/i);
    const flagsMatch = line.match(/FLAGS\s*\(([^)]*)\)/i);
    if (!uidMatch || !flagsMatch) continue;
    const flags = flagsMatch[1].toLowerCase();
    if (flags.includes("\\seen")) {
      seenUids.add(Number(uidMatch[1]));
    }
  }
  return seenUids;
}

export async function resyncUnreadFlags(
  supabase: SupabaseLike,
  imapExec: ImapExec,
  userId: string,
  mailboxId: string | null = null,
): Promise<{ checked: number; markedRead: number }> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString();

  let q = supabase
    .from("channel_messages")
    .select("id, imap_uid")
    .eq("user_id", userId)
    .eq("channel", "email")
    .eq("direction", "inbound")
    .is("read_at", null)
    .not("imap_uid", "is", null)
    .gte("created_at", since);
  q = mailboxId ? q.eq("mailbox_id", mailboxId) : q.is("mailbox_id", null);
  const { data, error } = await q
    .order("imap_uid", { ascending: false })
    .limit(MAX_UIDS);

  if (error || !data || data.length === 0) {
    return { checked: 0, markedRead: 0 };
  }

  const rows = data as UnreadRow[];
  const uidToId = new Map<number, string>();
  for (const r of rows) {
    if (typeof r.imap_uid === "number") uidToId.set(r.imap_uid, r.id);
  }

  const allUids = Array.from(uidToId.keys());
  const seenIds: string[] = [];

  for (let i = 0; i < allUids.length; i += CHUNK_SIZE) {
    const chunk = allUids.slice(i, i + CHUNK_SIZE);
    const cmd = `UID FETCH ${chunk.join(",")} (FLAGS)`;
    try {
      const resp = await imapExec.executeCommand(cmd);
      const seenUids = parseSeenFromFetchResponse(resp);
      for (const uid of seenUids) {
        const id = uidToId.get(uid);
        if (id) seenIds.push(id);
      }
    } catch (_err) {
      // best-effort: ignora il chunk e prosegui
      continue;
    }
  }

  if (seenIds.length === 0) {
    return { checked: allUids.length, markedRead: 0 };
  }

  const nowIso = new Date().toISOString();
  // Update in chunk per evitare URL/payload troppo grandi
  for (let i = 0; i < seenIds.length; i += CHUNK_SIZE) {
    const chunk = seenIds.slice(i, i + CHUNK_SIZE);
    try {
      await supabase
        .from("channel_messages")
        .update({ read_at: nowIso })
        .in("id", chunk)
        .is("read_at", null);
    } catch (_err) {
      continue;
    }
  }

  return { checked: allUids.length, markedRead: seenIds.length };
}