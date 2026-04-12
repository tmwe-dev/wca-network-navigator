/**
 * imapParser.ts — IMAP response parsing helpers.
 * Extracted from check-inbox/index.ts (lines 418-692).
 */

import { extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { decodeRfc2047 } from "./mimeDecoder.ts";

// ━━━ Constants ━━━

export const BATCH_SIZE = 1;
export const UID_SEARCH_INITIAL_WINDOW = 250;
export const UID_SEARCH_MAX_EXPANSIONS = 10;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_RAW_BYTES = 15 * 1024 * 1024;
export const MAX_RAW_FETCH_BYTES = 2 * 1024 * 1024;
export const INLINE_DATA_URI_THRESHOLD = 100 * 1024;

// ━━━ Envelope helpers ━━━

export function envelopeAddr(addr: Record<string, unknown> | null): string {
  if (!addr) return "";
  const mb = (addr.mailbox as string) || "";
  const host = (addr.host as string) || "";
  if (mb && host) return `${mb}@${host}`.toLowerCase();
  return "";
}

export function envelopeAddrName(addr: Record<string, unknown> | null): string {
  if (!addr) return "";
  return decodeRfc2047((addr.name as string) || "") || envelopeAddr(addr);
}

export function envelopeAddrList(addrs: Record<string, unknown>[] | null | undefined): string {
  if (!addrs || !Array.isArray(addrs)) return "";
  return addrs.map(a => envelopeAddr(a)).filter(Boolean).join(", ");
}

// ━━━ Byte concatenation ━━━

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

// ━━━ Literal extraction from IMAP response ━━━

export function extractLiteralBytesFromResponse(lines: (string | Uint8Array)[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();
  let literalStarted = false;
  for (const line of lines) {
    if (line instanceof Uint8Array) { literalStarted = true; chunks.push(line); continue; }
    if (typeof line !== "string") continue;
    if (/\{\d+\}\s*$/.test(line)) { literalStarted = true; continue; }
    if (!literalStarted) continue;
    if (/^\* \d+ FETCH/.test(line)) continue;
    if (line.trim() === ")" || /^\S+ OK/.test(line)) continue;
    chunks.push(encoder.encode(line + "\r\n"));
  }
  return concatBytes(chunks);
}

export function extractLiteralTextFromResponse(lines: (string | Uint8Array)[]): string {
  return new TextDecoder().decode(extractLiteralBytesFromResponse(lines)).trim();
}

// ━━━ Raw header parsing ━━━

export function parseRawHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let currentKey = "";
  let currentValue = "";
  for (const line of lines) {
    if (line.match(/^\s/) && currentKey) {
      currentValue += " " + line.trim();
    } else {
      if (currentKey) headers[currentKey.toLowerCase()] = currentValue.trim();
      const match = line.match(/^([A-Za-z\-]+):\s*(.*)/);
      if (match) { currentKey = match[1]; currentValue = match[2]; }
      else { currentKey = ""; currentValue = ""; }
    }
  }
  if (currentKey) headers[currentKey.toLowerCase()] = currentValue.trim();
  return headers;
}

export function parseEmailFromHeader(header: string): string {
  if (!header) return "";
  const angleMatch = header.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].toLowerCase();
  const trimmed = header.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  return "";
}

// ━━━ Threading ━━━

export function computeThreadId(messageId: string, inReplyTo: string | null, references: string | null): string {
  if (references) {
    const refs = references.match(/[^\s<>]+@[^\s<>]+/g);
    if (refs && refs.length > 0) return refs[0];
  }
  if (inReplyTo) return inReplyTo.replace(/[<>]/g, "");
  return messageId;
}

// ━━━ UID Search parsing ━━━

export type NextUidBatch = {
  uids: number[];
  remaining: number;
  hasMore: boolean;
};

export function parseESearchMinCount(lines: (string | Uint8Array)[]): { nextUid: number | null; count: number | null } {
  for (const line of lines) {
    if (typeof line !== "string" || !line.includes("ESEARCH")) continue;
    const minMatch = line.match(/\bMIN\s+(\d+)\b/i);
    const countMatch = line.match(/\bCOUNT\s+(\d+)\b/i);
    return {
      nextUid: minMatch ? Number(minMatch[1]) : null,
      count: countMatch ? Number(countMatch[1]) : null,
    };
  }
  return { nextUid: null, count: null };
}

export function parseUidSearchResponse(lines: (string | Uint8Array)[], minUid: number): number[] {
  for (const line of lines) {
    if (typeof line !== "string" || !line.startsWith("* SEARCH")) continue;
    const payload = line.slice("* SEARCH".length).trim();
    if (!payload) return [];
    return payload
      .split(/\s+/)
      .map((token) => Number(token))
      .filter((uid) => Number.isFinite(uid) && uid >= minUid);
  }
  return [];
}

export function parseFirstUidSearchResponse(lines: (string | Uint8Array)[], minUid: number): number | null {
  for (const line of lines) {
    if (typeof line !== "string" || !line.startsWith("* SEARCH")) continue;
    const matches = line.match(/\d+/g);
    if (!matches) return null;
    for (const match of matches) {
      const uid = Number(match);
      if (Number.isFinite(uid) && uid >= minUid) return uid;
    }
  }
  return null;
}

// ━━━ ImapClient type for executeCommand ━━━
interface ImapClientLike {
  executeCommand(cmd: string): Promise<(string | Uint8Array)[]>;
}

export async function getNextUidBatch(client: ImapClientLike, lastUid: number): Promise<NextUidBatch> {
  const minUid = Math.max(1, lastUid + 1);

  try {
    const esearchResponse = await client.executeCommand(`UID SEARCH RETURN (MIN COUNT) UID ${minUid}:*`);
    const { nextUid, count } = parseESearchMinCount(esearchResponse);

    if (count === 0) {
      return { uids: [], remaining: 0, hasMore: false };
    }

    if (nextUid && nextUid >= minUid) {
      return {
        uids: [nextUid],
        remaining: Math.max(0, (count ?? 1) - 1),
        hasMore: (count ?? 0) > 1,
      };
    }
  } catch (esearchErr: unknown) {
    console.warn(`[check-inbox] ESEARCH MIN fallback: ${extractErrorMessage(esearchErr)}`);
  }

  let windowSize = UID_SEARCH_INITIAL_WINDOW;
  for (let attempt = 1; attempt <= UID_SEARCH_MAX_EXPANSIONS; attempt++) {
    const maxUid = minUid + windowSize - 1;
    try {
      const searchResponse = await client.executeCommand(`UID SEARCH UID ${minUid}:${maxUid}`);
      const uids = parseUidSearchResponse(searchResponse, minUid).sort((a, b) => a - b);
      if (uids.length > 0) {
        return {
          uids: uids.slice(0, BATCH_SIZE),
          remaining: Math.max(0, uids.length - BATCH_SIZE),
          hasMore: true,
        };
      }
    } catch (searchErr: unknown) {
      console.warn(`[check-inbox] UID SEARCH ${minUid}:${maxUid} failed: ${extractErrorMessage(searchErr)}`);
    }
    windowSize *= 2;
  }

  try {
    const fallbackResponse = await client.executeCommand(`UID SEARCH UID ${minUid}:*`);
    const nextUid = parseFirstUidSearchResponse(fallbackResponse, minUid);
    if (nextUid) {
      return { uids: [nextUid], remaining: 1, hasMore: true };
    }
  } catch (fallbackErr: unknown) {
    console.error("[check-inbox] UID SEARCH fallback error:", extractErrorMessage(fallbackErr));
  }

  return { uids: [], remaining: 0, hasMore: false };
}
