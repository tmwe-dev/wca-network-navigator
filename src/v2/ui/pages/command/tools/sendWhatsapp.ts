/**
 * Tool: send-whatsapp — Queues a WhatsApp message via the browser extension bridge.
 * Write tool → requires approval. Backed by edge function `send-whatsapp`.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractRecipient(prompt: string): string | null {
  const phone = prompt.match(/\+?\d[\d\s().-]{6,}\d/);
  return phone ? phone[0].replace(/[^\d+]/g, "") : null;
}

function extractMessage(prompt: string): string {
  const m = prompt.match(/["“”']([^"“”']{4,})["“”']/);
  if (m) return m[1].trim();
  // fallback: text after "scrivi"/"messaggio"/"dì"
  const m2 = prompt.match(/(?:scrivi|messaggio|di[ckg]li|manda|invia)[^:]*:\s*(.+)$/i);
  if (m2) return m2[1].trim();
  return prompt.trim();
}

export const sendWhatsappTool: Tool = {
  id: "send-whatsapp",
  label: "Invia WhatsApp",
  description: "Accoda un messaggio WhatsApp tramite l'estensione bridge (rate limit 5/min, finestra oraria operativa).",
  match: (p) => /\b(?:invia|manda|scrivi|spedisci)\b[^.]{0,40}\b(?:whatsapp|wa)\b/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const recipient = extractRecipient(prompt);
      const message_text = extractMessage(prompt);
      return {
        kind: "approval",
        title: "Inviare messaggio WhatsApp?",
        description: "Il messaggio sarà accodato nel dispatch dell'estensione e inviato secondo i limiti operativi.",
        details: [
          { label: "Destinatario", value: recipient ?? "(da specificare)" },
          { label: "Anteprima", value: message_text.slice(0, 140) + (message_text.length > 140 ? "…" : "") },
          { label: "Canale", value: "WhatsApp · extension bridge" },
        ],
        governance: { role: "COMMERCIALE", permission: "WRITE:CHANNEL_MESSAGES", policy: "POLICY v1.0 · WA-RATE-5/MIN" },
        pendingPayload: { recipient, message_text },
        toolId: "send-whatsapp",
      };
    }

    const p = context.payload ?? {};
    if (!p.recipient || !p.message_text) {
      return {
        kind: "result",
        title: "Invio WhatsApp non eseguito",
        message: "Manca destinatario o testo del messaggio.",
        meta: { count: 0, sourceLabel: "send-whatsapp" },
      };
    }

    const res = await invokeEdge<{ success?: boolean; queued?: boolean; message?: string; error?: string }>(
      "send-whatsapp",
      {
        body: {
          recipient: String(p.recipient),
          message_text: String(p.message_text),
          partner_id: p.partner_id ?? null,
          contact_id: p.contact_id ?? null,
        },
        context: "command:send-whatsapp",
      },
    );

    return {
      kind: "result",
      title: res?.error ? "WhatsApp non inviato" : "WhatsApp accodato",
      message: res?.error ?? res?.message ?? "Messaggio accodato per dispatch dall'estensione.",
      meta: { count: 1, sourceLabel: "Edge · send-whatsapp" },
    };
  },
};