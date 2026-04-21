// === EmailContract — Contratto Unico per tutte le operazioni email (LOVABLE-81) ===
// Ogni motore che genera, migliora o invia email DEVE costruire e validare questo
// contratto prima di operare. Garantisce che generate-email, improve-email e
// agent-execute parlino la STESSA lingua e abbiano lo STESSO contesto strutturato.
//
// Il contratto NON sostituisce il contextAssembler: lo ALIMENTA, fornendogli un
// input normalizzato e validato. Eventuali campi mancanti producono errori espliciti
// (422) invece di output silenziosamente generici.

/* eslint-disable @typescript-eslint/no-explicit-any */

/** I 9 stati canonici del lead (deve coincidere con src/constants/holdingPattern.ts) */
export const VALID_LEAD_STATUSES = [
  "new",
  "first_touch_sent",
  "holding",
  "engaged",
  "qualified",
  "negotiation",
  "converted",
  "archived",
  "blacklisted",
] as const;

export type LeadStatus = typeof VALID_LEAD_STATUSES[number];

/** Input strutturato per qualsiasi operazione email */
export interface EmailContract {
  // === IDENTITÀ OPERAZIONE ===
  engine: "generate-email" | "improve-email" | "agent-execute" | "command";
  operation: "generate" | "improve" | "review";

  // === DESTINATARIO ===
  recipient: {
    partner_id: string | null;
    partner_name: string;
    lead_status: string;
    country?: string | null;
    contact_id?: string | null;
    contact_name?: string | null;
    contact_role?: string | null;
    contact_email: string;
  };

  // === TIPO EMAIL ===
  email_type: {
    selected_type: string;
    user_description: string;
    objective?: string;
  };

  // === CONTESTO RELAZIONALE ===
  relationship: {
    touch_count: number;
    last_channel?: "email" | "whatsapp" | "linkedin" | string;
    days_since_last_outbound?: number;
    days_since_last_inbound?: number;
    last_inbound_category?: string;
    conversation_summary?: string;
    has_replied: boolean;
  };

  // === ENRICHMENT ===
  enrichment: {
    available_levels: ("base" | "deep_search" | "sherlock")[];
    formatted_summary?: string;
    last_enriched_at?: string;
  };

  // === KB + MEMORY ===
  knowledge: {
    kb_sections_loaded: string[];
    active_playbook?: string;
    playbook_step?: number;
    memories_loaded: number;
    memory_summary?: string;
  };

  // === STILE ===
  style?: {
    language: string;
    tone?: string;
    length_target?: "short" | "medium" | "long";
    learned_patterns?: string;
  };

  // === Per IMPROVE ===
  existing_draft?: {
    subject?: string;
    body: string;
    improvement_instructions?: string;
  };

  // === VINCOLI ===
  constraints?: string[];
}

/** Output strutturato di qualsiasi operazione email */
export interface EmailContractOutput {
  subject: string;
  body: string;
  engine: string;
  contract_used: boolean;
  context_loaded: {
    kb_sections: string[];
    enrichment_levels: string[];
    memories: number;
    history_available: boolean;
    playbook_active: boolean;
  };
  contract_warnings: string[];
}

export interface ContractValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valida un EmailContract. DEVE essere chiamata prima di ogni operazione email.
 * - errors: bloccanti, l'operazione NON deve procedere (return 422)
 * - warnings: soft, l'operazione procede ma traccia le mancanze
 */
