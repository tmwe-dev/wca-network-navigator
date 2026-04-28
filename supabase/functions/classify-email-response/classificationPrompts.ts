// Classification prompts and rules

import { normalizeContent } from "../_shared/contentNormalizer.ts";
import { safeWrap } from "../_shared/promptSanitizer.ts";

export interface ConversationExchange {
  date: string;
  subject: string;
  summary: string;
  direction: string;
  sentiment: string;
}

export function buildClassificationPrompt(
  req: { direction: string; email_address: string; subject: string; body: string },
  conversationCtx: ConversationExchange[] | null,
  conversationSummary: string | null,
  rules: Record<string, unknown> | null,
  promptInstructions: string | null,
  relationalContext?: { lead_status?: string; touchCount?: number; daysSinceLastContact?: number } | null
): string {
  const parts: string[] = [];

  // PRIORITY: custom_prompt injection
  if (rules && rules.custom_prompt && typeof rules.custom_prompt === "string") {
    parts.push(`## ⚠️ ISTRUZIONE PRIORITARIA PER QUESTO INDIRIZZO\n${rules.custom_prompt}`);
  }

  // LOVABLE-93: Domain type hint
  if (rules && rules.domain_type && typeof rules.domain_type === "string") {
    parts.push(`## DOMINIO PREDEFINITO\nQuesto indirizzo è stato manualmente categorizzato come: "${rules.domain_type}"\nUsare questa informazione come segnale primario di classificazione.`);
  }

  // LOVABLE-93: relational context
  if (relationalContext) {
    const relCtx: string[] = ["## STATO RELAZIONALE"];
    relCtx.push(`Fase: ${relationalContext.lead_status || "sconosciuto"}`);
    if (relationalContext.touchCount !== undefined) {
      relCtx.push(`Touch totali: ${relationalContext.touchCount}`);
    }
    if (relationalContext.daysSinceLastContact !== undefined) {
      relCtx.push(`Giorni dall'ultimo contatto: ${relationalContext.daysSinceLastContact}`);
    }
    parts.push(relCtx.join("\n"));
  }

  // Context block
  if (conversationCtx?.length) {
    parts.push("## Conversation History (last exchanges)");
    for (const ex of conversationCtx.slice(-5)) {
      parts.push(`- [${ex.date}] ${ex.direction}: "${ex.subject}" — ${ex.summary} (sentiment: ${ex.sentiment})`);
    }
  }

  if (conversationSummary) {
    parts.push(`\n## Conversation Summary\n${conversationSummary}`);
  }

  if (rules) {
    const ruleDetails: string[] = [];
    if (rules.category) ruleDetails.push(`Category: ${rules.category}`);
    if (rules.tone_override) ruleDetails.push(`Preferred tone: ${rules.tone_override}`);
    if (Array.isArray(rules.topics_to_emphasize) && rules.topics_to_emphasize.length) {
      ruleDetails.push(`Topics to emphasize: ${(rules.topics_to_emphasize as string[]).join(", ")}`);
    }
    if (Array.isArray(rules.topics_to_avoid) && rules.topics_to_avoid.length) {
      ruleDetails.push(`Topics to avoid: ${(rules.topics_to_avoid as string[]).join(", ")}`);
    }
    if (ruleDetails.length) {
      parts.push(`\n## Sender Rules\n${ruleDetails.join("\n")}`);
    }
  }

  if (promptInstructions) {
    parts.push(`\n## Custom Instructions\n${promptInstructions}`);
  }

  // Email content
  parts.push(`\n## Email to Classify`);
  parts.push(`Direction: ${req.direction}`);
  parts.push(`From: ${req.email_address}`);
  // Normalize+sanitize+wrap email content prima di iniettarlo nel prompt:
  // - rimuove HTML, quoted-replies, firme, disclaimer, zero-width chars
  // - applica anti-injection redact
  // - avvolge in fence non-trusted (modello tratta come dati, non istruzioni)
  const subjNorm = normalizeContent(req.subject || "", { source: "email-inbound", maxChars: 300 }).text;
  const bodyNorm = normalizeContent(req.body || "", { source: "email-inbound", maxChars: 4000 });
  const { block: bodyBlock } = safeWrap(bodyNorm.text, "EMAIL BODY", {
    source: "email-inbound",
    policy: "redact",
  });
  parts.push(`Subject: ${subjNorm}`);
  parts.push(`Body:\n${bodyBlock}`);

  // Output contract — generato dinamicamente dai VALID_* per non duplicare
  // l'enum a mano ad ogni cambio. Le regole semantiche di dominio/categoria
  // sono iniettate dal Prompt Lab (operative_prompts) via operativePromptsLoader.
  parts.push(`\n## Required Output (JSON, no markdown)`);
  parts.push(`{
  "domain": "${VALID_DOMAINS.join("|")}",
  "category": "${VALID_CATEGORIES.join("|")}",
  "confidence": 0.0-1.0,
  "ai_summary": "one-sentence summary in Italian",
  "keywords": ["..."],
  "urgency": "${VALID_URGENCY.join("|")}",
  "sentiment": "${VALID_SENTIMENT.join("|")}",
  "detected_patterns": ["..."],
  "action_suggested": "brief next action",
  "reasoning": "brief explanation",
  "detected_language": "language of the email"
}`);

  return parts.join("\n");
}

export const VALID_DOMAINS = ["commercial", "operative", "administrative", "support", "internal"];
export const VALID_CATEGORIES = [
  "interested", "not_interested", "request_info", "question", "meeting_request", "complaint", "follow_up", "auto_reply", "unsubscribe", "bounce", "spam", "uncategorized",
  "quote_request", "booking_request", "shipment_tracking", "documentation_request", "rate_inquiry", "cargo_status",
  "invoice_query", "payment_request", "payment_confirmation", "credit_note", "account_statement",
  "service_inquiry", "technical_issue", "feedback",
  "newsletter", "system_notification", "internal_communication",
];
export const VALID_URGENCY = ["critical", "high", "normal", "low"];
export const VALID_SENTIMENT = ["positive", "negative", "neutral", "mixed"];
