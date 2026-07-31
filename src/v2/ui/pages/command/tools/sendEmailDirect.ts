/**
 * Tool: send-email-direct — Enqueue email diretta in ai_pending_actions
 * per approvazione manuale (SSOT v3.9.56).
 *
 * Payload dal planner: { to, subject, body, partner_id?, contact_id? }.
 * Regex sul prompt solo come fallback per input umano diretto.
 */
import { supabase } from "@/integrations/supabase/client";
import { insertPendingActionReturningId } from "@/data/aiPendingActions";
import type { Tool, ToolResult, ToolContext } from "./types";
import { mergePayload } from "./_helpers/writePayload";

function fallbackFromPrompt(prompt: string): Record<string, unknown> {
  const toMatch = prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const subjMatch = prompt.match(/oggetto[:\s]+["“”']?([^"“”'\n]{3,140})["“”']?/i);
  const bodyMatch = prompt.match(/(?:testo|corpo|body|messaggio)[:\s]+["“”']?([\s\S]{5,2000})["“”']?$/i);
  return {
    to: toMatch?.[0] ?? "",
    subject: subjMatch?.[1]?.trim() ?? "",
    body: bodyMatch?.[1]?.trim() ?? "",
  };
}

export const sendEmailDirectTool: Tool = {
  id: "send-email-direct",
  label: "Invia email (diretta)",
  description: "Invia un'email ESISTENTE (oggetto+testo già pronti) tramite l'infra SMTP. Per scrivere usa compose-email.",
  match: (p) =>
    /\b(invia|spedisci|manda)\s+(?:subito\s+)?(?:la\s+|questa\s+)?email\b(?!.*\bcompon)/i.test(p) &&
    /@/.test(p) &&
    /oggetto|testo|corpo|body|messaggio/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const p = mergePayload(context?.payload, fallbackFromPrompt(prompt));

    if (!context?.confirmed) {
      const bodyStr = String(p.body ?? "");
      return {
        kind: "approval",
        title: "Inviare email diretta?",
        description: "L'email partirà subito. Nessuna riscrittura AI. Usa compose-email se vuoi assistenza.",
        details: [
          { label: "A", value: String(p.to || "(da specificare)") },
          { label: "Oggetto", value: String(p.subject || "(da specificare)") },
          { label: "Anteprima", value: bodyStr.slice(0, 200) + (bodyStr.length > 200 ? "…" : "") },
        ],
        governance: { role: "COMMERCIALE", permission: "WRITE:EMAIL_SEND", policy: "POLICY v1.0 · SMTP-DIRECT" },
        pendingPayload: p,
        toolId: "send-email-direct",
      };
    }

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
    const { id: pendingId, error } = await insertPendingActionReturningId({
      user_id: userId,
      action_type: "send_email",
      action_payload: {
        to: String(p.to),
        subject: String(p.subject),
        html,
        body: String(p.body),
        partner_id: (p.partner_id as string | null) ?? null,
        contact_id: (p.contact_id as string | null) ?? null,
      },
      partner_id: (p.partner_id as string | null) ?? null,
      contact_id: (p.contact_id as string | null) ?? null,
      email_address: String(p.to),
      suggested_content: String(p.body),
      reasoning: "Command tool send-email-direct: in attesa di approvazione.",
      confidence: 1.0,
      source: "command:send-email-direct",
      status: "pending",
    });
    if (error) {
      return { kind: "result", title: "Errore in coda", message: error.message, meta: { count: 0, sourceLabel: "command" } };
    }
    return {
      kind: "result",
      title: "📥 Email in coda di approvazione",
      message: `Apri AI Control per approvare l'invio a ${String(p.to)}${pendingId ? ` (id: ${pendingId})` : ""}.`,
      meta: { count: 1, sourceLabel: "ai_pending_actions" },
    };
  },
};
