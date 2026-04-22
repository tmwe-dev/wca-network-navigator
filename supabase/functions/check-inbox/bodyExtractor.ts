/**
 * bodyExtractor.ts — Body and attachment extraction logic (Phase 3b).
 * Handles MIME parts, inline images, and attachment downloads.
 */

import { decodeAttachment } from "jsr:@workingdevshero/deno-imap";
import {
  decodeMimePart, collectMimeLeafParts, sanitizeFilename,
  parseMultipartFallback, type MimeLeafPart,
} from "./mimeDecoder.ts";
import {
  extractLiteralBytesFromResponse, extractLiteralTextFromResponse,
  MAX_ATTACHMENT_BYTES, INLINE_DATA_URI_THRESHOLD,
} from "./imapParser.ts";
import { type AttachmentRecord } from "./dbOperations.ts";

const MAX_RAW_FETCH_BYTES = 15_000_000; // 15MB
const MAX_TEXT_LENGTH = 50_000;
const MAX_HTML_LENGTH = 100_000;

interface ExtractionResult {
  bodyText: string;
  bodyHtml: string;
  attachmentRecords: AttachmentRecord[];
  parseWarnings: string[];
}

export async function extractBodyAndAttachments(
  uid: number,
  userId: string,
  imapExec: { executeCommand(cmd: string): Promise<(string | Uint8Array)[]> },
  supabaseAdmin: any,
  messageId: string,
  bodyStructure: Record<string, unknown> | null,
  isOversized: boolean,
  rfc822Size: number,
): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    bodyText: "",
    bodyHtml: "",
    attachmentRecords: [],
    parseWarnings: [],
  };

  const { extractErrorMessage } = await import("../_shared/handleEdgeError.ts");

  // ─── Oversized message: metadata only ───
  if (isOversized) {
    const sizeMB = (rfc822Size / (1024 * 1024)).toFixed(1);
    result.bodyText = `⚠️ Messaggio troppo grande per il download completo (${sizeMB} MB). Sono stati salvati solo oggetto e dati principali.`;
    result.bodyHtml = `<div style="padding:16px;border:2px solid #f59e0b;border-radius:8px;background:#fffbeb;color:#92400e;font-family:sans-serif"><strong>⚠️ Messaggio sovradimensionato (${sizeMB} MB)</strong><br/><p>Questo messaggio supera il limite operativo per il parsing completo.</p><p>Sono stati salvati solo: oggetto, mittente, destinatari e data.</p><p>Corpo completo e allegati non sono stati scaricati per evitare errori di elaborazione.</p></div>`;
    result.parseWarnings.push(`oversized message (${sizeMB}MB) — saved metadata only`);
    return result;
  }

  // ─── Collect MIME parts from BODYSTRUCTURE ───
  let parts: MimeLeafPart[] = [];
  if (bodyStructure) {
    try {
      parts = collectMimeLeafParts(bodyStructure);
    } catch (bsErr: unknown) {
      result.parseWarnings.push(`BODYSTRUCTURE parse failed: ${extractErrorMessage(bsErr)}`);
    }
  }

  // ─── Fallback to RFC822.TEXT if no parts ───
  if (parts.length === 0) {
    try {
      let mainBoundary = "";
      try {
        const ctHdrResp = await imapExec.executeCommand(`UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (CONTENT-TYPE)])`);
        const ctHdrText = extractLiteralTextFromResponse(ctHdrResp);
        const bndMatch = ctHdrText?.match(/boundary="?([^\s";\r\n]+)"?/i);
        if (bndMatch) mainBoundary = bndMatch[1];
      } catch (e: unknown) {
        console.debug("content-type header fetch skipped:", extractErrorMessage(e));
      }

      const rfc822Response = await imapExec.executeCommand(`UID FETCH ${uid} (BODY.PEEK[TEXT])`);
      const textBytes = extractLiteralBytesFromResponse(rfc822Response);
      const textStr = new TextDecoder("utf-8", { fatal: false }).decode(textBytes);

      if (textStr && textStr.length > 5) {
        let parseInput = textStr;
        if (mainBoundary && !textStr.includes(`boundary`)) {
          parseInput = `Content-Type: multipart/mixed; boundary="${mainBoundary}"\r\n\r\n` + textStr;
        }
        const parsed = parseMultipartFallback(new TextEncoder().encode(parseInput), parseInput);
        if (parsed.html) result.bodyHtml = parsed.html.slice(0, MAX_HTML_LENGTH);
        if (parsed.text) result.bodyText = parsed.text.slice(0, MAX_TEXT_LENGTH);

        if (!result.bodyHtml && !result.bodyText) {
          const looksLikeRawMime =
            textStr.match(/^--[\w_=-]+\s*\r?\nContent-Type:/im) ||
            textStr.match(/Content-Transfer-Encoding:\s*(quoted-printable|base64)/im);
          if (looksLikeRawMime) {
            const inlineBndMatch = textStr.match(/^--([\w_=+/-]+)\s*$/m);
            if (inlineBndMatch) {
              const retryInput = `Content-Type: multipart/mixed; boundary="${inlineBndMatch[1]}"\r\n\r\n` + textStr;
              const retry = parseMultipartFallback(new TextEncoder().encode(retryInput), retryInput);
              if (retry.html) result.bodyHtml = retry.html.slice(0, MAX_HTML_LENGTH);
              if (retry.text) result.bodyText = retry.text.slice(0, MAX_TEXT_LENGTH);
            }
            if (!result.bodyHtml && !result.bodyText) {
              result.bodyText = "⚠️ Contenuto MIME complesso — parsing parziale non riuscito. Consultare il messaggio originale.";
              result.parseWarnings.push("raw MIME detected but could not extract body parts");
            }
          } else {
            result.bodyText = textStr.slice(0, MAX_TEXT_LENGTH);
          }
        }

        // ─── Handle inline images from fallback ───
        for (const img of parsed.inlineImages) {
          if (img.data.length <= INLINE_DATA_URI_THRESHOLD) {
            let b64 = "";
            const CHUNK = 8192;
            for (let i = 0; i < img.data.length; i += CHUNK) {
              b64 += String.fromCharCode(...img.data.subarray(i, Math.min(i + CHUNK, img.data.length)));
            }
            b64 = btoa(b64);
            result.attachmentRecords.push({
              cid: img.cid,
              publicUrl: `data:${img.contentType};base64,${b64}`,
              filename: `inline_${img.cid}.${img.contentType.split("/")[1] || "bin"}`,
              storagePath: "",
              contentType: img.contentType,
              size: img.data.length,
              isInline: true,
              isDataUri: true,
            });
          }
        }
      }
    } catch (fallbackErr: unknown) {
      result.parseWarnings.push(`RFC822.TEXT fallback failed: ${extractErrorMessage(fallbackErr)}`);
    }
    parts = [];
  }

  // ─── Fetch each MIME part ───
  for (const part of parts) {
    // ─── Inline body parts (text/html) ───
    if (part.isInlineBody) {
      const target = part.subtype === "html" ? "html" : "text";
      if (target === "html" && result.bodyHtml) continue;
      if (target === "text" && result.bodyText) continue;
      try {
        const bodyResponse = await imapExec.executeCommand(`UID FETCH ${uid} (BODY.PEEK[${part.section}])`);
        const partBytes = extractLiteralBytesFromResponse(bodyResponse);
        if (partBytes.length > 5) {
          const decoded = decodeMimePart(partBytes, part.encoding, part.charset);
          if (target === "html") result.bodyHtml = decoded.slice(0, MAX_HTML_LENGTH);
          else result.bodyText = decoded.slice(0, MAX_TEXT_LENGTH);
        }
      } catch (bodyErr: unknown) {
        result.parseWarnings.push(`body section ${part.section} error: ${extractErrorMessage(bodyErr)}`);
      }
      continue;
    }

    // ─── Inline images ───
    if (part.isInlineImage && part.contentId) {
      if (part.size > MAX_ATTACHMENT_BYTES) {
        result.parseWarnings.push(`inline image ${part.contentId} too large (${part.size}B)`);
        continue;
      }
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
            for (let i = 0; i < decoded.length; i += CHUNK) {
              b64 += String.fromCharCode(...decoded.subarray(i, Math.min(i + CHUNK, decoded.length)));
            }
            b64 = btoa(b64);
            result.attachmentRecords.push({
              cid: part.contentId,
              publicUrl: `data:${contentType};base64,${b64}`,
              filename,
              storagePath: "",
              contentType,
              size: decoded.length,
              isInline: true,
              isDataUri: true,
            });
          } else {
            const storagePath = `emails/${userId}/${messageId}/${filename}`;
            const { error: uploadErr } = await supabaseAdmin
              .storage.from("import-files")
              .upload(storagePath, decoded, { contentType, upsert: true });
            if (!uploadErr) {
              const { data: urlData } = supabaseAdmin.storage.from("import-files").getPublicUrl(storagePath);
              result.attachmentRecords.push({
                cid: part.contentId,
                publicUrl: (urlData as Record<string, unknown>)?.publicUrl as string || "",
                filename,
                storagePath,
                contentType,
                size: decoded.length,
                isInline: true,
              });
            } else {
              result.parseWarnings.push(`inline image upload failed: ${uploadErr.message}`);
            }
          }
        }
      } catch (imgErr: unknown) {
        result.parseWarnings.push(`inline image ${part.section} error: ${extractErrorMessage(imgErr)}`);
      }
      continue;
    }

    // ─── Regular attachments ───
    if (part.isAttachment && part.filename) {
      if (part.size > MAX_ATTACHMENT_BYTES) {
        result.attachmentRecords.push({
          filename: sanitizeFilename(part.filename),
          storagePath: "",
          contentType: `${part.type}/${part.subtype}`,
          size: part.size,
          isInline: false,
          skipped: true,
          contentId: part.contentId || null,
        });
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
          const { error: uploadErr } = await supabaseAdmin
            .storage.from("import-files")
            .upload(storagePath, decoded, { contentType, upsert: true });
          if (!uploadErr) {
            result.attachmentRecords.push({
              filename,
              storagePath,
              contentType,
              size: decoded.length,
              isInline: false,
              contentId: part.contentId || null,
            });
          } else {
            result.parseWarnings.push(`attachment upload failed: ${uploadErr.message}`);
          }
        }
      } catch (attErr: unknown) {
        result.parseWarnings.push(`attachment ${part.section} error: ${extractErrorMessage(attErr)}`);
      }
    }
  }

  return result;
}
