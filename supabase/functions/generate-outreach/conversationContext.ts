/**
 * conversationContext.ts — Conversation intelligence and rules for contacts.
 */

type SupabaseClient = ReturnType<typeof (await import("https://esm.sh/@supabase/supabase-js@2.39.3")).createClient>;

export async function loadConversationContextOutreach(
  supabase: SupabaseClient, userId: string, emailAddress: string | null,
): Promise<{ text: string; customPrompt?: string; category?: string }> {
  if (!emailAddress) return { text: "" };

  const [ctxRes, rulesRes, classRes] = await Promise.all([
    supabase.from("contact_conversation_context").select("conversation_summary, last_exchanges, response_rate, avg_response_time_hours, dominant_sentiment")
      .eq("user_id", userId).eq("email_address", emailAddress).maybeSingle(),
    supabase.from("email_address_rules").select("tone_override, topics_to_emphasize, topics_to_avoid, custom_prompt, category, email_prompts(instructions)")
      .eq("user_id", userId).eq("email_address", emailAddress).maybeSingle(),
    supabase.from("email_classifications")
      .select("category, confidence, ai_summary, sentiment")
      .eq("user_id", userId).eq("email_address", emailAddress)
      .order("classified_at", { ascending: false }).limit(3),
  ]);

  const parts: string[] = [];
  const ctx = ctxRes.data;
  const rules = rulesRes.data;
  const classes = classRes.data ?? [];

  // ── PRIORITY: custom_prompt and category injection ──
  // LOVABLE-93: category as decision signal — holding pattern detection + priority modulation
  let customPrompt: string | undefined;
  let category: string | undefined;
  if (rules) {
    if ((rules as Record<string, unknown>).custom_prompt && typeof (rules as Record<string, unknown>).custom_prompt === "string") {
      customPrompt = (rules as Record<string, unknown>).custom_prompt as string;
      parts.push(`ISTRUZIONE PRIORITARIA PER QUESTO INDIRIZZO:\n${customPrompt}`);
    }
    if ((rules as Record<string, unknown>).category && typeof (rules as Record<string, unknown>).category === "string") {
      category = (rules as Record<string, unknown>).category as string;
      const isCat = category.toLowerCase();

      // Detect holding pattern signals
      const isHoldingPattern = isCat.includes("attesa") || isCat.includes("hold") ||
                              isCat.includes("paused") || isCat.includes("on_hold") ||
                              isCat.includes("holding") || isCat.includes("pausa") ||
                              isCat.includes("pending");

      // Detect priority signals
      const isPriority = isCat.includes("priority") || isCat.includes("urgente") ||
                        isCat.includes("vip") || isCat.includes("prioritario");

      if (isHoldingPattern) {
        parts.push(`⚠️ CONTATTO IN CIRCUITO DI ATTESA (da email_address_rules):\nQuesto indirizzo è marcato come "${category}".\nAdatta il tono: cordiale ma non insistente. Non proporre azioni immediate.\nSuggerisci di riprendere il contatto con un pretesto leggero (novità, evento, articolo).`);
      } else if (isPriority) {
        parts.push(`🔴 CONTATTO PRIORITARIO (da email_address_rules):\nQuesto indirizzo è marcato come "${category}".\nDedicare maggiore attenzione alla personalizzazione. Tono diretto e propositivo.`);
      } else {
        parts.push(`CATEGORIA CONTATTO: ${category}`);
      }
    }
  }

  if (ctx) {
    if (ctx.conversation_summary) parts.push(`CONVERSATION HISTORY: ${ctx.conversation_summary}`);
    const exchanges = Array.isArray(ctx.last_exchanges) ? (ctx.last_exchanges as Array<Record<string, unknown>>).slice(-5) : [];
    if (exchanges.length) {
      parts.push(`Last exchanges:\n${exchanges.map((ex: Record<string, unknown>) => `  ${ex.date || "?"} - ${ex.subject || "N/A"} - ${ex.sentiment || "neutral"}`).join("\n")}`);
    }
    parts.push(`RESPONSE PATTERN: Rate ${Math.round(ctx.response_rate ?? 0)}%, avg ${ctx.avg_response_time_hours != null ? `${Math.round(ctx.avg_response_time_hours)}h` : "N/A"}, sentiment: ${ctx.dominant_sentiment || "neutral"}`);
  }

  if (rules) {
    const rp: string[] = [];
    if (rules.tone_override) rp.push(`Tone=${rules.tone_override}`);
    if (rules.topics_to_emphasize?.length) rp.push(`Emphasize=${rules.topics_to_emphasize.join(", ")}`);
    if (rules.topics_to_avoid?.length) rp.push(`Avoid=${rules.topics_to_avoid.join(", ")}`);
    if (rp.length) parts.push(`SENDER RULES: ${rp.join(", ")}`);
    if ((rules as Record<string, unknown>)?.email_prompts && ((rules as Record<string, unknown>).email_prompts as Record<string, unknown>)?.instructions) parts.push(`SENDER PROMPT: ${((rules as Record<string, unknown>).email_prompts as Record<string, unknown>).instructions}`);
  }

  if (classes.length) {
    parts.push(`RECENT CLASSIFICATIONS:\n${classes.map((c: Record<string, unknown>) => `  ${c.category} (${Math.round((c.confidence ?? 0) * 100)}%) - ${c.ai_summary || ""}`).join("\n")}`);
  }

  const text = parts.length ? `\nCONVERSATION INTELLIGENCE:\n${parts.join("\n")}\n` : "";
  return { text, customPrompt, category };
}
