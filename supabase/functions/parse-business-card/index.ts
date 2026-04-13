import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";


serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl richiesto" }), {
        status: 400, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Deduct 2 credits
    const { data: creditResult } = await sb.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: 2,
      p_operation: "business_card_parse",
      p_description: "Parsing biglietto da visita con AI",
    });
    const creditRow = creditResult?.[0];
    if (!creditRow?.success) {
      return new Response(JSON.stringify({ error: "Crediti insufficienti" }), {
        status: 402, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Download image as base64
    let imageBase64: string;
    let mimeType = "image/jpeg";

    if (imageUrl.startsWith("http")) {
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) throw new Error("Impossibile scaricare immagine");
      const ct = imgResp.headers.get("content-type") || "image/jpeg";
      mimeType = ct.split(";")[0].trim();
      const buf = await imgResp.arrayBuffer();
      imageBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    } else {
      throw new Error("URL immagine non valido");
    }

    // Call Gemini vision via Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY non configurata");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analizza questa immagine di un biglietto da visita e estrai TUTTI i dati visibili.
Restituisci SOLO un JSON valido con questi campi (usa null se non trovato):
{
  "company_name": "nome azienda",
  "contact_name": "nome e cognome della persona",
  "position": "ruolo/titolo",
  "email": "indirizzo email",
  "phone": "telefono fisso",
  "mobile": "cellulare",
  "address": "indirizzo completo",
  "website": "sito web",
  "notes": "qualsiasi altra info rilevante sul biglietto"
}
Sii preciso con numeri di telefono e email. Se ci sono più numeri, metti il fisso in phone e il mobile in mobile.`,
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_business_card",
              description: "Extract structured data from a business card image",
              parameters: {
                type: "object",
                properties: {
                  company_name: { type: "string", nullable: true },
                  contact_name: { type: "string", nullable: true },
                  position: { type: "string", nullable: true },
                  email: { type: "string", nullable: true },
                  phone: { type: "string", nullable: true },
                  mobile: { type: "string", nullable: true },
                  address: { type: "string", nullable: true },
                  website: { type: "string", nullable: true },
                  notes: { type: "string", nullable: true },
                },
                required: ["company_name", "contact_name"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_business_card" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI Gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit AI superato, riprova tra poco" }), {
          status: 429, headers: { ...dynCors, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    let extracted: any = {};

    // Parse tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        extracted = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } catch {
        // Fallback: try parsing from content
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
      }
    } else {
      // Fallback: parse from content
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        company_name: extracted.company_name || null,
        contact_name: extracted.contact_name || null,
        position: extracted.position || null,
        email: extracted.email || null,
        phone: extracted.phone || null,
        mobile: extracted.mobile || null,
        address: extracted.address || null,
        website: extracted.website || null,
        notes: extracted.notes || null,
      },
      credits_remaining: creditRow.new_balance,
    }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-business-card error:", e);
    return new Response(JSON.stringify({ error: e.message || "Errore interno" }), {
      status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
