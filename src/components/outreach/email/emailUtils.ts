/**
 * Shared utilities for email display components.
 * Handles RFC 2047 decoding, formatting, and HTML processing.
 */

import { FileText, Image } from "lucide-react";

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
        catch { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
      }
      const decoded = text.replace(/_/g, " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      try { return new TextDecoder(cs).decode(bytes); }
      catch { return decoded; }
    } catch { return text; }
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
