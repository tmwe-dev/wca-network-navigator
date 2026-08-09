import "../_shared/llmFetchInterceptor.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { aiChat, mapErrorToResponse } from "../_shared/aiGateway.ts";
import { requireAuth } from "../_shared/authGuard.ts";
import { createLogger } from "../_shared/structuredLogger.ts";
import { edgeErrorWithStatus } from "../_shared/handleEdgeError.ts";

const log = createLogger("analyze-email-edit");

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
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // Auth — guard condiviso (terse: AUTH_REQUIRED / AUTH_INVALID)
    const auth = await requireAuth(req, dynCors, { errorFormat: "terse" });
    if (auth instanceof Response) return auth;
    const userId = auth.userId;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // LOVABLE-93: global pause check
    const { data: pauseSettings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_automations_paused")
      .eq("user_id", userId)
      .maybeSingle();

    if (pauseSettings?.value === "true") {
      return edgeErrorWithStatus("INTERNAL_ERROR", "AI automations are paused", 503, { ...dynCors, "Content-Type": "application/json" });
    }

    const { original_html, edited_html, recipient_country, email_type } = await req.json();
    if (!original_html || !edited_html) {
      return edgeErrorWithStatus("VALIDATION_ERROR", "original_html and edited_html required", 400, { ...dynCors, "Content-Type": "application/json" });
    }

    const originalText = stripHtml(original_html);
    const editedText = stripHtml(edited_html);

    // Quick heuristic: if texts are nearly identical, skip AI call
    const lengthChangePct =
      originalText.length > 0 ? Math.round(((editedText.length - originalText.length) / originalText.length) * 100) : 0;

    if (Math.abs(lengthChangePct) < 10 && originalText.length > 0) {
      // Check word-level similarity
      const origWords = originalText.split(/\s+/).length;
      const editWords = editedText.split(/\s+/).length;
      const wordDiff = Math.abs(origWords - editWords);
      if (wordDiff < 5) {
        return new Response(
          JSON.stringify({
            significance: "low",
            length_change_pct: lengthChangePct,
            tone_shift: null,
            structural_changes: [],
            suggested_memory: null,
          }),
          { headers: { ...dynCors, "Content-Type": "application/json" } },
        );
      }
    }

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

    const result = await aiChat({
      models: ["google/gemini-2.5-flash-lite", "openai/gpt-5-mini"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 300,
      timeoutMs: 15000,
      maxRetries: 1,
      context: "analyze-email-edit",
    });
    const content = result.content || "";

    // Parse JSON from AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({
          significance: "low",
          length_change_pct: lengthChangePct,
          tone_shift: null,
          structural_changes: [],
          suggested_memory: null,
        }),
        { headers: { ...dynCors, "Content-Type": "application/json" } },
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({
        significance: parsed.significance || "low",
        length_change_pct: lengthChangePct,
        tone_shift: parsed.tone_shift || null,
        structural_changes: Array.isArray(parsed.structural_changes) ? parsed.structural_changes : [],
        suggested_memory: parsed.suggested_memory || null,
      }),
      { headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    log.error("analyze-email-edit error:", e);
    return mapErrorToResponse(e, dynCors);
  }
});
