import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { original_html, edited_html, recipient_country, email_type } = await req.json();
    if (!original_html || !edited_html) {
      return new Response(JSON.stringify({ error: "original_html and edited_html required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const originalText = stripHtml(original_html);
    const editedText = stripHtml(edited_html);

    // Quick heuristic: if texts are nearly identical, skip AI call
    const lengthChangePct = originalText.length > 0
      ? Math.round(((editedText.length - originalText.length) / originalText.length) * 100)
      : 0;

    if (Math.abs(lengthChangePct) < 10 && originalText.length > 0) {
      // Check word-level similarity
      const origWords = originalText.split(/\s+/).length;
      const editWords = editedText.split(/\s+/).length;
      const wordDiff = Math.abs(origWords - editWords);
      if (wordDiff < 5) {
        return new Response(JSON.stringify({
          significance: "low",
          length_change_pct: lengthChangePct,
          tone_shift: null,
          structural_changes: [],
          suggested_memory: null,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Analizza le modifiche che l'utente ha apportato a un'email generata dall'AI.

TESTO ORIGINALE (generato dall'AI):
---
${originalText.substring(0, 2000)}
---

TESTO MODIFICATO (dall'utente):
---
${editedText.substring(0, 2000)}
---

Contesto: Email tipo "${email_type || "generico"}", destinatario in "${recipient_country || "N/A"}".

Analizza e rispondi SOLO con JSON valido:
{
  "tone_shift": "descrizione breve del cambio tono, es: 'formale → informale', 'neutro → amichevole', o null se invariato",
  "structural_changes": ["lista di cambi strutturali, es: 'saluto abbreviato', 'paragrafi ridotti', 'CTA semplificata'"],
  "significance": "low | medium | high",
  "suggested_memory": "frase sintetica che descrive la preferenza dell'utente da memorizzare, es: 'Preferisce email brevi e dirette con tono informale per contatti italiani'. Null se non significativo."
}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      const status = resp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiResult = await resp.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({
        significance: "low",
        length_change_pct: lengthChangePct,
        tone_shift: null,
        structural_changes: [],
        suggested_memory: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({
      significance: parsed.significance || "low",
      length_change_pct: lengthChangePct,
      tone_shift: parsed.tone_shift || null,
      structural_changes: Array.isArray(parsed.structural_changes) ? parsed.structural_changes : [],
      suggested_memory: parsed.suggested_memory || null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("analyze-email-edit error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
