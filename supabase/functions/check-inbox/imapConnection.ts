/**
 * imapConnection.ts — IMAP connection, UID management, and deduplication.
 */

import { ImapClient } from "jsr:@workingdevshero/deno-imap";
import { getCaCertsForHost } from "./caCerts.ts";
import { getNextUidBatch } from "./imapParser.ts";
import { extractErrorMessage } from "../_shared/handleEdgeError.ts";

interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
  tls: boolean;
  connectionTimeout: number;
  tlsOptions: { caCerts: string[] };
}

interface SyncState {
  lastUid: number;
  storedUidvalidity: number | null;
}

interface UidBatch {
  uids: number[];
  remainingCount: number;
  hasMore: boolean;
}

export async function createImapConfig(
  imapHost: string,
  imapUser: string,
  imapPassword: string
): Promise<ImapConfig> {
  return {
    host: imapHost,
    port: 993,
    username: imapUser,
    password: imapPassword,
    secure: true,
    tls: true,
    connectionTimeout: 15000,
    tlsOptions: { caCerts: getCaCertsForHost(imapHost) },
  };
}

export async function connectToImap(config: ImapConfig): Promise<ImapClient> {
  let client: ImapClient | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // deno-lint-ignore no-explicit-any
      client = new ImapClient(config as any);
      await client.connect();
      await client.authenticate();
      return client;
    } catch (connErr: unknown) {
      if (attempt === 2) {
        throw new Error(`IMAP connection failed after 2 attempts: ${extractErrorMessage(connErr)}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  throw new Error("Failed to connect to IMAP");
}

export async function selectInbox(client: ImapClient): Promise<{
  exists: number;
  uidvalidity: number | null;
}> {
  const inbox = await client.selectMailbox("INBOX");
  // deno-lint-ignore no-explicit-any
  const uidvalidity = ((inbox as any).uidValidity as number | null) || null;
  return { exists: inbox.exists ?? 0, uidvalidity };
}

export async function handleUidvalidityChange(
  supabase: any,
  userId: string,
  storedUidvalidity: number | null,
  uidvalidity: number | null,
  mailboxId: string | null = null,
): Promise<number> {
  // UIDVALIDITY change detection
  if (storedUidvalidity && uidvalidity && storedUidvalidity !== uidvalidity) {
    let q = supabase
      .from("email_sync_state")
      .update({ last_uid: 0, stored_uidvalidity: uidvalidity })
      .eq("user_id", userId);
    q = mailboxId ? q.eq("mailbox_id", mailboxId) : q.is("mailbox_id", null);
    await q;
    return 0;
  } else if (uidvalidity && storedUidvalidity !== uidvalidity) {
    let q = supabase
      .from("email_sync_state")
      .update({ stored_uidvalidity: uidvalidity })
      .eq("user_id", userId);
    q = mailboxId ? q.eq("mailbox_id", mailboxId) : q.is("mailbox_id", null);
    await q;
  }

  return 0; // lastUid should not change unless UIDVALIDITY changed
}

export async function fetchUidBatch(
  imapExec: { executeCommand(cmd: string): Promise<(string | Uint8Array)[]> },
  lastUid: number
): Promise<UidBatch> {
  try {
    const nextBatch = await getNextUidBatch(imapExec, lastUid);
    return {
      uids: nextBatch.uids,
      remainingCount: nextBatch.remaining,
      hasMore: nextBatch.hasMore,
    };
  } catch (searchErr: unknown) {
    return { uids: [], remainingCount: 0, hasMore: false };
  }
}

export async function updateSyncState(
  supabase: any,
  userId: string,
  lastUid: number,
  mailboxId: string | null = null,
): Promise<void> {
  let q = supabase
    .from("email_sync_state")
    .update({ last_uid: lastUid, last_sync_at: new Date().toISOString() })
    .eq("user_id", userId);
  q = mailboxId ? q.eq("mailbox_id", mailboxId) : q.is("mailbox_id", null);
  await q;
}

export async function skipDuplicateUid(
  supabase: any,
  userId: string,
  uid: number,
  mailboxId: string | null = null,
): Promise<boolean> {
  let dupQ = supabase
    .from("channel_messages")
    .select("id")
    .eq("imap_uid", uid)
    .eq("user_id", userId);
  dupQ = mailboxId ? dupQ.eq("mailbox_id", mailboxId) : dupQ.is("mailbox_id", null);
  const { data: existingByUid } = await dupQ.maybeSingle();

  if (existingByUid) {
    // Fast-forward: jump cursor to MAX(imap_uid) in DB
    let maxQ = supabase
      .from("channel_messages")
      .select("imap_uid")
      .eq("user_id", userId)
      .eq("channel", "email")
      .not("imap_uid", "is", null);
    maxQ = mailboxId ? maxQ.eq("mailbox_id", mailboxId) : maxQ.is("mailbox_id", null);
    const { data: maxRow } = await maxQ
      .order("imap_uid", { ascending: false })
      .limit(1)
      .maybeSingle();
    const dbMaxUid = (maxRow?.imap_uid as number | undefined) ?? uid;
    const jumpTo = Math.max(dbMaxUid, uid);
    await updateSyncState(supabase, userId, jumpTo, mailboxId);
    return true;
  }

  return false;
}

export async function getSyncState(
  supabase: any,
  userId: string,
  imapHost: string,
  imapUser: string,
  mailboxId: string | null = null,
): Promise<SyncState> {
  let selQ = supabase
    .from("email_sync_state")
    .select("last_uid, stored_uidvalidity")
    .eq("user_id", userId);
  selQ = mailboxId ? selQ.eq("mailbox_id", mailboxId) : selQ.is("mailbox_id", null);
  const { data: syncState } = await selQ.maybeSingle();

  let lastUid = syncState?.last_uid || 0;
  const storedUidvalidity = syncState?.stored_uidvalidity || null;

  if (!syncState) {
    await supabase.from("email_sync_state").insert(
      {
        user_id: userId,
        mailbox_id: mailboxId,
        last_uid: 0,
        imap_host: imapHost,
        imap_user: imapUser,
      },
    );
  }

  return { lastUid, storedUidvalidity };
}
