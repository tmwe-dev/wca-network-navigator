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
  name: "list_agents",
  title: "Elenca agenti AI",
  description: "Elenca gli agenti AI configurati nel CRM (nome, ruolo, stato attivo, tools assegnati).",
  inputSchema: {
    only_active: z.boolean().optional().describe("Se true, restituisce solo gli agenti attivi."),
    limit: z.number().int().optional().describe("Numero massimo di agenti da restituire (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_active, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non autenticato" }], isError: true };
    }
    const cap = Math.min(Math.max(Number(limit ?? 50), 1), 200);
    let query = supabaseForUser(ctx)
      .from("agents")
      .select("id, name, role, avatar_emoji, is_active, assigned_tools, territory_codes")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(cap);
    if (only_active) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { agents: data ?? [] },
    };
  },
});
