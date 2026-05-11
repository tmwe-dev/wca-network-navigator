/**
 * mimeDecoder.ts — MIME/RFC decoding utilities.
 * Extracted from check-inbox/index.ts (lines 172-582).
 */

import { extractErrorMessage } from "../_shared/handleEdgeError.ts";

// ━━━ RFC 2045/2046 — Content-Transfer-Encoding & Charset ━━━

export function normalizeCharset(charset?: string | null): string {
  const value = (charset || "utf-8").trim().toLowerCase();
  if (value === "utf8") return "utf-8";
  if (value === "us-ascii" || value === "ascii") return "utf-8";
  if (value === "latin1" || value === "iso_8859-1") return "iso-8859-1";
  if (value === "latin2" || value === "iso_8859-2") return "iso-8859-2";
  if (value === "windows-1252" || value === "cp1252") return "windows-1252";
  if (value === "windows-1250" || value === "cp1250") return "windows-1250";
  if (value === "windows-1251" || value === "cp1251") return "windows-1251";
  if (value === "iso-8859-15" || value === "latin9") return "iso-8859-15";
  if (value === "gb2312" || value === "gbk") return "gbk";
  if (value === "big5") return "big5";
  if (value === "euc-jp") return "euc-jp";
  if (value === "shift_jis" || value === "shift-jis") return "shift_jis";
  if (value === "iso-2022-jp") return "iso-2022-jp";
  if (value === "koi8-r") return "koi8-r";
  return value;
}

export function decodeQuotedPrintable(input: Uint8Array): Uint8Array {
  const result: number[] = [];
  let i = 0;
  while (i < input.length) {
    const byte = input[i];
    if (byte === 0x3D) {
      if (i + 1 < input.length && input[i + 1] === 0x0A) { i += 2; continue; }
      if (i + 2 < input.length && input[i + 1] === 0x0D && input[i + 2] === 0x0A) { i += 3; continue; }
      if (i + 2 < input.length) {
        const hex = String.fromCharCode(input[i + 1], input[i + 2]);
        const val = parseInt(hex, 16);
        if (!isNaN(val)) { result.push(val); i += 3; continue; }
      }
      result.push(byte); i++;
    } else {
      result.push(byte); i++;
    }
  }
  return new Uint8Array(result);
}

