/**
 * Tools: blacklist-add / blacklist-remove — governance mittenti/partner.
 * Payload: { company_name?: string, partner_id?: string, reason?: string }
 */
import type { Tool, ToolResult, ToolContext } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { mergePayload, isUuid, resolvePartnerRef } from "./_helpers/writePayload";

type Payload = { company_name?: string; partner_id?: string; reason?: string; [k: string]: unknown };

function fallback(prompt: string): Payload {
  const id = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  const name = prompt.match(/"([^"]+)"/)?.[1];
  return { partner_id: id, company_name: name };
}

export const blacklistAddTool: Tool = {
  id: "blacklist-add",
  label: "Aggiungi a blacklist",
  description: "Aggiunge un'azienda / partner alla blacklist",
  match: (p) => /\b(aggiungi|metti|inserisci)\b.*\bblacklist/i.test(p),
  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const payload = mergePayload<Payload>(context?.payload, fallback(prompt));
    const ref = String(payload.partner_id || payload.company_name || "").trim();
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Aggiungere alla blacklist?",
        description: "L'entità sarà esclusa da outreach futuri.",
        details: [
          { label: "Riferimento", value: ref || "(mancante)" },
          ...(payload.reason ? [{ label: "Motivo", value: payload.reason }] : []),
        ],
        governance: { role: "operator", permission: "WRITE:BLACKLIST", policy: "blacklist-add" },
        pendingPayload: payload,
        toolId: "blacklist-add",
      };
    }
    if (!ref) throw new Error("Riferimento partner/azienda mancante");
    let company = payload.company_name?.trim();
    let matchedPartnerId: string | null = null;
    if (isUuid(ref)) {
      const p = await resolvePartnerRef(ref);
      if (p) { matchedPartnerId = p.id; company = company ?? p.company_name; }
    } else {
      const p = await resolvePartnerRef(ref);
      if (p) { matchedPartnerId = p.id; company = company ?? p.company_name; }
      company = company ?? ref;
    }
    if (!company) throw new Error("Nome azienda mancante");
    const { error } = await supabase.from("blacklist_entries").insert({
      company_name: company,
      matched_partner_id: matchedPartnerId,
      source: "command",
      status: "active",
    } as never);
    if (error) throw new Error(error.message);
    return {
      kind: "result",
      title: "🚫 Aggiunto in blacklist",
      message: `${company} escluso dagli outreach.`,
      meta: { count: 1, sourceLabel: "Supabase · blacklist_entries" },
    };
  },
};

export const blacklistRemoveTool: Tool = {
  id: "blacklist-remove",
  label: "Rimuovi dalla blacklist",
  description: "Rimuove un'azienda dalla blacklist",
  match: (p) => /\b(rimuovi|togli|elimina)\b.*\bblacklist/i.test(p),
  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const payload = mergePayload<Payload>(context?.payload, fallback(prompt));
    const ref = String(payload.partner_id || payload.company_name || "").trim();
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Rimuovere dalla blacklist?",
        description: "L'entità tornerà elegibile per outreach.",
        details: [{ label: "Riferimento", value: ref || "(mancante)" }],
        governance: { role: "operator", permission: "WRITE:BLACKLIST", policy: "blacklist-remove" },
        pendingPayload: payload,
        toolId: "blacklist-remove",
      };
    }
    if (!ref) throw new Error("Riferimento mancante");
    const q = supabase.from("blacklist_entries").delete();
    const { error, count } = isUuid(ref)
      ? await q.eq("matched_partner_id", ref).select("*", { count: "exact", head: true })
      : await q.ilike("company_name", `%${ref}%`).select("*", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return {
      kind: "result",
      title: "✅ Rimosso da blacklist",
      message: `${count ?? 0} voce rimossa.`,
      meta: { count: count ?? 0, sourceLabel: "Supabase · blacklist_entries" },
    };
  },
};