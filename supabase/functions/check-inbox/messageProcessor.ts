/**
 * messageProcessor.ts — Core message processing logic.
 * Handles phases 1-6: raw fetch, envelope, body parsing, sender matching, and DB save.
 */

import { ImapClient, decodeAttachment } from "jsr:@workingdevshero/deno-imap";
import {
  decodeMimePart, sha256hex, collectMimeLeafParts, sanitizeFilename,
  sanitizeMessageId, parseMultipartFallback, decodeRfc2047, decodeBase64Bytes,
  type MimeLeafPart,
} from "./mimeDecoder.ts";
import {
  envelopeAddr, envelopeAddrName, envelopeAddrList,
  extractLiteralBytesFromResponse, extractLiteralTextFromResponse,
  parseRawHeaders, parseEmailFromHeader, computeThreadId, getNextUidBatch,
  MAX_ATTACHMENT_BYTES, INLINE_DATA_URI_THRESHOLD,
} from "./imapParser.ts";
import { matchSender, saveMessageToDb, type AttachmentRecord } from "./dbOperations.ts";
import { detectBounce, handleBounce } from "./bounceDetector.ts";
import { extractBodyAndAttachments } from "./bodyExtractor.ts";

interface MessageData {
  uid: number;
  uidvalidity: number | null;
  fromAddr: string;
  toAddr: string;
  ccAddresses: string;
  bccAddresses: string;
  senderName: string;
  subject: string;
  messageId: string;
  date: string;
  inReplyTo: string | null;
  referencesHeader: string | null;
  bodyText: string;
  bodyHtml: string;
  imapFlags: string;
  internalDate: string | null;
  rfc822Size: number;
  rawBytes: Uint8Array;
  rawHash: string;
  rawStoragePath: string;
  isOversized: boolean;
  parseWarnings: string[];
  attachmentRecords: AttachmentRecord[];
  bodyStructure: Record<string, unknown> | null;
}

const MAX_RAW_FETCH_BYTES = 15_000_000; // 15MB

