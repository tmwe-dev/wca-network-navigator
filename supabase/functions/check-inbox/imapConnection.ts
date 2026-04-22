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
    connectionTimeout: 15000,
    tlsOptions: { caCerts: getCaCertsForHost(imapHost) },
  };
}

export async function connectToImap(config: ImapConfig): Promise<ImapClient> {
  let client: ImapClient | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      client = new ImapClient(config);
      await client.connect();
      await client.authenticate();
      console.log(`[check-inbox] Authenticated OK (attempt ${attempt})`);
      return client;
    } catch (connErr: unknown) {
      if (attempt === 2) {
        throw new Error(`IMAP connection failed after 2 attempts: ${extractErrorMessage(connErr)}`);
      }
      console.warn(`[check-inbox] Connection attempt ${attempt} failed: ${extractErrorMessage(connErr)}, retrying...`);
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
  const uidvalidity = (inbox as Record<string, unknown>).uidValidity as number | null || null;
  console.log(`[check-inbox] INBOX: ${inbox.exists} msgs, UIDVALIDITY: ${uidvalidity}`);
  return { exists: inbox.exists, uidvalidity };
}

export async function handleUidvalidityChange(
  supabase: any,
  userId: string,
  storedUidvalidity: number | null,
  uidvalidity: number | null
): Promise<number> {
  // UIDVALIDITY change detection
  if (storedUidvalidity && uidvalidity && storedUidvalidity !== uidvalidity) {
    console.warn(`[check-inbox] UIDVALIDITY changed: ${storedUidvalidity} → ${uidvalidity}. Resetting sync.`);
    await supabase
      .from("email_sync_state")
      .update({ last_uid: 0, stored_uidvalidity: uidvalidity })
      .eq("user_id", userId);
    return 0;
  } else if (uidvalidity && storedUidvalidity !== uidvalidity) {
    await supabase
      .from("email_sync_state")
      .update({ stored_uidvalidity: uidvalidity })
      .eq("user_id", userId);
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
    console.error("[check-inbox] UID lookup error:", extractErrorMessage(searchErr));
    return { uids: [], remainingCount: 0, hasMore: false };
  }
}

export async function updateSyncState(
  supabase: any,
  userId: string,
  lastUid: number
): Promise<void> {
  await supabase
    .from("email_sync_state")
    .update({ last_uid: lastUid, last_sync_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export async function skipDuplicateUid(
  supabase: any,
  userId: string,
  uid: number
): Promise<boolean> {
  const { data: existingByUid } = await supabase
    .from("channel_messages")
    .select("id")
    .eq("imap_uid", uid)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingByUid) {
    // Fast-forward: jump cursor to MAX(imap_uid) in DB
    const { data: maxRow } = await supabase
      .from("channel_messages")
      .select("imap_uid")
      .eq("user_id", userId)
      .eq("channel", "email")
      .not("imap_uid", "is", null)
      .order("imap_uid", { ascending: false })
      .limit(1)
      .maybeSingle();
    const dbMaxUid = (maxRow?.imap_uid as number | undefined) ?? uid;
    const jumpTo = Math.max(dbMaxUid, uid);
    console.log(`[check-inbox] UID ${uid}: already in DB — fast-forward cursor to ${jumpTo} (DB max=${dbMaxUid})`);
    await updateSyncState(supabase, userId, jumpTo);
    return true;
  }

  return false;
}

export async function getSyncState(
  supabase: any,
  userId: string,
  imapHost: string,
  imapUser: string
): Promise<SyncState> {
  const { data: syncState } = await supabase
    .from("email_sync_state")
    .select("last_uid, stored_uidvalidity")
    .eq("user_id", userId)
    .maybeSingle();

  let lastUid = syncState?.last_uid || 0;
  const storedUidvalidity = syncState?.stored_uidvalidity || null;

  if (!syncState) {
    await supabase.from("email_sync_state").upsert(
      {
        user_id: userId,
        last_uid: 0,
        imap_host: imapHost,
        imap_user: imapUser,
      },
      { onConflict: "user_id" }
    );
  }

  return { lastUid, storedUidvalidity };
}
