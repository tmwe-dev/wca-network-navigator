import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_contacts",
  title: "Cerca contatti CRM",
  description:
    "Cerca contatti/partner nel CRM per nome azienda o email (case-insensitive). Rispetta RLS: mostra solo i contatti visibili all'utente autenticato.",
  inputSchema: {
    query: z.string().min(1).max(200).describe("Testo da cercare (nome azienda o email)."),
    limit: z.number().int().optional().describe("Massimo record (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non autenticato" }], isError: true };
    }
    const cap = Math.min(Math.max(Number(limit ?? 20), 1), 100);
    const term = String(query).replace(/[%_]/g, (m) => `\\${m}`);
    const { data, error } = await supabaseForUser(ctx)
      .from("partners")
      .select("id, company_name, email, country_code, lead_status, updated_at")
      .is("deleted_at", null)
      .or(`company_name.ilike.%${term}%,email.ilike.%${term}%`)
      .order("updated_at", { ascending: false })
      .limit(cap);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { contacts: data ?? [] },
    };
  },
});