export function validateEmailContract(contract: EmailContract): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Destinatario
  if (!contract.recipient.partner_id && !contract.recipient.contact_email) {
    errors.push("partner_id o contact_email obbligatori");
  }
  if (!contract.recipient.lead_status) {
    errors.push("lead_status mancante");
  } else if (!VALID_LEAD_STATUSES.includes(contract.recipient.lead_status as LeadStatus)) {
    errors.push(
      `lead_status "${contract.recipient.lead_status}" non valido. Validi: ${VALID_LEAD_STATUSES.join(", ")}`,
    );
  }

  // Blacklist gate (assoluto)
  if (contract.recipient.lead_status === "blacklisted") {
    errors.push("BLOCCATO: partner blacklisted, nessuna email permessa");
  }

  // Tipo email
  if (!contract.email_type.selected_type) {
    errors.push("email_type.selected_type mancante");
  }
  if (!contract.email_type.user_description) {
    warnings.push("user_description vuota — il detector tipo/descrizione non può operare");
  }

  // Relazione
  if (typeof contract.relationship.touch_count !== "number") {
    warnings.push("touch_count non disponibile — coerenza tipo/history non verificabile");
  }

  // Enrichment
  if (contract.enrichment.available_levels.length === 0) {
    warnings.push("Nessun enrichment disponibile — la mail sarà generica");
  }

  // KB
  if (contract.knowledge.kb_sections_loaded.length === 0) {
    warnings.push("Nessuna sezione KB caricata — dottrina non applicabile");
  }

  // Improve senza draft
  if (contract.operation === "improve" && !contract.existing_draft?.body) {
    errors.push("Operazione improve richiede existing_draft.body");
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Costruisce un EmailContract da dati grezzi.
 * Usato dai 3 motori (generate, improve, agent-execute) per normalizzare l'input.
 * Carica partner, contatto, history, enrichment e settings di stile.
 * Ritorna SEMPRE un contratto (anche con campi vuoti) + i warning di build.
 */
export async function buildEmailContract(
  supabase: any,
  userId: string,
  params: {
    engine: EmailContract["engine"];
    operation: EmailContract["operation"];
    partnerId: string | null;
    contactId?: string | null;
    emailType: string;
    emailDescription: string;
    objective?: string;
    existingDraft?: { subject?: string; body: string; instructions?: string };
    constraints?: string[];
    language?: string;
    fallbackPartnerName?: string;
    fallbackContactEmail?: string;
  },
): Promise<{ contract: EmailContract; build_warnings: string[] }> {
  const buildWarnings: string[] = [];

  // Partner
  let partner: Record<string, any> | null = null;
  if (params.partnerId) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name, company_alias, lead_status, country_name, country_code, enrichment_data")
      .eq("id", params.partnerId)
      .maybeSingle();
    partner = data || null;
    if (!partner) buildWarnings.push(`Partner ${params.partnerId} non trovato`);
  }

  // Contatto
  let contact: Record<string, any> | null = null;
  if (params.contactId) {
    const { data } = await supabase
      .from("partner_contacts")
      .select("id, name, contact_alias, title, email")
      .eq("id", params.contactId)
      .maybeSingle();
    contact = data || null;
    if (!contact) buildWarnings.push(`Contatto ${params.contactId} non trovato`);
  }

  // History (channel_messages)
  let messages: Array<{ direction: string; channel?: string; created_at: string; category?: string | null }> = [];
  let touchCount = 0;
  if (params.partnerId) {
    const { data, count } = await supabase
      .from("channel_messages")
      .select("direction, channel, created_at, category", { count: "exact" })
      .eq("partner_id", params.partnerId)
      .order("created_at", { ascending: false })
      .limit(20);
    messages = (data as typeof messages) || [];
    touchCount = count || messages.length;
  }

  const outbound = messages.filter((m) => m.direction === "outbound");
  const inbound = messages.filter((m) => m.direction === "inbound");
  const lastOutbound = outbound[0];
  const lastInbound = inbound[0];
  const daysSince = (date?: string) =>
    date ? Math.floor((Date.now() - new Date(date).getTime()) / 86400000) : undefined;

  let conversationSummary: string | undefined;
  if (messages.length > 0) {
    const lastOutDays = daysSince(lastOutbound?.created_at);
    const lastInDays = daysSince(lastInbound?.created_at);
    conversationSummary = `${touchCount} messaggi totali. Ultimo outbound: ${lastOutbound?.channel || "—"}${
      lastOutDays != null ? ` ${lastOutDays}gg fa` : ""
    }. Ultimo inbound: ${lastInbound?.channel || "—"}${lastInDays != null ? ` ${lastInDays}gg fa` : ""}.`;
  }

  // Enrichment levels
  const enrichmentData = (partner?.enrichment_data as Record<string, any> | null) || {};
  const levels: ("base" | "deep_search" | "sherlock")[] = [];
  if (enrichmentData.linkedin_url || enrichmentData.website_excerpt || enrichmentData.website_url) levels.push("base");
  if (enrichmentData.contact_profiles || enrichmentData.reputation || enrichmentData.deep_search_at) {
    levels.push("deep_search");
  }
  if (params.partnerId) {
    try {
      const { count: sherlockCount } = await supabase
        .from("sherlock_investigations")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", params.partnerId)
        .eq("status", "completed");
      if (sherlockCount && sherlockCount > 0) levels.push("sherlock");
    } catch {
      // Tabella opzionale; ignora se mancante
    }
  }

  // Memorie
  let memoryCount = 0;
  try {
    const { count } = await supabase
      .from("ai_memory")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    memoryCount = count || 0;
  } catch {
    // tabella opzionale
  }

  // Settings stile
  let toneSetting: string | undefined;
  let langSetting: string | undefined;
  try {
    const { data: styleSettings } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", userId)
      .in("key", ["ai_tone", "ai_language"]);
    const map = new Map(((styleSettings || []) as Array<{ key: string; value: string }>).map((s) => [s.key, s.value]));
    toneSetting = map.get("ai_tone") || undefined;
    langSetting = map.get("ai_language") || undefined;
  } catch {
    // ignora
  }

  const contactEmail = contact?.email || params.fallbackContactEmail || "";

  const contract: EmailContract = {
    engine: params.engine,
    operation: params.operation,
    recipient: {
      partner_id: partner?.id || params.partnerId || null,
      partner_name: partner?.company_alias || partner?.company_name || params.fallbackPartnerName || "",
      lead_status: (partner?.lead_status as string) || "new",
      country: partner?.country_name || partner?.country_code || null,
      contact_id: contact?.id || params.contactId || null,
      contact_name: contact?.contact_alias || contact?.name || null,
      contact_role: contact?.title || null,
      contact_email: contactEmail,
    },
    email_type: {
      selected_type: params.emailType,
      user_description: params.emailDescription || "",
      objective: params.objective,
    },
    relationship: {
      touch_count: touchCount,
      last_channel: lastOutbound?.channel,
      days_since_last_outbound: daysSince(lastOutbound?.created_at),
      days_since_last_inbound: daysSince(lastInbound?.created_at),
      last_inbound_category: lastInbound?.category || undefined,
      conversation_summary: conversationSummary,
      has_replied: inbound.length > 0,
    },
    enrichment: {
      available_levels: levels,
      formatted_summary: undefined,
      last_enriched_at: enrichmentData.deep_search_at || enrichmentData._enriched_at,
    },
    knowledge: {
      kb_sections_loaded: [],
      active_playbook: undefined,
      playbook_step: undefined,
      memories_loaded: memoryCount,
      memory_summary: undefined,
    },
    style: {
      language: params.language || langSetting || "italiano",
      tone: toneSetting,
    },
    existing_draft: params.existingDraft
      ? {
          subject: params.existingDraft.subject,
          body: params.existingDraft.body,
          improvement_instructions: params.existingDraft.instructions,
        }
      : undefined,
    constraints: params.constraints,
  };

  return { contract, build_warnings: buildWarnings };
}

// ============================================================================
// === ResolvedEmailType (LOVABLE-82) — esportato da qui per coerenza =========
// ============================================================================

export interface ResolvedEmailType {
  original_type: string;
  resolved_type: string;
  was_overridden: boolean;
  confidence: number;
  reasoning: string;
  conflicts: TypeConflict[];
  proceed: boolean;
}

export interface TypeConflict {
  type:
    | "type_history_mismatch"
    | "type_status_mismatch"
    | "description_type_mismatch"
    | "status_channel_mismatch"
    | "duplicate_recent"
    | "phase_skip";
  description: string;
  severity: "info" | "warning" | "blocking";
  suggestion: string;
}