export async function processMessage(
  uid: number,
  uidvalidity: number | null,
  userId: string,
  imapExec: { executeCommand(cmd: string): Promise<(string | Uint8Array)[]> },
  client: ImapClient,
  supabase: any,
  supabaseAdmin: any,
  isOversized: boolean,
): Promise<{
  msgData: Record<string, unknown> | null;
  error: string | null;
}> {
  let rawBytes = new Uint8Array(0);
  let rawHash = "";
  let rawStoragePath = "";
  let imapFlags = "";
  let internalDate: string | null = null;
  let rfc822Size = 0;

  const parseWarnings: string[] = [];
  const { extractErrorMessage } = await import("../_shared/handleEdgeError.ts");

  try {
    /* ─── Phase 1: Size check + raw fetch ─── */
    try {
      const metaResponse = await imapExec.executeCommand(`UID FETCH ${uid} (FLAGS INTERNALDATE RFC822.SIZE)`);
      for (const line of metaResponse) {
        if (typeof line !== "string") continue;
        const flagsMatch = line.match(/FLAGS\s*\(([^)]*)\)/i);
        if (flagsMatch) imapFlags = flagsMatch[1].trim();
        const idateMatch = line.match(/INTERNALDATE\s*"([^"]+)"/i);
        if (idateMatch) {
          try {
            const parsed = new Date(idateMatch[1]);
            if (!isNaN(parsed.getTime())) internalDate = parsed.toISOString();
          } catch (e: unknown) {
            console.debug("internaldate parse skipped:", extractErrorMessage(e));
          }
        }
        const sizeMatch = line.match(/RFC822\.SIZE\s+(\d+)/i);
        if (sizeMatch) rfc822Size = parseInt(sizeMatch[1], 10);
      }

      if (rfc822Size > 0 && rfc822Size <= MAX_RAW_FETCH_BYTES) {
        const rawResponse = await imapExec.executeCommand(`UID FETCH ${uid} (BODY.PEEK[])`);
        rawBytes = extractLiteralBytesFromResponse(rawResponse);
        if (!rfc822Size) rfc822Size = rawBytes.length;
        if (rawBytes.length > 0) {
          rawHash = await sha256hex(rawBytes);
          const { data: existing } = await supabase.from("channel_messages").select("id").eq("raw_sha256", rawHash).eq("user_id", userId).maybeSingle();
          if (existing) {
            return { msgData: null, error: "duplicate_by_hash" };
          }
          rawStoragePath = `raw-emails/${userId}/${uid}.eml`;
          const { error: rawUpErr } = await supabaseAdmin.storage.from("import-files").upload(rawStoragePath, rawBytes, { contentType: "message/rfc822", upsert: true });
          if (rawUpErr) {
            parseWarnings.push(`raw upload failed: ${rawUpErr.message}`);
            rawStoragePath = "";
          }
        }
      } else if (rfc822Size > MAX_RAW_FETCH_BYTES) {
        parseWarnings.push(`raw too large (${rfc822Size}B > ${MAX_RAW_FETCH_BYTES}B), skipping raw fetch to stay within CPU limits`);
        
      } else {
        try {
          const rawResponse = await imapExec.executeCommand(`UID FETCH ${uid} (BODY.PEEK[])`);
          rawBytes = extractLiteralBytesFromResponse(rawResponse);
          rfc822Size = rawBytes.length;
          if (rawBytes.length > MAX_RAW_FETCH_BYTES) {
            parseWarnings.push(`raw fetched but too large (${rawBytes.length}B), discarding`);
            rawBytes = new Uint8Array(0);
          } else if (rawBytes.length > 0) {
            rawHash = await sha256hex(rawBytes);
            const { data: existing } = await supabase.from("channel_messages").select("id").eq("raw_sha256", rawHash).eq("user_id", userId).maybeSingle();
            if (existing) {
              return { msgData: null, error: "duplicate_by_hash" };
            }
            rawStoragePath = `raw-emails/${userId}/${uid}.eml`;
            const { error: rawUpErr } = await supabaseAdmin.storage.from("import-files").upload(rawStoragePath, rawBytes, { contentType: "message/rfc822", upsert: true });
            if (rawUpErr) {
              parseWarnings.push(`raw upload failed: ${rawUpErr.message}`);
              rawStoragePath = "";
            }
          }
        } catch (rawErr: unknown) {
          parseWarnings.push(`raw fetch failed: ${extractErrorMessage(rawErr)}`);
        }
      }
    } catch (rawErr: unknown) {
      parseWarnings.push(`metadata fetch failed: ${extractErrorMessage(rawErr)}`);
    }

    const oversized = rfc822Size > MAX_RAW_FETCH_BYTES;

    /* ─── Phase 2: ENVELOPE + BODYSTRUCTURE ─── */
    let fromAddr = "";
    let toAddr = "";
    let ccAddresses = "";
    let bccAddresses = "";
    let senderName = "";
    let subject = "(nessun oggetto)";
    let messageId = `uid_${uid}_${Date.now()}`;
    let date = "";
    let inReplyTo: string | null = null;
    let referencesHeader: string | null = null;
    let bodyStructure: Record<string, unknown> | null = null;

    try {
      const envFetch = await client.fetch(String(uid), {
        byUid: true,
        uid: true,
        envelope: true,
        bodyStructure: !oversized,
      } as Record<string, unknown>);
      const env = (envFetch as Record<string, unknown>[])?.[0]?.envelope as Record<string, unknown> | undefined;
      bodyStructure = !oversized ? ((envFetch as Record<string, unknown>[])?.[0]?.bodyStructure as Record<string, unknown> || null) : null;
      if (env) {
        fromAddr = envelopeAddr((env.from as Record<string, unknown>[] | undefined)?.[0] ?? null);
        toAddr = envelopeAddrList(env.to as Record<string, unknown>[] | undefined);
        ccAddresses = envelopeAddrList(env.cc as Record<string, unknown>[] | undefined);
        bccAddresses = envelopeAddrList(env.bcc as Record<string, unknown>[] | undefined);
        senderName = envelopeAddrName((env.from as Record<string, unknown>[] | undefined)?.[0] ?? null) || fromAddr;
        subject = decodeRfc2047((env.subject as string) || "") || "(nessun oggetto)";
        messageId = env.messageId ? sanitizeMessageId(env.messageId as string) : messageId;
        date = (env.date as string) || "";
        inReplyTo = (env.inReplyTo as string) || null;
      }
    } catch (envErr: unknown) {
      parseWarnings.push(`envelope error: ${extractErrorMessage(envErr)}`);
    }

    /* ─── Phase 2b: Fallback to raw headers ─── */
    if (!fromAddr || fromAddr === "@" || fromAddr === "sconosciuto@unknown") {
      try {
        const hdrResponse = await imapExec.executeCommand(
          `UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID IN-REPLY-TO REFERENCES)])`
        );
        const rawHeaders = extractLiteralTextFromResponse(hdrResponse);
        if (rawHeaders) {
          const parsed = parseRawHeaders(rawHeaders);
          const rawFrom = parseEmailFromHeader(parsed["from"] || "");
          if (rawFrom && rawFrom !== "@") fromAddr = rawFrom;
          if (!toAddr || toAddr === "@") toAddr = parseEmailFromHeader(parsed["to"] || "");
          if (subject === "(nessun oggetto)" && parsed["subject"]) subject = decodeRfc2047(parsed["subject"]);
          if (!date && parsed["date"]) date = parsed["date"];
          if (messageId.startsWith("uid_") && parsed["message-id"]) messageId = sanitizeMessageId(parsed["message-id"]);
          if (!inReplyTo && parsed["in-reply-to"]) inReplyTo = parsed["in-reply-to"].replace(/[<>]/g, "");
          if (!referencesHeader && parsed["references"]) referencesHeader = parsed["references"];
          const rawFromFull = parsed["from"] || "";
          const nameMatch = rawFromFull.match(/^"?([^"<]+)"?\s*</);
          if (nameMatch) senderName = nameMatch[1].trim();
          else senderName = fromAddr;
        }
      } catch (hdrErr: unknown) {
        parseWarnings.push(`header fallback error: ${extractErrorMessage(hdrErr)}`);
      }
    }

    // Message-ID dedup for large messages
    if (!rawHash && messageId && !messageId.startsWith("uid_")) {
      const { data: existingByMid } = await supabase
        .from("channel_messages")
        .select("id")
        .eq("message_id_external", messageId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existingByMid) {
        return { msgData: null, error: "duplicate_by_message_id" };
      }
    }

    if (!fromAddr || fromAddr === "@") fromAddr = "sconosciuto@unknown";

    /* ─── Phase 3 + 3b: Parse body and attachments ─── */
    let bodyText = "";
    let bodyHtml = "";
    const attachmentRecords: AttachmentRecord[] = [];

    const extracted = await extractBodyAndAttachments(
      uid,
      userId,
      imapExec,
      supabaseAdmin,
      messageId,
      bodyStructure,
      oversized,
      rfc822Size,
    );
    bodyText = extracted.bodyText;
    bodyHtml = extracted.bodyHtml;
    attachmentRecords.push(...extracted.attachmentRecords);
    parseWarnings.push(...extracted.parseWarnings);

    /* ─── Phase 4: Replace cid: in HTML ─── */
    if (bodyHtml) {
      for (const att of attachmentRecords) {
        if (att.isInline && att.cid && att.publicUrl) {
          const escapedCid = att.cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          bodyHtml = bodyHtml.replace(new RegExp(`cid:${escapedCid}`, 'gi'), att.publicUrl);
        }
      }
    }

    

    /* ─── Phase 5: Match sender ─── */
    const match = await matchSender(supabase, fromAddr, userId);

    /* ─── Phase 5b: Resolve operator_id ─── */
    const { data: opRow } = await supabase.from("operators").select("id").eq("user_id", userId).maybeSingle();
    const operatorId = opRow?.id ?? null;
    if (!operatorId) {
      return { msgData: null, error: "no_operator" };
    }

    /* ─── Phase 6: Save ─── */
    const threadId = computeThreadId(messageId, inReplyTo, referencesHeader);
    const result = await saveMessageToDb(supabase, {
      userId,
      operatorId,
      uid,
      uidvalidity,
      messageId,
      threadId,
      fromAddr,
      toAddr,
      ccAddresses,
      bccAddresses,
      subject,
      date,
      bodyText,
      bodyHtml,
      imapFlags,
      internalDate,
      rawStoragePath,
      rawHash,
      rfc822Size,
      referencesHeader,
      inReplyTo,
      parseWarnings,
      senderName,
      match,
      attachmentRecords,
    });

    if (result.error) {
      return { msgData: null, error: result.error };
    }

    if (result.msgData) {
      // ── Bounce detection (best-effort) ──
      try {
        const bounceInfo = detectBounce({ fromAddr, subject, bodyText });
        if (bounceInfo) {
          await handleBounce(supabase, userId, result.msgData.id as string, bounceInfo);
        }
      } catch (bounceErr) {
      }

      return { msgData: result.msgData, error: null };
    }

    return { msgData: null, error: "save_returned_null" };
  } catch (e: unknown) {
    const { extractErrorMessage } = await import("../_shared/handleEdgeError.ts");
    return { msgData: null, error: extractErrorMessage(e) };
  }
}

