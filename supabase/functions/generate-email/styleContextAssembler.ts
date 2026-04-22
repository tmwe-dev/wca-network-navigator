/**
 * styleContextAssembler.ts — Assemble style preferences, edit patterns, and response insights
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { PartnerData } from "./promptBuilder.ts";

type SupabaseClient = ReturnType<typeof createClient>;

interface StyleMemoryRow {
  content: string;
  confidence: number;
  access_count: number;
}

export interface StyleContext {
  stylePreferencesContext: string;
  editPatternsContext: string;
  responseInsightsContext: string;
}

/**
 * Load style preferences from ai_memory table.
 */
async function loadStylePreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: styleMemories } = await supabase
    .from("ai_memory")
    .select("content, confidence, access_count")
    .eq("user_id", userId)
    .contains("tags", ["style_preference"])
    .gte("confidence", 30)
    .order("access_count", { ascending: false })
    .limit(5);

  if (!styleMemories?.length) return "";

  return `\nPREFERENZE DI STILE APPRESE (dall'editing dell'utente):\n${(styleMemories as StyleMemoryRow[])
    .map((m) => `- ${m.content}`)
    .join("\n")}\nAPPLICA queste preferenze nella generazione.\n`;
}

/**
 * Load user edit patterns (modifications to generated emails).
 */
async function loadEditPatterns(
  supabase: SupabaseClient,
  userId: string,
  partner: PartnerData,
  emailCategory: string | null,
): Promise<string> {
  const countryFilter = partner.country_code || null;

  let epQuery = supabase
    .from("ai_edit_patterns")
    .select(
      "email_type, country_code, hook_original, hook_final, cta_original, cta_final, tone_delta, formality_shift, length_delta_percent",
    )
    .eq("user_id", userId)
    .in("significance", ["medium", "high"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (countryFilter) epQuery = epQuery.eq("country_code", countryFilter);
  if (emailCategory) epQuery = epQuery.eq("email_type", emailCategory);

  let { data: editPatterns } = await epQuery;

  // Fallback if no country/category-specific patterns found
  if (!editPatterns?.length && (countryFilter || emailCategory)) {
    const { data: fallback } = await supabase
      .from("ai_edit_patterns")
      .select(
        "email_type, country_code, hook_original, hook_final, cta_original, cta_final, tone_delta, formality_shift, length_delta_percent",
      )
      .eq("user_id", userId)
      .in("significance", ["medium", "high"])
      .order("created_at", { ascending: false })
      .limit(10);
    editPatterns = fallback;
  }

  if (!editPatterns?.length) return "";

  const lines = editPatterns.map(
    (ep: Record<string, unknown>) =>
      `- ${ep.email_type || "generico"} verso ${ep.country_code || "??"}: Hook cambiato da '${((ep.hook_original || "") as string).slice(0, 60)}' a '${((ep.hook_final || "") as string).slice(0, 60)}', CTA da '${((ep.cta_original || "") as string).slice(0, 60)}' a '${((ep.cta_final || "") as string).slice(0, 60)}', tono: ${ep.tone_delta || "invariato"}, formalità: ${ep.formality_shift || "invariata"}, lunghezza: ${ep.length_delta_percent || 0}%`,
  );

  return `\nPATTERN DI EDITING DELL'UTENTE (modifiche precedenti alle email generate):\n${lines.join(
    "\n",
  )}\nADATTA lo stile in base a questi pattern.\n`;
}

/**
 * Load response patterns (historical email response data).
 */
async function loadResponsePatterns(
  supabase: SupabaseClient,
  userId: string,
  partner: PartnerData,
): Promise<string> {
  let rpQuery = supabase
    .from("response_patterns")
    .select(
      "country_code, channel, email_type, total_sent, total_responses, response_rate, avg_response_time_hours, pattern_confidence",
    )
    .eq("user_id", userId)
    .gte("pattern_confidence", 0.5)
    .gte("total_sent", 3)
    .order("pattern_confidence", { ascending: false })
    .limit(5);

  if (partner.country_code) rpQuery = rpQuery.eq("country_code", partner.country_code);

  const { data: responsePatterns } = await rpQuery;

  if (!responsePatterns?.length) return "";

  const lines = responsePatterns.map(
    (rp: Record<string, unknown>) =>
      `- ${rp.country_code || "Global"} ${rp.channel} ${rp.email_type || "generico"}: ${rp.total_responses}/${rp.total_sent} risposte (${Math.round(Number(rp.response_rate))}%), tempo medio: ${rp.avg_response_time_hours != null ? `${rp.avg_response_time_hours}h` : "N/A"}`,
  );

  return `\nINSIGHT DALLE RISPOSTE RICEVUTE (dati reali):\n${lines.join("\n")}\n`;
}

/**
 * Assemble all style-related context (preferences, edit patterns, response insights).
 */
export async function assembleStyleContext(
  supabase: SupabaseClient,
  userId: string,
  partner: PartnerData,
  emailCategory: string | null,
): Promise<StyleContext> {
  const [stylePreferencesContext, editPatternsContext, responseInsightsContext] = await Promise.all(
    [
      loadStylePreferences(supabase, userId),
      loadEditPatterns(supabase, userId, partner, emailCategory),
      loadResponsePatterns(supabase, userId, partner),
    ],
  );

  return {
    stylePreferencesContext,
    editPatternsContext,
    responseInsightsContext,
  };
}
