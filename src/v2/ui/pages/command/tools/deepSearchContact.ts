/**
 * Tool: deep-search-contact — LOVABLE-75
 * La edge deep-search-contact è deprecata. Questo tool ora restituisce uno
 * snapshot read-only e indirizza l'utente al Deep Search client-side
 * (Partner Connect extension / Email Forge).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tool, ToolResult } from "./types";

export const deepSearchContactTool: Tool = {
  id: "deep-search-contact",
  label: "Stato deep search contatto",
  description: "Mostra lo stato del Deep Search per un contatto (read-only). L'esecuzione avviene client-side da Email Forge / Partner Connect.",
  match: (p) => /trova contatto|deep.?search.*contatt/i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    // Estrai eventuale nome contatto dal prompt (best-effort)
    const nameMatch = prompt.match(/contatto\s+["']?([^"'\n]+?)["']?$/i);
    const term = nameMatch?.[1]?.trim();
    let query = supabase
      .from("imported_contacts")
      .select("id, name, email, company_name, deep_search_at, wca_partner_id")
      .order("deep_search_at", { ascending: false, nullsFirst: false })
      .limit(20);
    if (term) query = query.ilike("name", `%${term}%`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const results = (data ?? []) as Array<{
      id: string; name: string | null; email: string | null;
      company_name: string | null; deep_search_at: string | null;
    }>;

    return {
      kind: "table",
      title: "Stato Deep Search Contatti (read-only)",
      meta: {
        count: results.length,
        sourceLabel: "DB · imported_contacts — il Deep Search si esegue da Email Forge / Partner Connect",
      },
      columns: [
        { key: "name", label: "Nome" },
        { key: "company", label: "Azienda" },
        { key: "email", label: "Email" },
        { key: "status", label: "Deep Search" },
      ],
      rows: results.map((r) => ({
        name: r.name ?? "—",
        company: r.company_name ?? "—",
        email: r.email ?? "—",
        status: r.deep_search_at
          ? `✓ ${new Date(r.deep_search_at).toLocaleDateString("it-IT")}`
          : "○ mai eseguito",
      })),
    };
  },
};