export async function matchResponseActivity(
  supabase: any,
  savedMsgId: string,
  inReplyTo: string | null,
  threadId: string,
  match: { partnerId?: string } | null
): Promise<void> {
  try {
    if (!inReplyTo && !threadId) return;

    const partnerId = match?.partnerId || null;

    // Pass 1: match by thread_id
    let activityMatch: { id: string; sent_at: string } | null = null;
    if (threadId) {
      const { data } = await supabase
        .from("activities")
        .select("id, sent_at")
        .eq("thread_id", threadId)
        .eq("activity_type", "send_email")
        .eq("response_received", false)
        .order("sent_at", { ascending: false })
        .limit(1);
      if (data?.length) activityMatch = data[0];
    }

    // Pass 2: match by partner_id + recency
    if (!activityMatch && partnerId) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("activities")
        .select("id, sent_at")
        .eq("partner_id", partnerId)
        .eq("activity_type", "send_email")
        .eq("response_received", false)
        .gte("sent_at", thirtyDaysAgo)
        .order("sent_at", { ascending: false })
        .limit(1);
      if (data?.length) activityMatch = data[0];
    }

    if (activityMatch) {
      const responseTimeHours = Math.round(
        ((Date.now() - new Date(activityMatch.sent_at).getTime()) / (1000 * 60 * 60)) * 10
      ) / 10;
      await supabase.rpc("link_response_to_activity", {
        p_channel_message_id: savedMsgId,
        p_activity_id: activityMatch.id,
        p_response_time_hours: responseTimeHours,
      });
    }
  } catch (matchErr: unknown) {
    const { extractErrorMessage } = await import("../_shared/handleEdgeError.ts");
  }
}
