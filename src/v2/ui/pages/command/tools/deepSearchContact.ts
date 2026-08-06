/**
 * Tool: deep-search-contact — read-only snapshot.
 * Sherlock (Scout/Detective/Sherlock) è il motore unico di Deep Search.
 * Questo tool mostra lo stato; l'esecuzione si fa da Email Forge → tab Deep Search.
 */
import { findDeepSearchContacts } from "@/data/commandDeepSearchContact";
import type { Tool, ToolResult } from "./types";

export const deepSearchContactTool: Tool = {
  id: "deep-search-contact",
  label: "Stato deep search contatto",
  description:
    "Mostra lo stato del Deep Search per un contatto (read-only). L'esecuzione avviene client-side da Email Forge / Partner Connect.",
  match: (p) => /trova contatto|deep.?search.*contatt/i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    // Estrai eventuale nome contatto dal prompt (best-effort)
    const nameMatch = prompt.match(/contatto\s+["']?([^"'\n]+?)["']?$/i);
    const term = nameMatch?.[1]?.trim();
    const results = await findDeepSearchContacts(term);

    return {
      kind: "table",
      title: "Stato Deep Search Contatti (read-only)",
      meta: {
        count: results.length,
        sourceLabel: "Contatti CRM — Deep Search via Sherlock (Email Forge → tab Deep Search)",
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
        status: r.deep_search_at ? `✓ ${new Date(r.deep_search_at).toLocaleDateString("it-IT")}` : "○ mai eseguito",
      })),
    };
  },
};
