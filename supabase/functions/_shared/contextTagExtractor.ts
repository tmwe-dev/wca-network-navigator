/**
 * contextTagExtractor.ts — Extracts context tags from conversation for KB loading.
 */

export interface ConversationContext {
  scope?: string;
  page?: string;
  partner_country?: string;
  channel?: string;
  email_type?: string;
  partner_id?: string;
  relationship_stage?: string;
  last_user_message?: string;
}

export interface ContextTags {
  tags: string[];
  categories: string[];
  priority_boost: number;
}

const COUNTRY_KEYWORDS: Record<string, string[]> = {
  de: ["germania", "germany", "tedesc", "deutsch"],
  br: ["brasile", "brazil", "brasil"],
  fr: ["francia", "france", "francese"],
  es: ["spagna", "spain", "español"],
  it: ["italia", "italy", "italian"],
  us: ["usa", "stati uniti", "united states", "america"],
  gb: ["uk", "inghilterra", "england", "united kingdom", "british"],
  cn: ["cina", "china", "cinese", "chinese"],
  nl: ["olanda", "netherlands", "dutch"],
  ae: ["emirati", "emirates", "dubai"],
  in: ["india", "indian"],
  tr: ["turchia", "turkey", "turkish"],
  mx: ["messico", "mexico"],
  jp: ["giappone", "japan"],
};

export const STAGE_TAG_MAP: Record<string, string[]> = {
  new:               ["cold_outreach", "first_contact"],
  first_touch_sent:  ["cold_outreach", "followup"],
  holding:           ["holding_pattern", "nurturing", "followup"],
  engaged:           ["relationship_progression", "followup"],
  qualified:         ["negotiation_technique", "closing"],
  negotiation:       ["negotiation_technique", "closing", "proposal"],
  converted:         ["relationship_progression", "upselling"],
  archived:          ["reactivation"],
};

export function extractContextTags(ctx: ConversationContext): ContextTags {
  const tags: string[] = [];
  const categories: string[] = [];
  let priority_boost = 0;

  // Partner country
  if (ctx.partner_country) {
    tags.push(ctx.partner_country.toLowerCase());
    categories.push("country_culture");
    priority_boost += 2;
  }

  // Channel
  if (ctx.channel) {
    tags.push(ctx.channel.toLowerCase());
    categories.push("communication_pattern");
  }

  // Email type
  if (ctx.email_type) {
    tags.push(ctx.email_type.toLowerCase());
  }

  // Commercial state → load relevant doctrine
  if (ctx.relationship_stage) {
    const stage = ctx.relationship_stage.toLowerCase();
    tags.push(stage);
    // Always load commercial doctrine when dealing with a relationship
    if (!categories.includes("system_doctrine")) categories.push("system_doctrine");
    if (!tags.includes("commercial_doctrine")) tags.push("commercial_doctrine");

    // Stage-specific tags for targeted KB loading
    const stageTagMap: Record<string, string[]> = {
      "new": ["cold_outreach", "prospecting"],
      "contacted": ["holding_pattern", "nurturing", "tone_modulation"],
      "first_touch_sent": ["holding_pattern", "nurturing"],
      "holding": ["holding_pattern", "nurturing", "follow_up"],
      "in_progress": ["relationship_progression", "tone_modulation", "trust_building"],
      "engaged": ["relationship_progression", "tone_modulation", "trust_building"],
      "qualified": ["relationship_progression", "closing", "negoziazione"],
      "negotiation": ["closing", "negoziazione", "obiezioni"],
      "converted": ["conversion", "onboarding", "account_management"],
    };
    const extraTags = stageTagMap[stage] || [];
    for (const t of extraTags) if (!tags.includes(t)) tags.push(t);
  }

  // Scope → categories
  if (ctx.scope) {
    const scopeMap: Record<string, string[]> = {
      cockpit: ["operative_procedure"],
      contacts: ["operative_procedure"],
      strategic: ["country_culture", "communication_pattern", "competitive_intelligence"],
      import: ["operative_procedure"],
      extension: ["operative_procedure"],
    };
    if (scopeMap[ctx.scope]) categories.push(...scopeMap[ctx.scope]);
  }

  // Page context
  if (ctx.page) {
    const p = ctx.page.toLowerCase();
    if (p.includes("outreach") || p.includes("email") || p.includes("campaign")) {
      categories.push("communication_pattern");
    }
    if (p.includes("network") || p.includes("partner")) {
      categories.push("competitive_intelligence");
    }
  }

  // Keyword analysis from last user message
  if (ctx.last_user_message) {
    const msg = ctx.last_user_message.toLowerCase();

    if (/\b(email|mail|messaggio)\b/.test(msg)) {
      tags.push("email");
      categories.push("communication_pattern");
    }
    if (/\b(linkedin)\b/.test(msg)) tags.push("linkedin");
    if (/\b(whatsapp)\b/.test(msg)) tags.push("whatsapp");
    if (/\b(follow[\s-]?up)\b/.test(msg)) tags.push("follow_up");
    if (/\b(strategi[ae]|strategy|piano)\b/.test(msg)) {
      categories.push("user_preference", "learning_metric");
    }

    // Country detection from message
    for (const [code, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
      if (keywords.some((kw) => msg.includes(kw))) {
        tags.push(code);
        categories.push("country_culture");
      }
    }
  }

  // Deduplicate
  return {
    tags: [...new Set(tags)],
    categories: [...new Set(categories)],
    priority_boost,
  };
}
