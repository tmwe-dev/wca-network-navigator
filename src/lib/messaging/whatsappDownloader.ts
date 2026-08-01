/**
 * WhatsApp Downloader — SSOT per la lettura sidebar/thread WhatsApp.
 *
 * Procedure uniche:
 *   - listSidebarChats / readUnread   (timeout 60s)
 *   - readThread                      (timeout 60s)
 *   - backfillChat                    (timeout 120s)
 *
 * Esecuzione e timing/retry vivono in:
 *   - useWhatsAppAdaptiveSync   (orchestrazione cron-like)
 *   - useWhatsAppBackfill       (backfill + cursor)
 *
 * Contratto bridge congelato: nessuna azione postMessage nuova.
 */
export { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
export { useWhatsAppAdaptiveSync } from "@/hooks/useWhatsAppAdaptiveSync";
export { useWhatsAppBackfill } from "@/hooks/useWhatsAppBackfill";