/**
 * Shared utilities for email display components.
 * Handles RFC 2047 decoding, formatting, and HTML processing.
 */

import { FileText, Image } from "lucide-react";
import { createLogger } from "@/lib/log";

const log = createLogger("emailUtils");

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getAttachmentIcon(contentType: string | null) {
  if (contentType?.startsWith("image/")) return Image;
  return FileText;
}

/**
 * RFC 2047 — Decode encoded-word in headers (=?charset?encoding?text?=)
 */
export function decodeRfc2047(input: string): string {
  if (!input) return input;
  const joined = input.replace(/\?=\s+=\?/g, "?==?");
  return joined.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, charset, encoding, text) => {
    try {
      const cs = (charset || "utf-8").trim().toLowerCase();
      if (encoding.toUpperCase() === "B") {
        const binary = atob(text);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        try { return new TextDecoder(cs).decode(bytes); }
        catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
      }
      const decoded = text.replace(/_/g, " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      try { return new TextDecoder(cs).decode(bytes); }
      catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); return decoded; }
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); return text; }
  });
}

/**
 * Block remote images in HTML by replacing external src with SVG placeholders.
 * Preserves data: URIs and cid: references (already resolved).
 */
export function blockRemoteImages(html: string): string {
  return html.replace(
    /(<img[^>]*\s+src\s*=\s*["'])(https?:\/\/[^"']+)(["'][^>]*>)/gi,
    '$1data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22%23e5e7eb%22/%3E%3Ctext x=%2224%22 y=%2228%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-size=%2210%22%3E🖼%3C/text%3E%3C/svg%3E$3'
  );
}

/**
 * Known personal email providers — no company logo available.
 */
const PERSONAL_PROVIDERS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com",
  "fastmail.com", "zoho.com", "mail.com", "yandex.com", "gmx.com",
  "libero.it", "virgilio.it", "alice.it", "tin.it", "tiscali.it",
  "yahoo.it", "hotmail.it", "outlook.it", "pec.it",
]);

/**
 * Extract brand/company name from email "From" header.
 * Returns a brand name (e.g. "Twilio") and detail line.
 */
export function extractSenderBrand(from: string): { brand: string; detail: string } {
  if (!from) return { brand: "Sconosciuto", detail: "" };

  const displayMatch = from.match(/^"?([^"<]+)"?\s*<(.+)>/);
  const displayName = displayMatch ? displayMatch[1].trim() : "";
  const emailAddr = displayMatch ? displayMatch[2].trim() : from.trim();

  const domainMatch = emailAddr.match(/@([^>]+)/);
  const domain = domainMatch ? domainMatch[1].toLowerCase() : "";

  if (PERSONAL_PROVIDERS.has(domain)) {
    const localPart = emailAddr.split("@")[0] || "";
    const name = displayName || localPart.replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return { brand: name, detail: emailAddr };
  }

  const domainParts = domain.split(".");
  let companySlug = domainParts[0];
  if (domainParts.length > 2 && ["co", "com", "org", "net"].includes(domainParts[domainParts.length - 2])) {
    companySlug = domainParts.slice(0, -2).join(".");
  } else if (domainParts.length > 1) {
    companySlug = domainParts.slice(0, -1).join(".");
  }

  const brand = companySlug.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const detail = displayName ? `${displayName} — ${emailAddr}` : emailAddr;

  return { brand, detail };
}
