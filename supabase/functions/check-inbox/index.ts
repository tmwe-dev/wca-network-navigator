/**
 * check-inbox/index.ts — Slim orchestrator.
 * Imports from: caCerts, mimeDecoder, imapParser, dbOperations.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapClient, decodeAttachment } from "jsr:@workingdevshero/deno-imap";
import { getCorsHeaders } from "../_shared/cors.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";

import { getCaCertsForHost } from "./caCerts.ts";
import {
  decodeMimePart, sha256hex, collectMimeLeafParts, sanitizeFilename,
  sanitizeMessageId, parseMultipartFallback, decodeRfc2047, decodeBase64Bytes,
  type MimeLeafPart, type FallbackResult,
} from "./mimeDecoder.ts";
import {
  envelopeAddr, envelopeAddrName, envelopeAddrList,
  extractLiteralBytesFromResponse, extractLiteralTextFromResponse,
  parseRawHeaders, parseEmailFromHeader, computeThreadId, getNextUidBatch,
  MAX_ATTACHMENT_BYTES, MAX_RAW_FETCH_BYTES, INLINE_DATA_URI_THRESHOLD,
} from "./imapParser.ts";
import { matchSender, saveMessageToDb, type AttachmentRecord } from "./dbOperations.ts";
import { detectBounce, handleBounce } from "./bounceDetector.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  if (req.method === "OPTIONS") return new Response(null, { headers: dynCors });

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return edgeError("AUTH_REQUIRED", "Unauthorized", undefined, dynCors);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const syncUserId = req.headers.get("x-sync-user-id");
    const isServiceRoleCall = authHeader === `Bearer ${serviceRoleKey}` && syncUserId;

    let supabase: ReturnType<typeof createClient>;
    let supabaseAdmin: ReturnType<typeof createClient>;
    let userId: string;

    if (isServiceRoleCall) {
      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
      supabase = supabaseAdmin;
      userId = syncUserId;
      console.log(`[check-inbox] Worker mode for user ${userId}`);
    } else {
      supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });
      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) return edgeError("AUTH_INVALID", "Unauthorized");
      userId = claimsData.claims.sub as string;
    }

    // ── IMAP config ──
    const imapHost = Deno.env.get("IMAP_HOST") || "";
    const imapUser = Deno.env.get("IMAP_USER") || "";
    const imapPassword = Deno.env.get("IMAP_PASSWORD") || "";
    if (!imapHost || !imapUser || !imapPassword) throw new Error("IMAP credentials not configured");

    const { data: syncState } = await supabase
      .from("email_sync_state").select("last_uid, stored_uidvalidity").eq("user_id", userId).maybeSingle();
    let lastUid = syncState?.last_uid || 0;
    const storedUidvalidity = syncState?.stored_uidvalidity || null;

    if (!syncState) {
      await supabase.from("email_sync_state").upsert({
        user_id: userId, last_uid: 0, imap_host: imapHost, imap_user: imapUser,
      }, { onConflict: "user_id" });
    }

    // ── Connect with retry (max 2 attempts) ──
    let client!: ImapClient;
    const imapConfig = {
      host: imapHost, port: 993, username: imapUser, password: imapPassword,
      secure: true, connectionTimeout: 15000,
      tlsOptions: { caCerts: getCaCertsForHost(imapHost) },
    };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        client = new ImapClient(imapConfig);
        await client.connect();
        await client.authenticate();
        console.log(`[check-inbox] Authenticated OK (attempt ${attempt})`);
        break;
      } catch (connErr: unknown) {
        if (attempt === 2) throw new Error(`IMAP connection failed after 2 attempts: ${extractErrorMessage(connErr)}`);
        console.warn(`[check-inbox] Connection attempt ${attempt} failed: ${extractErrorMessage(connErr)}, retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    const inbox = await client.selectMailbox("INBOX");
    const uidvalidity = (inbox as Record<string, unknown>).uidValidity as number | null || null;
    console.log(`[check-inbox] INBOX: ${inbox.exists} msgs, UIDVALIDITY: ${uidvalidity}`);

    // UIDVALIDITY change detection
    if (storedUidvalidity && uidvalidity && storedUidvalidity !== uidvalidity) {
      console.warn(`[check-inbox] UIDVALIDITY changed: ${storedUidvalidity} → ${uidvalidity}. Resetting sync.`);
      lastUid = 0;
      await supabase.from("email_sync_state").update({ last_uid: 0, stored_uidvalidity: uidvalidity }).eq("user_id", userId);
    } else if (uidvalidity && storedUidvalidity !== uidvalidity) {
      await supabase.from("email_sync_state").update({ stored_uidvalidity: uidvalidity }).eq("user_id", userId);
    }

    // ── UID SEARCH ──
    let uids: number[] = [];
    let remainingCount = 0;
    let hasMore = false;
    try {
      const nextBatch = await getNextUidBatch(client as unknown as { executeCommand(cmd: string): Promise<(string | Uint8Array)[]> }, lastUid);
      uids = nextBatch.uids;
      remainingCount = nextBatch.remaining;
      hasMore = nextBatch.hasMore;
    } catch (searchErr: unknown) {
      console.error("[check-inbox] UID lookup error:", extractErrorMessage(searchErr));
    }

    if (uids.length > 0) console.log(`[check-inbox] Selected UID ${uids[0]} for this run (${remainingCount} remaining)`);
    else console.log("[check-inbox] No new UIDs");

    const messages: Record<string, unknown>[] = [];
    let maxUid = lastUid;
    const imapExec = client as unknown as { executeCommand(cmd: string): Promise<(string | Uint8Array)[]> };

    for (const uid of uids) {
      console.log(`[check-inbox] Processing UID ${uid}`);

      // Pre-check: skip if already in DB
      const { data: existingByUid } = await supabase.from("channel_messages").select("id").eq("imap_uid", uid).eq("user_id", userId).maybeSingle();
      if (existingByUid) {
        console.log(`[check-inbox] UID ${uid}: already in DB (fast-forward skip)`);
        maxUid = uid;
        await supabase.from("email_sync_state").update({ last_uid: uid, last_sync_at: new Date().toISOString() }).eq("user_id", userId);
        continue;
      }

      const parseWarnings: string[] = [];

      try {
        /* ─── Phase 1: Size check + raw fetch ─── */
        let rawBytes = new Uint8Array(0);
        let rawHash = "";
        let rawStoragePath = "";
        let imapFlags = "";
        let internalDate: string | null = null;
        let rfc822Size = 0;

        try {
          const metaResponse = await imapExec.executeCommand(`UID FETCH ${uid} (FLAGS INTERNALDATE RFC822.SIZE)`);
          for (const line of metaResponse) {
            if (typeof line !== "string") continue;
            const flagsMatch = line.match(/FLAGS\s*\(([^)]*)\)/i);
            if (flagsMatch) imapFlags = flagsMatch[1].trim();
            const idateMatch = line.match(/INTERNALDATE\s*"([^"]+)"/i);
            if (idateMatch) {
              try { const parsed = new Date(idateMatch[1]); if (!isNaN(parsed.getTime())) internalDate = parsed.toISOString(); }
              catch (e: unknown) { console.debug("internaldate parse skipped:", extractErrorMessage(e)); }
            }
            const sizeMatch = line.match(/RFC822\.SIZE\s+(\d+)/i);
            if (sizeMatch) rfc822Size = parseInt(sizeMatch[1], 10);
          }
          console.log(`[check-inbox] UID ${uid}: RFC822.SIZE=${rfc822Size}`);

          if (rfc822Size > 0 && rfc822Size <= MAX_RAW_FETCH_BYTES) {
            const rawResponse = await imapExec.executeCommand(`UID FETCH ${uid} (BODY.PEEK[])`);
            rawBytes = extractLiteralBytesFromResponse(rawResponse);
            if (!rfc822Size) rfc822Size = rawBytes.length;
            if (rawBytes.length > 0) {
              rawHash = await sha256hex(rawBytes);
              const { data: existing } = await supabase.from("channel_messages").select("id").eq("raw_sha256", rawHash).eq("user_id", userId).maybeSingle();
              if (existing) {
                console.log(`[check-inbox] UID ${uid}: duplicate by SHA-256, skipping`);
                maxUid = uid;
                await supabase.from("email_sync_state").update({ last_uid: uid, last_sync_at: new Date().toISOString() }).eq("user_id", userId);
                continue;
              }
              rawStoragePath = `raw-emails/${userId}/${uid}.eml`;
              const { error: rawUpErr } = await supabaseAdmin.storage.from("import-files").upload(rawStoragePath, rawBytes, { contentType: "message/rfc822", upsert: true });
              if (rawUpErr) { parseWarnings.push(`raw upload failed: ${rawUpErr.message}`); rawStoragePath = ""; }
            }
          } else if (rfc822Size > MAX_RAW_FETCH_BYTES) {
            parseWarnings.push(`raw too large (${rfc822Size}B > ${MAX_RAW_FETCH_BYTES}B), skipping raw fetch to stay within CPU limits`);
            console.log(`[check-inbox] UID ${uid}: skipping raw fetch (${rfc822Size}B too large for CPU budget)`);
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
                  console.log(`[check-inbox] UID ${uid}: duplicate by SHA-256, skipping`);
                  maxUid = uid;
                  await supabase.from("email_sync_state").update({ last_uid: uid, last_sync_at: new Date().toISOString() }).eq("user_id", userId);
                  continue;
                }
                rawStoragePath = `raw-emails/${userId}/${uid}.eml`;
                const { error: rawUpErr } = await supabaseAdmin.storage.from("import-files").upload(rawStoragePath, rawBytes, { contentType: "message/rfc822", upsert: true });
                if (rawUpErr) { parseWarnings.push(`raw upload failed: ${rawUpErr.message}`); rawStoragePath = ""; }
              }
            } catch (rawErr: unknown) {
              parseWarnings.push(`raw fetch failed: ${extractErrorMessage(rawErr)}`);
            }
          }
        } catch (rawErr: unknown) {
          parseWarnings.push(`metadata fetch failed: ${extractErrorMessage(rawErr)}`);
          console.warn(`[check-inbox] UID ${uid}: metadata fetch error:`, extractErrorMessage(rawErr));
        }

        const isOversized = rfc822Size > MAX_RAW_FETCH_BYTES;

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
          const envFetch = await client.fetch(String(uid), { byUid: true, uid: true, envelope: true, bodyStructure: !isOversized } as Record<string, unknown>);
          const env = (envFetch as Record<string, unknown>[])?.[0]?.envelope as Record<string, unknown> | undefined;
          bodyStructure = !isOversized ? ((envFetch as Record<string, unknown>[])?.[0]?.bodyStructure as Record<string, unknown> || null) : null;
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
          console.warn(`[check-inbox] Envelope error UID ${uid}:`, extractErrorMessage(envErr));
        }

        /* ─── Phase 2b: Fallback to raw headers ─── */
        if (!fromAddr || fromAddr === "@" || fromAddr === "sconosciuto@unknown") {
          try {
            const hdrResponse = await imapExec.executeCommand(`UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID IN-REPLY-TO REFERENCES)])`);
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
          const { data: existingByMid } = await supabase.from("channel_messages").select("id").eq("message_id_external", messageId).eq("user_id", userId).maybeSingle();
          if (existingByMid) {
            console.log(`[check-inbox] UID ${uid}: duplicate by Message-ID, skipping`);
            maxUid = uid;
            await supabase.from("email_sync_state").update({ last_uid: uid, last_sync_at: new Date().toISOString() }).eq("user_id", userId);
            continue;
          }
        }

        if (!fromAddr || fromAddr === "@") fromAddr = "sconosciuto@unknown";

        /* ─── Phase 3: Parse body and attachments ─── */
        let bodyText = "";
        let bodyHtml = "";
        const attachmentRecords: AttachmentRecord[] = [];

        let parts: MimeLeafPart[] = [];
        if (!isOversized && bodyStructure) {
          try {
            parts = collectMimeLeafParts(bodyStructure);
            console.log(`[check-inbox] UID ${uid}: ${parts.length} MIME parts`);
          } catch (bsErr: unknown) {
            parseWarnings.push(`BODYSTRUCTURE parse failed: ${extractErrorMessage(bsErr)}`);
          }
        }

        if (parts.length === 0 && !isOversized) {
          try {
            let mainBoundary = "";
            try {
              const ctHdrResp = await imapExec.executeCommand(`UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (CONTENT-TYPE)])`);
              const ctHdrText = extractLiteralTextFromResponse(ctHdrResp);
              const bndMatch = ctHdrText?.match(/boundary="?([^\s";\r\n]+)"?/i);
              if (bndMatch) mainBoundary = bndMatch[1];
            } catch (e: unknown) { console.debug("content-type header fetch skipped:", extractErrorMessage(e)); }

            const rfc822Response = await imapExec.executeCommand(`UID FETCH ${uid} (BODY.PEEK[TEXT])`);
            const textBytes = extractLiteralBytesFromResponse(rfc822Response);
            const textStr = new TextDecoder("utf-8", { fatal: false }).decode(textBytes);

            if (textStr && textStr.length > 5) {
              let parseInput = textStr;
              if (mainBoundary && !textStr.includes(`boundary`)) {
                parseInput = `Content-Type: multipart/mixed; boundary="${mainBoundary}"\r\n\r\n` + textStr;
              }
              const parsed = parseMultipartFallback(new TextEncoder().encode(parseInput), parseInput);
              if (parsed.html) bodyHtml = parsed.html.slice(0, 100_000);
              if (parsed.text) bodyText = parsed.text.slice(0, 50_000);

              if (!bodyHtml && !bodyText) {
                const looksLikeRawMime = textStr.match(/^--[\w_=-]+\s*\r?\nContent-Type:/im) ||
                  textStr.match(/Content-Transfer-Encoding:\s*(quoted-printable|base64)/im);
                if (looksLikeRawMime) {
                  const inlineBndMatch = textStr.match(/^--([\w_=+/-]+)\s*$/m);
                  if (inlineBndMatch) {
                    const retryInput = `Content-Type: multipart/mixed; boundary="${inlineBndMatch[1]}"\r\n\r\n` + textStr;
                    const retry = parseMultipartFallback(new TextEncoder().encode(retryInput), retryInput);
                    if (retry.html) bodyHtml = retry.html.slice(0, 100_000);
                    if (retry.text) bodyText = retry.text.slice(0, 50_000);
                  }
                  if (!bodyHtml && !bodyText) {
                    bodyText = "⚠️ Contenuto MIME complesso — parsing parziale non riuscito. Consultare il messaggio originale.";
                    parseWarnings.push("raw MIME detected but could not extract body parts");
                  }
                } else {
                  bodyText = textStr.slice(0, 50_000);
                }
              }

              for (const img of parsed.inlineImages) {
                if (img.data.length <= INLINE_DATA_URI_THRESHOLD) {
                  let b64 = "";
                  const CHUNK = 8192;
                  for (let i = 0; i < img.data.length; i += CHUNK) {
                    b64 += String.fromCharCode(...img.data.subarray(i, Math.min(i + CHUNK, img.data.length)));
                  }
                  b64 = btoa(b64);
                  attachmentRecords.push({
                    cid: img.cid, publicUrl: `data:${img.contentType};base64,${b64}`,
                    filename: `inline_${img.cid}.${img.contentType.split("/")[1] || "bin"}`,
                    storagePath: "", contentType: img.contentType, size: img.data.length, isInline: true, isDataUri: true,
                  });
                }
              }
            }
          } catch (fallbackErr: unknown) {
            parseWarnings.push(`RFC822.TEXT fallback failed: ${extractErrorMessage(fallbackErr)}`);
          }
          parts = [];
        }

        if (isOversized) {
          const sizeMB = (rfc822Size / (1024 * 1024)).toFixed(1);
          console.log(`[check-inbox] UID ${uid}: oversized — metadata only (${sizeMB} MB)`);
          bodyText = `⚠️ Messaggio troppo grande per il download completo (${sizeMB} MB). Sono stati salvati solo oggetto e dati principali.`;
          bodyHtml = `<div style="padding:16px;border:2px solid #f59e0b;border-radius:8px;background:#fffbeb;color:#92400e;font-family:sans-serif"><strong>⚠️ Messaggio sovradimensionato (${sizeMB} MB)</strong><br/><p>Questo messaggio supera il limite operativo per il parsing completo.</p><p>Sono stati salvati solo: oggetto, mittente, destinatari e data.</p><p>Corpo completo e allegati non sono stati scaricati per evitare errori di elaborazione.</p></div>`;
          parseWarnings.push(`oversized message (${sizeMB}MB) — saved metadata only`);
          parts = [];
        }

        /* ─── Phase 3b: Fetch each MIME part ─── */
        for (const part of parts) {
          if (part.isInlineBody) {
            const target = part.subtype === "html" ? "html" : "text";
            if (target === "html" && bodyHtml) continue;
            if (target === "text" && bodyText) continue;
            try {
              const bodyResponse = await imapExec.executeCommand(`UID FETCH ${uid} (BODY.PEEK[${part.section}])`);
              const partBytes = extractLiteralBytesFromResponse(bodyResponse);
              if (partBytes.length > 5) {
                const decoded = decodeMimePart(partBytes, part.encoding, part.charset);
                if (target === "html") bodyHtml = decoded.slice(0, 100_000);
                else bodyText = decoded.slice(0, 50_000);
              }
            } catch (bodyErr: unknown) {
              parseWarnings.push(`body section ${part.section} error: ${extractErrorMessage(bodyErr)}`);
            }
            continue;
          }

          if (part.isInlineImage && part.contentId) {
            if (part.size > MAX_ATTACHMENT_BYTES) { parseWarnings.push(`inline image ${part.contentId} too large (${part.size}B)`); continue; }
            try {
              const imgResponse = await imapExec.executeCommand(`UID FETCH ${uid} (BODY.PEEK[${part.section}])`);
              const imgRawBytes = extractLiteralBytesFromResponse(imgResponse);
              if (imgRawBytes.length > 0) {
                const decoded: Uint8Array = decodeAttachment(imgRawBytes, part.encoding);
                const contentType = `${part.type}/${part.subtype}`;
                const ext = part.subtype === "jpeg" ? "jpg" : part.subtype;
                const filename = sanitizeFilename(part.filename || `inline_${part.contentId}.${ext}`);
                if (decoded.length <= INLINE_DATA_URI_THRESHOLD) {
                  let b64 = "";
                  const CHUNK = 8192;
                  for (let i = 0; i < decoded.length; i += CHUNK) { b64 += String.fromCharCode(...decoded.subarray(i, Math.min(i + CHUNK, decoded.length))); }
                  b64 = btoa(b64);
                  attachmentRecords.push({ cid: part.contentId, publicUrl: `data:${contentType};base64,${b64}`, filename, storagePath: "", contentType, size: decoded.length, isInline: true, isDataUri: true });
                } else {
                  const storagePath = `emails/${userId}/${messageId}/${filename}`;
                  const { error: uploadErr } = await supabaseAdmin.storage.from("import-files").upload(storagePath, decoded, { contentType, upsert: true });
                  if (!uploadErr) {
                    const { data: urlData } = supabaseAdmin.storage.from("import-files").getPublicUrl(storagePath);
                    attachmentRecords.push({ cid: part.contentId, publicUrl: (urlData as Record<string, unknown>)?.publicUrl as string || "", filename, storagePath, contentType, size: decoded.length, isInline: true });
                  } else { parseWarnings.push(`inline image upload failed: ${uploadErr.message}`); }
                }
              }
            } catch (imgErr: unknown) {
              parseWarnings.push(`inline image ${part.section} error: ${extractErrorMessage(imgErr)}`);
            }
            continue;
          }

          if (part.isAttachment && part.filename) {
            if (part.size > MAX_ATTACHMENT_BYTES) {
              attachmentRecords.push({ filename: sanitizeFilename(part.filename), storagePath: "", contentType: `${part.type}/${part.subtype}`, size: part.size, isInline: false, skipped: true, contentId: part.contentId || null });
              continue;
            }
            try {
              const attResponse = await imapExec.executeCommand(`UID FETCH ${uid} (BODY.PEEK[${part.section}])`);
              const attRawBytes = extractLiteralBytesFromResponse(attResponse);
              if (attRawBytes.length > 0) {
                const decoded: Uint8Array = decodeAttachment(attRawBytes, part.encoding);
                const contentType = `${part.type}/${part.subtype}`;
                const filename = sanitizeFilename(part.filename);
                const storagePath = `emails/${userId}/${messageId}/${filename}`;
                const { error: uploadErr } = await supabaseAdmin.storage.from("import-files").upload(storagePath, decoded, { contentType, upsert: true });
                if (!uploadErr) {
                  attachmentRecords.push({ filename, storagePath, contentType, size: decoded.length, isInline: false, contentId: part.contentId || null });
                } else { parseWarnings.push(`attachment upload failed: ${uploadErr.message}`); }
              }
            } catch (attErr: unknown) {
              parseWarnings.push(`attachment ${part.section} error: ${extractErrorMessage(attErr)}`);
            }
          }
        }

        /* ─── Phase 4: Replace cid: in HTML ─── */
        if (bodyHtml) {
          for (const att of attachmentRecords) {
            if (att.isInline && att.cid && att.publicUrl) {
              const escapedCid = att.cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              bodyHtml = bodyHtml.replace(new RegExp(`cid:${escapedCid}`, 'gi'), att.publicUrl);
            }
          }
        }

        console.log(`[check-inbox] UID ${uid}: from=${fromAddr}, text=${bodyText.length}c, html=${bodyHtml.length}c, att=${attachmentRecords.length}, raw=${rawBytes.length}B`);

        /* ─── Phase 5: Match sender ─── */
        const match = await matchSender(supabase, fromAddr);

        /* ─── Phase 6: Save ─── */
        const threadId = computeThreadId(messageId, inReplyTo, referencesHeader);
        const result = await saveMessageToDb(supabase, {
          userId, uid, uidvalidity, messageId, threadId, fromAddr, toAddr, ccAddresses, bccAddresses,
          subject, date, bodyText, bodyHtml, imapFlags, internalDate, rawStoragePath, rawHash,
          rfc822Size, referencesHeader, inReplyTo, parseWarnings, senderName, match, attachmentRecords,
        });

        if (result.error) {
          console.error(`[check-inbox] Save error UID ${uid}:`, result.error);
        } else if (result.msgData) {
          messages.push(result.msgData);
          maxUid = uid;

          // ── Response matching (best-effort) ──
          try {
            if (inReplyTo || threadId) {
              const savedMsgId = result.msgData.id as string;
              const partnerId = match?.partnerId || (result.msgData.partner_id as string | null);

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
                console.log("[check-inbox] Response matched:", {
                  messageId: savedMsgId,
                  activityId: activityMatch.id,
                  responseTimeHours,
                });
              }
            }
          } catch (matchErr: unknown) {
            console.warn("[check-inbox] Response matching failed (non-blocking):", matchErr instanceof Error ? matchErr.message : String(matchErr));
          }
        }

      } catch (e: unknown) {
        console.error(`[check-inbox] Error processing UID ${uid}:`, extractErrorMessage(e));
        if (uid > maxUid) {
          maxUid = uid;
          await supabase.from("email_sync_state").update({ last_uid: uid, last_sync_at: new Date().toISOString() }).eq("user_id", userId);
        }
      }
    }

    try { client.disconnect(); } catch (e: unknown) { console.debug("disconnect skipped:", extractErrorMessage(e)); }

    const matched = messages.filter(m => m.source_type !== "unknown").length;
    return new Response(JSON.stringify({
      success: true, total: messages.length, matched, unmatched: messages.length - matched,
      last_uid: maxUid, remaining: remainingCount, has_more: hasMore,
      messages: messages.map(m => ({
        id: m.id, from: m.from_address, from_address: m.from_address, subject: m.subject,
        email_date: m.email_date, source_type: m.source_type,
        sender_name: (m.raw_payload as Record<string, unknown>)?.sender_name,
        date: (m.raw_payload as Record<string, unknown>)?.date,
        has_body: !!((m.body_text as string) || (m.body_html as string)),
        body_text: ((m.body_text as string) || "").slice(0, 500),
        body_html: ((m.body_html as string) || "").slice(0, 8000),
        body_text_length: (m.body_text as string)?.length || 0,
        body_html_length: (m.body_html as string)?.length || 0,
        raw_size: (m.raw_size_bytes as number) || 0,
        raw_stored: !!(m.raw_storage_path),
      })),
    }), { headers: { ...dynCors, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    console.error("[check-inbox] Error:", extractErrorMessage(err));
    return edgeError("INTERNAL_ERROR", extractErrorMessage(err), undefined, dynCors);
  }
});
