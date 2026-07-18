/**
 * Tools: update-kb-entry, delete-kb-entry (soft-delete).
 */
import type { Tool, ToolResult, ToolContext } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { mergePayload, isUuid } from "./_helpers/writePayload";

type UpdatePayload = { entry_id?: string; title?: string; updates?: Record<string, unknown>; [k: string]: unknown };

async function resolveEntry(ref: string): Promise<{ id: string; title: string } | null> {
  if (!ref) return null;
  if (isUuid(ref)) {
    const { data } = await supabase.from("kb_entries").select("id, title").eq("id", ref).maybeSingle();
    return data ? { id: data.id as string, title: (data.title ?? "") as string } : null;
  }
  const { data } = await supabase.from("kb_entries").select("id, title").ilike("title", `%${ref}%`).is("deleted_at", null).limit(1).maybeSingle();
  return data ? { id: data.id as string, title: (data.title ?? "") as string } : null;
}

export const updateKbEntryTool: Tool = {
  id: "update-kb-entry",
  label: "Aggiorna KB entry",
  description: "Aggiorna una entry della Knowledge Base",
  match: (p) => /\b(aggiorna|modifica)\s+(entry|voce)\s+(kb|knowledge)/i.test(p),
  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const payload = mergePayload<UpdatePayload>(context?.payload, {});
    const ref = String(payload.entry_id || payload.title || "").trim();
    const updates = (payload.updates as Record<string, unknown>) ?? {};
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Aggiornare KB entry?",
        description: "La voce verrà modificata.",
        details: [
          { label: "Voce", value: ref || "(mancante)" },
          { label: "Campi", value: Object.keys(updates).join(", ") || "(nessuno)" },
        ],
        governance: { role: "editor", permission: "WRITE:KB", policy: "kb-update" },
        pendingPayload: payload,
        toolId: "update-kb-entry",
      };
    }
    if (!ref) throw new Error("Riferimento entry mancante");
    if (Object.keys(updates).length === 0) throw new Error("Nessun aggiornamento");
    const resolved = await resolveEntry(ref);
    if (!resolved) throw new Error(`Entry "${ref}" non trovata`);
    const { error } = await supabase.from("kb_entries").update(updates as never).eq("id", resolved.id);
    if (error) throw new Error(error.message);
    return {
      kind: "result",
      title: "📚 KB aggiornata",
      message: `"${resolved.title}" aggiornata.`,
      meta: { count: 1, sourceLabel: "Supabase · kb_entries" },
    };
  },
};

type DeletePayload = { entry_id?: string; title?: string; [k: string]: unknown };

export const deleteKbEntryTool: Tool = {
  id: "delete-kb-entry",
  label: "Elimina KB entry",
  description: "Soft-delete di una entry della Knowledge Base",
  match: (p) => /\b(elimina|cancella|rimuovi)\s+(entry|voce)\s+(kb|knowledge)/i.test(p),
  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const payload = mergePayload<DeletePayload>(context?.payload, {});
    const ref = String(payload.entry_id || payload.title || "").trim();
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Eliminare KB entry?",
        description: "La voce verrà soft-deleted (recuperabile dal cestinone).",
        details: [{ label: "Voce", value: ref || "(mancante)" }],
        governance: { role: "editor", permission: "WRITE:KB", policy: "kb-delete" },
        pendingPayload: payload,
        toolId: "delete-kb-entry",
      };
    }
    if (!ref) throw new Error("Riferimento mancante");
    const resolved = await resolveEntry(ref);
    if (!resolved) throw new Error(`Entry "${ref}" non trovata`);
    const { error } = await supabase
      .from("kb_entries")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", resolved.id);
    if (error) throw new Error(error.message);
    return {
      kind: "result",
      title: "🗑️ Entry eliminata",
      message: `"${resolved.title}" rimossa dalla KB.`,
      meta: { count: 1, sourceLabel: "Supabase · kb_entries" },
    };
  },
};