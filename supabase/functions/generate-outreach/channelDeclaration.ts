/**
 * channelDeclaration.ts — Honest channel context declaration.
 * Fix 3.3: The AI must know if it has complete historical context or limited context.
 */
import type { Channel } from "./promptBuilder.ts";

export function buildChannelDeclaration(channel: Channel): string {
  switch (channel) {
    case "email":
      return `CANALE: EMAIL — canale primario, contesto storico completo (interazioni, classificazioni, risposte).`;
    case "whatsapp":
      return `CANALE: WHATSAPP — contesto storico LIMITATO (no thread completo). Tono breve, diretto, conversazionale. Max 2-4 righe.`;
    case "linkedin":
      return `CANALE: LINKEDIN — contesto storico LIMITATO. Tono professionale, conciso. Max 4-6 righe.`;
    case "sms":
      return `CANALE: SMS — un solo messaggio breve (max 160 caratteri). Solo per follow-up urgenti.`;
    default:
      return `CANALE: ${(channel as string).toUpperCase()} — adatta tono e lunghezza.`;
  }
}
