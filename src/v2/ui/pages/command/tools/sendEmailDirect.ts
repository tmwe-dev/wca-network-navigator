/**
 * Tool: send-email — Diretto (non composer). SSOT v3.9.56:
 * NON invia direttamente all'edge `send-email`; enqueue in `ai_pending_actions`
 * per approvazione manuale nel cockpit. Per email assistite usa compose-email.
 */
import { supabase } from "@/integrations/supabase/client";
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

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess?.session?.user?.id;
    if (!userId) {
      return { kind: "result", title: "Sessione non valida", message: "Effettua nuovamente il login.", meta: { count: 0, sourceLabel: "command" } };
    }
    const html = String(p.body).replace(/\n/g, "<br/>");
    const { data, error } = await supabase.from("ai_pending_actions").insert({
      user_id: userId,
      action_type: "send_email",
      action_payload: {
        to: String(p.to),
        subject: String(p.subject),
        html,
        body: String(p.body),
        partner_id: p.partner_id ?? null,
        contact_id: p.contact_id ?? null,
      } as never,
      partner_id: (p.partner_id as string | null) ?? null,
      contact_id: (p.contact_id as string | null) ?? null,
      email_address: String(p.to),
      suggested_content: String(p.body),
      reasoning: "Command tool send-email-direct: in attesa di approvazione.",
      confidence: 1.0,
      source: "command:send-email-direct",
      status: "pending",
    } as never).select("id").maybeSingle();
    if (error) {
      return { kind: "result", title: "Errore in coda", message: error.message, meta: { count: 0, sourceLabel: "command" } };
    }
    return {
      kind: "result",
      title: "📥 Email in coda di approvazione",
      message: `Apri AI Control per approvare l'invio a ${String(p.to)}${data?.id ? ` (id: ${data.id})` : ""}.`,
      meta: { count: 1, sourceLabel: "ai_pending_actions" },
    };
  },
};