export function decodeBase64Bytes(input: Uint8Array): Uint8Array {
  const str = new TextDecoder("ascii").decode(input).replace(/[\r\n\s]/g, "");
  try {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch (e: unknown) {
    console.debug("base64 decode failed, returning input:", extractErrorMessage(e));
    return input;
  }
}

export function decodeMimePart(rawBytes: Uint8Array, encoding: string, charset?: string | null): string {
  const enc = (encoding || "7BIT").toUpperCase();
  let decoded: Uint8Array;
  switch (enc) {
    case "QUOTED-PRINTABLE": decoded = decodeQuotedPrintable(rawBytes); break;
    case "BASE64": decoded = decodeBase64Bytes(rawBytes); break;
    default: decoded = rawBytes;
  }
  const cs = normalizeCharset(charset);
  try { return new TextDecoder(cs).decode(decoded); }
  catch (e: unknown) {
    console.debug("charset decode failed, falling back to utf-8:", extractErrorMessage(e));
    return new TextDecoder("utf-8", { fatal: false }).decode(decoded);
  }
}

// ━━━ SHA-256 hash ━━━

export async function sha256hex(data: Uint8Array): Promise<string> {
  const buf = new Uint8Array(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ━━━ RFC 3501 §6.4.5 — BODYSTRUCTURE navigation ━━━

export type MimeLeafPart = {
  section: string;
  type: string;
  subtype: string;
  encoding: string;
  charset: string;
  contentId: string;
  dispositionType: string;
  filename: string;
  size: number;
  isInlineBody: boolean;
  isInlineImage: boolean;
  isAttachment: boolean;
};

export function getPartParameter(params: Record<string, string> | undefined, key: string): string {
  if (!params) return "";
  const found = Object.entries(params).find(([k]) => k.toLowerCase() === key.toLowerCase());
  return found?.[1] || "";
}

export function decodeRfc2231(value: string): string {
  if (!value) return value;
  const match = value.match(/^([^']*)'([^']*)'(.*)$/);
  if (match) {
    const charset = match[1] || "utf-8";
    const encoded = match[3];
    try {
      const decoded = encoded.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      return new TextDecoder(normalizeCharset(charset)).decode(bytes);
    } catch (e: unknown) {
      console.debug("RFC 2231 decode failed:", extractErrorMessage(e));
      return encoded;
    }
  }
  return value;
}

export function getPartFilename(part: Record<string, unknown>): string {
  const extFilename = getPartParameter(part?.dispositionParameters as Record<string, string> | undefined, "filename*") ||
                      getPartParameter(part?.parameters as Record<string, string> | undefined, "name*");
  if (extFilename) return decodeRfc2231(extFilename);

  return (
    getPartParameter(part?.dispositionParameters as Record<string, string> | undefined, "filename") ||
    getPartParameter(part?.parameters as Record<string, string> | undefined, "name") ||
    ""
  );
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|\x00-\x1F]/g, "_").slice(0, 180) || "attachment.bin";
}

export function sanitizeMessageId(mid: string): string {
  return mid.replace(/[<>]/g, "").trim().slice(0, 250) || "unknown";
}

export function collectMimeLeafParts(part: Record<string, unknown>, path: string = ""): MimeLeafPart[] {
  if (!part) return [];
  if (Array.isArray(part.childParts) && part.childParts.length > 0) {
    return (part.childParts as Record<string, unknown>[]).flatMap((child: Record<string, unknown>, index: number) =>
      collectMimeLeafParts(child, path ? `${path}.${index + 1}` : `${index + 1}`)
    );
  }

  const type = ((part.type as string) || "").toLowerCase();
  const subtype = ((part.subtype as string) || "").toLowerCase();
  const dispositionType = ((part.dispositionType as string) || "").toLowerCase();
  const filename = getPartFilename(part);
  const charset = getPartParameter(part.parameters as Record<string, string> | undefined, "charset") || "utf-8";
  const contentId = ((part.id as string) || "").replace(/[<>]/g, "");
  const section = path || "1";
  const encoding = ((part.encoding as string) || "7BIT").toUpperCase();

  if (type === "message" && subtype === "rfc822") {
    const isAttachedMessage = dispositionType === "attachment" || !!filename;
    if (isAttachedMessage || !part.messageBodyStructure) {
      return [{
        section, type, subtype, encoding, charset, contentId, dispositionType,
        filename: filename || `message-${section}.eml`,
        size: (part.size as number) || 0,
        isInlineBody: false, isInlineImage: false, isAttachment: true,
      }];
    }
    return collectMimeLeafParts(part.messageBodyStructure as Record<string, unknown>, section);
  }

  const isTextBody = type === "text" && (subtype === "plain" || subtype === "html") &&
    dispositionType !== "attachment" && !filename;

  const isInlineImage = type === "image" && !!contentId && dispositionType !== "attachment";

  return [{
    section, type, subtype, encoding, charset, contentId, dispositionType,
    filename: filename || (isTextBody ? "" : `${type}_${subtype}.${subtype}`),
    size: (part.size as number) || 0,
    isInlineBody: isTextBody, isInlineImage,
    isAttachment: !isTextBody && !isInlineImage,
  }];
}

// ━━━ RFC 2047 — Encoded-Word decoder ━━━

export function decodeRfc2047(input: string): string {
  if (!input) return input;
  const joined = input.replace(/\?=\s+=\?/g, "?==?");
  return joined.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, charset, encoding, text) => {
    try {
      const cs = normalizeCharset(charset);
      if (encoding.toUpperCase() === "B") {
        const binary = atob(text);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        try { return new TextDecoder(cs).decode(bytes); }
        catch (e: unknown) {
          console.debug("RFC 2047 B decode fallback:", extractErrorMessage(e));
          return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        }
      }
      const decoded = text.replace(/_/g, " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      try { return new TextDecoder(cs).decode(bytes); }
      catch (e: unknown) {
        console.debug("RFC 2047 Q decode fallback:", extractErrorMessage(e));
        return decoded;
      }
    } catch (e: unknown) {
      console.debug("RFC 2047 decode error:", extractErrorMessage(e));
      return text;
    }
  });
}

// ━━━ RFC 2046 — Multipart MIME parser for RFC822.TEXT fallback ━━━

export type FallbackResult = {
  text: string;
  html: string;
  inlineImages: Array<{ cid: string; contentType: string; data: Uint8Array }>;
};

export function parseMultipartFallback(rawBytes: Uint8Array, rawText: string): FallbackResult {
  let text = "";
  let html = "";
  const inlineImages: FallbackResult["inlineImages"] = [];
  const boundaryMatch = rawText.match(/boundary="?([^\s";\r\n]+)"?/i);
  if (!boundaryMatch) return { text: "", html: "", inlineImages: [] };

  const boundary = boundaryMatch[1];
  const delimiter = "--" + boundary;
  const sections = rawText.split(delimiter);

  for (const section of sections) {
    if (!section || section.startsWith("--") || section.trim().length < 10) continue;
    const headerEnd = section.indexOf("\r\n\r\n");
    const headerEndAlt = section.indexOf("\n\n");
    const splitPos = headerEnd >= 0 ? headerEnd : headerEndAlt;
    if (splitPos < 0) continue;

    const headerPart = section.slice(0, splitPos);
    const bodyStart = headerEnd >= 0 ? splitPos + 4 : splitPos + 2;
    const bodyPart = section.slice(bodyStart);

    const ctMatch = headerPart.match(/content-type:\s*([^;\r\n]+)/i);
    const encMatch = headerPart.match(/content-transfer-encoding:\s*(\S+)/i);
    const charsetMatch = headerPart.match(/charset="?([^"\s;]+)"?/i);
    const cidMatch = headerPart.match(/content-id:\s*<?([^>\s\r\n]+)>?/i);

    const contentType = (ctMatch?.[1] || "").trim().toLowerCase();
    const encoding = (encMatch?.[1] || "7bit").trim();
    const charset = charsetMatch?.[1] || "utf-8";
    const cid = cidMatch?.[1] || "";

    if (contentType.startsWith("multipart/")) {
      const nestedBoundaryMatch = headerPart.match(/boundary="?([^\s";\r\n]+)"?/i);
      if (nestedBoundaryMatch) {
        const nestedBytes = new TextEncoder().encode(bodyPart);
        const nested = parseMultipartFallback(nestedBytes, bodyPart);
        if (nested.text && !text) text = nested.text;
        if (nested.html && !html) html = nested.html;
        inlineImages.push(...nested.inlineImages);
      }
      continue;
    }

    if (contentType === "text/plain" && !text) {
      text = decodeMimePart(new TextEncoder().encode(bodyPart), encoding, charset);
    } else if (contentType === "text/html" && !html) {
      html = decodeMimePart(new TextEncoder().encode(bodyPart), encoding, charset);
    } else if (contentType.startsWith("image/") && cid) {
      try {
        const imgBytes = new TextEncoder().encode(bodyPart);
        const decoded = encoding.toUpperCase() === "BASE64"
          ? decodeBase64Bytes(imgBytes)
          : imgBytes;
        inlineImages.push({ cid, contentType, data: decoded });
      } catch (e: unknown) {
        console.debug("inline image decode skipped:", extractErrorMessage(e));
      }
    }
  }
  return { text, html, inlineImages };
}
