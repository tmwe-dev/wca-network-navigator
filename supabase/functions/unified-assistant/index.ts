/**
 * unified-assistant — Macro-function that handles all assistant scopes.
 * Routes by body.scope: partner_hub | cockpit | contacts | import | extension | strategic
 *
 * - partner_hub: forwards to ai-assistant (complex, 3800+ LOC)
 * - other scopes: handled inline via shared engine + scope configs
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { forwardToFunction } from "../_shared/proxyUtils.ts";
import { runAssistant } from "../_shared/assistantEngine.ts";
import { getScopeConfig } from "../_shared/scopeConfigs.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  try {
    const body = await req.json();
    const scope = body.scope || "partner_hub";

    // Partner hub is too complex to inline — forward to ai-assistant
    if (scope === "partner_hub") {
      return forwardToFunction("ai-assistant", body, req.headers);
    }

    // Auth check for inline scopes
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const scopeConfig = getScopeConfig(scope);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Build system prompt with context
    let systemPrompt = scopeConfig.systemPrompt;
    if (body.context) {
      systemPrompt += `\n\nCONTESTO CORRENTE:\n${JSON.stringify(body.context)}`;
    }

    // Build messages
    let messages: any[] = body.messages || [];
    if (scope === "cockpit" && body.command) {
      const contacts = body.contacts || [];
      const contactSummary = contacts.map((c: any) =>
        `- ${c.name} | ${c.company} | ${c.country} | priority:${c.priority}`
      ).join("\n");
      messages = [{ role: "user", content: `CONTATTI (${contacts.length}):\n${contactSummary}\n\nCOMANDO: "${body.command}"` }];
    }

    // Strategic scope has special handling (context injection, no tools)
    if (scope === "strategic") {
      const contextParts: string[] = [];
      if (body.systemStats) contextParts.push(`## Statistiche\n${JSON.stringify(body.systemStats, null, 2)}`);
      if (body.pageContext) contextParts.push(`## Pagina: ${body.pageContext}`);

      // Load memories and KB
      const [memories, kbEntries] = await Promise.all([
        supabase.from("ai_memory").select("content, tags").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
        supabase.from("kb_entries").select("title, content, category").eq("user_id", userId).eq("is_active", true).gte("priority", 7).order("priority", { ascending: false }).limit(10),
      ]);

      if (memories.data?.length) {
        contextParts.push(`## Memorie\n${memories.data.map((m: any) => `[${m.tags?.join(",")||"gen"}] ${m.content}`).join("\n")}`);
      }
      if (kbEntries.data?.length) {
        contextParts.push(`## KB\n${kbEntries.data.map((e: any) => `### ${e.title}\n${e.content}`).join("\n\n")}`);
      }

      systemPrompt += "\n\n" + contextParts.join("\n\n");
    }

    // Run through engine
    const localHandler = scopeConfig.localToolHandler
      ? (name: string, args: Record<string, unknown>) => scopeConfig.localToolHandler!(name, args, supabase)
      : undefined;

    const result = await runAssistant({
      systemPrompt,
      tools: scopeConfig.tools,
      messages,
      userId,
      authHeader,
      localToolHandler: localHandler,
      model: scopeConfig.model,
      temperature: scopeConfig.temperature,
      creditLabel: scopeConfig.creditLabel,
    });

    // Post-process if needed
    const responseData = scopeConfig.postProcess
      ? scopeConfig.postProcess(result.content)
      : { content: result.content };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("unified-assistant error:", e);
    const status = e.status || 500;
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
