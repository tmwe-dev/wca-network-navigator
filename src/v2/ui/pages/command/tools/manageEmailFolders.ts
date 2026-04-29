/**
 * Tool: manage-email-folders — Write/approval. Crea/rinomina/elimina cartelle inbox.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

function detectAction(prompt: string): "create" | "rename" | "delete" | null {
  if (/\b(crea|create|nuova|add)\b/i.test(prompt)) return "create";
  if (/\b(rinomina|rename)\b/i.test(prompt)) return "rename";
  if (/\b(elimina|cancella|delete|rimuovi)\b/i.test(prompt)) return "delete";
  return null;
}
function extractFolder(prompt: string): string | null {
  const m = prompt.match(/\bcartella\s+["“”']?([^"“”'\n]{1,80})["“”']?/i)
    ?? prompt.match(/\bfolder\s+["“”']?([^"“”'\n]{1,80})["“”']?/i);
  return m ? m[1].trim() : null;
}

export const manageEmailFoldersTool: Tool = {
  id: "manage-email-folders",
  label: "Gestisci cartelle email",
  description: "Crea / rinomina / elimina cartelle dell'inbox (IMAP). Richiede approvazione.",
  match: (p) => /\b(crea|rinomina|elimina|cancella|gestisci)\b[^.]{0,30}\b(cartella|folder|cartelle|folders)\b[^.]{0,30}\b(email|inbox|mail)\b/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const action = detectAction(prompt);
    const folder = extractFolder(prompt);
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Operazione su cartelle email",
        description: "Modifica struttura IMAP. Operazione potenzialmente distruttiva.",
        details: [
          { label: "Azione", value: action ?? "(da specificare)" },
          { label: "Cartella", value: folder ?? "(da specificare)" },
        ],
        governance: { role: "DIRETTORE", permission: "WRITE:EMAIL_FOLDERS", policy: "POLICY v1.0 · IMAP-FOLDERS" },
        pendingPayload: { action, folder },
        toolId: "manage-email-folders",
      };
    }
    const p = context.payload ?? {};
    if (!p.action || !p.folder) {
      return {
        kind: "result",
        title: "Operazione non eseguita",
        message: "Manca azione o nome cartella.",
        meta: { count: 0, sourceLabel: "manage-email-folders" },
      };
    }
    const res = await invokeEdge<{ success?: boolean; message?: string; error?: string }>(
      "manage-email-folders",
      { body: { action: String(p.action), folder: String(p.folder), new_name: p.new_name ?? null }, context: "command:manage-email-folders" },
    );
    return {
      kind: "result",
      title: res?.error ? "Operazione fallita" : "Cartella aggiornata",
      message: res?.error ?? res?.message ?? `Azione ${String(p.action)} eseguita su ${String(p.folder)}.`,
      meta: { count: 1, sourceLabel: "Edge · manage-email-folders" },
    };
  },
};