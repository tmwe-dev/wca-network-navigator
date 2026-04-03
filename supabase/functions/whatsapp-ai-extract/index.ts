import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const { html, mode } = await req.json();
    // mode: "sidebar" = extract unread from sidebar HTML
    // mode: "thread"  = extract messages from open chat HTML

    if (!html || typeof html !== "string") {
      return new Response(
        JSON.stringify({ error: "html field required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Trim HTML to avoid token limits (keep max ~30k chars)
    const trimmedHtml = html.length > 30000 ? html.slice(0, 30000) : html;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY)
      throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "thread") {
      systemPrompt = `You are a WhatsApp Web HTML parser. Extract individual messages from a WhatsApp conversation HTML.
Return a JSON array of messages. Each message must have:
- "direction": "inbound" or "outbound" (outbound = messages with blue ticks or sent by me)
- "text": the message text content
- "timestamp": any time info found (could be "14:30", "ieri 18:00", etc.)
- "contact": the sender name if visible

Only return valid JSON array, no markdown, no explanation.`;
      userPrompt = `Extract all chat messages from this WhatsApp Web HTML:\n\n${trimmedHtml}`;
    } else {
      systemPrompt = `You are a WhatsApp Web HTML parser. Extract unread conversations from the WhatsApp sidebar HTML.
Return a JSON array of unread chats. Each chat must have:
- "contact": the contact or group name
- "lastMessage": the last message preview text
- "time": the timestamp shown (e.g. "14:30", "ieri", "12/03/2025")
- "unreadCount": number of unread messages (from the badge)

ONLY include chats that have an unread badge/count visible.
Only return valid JSON array, no markdown, no explanation.
If no unread chats found, return an empty array [].`;
      userPrompt = `Extract unread chats from this WhatsApp Web sidebar HTML:\n\n${trimmedHtml}`;
    }

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: mode === "thread" ? "extract_thread" : "extract_unread",
                description:
                  mode === "thread"
                    ? "Return extracted messages from WhatsApp thread"
                    : "Return extracted unread chats from WhatsApp sidebar",
                parameters: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items:
                        mode === "thread"
                          ? {
                              type: "object",
                              properties: {
                                direction: {
                                  type: "string",
                                  enum: ["inbound", "outbound"],
                                },
                                text: { type: "string" },
                                timestamp: { type: "string" },
                                contact: { type: "string" },
                              },
                              required: ["direction", "text"],
                            }
                          : {
                              type: "object",
                              properties: {
                                contact: { type: "string" },
                                lastMessage: { type: "string" },
                                time: { type: "string" },
                                unreadCount: { type: "number" },
                              },
                              required: ["contact", "lastMessage"],
                            },
                    },
                  },
                  required: ["items"],
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: {
              name: mode === "thread" ? "extract_thread" : "extract_unread",
            },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, retry later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    
    // Extract from tool call response
    let items: any[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        items = parsed.items || [];
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // Fallback: try content directly
    if (!items.length) {
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          items = Array.isArray(parsed) ? parsed : parsed.items || [];
        } catch {
          console.error("Failed to parse AI content as JSON");
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        items,
        htmlLength: html.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("whatsapp-ai-extract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
