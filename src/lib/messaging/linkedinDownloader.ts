/**
 * LinkedIn Downloader — SSOT per la lettura inbox/thread LinkedIn.
 *
 * Procedure uniche (estensione v3.9.56+):
 *   - readLinkedInInbox        (timeout 35s)
 *   - readLinkedInThread       (timeout 30s)
 *   - backfillLinkedInThread   (timeout 120s)
 *
 * Questo modulo è una facade documentale: l'esecuzione vive nei due hook
 * che incapsulano timing/retry/persistence:
 *   - useLinkedInSync       (inbox + dedup in channel_messages)
 *   - useLinkedInBackfill   (backfill + cursor in channel_backfill_state)
 *
 * Riesporta i tipi DTO per uso applicativo. Non inserire qui altre
 * azioni postMessage: il contratto bridge è congelato.
 */
export type {
  LinkedInThreadDTO,
  LinkedInMessageDTO,
} from "@/hooks/useLinkedInMessagingBridge";

export { useLinkedInMessagingBridge } from "@/hooks/useLinkedInMessagingBridge";
export { useLinkedInSync } from "@/hooks/useLinkedInSync";
export { useLinkedInBackfill } from "@/hooks/useLinkedInBackfill";