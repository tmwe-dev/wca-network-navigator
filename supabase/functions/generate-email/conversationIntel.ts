/**
 * conversationIntel.ts — Load and format conversation context and intelligence.
 *
 * Handles email address rules, classifications, conversation history formatting.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

export interface ConversationIntelligence {
  convCtx: Record<string, unknown> | null;
  rules: Record<string, unknown> | null;
  classifications: Array<Record<string, unknown>>;
}

export async function loadConversationContext(
  supabase: SupabaseClient,
  userId: string,
  emailAddress: string | null,
  partnerId: string | null,
): Promise<ConversationIntelligence> {
  if (!emailAddress)
    return { convCtx: null, rules: null, classifications: [] };

  const [ctxRes, rulesRes, classRes] = await Promise.all([
    supabase
      .from("contact_conversation_context")
      .select("*")
      .eq("user_id", userId)
      .eq("email_address", emailAddress)
      .maybeSingle(),
    supabase
      .from("email_address_rules")
      .select("*, email_prompts(*)")
      .eq("user_id", userId)
      .eq("email_address", emailAddress)
      .maybeSingle(),
    supabase
      .from("email_classifications")
      .select("category, confidence, ai_summary, sentiment, action_suggested, classified_at")
      .eq("user_id", userId)
      .eq("email_address", emailAddress)
      .order("classified_at", { ascending: false })
      .limit(3),
  ]);

  return {
    convCtx: ctxRes.data ?? null,
    rules: rulesRes.data ?? null,
    classifications: classRes.data ?? [],
  };
}

export function buildPriorityAddressPromptBlock(rules: Record<string, unknown> | null): string {
  if (!rules) return "";

  const parts: string[] = [];

  // custom_prompt is HIGHEST priority
  if (rules.custom_prompt && typeof rules.custom_prompt === "string") {
    parts.push(`ISTRUZIONE PRIORITARIA PER QUESTO INDIRIZZO:\n${rules.custom_prompt}`);
  }

  // LOVABLE-93: category as decision signal — holding pattern detection + priority modulation
  if (rules.category && typeof rules.category === "string") {
    const category = rules.category.toLowerCase();

    // Detect holding pattern signals
    const isHoldingPattern =
      category.includes("attesa") ||
      category.includes("hold") ||
      category.includes("paused") ||
      category.includes("on_hold") ||
      category.includes("holding") ||
      category.includes("pausa") ||
      category.includes("pending");

    // Detect priority signals
    const isPriority =
      category.includes("priority") ||
      category.includes("urgente") ||
      category.includes("vip") ||
      category.includes("prioritario");

    if (isHoldingPattern) {
      parts.push(
        `⚠️ CONTATTO IN CIRCUITO DI ATTESA (da email_address_rules):\nQuesto indirizzo è marcato come "${rules.category}".\nAdatta il tono: cordiale ma non insistente. Non proporre azioni immediate.\nSuggerisci di riprendere il contatto con un pretesto leggero (novità, evento, articolo).`,
      );
    } else if (isPriority) {
      parts.push(
        `🔴 CONTATTO PRIORITARIO (da email_address_rules):\nQuesto indirizzo è marcato come "${rules.category}".\nDedicare maggiore attenzione alla personalizzazione. Tono diretto e propositivo.`,
      );
    } else {
      parts.push(`CATEGORIA CONTATTO: ${rules.category}`);
    }
  }

  return parts.length > 0 ? `\n${parts.join("\n\n")}\n` : "";
}

export function buildConversationBlock(intel: ConversationIntelligence): string {
  const parts: string[] = [];
  const { convCtx, rules, classifications } = intel;

  // ── PRIORITY: custom_prompt and category injection (before conversation history) ──
  if (rules) {
    const priorityBlock = buildPriorityAddressPromptBlock(rules);
    if (priorityBlock) parts.push(priorityBlock);
  }

  if (convCtx) {
    const exchanges = Array.isArray(convCtx.last_exchanges)
      ? (convCtx.last_exchanges as Array<Record<string, unknown>>)
      : [];
    if (convCtx.conversation_summary) {
      parts.push(`CONVERSATION HISTORY: ${convCtx.conversation_summary}`);
    }
    if (exchanges.length) {
      const last5 = exchanges.slice(-5).map(
        (ex: Record<string, unknown>) =>
          `  ${ex.date || "?"} - ${ex.subject || "N/A"} - sentiment: ${ex.sentiment || "neutral"} - ${ex.summary || ""}`,
      );
      parts.push(`Last ${last5.length} exchanges:\n${last5.join("\n")}`);
    }
    parts.push(
      `RESPONSE PATTERN: Response rate ${Math.round((convCtx.response_rate as number | undefined) ?? 0)}%, avg response time ${convCtx.avg_response_time_hours != null ? `${Math.round(convCtx.avg_response_time_hours as number)}h` : "N/A"}, dominant sentiment: ${(convCtx.dominant_sentiment as string | undefined) || "neutral"}`,
    );
  }

  if (rules) {
    const ruleParts: string[] = [];
    if (rules.tone_override) ruleParts.push(`Tone=${rules.tone_override}`);
    if ((rules.topics_to_emphasize as string[] | undefined)?.length)
      ruleParts.push(`Emphasize=${(rules.topics_to_emphasize as string[]).join(", ")}`);
    if ((rules.topics_to_avoid as string[] | undefined)?.length)
      ruleParts.push(`Avoid=${(rules.topics_to_avoid as string[]).join(", ")}`);
    if (ruleParts.length) parts.push(`SENDER RULES: ${ruleParts.join(", ")}`);
    if ((rules.email_prompts as Record<string, unknown> | undefined)?.instructions) {
      parts.push(
        `SENDER PROMPT: ${(rules.email_prompts as Record<string, unknown>).instructions}`,
      );
    }
  }

  if (classifications.length) {
    const classLines = classifications.map(
      (c: Record<string, unknown>) =>
        `  ${c.category} (${Math.round(((c.confidence as number | undefined) ?? 0) * 100)}%) - ${c.ai_summary || "no summary"}`,
    );
    parts.push(`RECENT CLASSIFICATIONS:\n${classLines.join("\n")}`);
  }

  if (!parts.length) return "";
  return `\nCONVERSATION INTELLIGENCE:\n${parts.join("\n")}\n`;
}
