/**
 * Tool: send-email — Diretto (non composer). Richiede approvazione esplicita.
 * Backed by edge `send-email`. Per email assistite usa compose-email.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractTo(prompt: string): string | null {
  const m = prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}
function extractSubject(prompt: string): string | null {
  const m = prompt.match(/oggetto[:\s]+["“”']?([^"“”'\n]{3,140})["“”']?/i);
  return m ? m[1].trim() : null;
}
function extractBody(prompt: string): string | null {
  const m = prompt.match(/(?:testo|corpo|body|messaggio)[:\s]+["“”']?([\s\S]{5,2000})["“”']?$/i);
  return m ? m[1].trim() : null;
}

export const sendEmailDirectTool: Tool = {
  id: "send-email-direct",
  label: "Invia email (diretta)",
  description: "Invia un'email ESISTENTE (oggetto+testo già pronti) tramite l'infra SMTP. Per scrivere usa compose-email.",
  match: (p) => /\b(invia|spedisci|manda)\s+(?:subito\s+)?(?:la\s+|questa\s+)?email\b(?!.*\bcompon)/i.test(p)
    && /@/.test(p) && /oggetto|testo|corpo|body|messaggio/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const to = extractTo(prompt);
      const subject = extractSubject(prompt);
      const body = extractBody(prompt);
      return {
        kind: "approval",
        title: "Inviare email diretta?",
        description: "L'email partirà subito. Nessuna riscrittura AI. Usa compose-email se vuoi assistenza.",
        details: [
          { label: "A", value: to ?? "(da specificare)" },
          { label: "Oggetto", value: subject ?? "(da specificare)" },
          { label: "Anteprima", value: (body ?? "").slice(0, 200) + ((body ?? "").length > 200 ? "…" : "") },
        ],
        governance: { role: "COMMERCIALE", permission: "WRITE:EMAIL_SEND", policy: "POLICY v1.0 · SMTP-DIRECT" },
        pendingPayload: { to, subject, body },
        toolId: "send-email-direct",
      };
    }

    const p = context.payload ?? {};
    if (!p.to || !p.subject || !p.body) {
      return {
        kind: "result",
        title: "Invio non eseguito",
        message: "Mancano destinatario, oggetto o testo.",
        meta: { count: 0, sourceLabel: "send-email" },
      };
    }

    const res = await invokeEdge<{ success?: boolean; messageId?: string; error?: string }>(
      "send-email",
      {
        body: {
          to: String(p.to),
          subject: String(p.subject),
          html: String(p.body).replace(/\n/g, "<br/>"),
          text: String(p.body),
          partner_id: p.partner_id ?? null,
          contact_id: p.contact_id ?? null,
        },
        context: "command:send-email-direct",
      },
    );

    return {
      kind: "result",
      title: res?.error ? "Email non inviata" : "Email inviata",
      message: res?.error ?? `Inviata a ${String(p.to)}${res?.messageId ? ` (id: ${res.messageId})` : ""}.`,
      meta: { count: 1, sourceLabel: "Edge · send-email" },
    };
  },
};