// Classification prompts and rules

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
  parts.push(`Subject: ${req.subject}`);
  parts.push(`Body:\n${req.body.substring(0, 4000)}`);

  // LOVABLE-93: Domain detection hints and rules
  parts.push(`\n## DOMAIN DETECTION RULES (Livello 1)
Classify email domain FIRST before category classification:
- "operative": richieste preventivo, booking, tracking spedizioni, documentazione, tariffe, stato merce, ordini
- "administrative": fatture, pagamenti, solleciti, note di credito, estratti conto, verifiche contabili, ricevute
- "support": reclami, richieste assistenza, problemi tecnici, feedback servizio, errori sistema
- "internal": newsletter, notifiche sistema, comunicazioni interne, auto-reply di sistema, digest automati
- "commercial": tutto ciò che riguarda prospect, lead, partnership, collaborazione nuova, follow-up commerciali

If email_address has manual domain_type set (from email_address_rules), RESPECT that as primary signal.`);

  // Output format
  parts.push(`\n## Required Output`);
  parts.push(`Respond with a JSON object (no markdown, no code fences):
{
  "domain": "commercial|operative|administrative|support|internal",
  "category": "interested|not_interested|request_info|question|meeting_request|complaint|follow_up|auto_reply|unsubscribe|bounce|spam|uncategorized|quote_request|booking_request|shipment_tracking|documentation_request|rate_inquiry|cargo_status|invoice_query|payment_request|payment_confirmation|credit_note|account_statement|service_inquiry|technical_issue|feedback|newsletter|system_notification|internal_communication",
  "confidence": 0.0-1.0,
  "ai_summary": "one-sentence summary of the email content and intent. If the email is NOT in Italian, provide an Italian translation summary here.",
  "keywords": ["keyword1", "keyword2"],
  "urgency": "critical|high|normal|low",
  "sentiment": "positive|negative|neutral|mixed",
  "detected_patterns": ["pattern1"],
  "action_suggested": "brief description of recommended next action",
  "reasoning": "brief explanation of classification reasoning",
  "detected_language": "detected language of the email (e.g. English, Deutsch, Français, Italiano)"
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
