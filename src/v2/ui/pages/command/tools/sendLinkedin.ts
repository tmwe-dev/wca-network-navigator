/**
 * Tool: send-linkedin — Queues a LinkedIn message via the browser extension bridge.
 * Write tool → requires approval. Backed by edge function `send-linkedin`.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractRecipient(prompt: string): string | null {
  const url = prompt.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+/i);
  if (url) return url[0];
  const handle = prompt.match(/linkedin\.com\/in\/([\w-]+)/i);
  return handle ? `https://linkedin.com/in/${handle[1]}` : null;
}

function extractMessage(prompt: string): string {
  const m = prompt.match(/["“”']([^"“”']{4,})["“”']/);
  if (m) return m[1].trim();
  const m2 = prompt.match(/(?:scrivi|messaggio|di[ckg]li|manda|invia)[^:]*:\s*(.+)$/i);
  if (m2) return m2[1].trim();
  return prompt.trim();
}

export const sendLinkedinTool: Tool = {
  id: "send-linkedin",
  label: "Invia LinkedIn",
  description: "Accoda un messaggio LinkedIn tramite estensione (no subject, max 300 char, finestra 9-19 CET, limite giornaliero).",
  match: (p) => /\b(?:invia|manda|scrivi|spedisci|connetti)\b[^.]{0,40}\b(?:linkedin|li)\b/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const recipient = extractRecipient(prompt);
      const message_text = extractMessage(prompt).slice(0, 300);
      return {
        kind: "approval",
        title: "Inviare messaggio LinkedIn?",
        description: "Verrà accodato nel dispatch estensione (finestra 9-19 CET, delay 45-180s, limite giornaliero).",
        details: [
          { label: "Profilo", value: recipient ?? "(URL profilo richiesto)" },
          { label: "Anteprima", value: message_text.slice(0, 140) + (message_text.length > 140 ? "…" : "") },
          { label: "Canale", value: "LinkedIn · extension bridge" },
        ],
        governance: { role: "COMMERCIALE", permission: "WRITE:CHANNEL_MESSAGES", policy: "POLICY v1.0 · LI-DAILY-LIMIT" },
        pendingPayload: { recipient, message_text },
        toolId: "send-linkedin",
      };
    }

    const p = context.payload ?? {};
    if (!p.recipient || !p.message_text) {
      return {
        kind: "result",
        title: "Invio LinkedIn non eseguito",
        message: "Manca URL profilo o testo del messaggio.",
        meta: { count: 0, sourceLabel: "send-linkedin" },
      };
    }

    const res = await invokeEdge<{ success?: boolean; queued?: boolean; message?: string; error?: string }>(
      "send-linkedin",
      {
        body: {
          recipient: String(p.recipient),
          message_text: String(p.message_text),
          partner_id: p.partner_id ?? null,
          contact_id: p.contact_id ?? null,
        },
        context: "command:send-linkedin",
      },
    );

    return {
      kind: "result",
      title: res?.error ? "LinkedIn non inviato" : "LinkedIn accodato",
      message: res?.error ?? res?.message ?? "Messaggio accodato per dispatch dall'estensione.",
      meta: { count: 1, sourceLabel: "Edge · send-linkedin" },
    };
  },
};