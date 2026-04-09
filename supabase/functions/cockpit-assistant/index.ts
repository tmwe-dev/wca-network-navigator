import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PLATFORM_TOOLS, executePlatformTool } from "../_shared/platformTools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Sei l'assistente AI della Command Bar del Cockpit outreach. Ricevi la lista dei contatti attualmente visibili e il comando dell'utente. Devi restituire azioni strutturate che il frontend eseguirà.

RISPONDI SEMPRE in italiano, breve e operativo.

HAI ACCESSO COMPLETO ALLA PIATTAFORMA
Puoi interrogare il database direttamente: cercare partner, contatti, prospect, inbox, holding pattern, creare attività, generare outreach, gestire memoria. Non sei limitato alla lista che ti viene passata dal frontend — puoi verificare dati e arricchire le risposte con informazioni dal DB.

AZIONI DISPONIBILI (restituisci un JSON con "actions" array e "message" stringa):

1. filter — Applica filtri sulla lista contatti
   { "type": "filter", "filters": [{"id": "lang-it", "label": "🇮🇹 Italiano", "type": "language"}] }
   Tipi filtro: language, country, channel, priority, status, custom
   
2. select_all — Seleziona tutti i contatti visibili
   { "type": "select_all" }

3. clear_selection — Deseleziona tutti
   { "type": "clear_selection" }

4. select_where — Seleziona contatti che matchano un criterio
   { "type": "select_where", "field": "priority"|"country"|"language"|"channels", "operator": ">="|"=="|"includes", "value": ... }

5. bulk_action — Lancia un'azione sui contatti selezionati
   { "type": "bulk_action", "action": "deep_search"|"alias"|"outreach" }

6. single_action — Azione su un singolo contatto (specificare il nome)
   { "type": "single_action", "action": "deep_search"|"alias", "contactName": "Marco Bianchi" }

7. view_mode — Cambia modalità visualizzazione
   { "type": "view_mode", "mode": "card"|"list" }

8. auto_outreach — Filtra, seleziona e prepara outreach automaticamente
   { "type": "auto_outreach", "channel": "email"|"linkedin"|"whatsapp"|"sms", "contactNames": ["Marco Bianchi", "Roberto Esposito"] }

REGOLE:
- Puoi combinare più azioni in sequenza (es. filter + select_where + bulk_action).
- Se l'utente chiede "prepara email per gli italiani", restituisci: filter italiano → select_where country IT → auto_outreach email.
- Se l'utente chiede qualcosa che non rientra nelle azioni, usa i TOOL per interrogare il database e fornire informazioni dirette.
- NON inventare contatti che non sono nella lista fornita.
- Il "message" è mostrato come toast di conferma all'utente.
- Puoi usare i tool della piattaforma per arricchire le tue risposte con dati reali dal database.

FORMATO RISPOSTA (SOLO JSON, niente altro):
{"actions":[...],"message":"..."}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { command, contacts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context from contacts
    const contactSummary = (contacts || []).map((c: any) =>
      `- ${c.name} | ${c.company} | ${c.country} | priority:${c.priority} | lang:${c.language} | channels:${(c.channels||[]).join(",")}`
    ).join("\n");

    const userPrompt = `CONTATTI ATTUALMENTE VISIBILI (${contacts?.length || 0}):
${contactSummary}

COMANDO UTENTE: "${command}"`;

    const allMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];

    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: allMessages,
        tools: PLATFORM_TOOLS,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      const errorMsg = status === 429 ? "Troppe richieste, riprova tra poco." : status === 402 ? "Crediti AI esauriti." : "Errore AI gateway";
      return new Response(JSON.stringify({ error: errorMsg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let result = await response.json();
    let assistantMessage = result.choices?.[0]?.message;

    // Tool calling loop
    let iterations = 0;
    while (assistantMessage?.tool_calls?.length && iterations < 5) {
      iterations++;
      const toolResults = [];
      for (const tc of assistantMessage.tool_calls) {
        console.log(`[cockpit-assistant] Tool: ${tc.function.name}`, tc.function.arguments);
        const args = JSON.parse(tc.function.arguments || "{}");
        const toolResult = await executePlatformTool(tc.function.name, args, userId, authHeader);
        console.log(`[cockpit-assistant] Result ${tc.function.name}:`, JSON.stringify(toolResult).substring(0, 500));
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });
      }

      allMessages.push(assistantMessage);
      allMessages.push(...toolResults);

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: allMessages, tools: PLATFORM_TOOLS, temperature: 0.1 }),
      });

      if (!response.ok) {
        console.error("AI error on tool response:", response.status, await response.text());
        break;
      }

      result = await response.json();
      assistantMessage = result.choices?.[0]?.message;
    }

    const content = assistantMessage?.content || "";

    // Extract JSON from response (may be wrapped in markdown code blocks)
    let parsed: any = null;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      try {
        parsed = JSON.parse(content.trim());
      } catch {
        parsed = { actions: [], message: content.replace(/```[\s\S]*?```/g, "").trim() || "Non ho capito il comando." };
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cockpit-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
