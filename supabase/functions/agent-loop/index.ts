/**
 * agent-loop edge function — One iteration of the agent loop.
 * Receives goal + history, returns AI decision with tool_calls.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "navigate",
      description: "Navigate to a route within the app.",
      parameters: { type: "object", properties: { path: { type: "string", description: "Route path" } }, required: ["path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_page",
      description: "Read current page structure (buttons, inputs, text).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "click",
      description: "Click an element by CSS selector.",
      parameters: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] },
    },
  },
  {
    type: "function",
    function: {
      name: "type_text",
      description: "Type text into an input/textarea.",
      parameters: {
        type: "object",
        properties: { selector: { type: "string" }, text: { type: "string" } },
        required: ["selector", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_dom",
      description: "Read outerHTML of a DOM element.",
      parameters: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_kb",
      description: "List KB entries with categories and titles.",
      parameters: { type: "object", properties: { category: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "read_kb",
      description: "Read full content of a KB entry by source_path.",
      parameters: { type: "object", properties: { source_path: { type: "string" } }, required: ["source_path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "scrape_url",
      description: "Scrape a website URL.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" }, mode: { type: "string", enum: ["static", "render"] } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user",
      description: "Ask the user a clarification question.",
      parameters: { type: "object", properties: { question: { type: "string" } }, required: ["question"] },
    },
  },
  {
    type: "function",
    function: {
      name: "finish",
      description: "Complete the mission with a final answer.",
      parameters: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
    },
  },
];

const FORBIDDEN_KEYWORDS = [
  "drop table", "truncate", "delete account", "rm -rf",
  "format disk", "password reset", "transfer funds",
];

function containsForbidden(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_KEYWORDS.some((k) => lower.includes(k));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { goal, history, sessionContext } = await req.json();

    if (!goal || typeof goal !== "string") {
      return new Response(JSON.stringify({ error: "goal è obbligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY non configurata" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Sei LUCA, l'assistente AI del CRM WCA Network Navigator.
Operi in italiano. Le tue risposte devono essere brevi e operative.
OBIETTIVO ATTUALE: ${goal}
${sessionContext ? `CONTESTO: ${JSON.stringify(sessionContext).slice(0, 1000)}` : ""}

Regole:
1. Prima di agire, LEGGI la pagina con read_page.
2. Non usare azioni distruttive (logout, delete account).
3. Per click su submit/invio form, fermati prima e verifica.
4. Se bloccato, usa ask_user.
5. Quando completato, usa finish con riassunto.
6. Rispondi SEMPRE in italiano.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history.slice(-30) : []),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: TOOL_DEFINITIONS,
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit superato, riprova tra poco." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", status, errText);
      return new Response(JSON.stringify({ error: "Errore AI gateway" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    if (!msg) {
      return new Response(JSON.stringify({ message: "", toolCalls: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Safety: check message content
    if (msg.content && containsForbidden(msg.content)) {
      return new Response(
        JSON.stringify({ message: "⚠️ Contenuto bloccato da safety filter.", toolCalls: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse tool calls
    const toolCalls = (msg.tool_calls ?? []).map((tc: Record<string, unknown>) => {
      const fn = tc.function as Record<string, unknown>;
      let args: Record<string, unknown> = {};
      try {
        args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : (fn.arguments as Record<string, unknown>) ?? {};
      } catch {
        args = {};
      }

      // Safety: check tool args
      const argsStr = JSON.stringify(args);
      if (containsForbidden(argsStr)) {
        return null;
      }

      return { name: fn.name as string, arguments: args, id: tc.id as string };
    }).filter(Boolean);

    return new Response(
      JSON.stringify({ message: msg.content ?? "", toolCalls }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("agent-loop error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
