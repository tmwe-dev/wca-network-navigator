/**
 * contextAssembly.ts
 * Loads, assembles, and prioritizes context blocks for the system prompt.
 * Handles user profiles, knowledge base, commercial state, and token budgets.
 */

import { extractErrorMessage } from "../_shared/handleEdgeError.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import { getContextBudget, assembleContext, estimateTokens } from "../_shared/tokenBudget.ts";
import {
  loadUserProfile,
  loadMissionHistory,
  loadKBContext,
  loadOperativePrompts,
  loadMemoryContext,
  loadSystemDoctrine,
  loadRecentEmailContext,
} from "./contextLoader.ts";
import { extractContextTags, type ConversationContext } from "../_shared/contextTagExtractor.ts";

export interface ContextAssemblyResult {
  systemPrompt: string;
  budgetStats: {
    totalTokens: number;
    included: string[];
    truncated: string[];
    dropped: string[];
  };
}

/**
 * Load active workflow information if partner ID is available
 */
async function loadActiveWorkflow(
  supabase: SupabaseClient,
  partnerId: string | undefined
): Promise<string> {
  if (!partnerId || typeof partnerId !== "string") return "";

  try {
    const { data: ws } = await supabase
      .from("partner_workflow_state")
      .select("current_gate, status, started_at, commercial_workflows(name, gates)")
      .eq("partner_id", partnerId)
      .eq("status", "active")
      .maybeSingle();

    if (!ws) return "";

    const wf = (ws as Record<string, unknown>).commercial_workflows as
      | Record<string, unknown>
      | undefined;
    if (!wf) return "";

    const gates = Array.isArray(wf.gates) ? wf.gates : [];
    const cur = (gates[(ws as Record<string, unknown>).current_gate as number] || {}) as Record<string, unknown>;
    return `Workflow: ${wf.name}\nGate corrente: ${(ws as Record<string, unknown>).current_gate} — ${cur.name || "(senza nome)"}\nObiettivo gate: ${cur.objective || "(non definito)"}\nExit criteria:\n${(Array.isArray(cur.exit_criteria) ? (cur.exit_criteria as string[]).map((c: string) => "  • " + c).join("\n") : "  • (non definiti)")}\nIniziato: ${(ws as Record<string, unknown>).started_at}`;
  } catch (e: unknown) {
    console.warn("Workflow state load failed:", extractErrorMessage(e));
    return "";
  }
}

/**
 * Load commercial partner state (holding pattern awareness)
 */
async function loadHoldingState(
  supabase: SupabaseClient,
  partnerId: string | undefined
): Promise<string> {
  if (!partnerId) return "";

  try {
    const { data: partnerState } = await supabase
      .from("partners")
      .select("lead_status, last_interaction_at, interaction_count, company_name")
      .eq("id", partnerId)
      .maybeSingle();

    if (!partnerState) return "";

    const daysInHolding = partnerState.last_interaction_at
      ? Math.floor(
          (Date.now() - new Date(partnerState.last_interaction_at).getTime()) /
            86400000
        )
      : 0;

    const lines = [
      `STATO COMMERCIALE PARTNER: ${(partnerState.lead_status || "new").toUpperCase()}`,
      partnerState.company_name
        ? `Azienda: ${partnerState.company_name}`
        : null,
      `Interazioni totali: ${partnerState.interaction_count || 0}`,
      partnerState.last_interaction_at
        ? `Giorni dall'ultimo contatto: ${daysInHolding}`
        : "Mai contattato",
      daysInHolding > 90
        ? `🔴 CRITICO: Holding da ${daysInHolding} giorni — review obbligatoria (riattivazione Voss o archiviazione motivata)`
        : null,
      daysInHolding > 30 && daysInHolding <= 90
        ? `⚠️ ATTENZIONE: Contatto stagnante da ${daysInHolding} giorni — valutare riattivazione`
        : null,
    ].filter(Boolean);

    return `--- STATO COMMERCIALE (HOLDING PATTERN) ---\n${lines.join("\n")}\n`;
  } catch (e) {
    console.warn("[ai-assistant] holding state fetch failed:", e);
    return "";
  }
}

/**
 * Load all context in parallel, with different sets for conversational vs operational modes
 */
async function loadContextParallel(
  supabase: SupabaseClient,
  userId: string,
  isConversational: boolean,
  lastUserMsg: string | undefined,
  ctxTags: any
): Promise<{
  memoryContext: string;
  userProfile: string;
  kbContext: string;
  opPrompts: string;
  missionHistory: string;
  doctrineContext: string;
  emailContext: string;
}> {
  if (isConversational) {
    // Lightweight context for voice mode
    const [memoryContext, userProfile, kbContext, doctrineContext, emailContext] = await Promise.all([
      loadMemoryContext(supabase, userId, lastUserMsg),
      loadUserProfile(supabase, userId),
      loadKBContext(supabase, lastUserMsg, userId, ctxTags),
      loadSystemDoctrine(supabase),
      loadRecentEmailContext(supabase, userId, lastUserMsg),
    ]);
    return {
      memoryContext,
      userProfile,
      kbContext,
      opPrompts: "",
      missionHistory: "",
      doctrineContext,
      emailContext,
    };
  } else {
    // Full context for operational mode
    const [memoryContext, userProfile, kbContext, opPrompts, missionHistory, doctrineContext, emailContext] = await Promise.all([
      loadMemoryContext(supabase, userId, lastUserMsg),
      loadUserProfile(supabase, userId),
      loadKBContext(supabase, lastUserMsg, userId, ctxTags),
      loadOperativePrompts(supabase, userId),
      loadMissionHistory(supabase, userId),
      loadSystemDoctrine(supabase),
      loadRecentEmailContext(supabase, userId, lastUserMsg),
    ]);
    return {
      memoryContext,
      userProfile,
      kbContext,
      opPrompts,
      missionHistory,
      doctrineContext,
      emailContext,
    };
  }
}

/**
 * Inject page/selection context into system prompt
 */
function injectPageContext(systemPrompt: string, context: Record<string, unknown>): string {
  let prompt = systemPrompt;
  prompt += "\n\nCONTESTO CORRENTE DELL'UTENTE:";

  if (context.currentPage) prompt += `\nPagina attiva: ${context.currentPage}`;

  if (context.source === "partner_hub") {
    prompt += `\nL'utente è nella Rubrica Partner.`;
    if (context.viewLevel) prompt += ` Vista: ${context.viewLevel}.`;
    if (context.selectedCountry) prompt += ` Paese selezionato: ${context.selectedCountry}.`;
    if (context.totalPartners !== undefined) prompt += ` Partner visibili: ${context.totalPartners}.`;
    if (context.selectedCount) prompt += ` Partner selezionati: ${context.selectedCount}.`;
  }

  const selCountries = context.selectedCountries as Array<Record<string, unknown>> | undefined;
  if (selCountries?.length) {
    prompt += `\nPaesi selezionati: ${selCountries.map((c) => `${c.name} (${c.code})`).join(", ")}.`;
  }

  if (
    context.filterMode &&
    context.filterMode !== "all" &&
    !(String(context.filterMode).startsWith("/"))
  ) {
    const filterLabels: Record<string, string> = {
      todo: "paesi con dati da verificare",
      no_profile: "paesi con descrizione profilo mancante (sync incompleto)",
      missing: "paesi mai esplorati",
    };
    prompt += `\nFiltro attivo: ${filterLabels[String(context.filterMode)] || context.filterMode}.`;
  }

  // Mission builder mode
  if (context.currentPage === "/mission-builder") {
    prompt += `\n\nMODALITÀ MISSION BUILDER — ISTRUZIONI SPECIALI:\nSei in modalità creazione missione. Il tuo ruolo è guidare l'utente passo dopo passo nella configurazione di una campagna di outreach. NON mostrare tutto subito — fai UNA domanda alla volta.\n\nFLUSSO CONVERSAZIONALE:\n1. Chiedi COSA vuole fare (email, WhatsApp, LinkedIn, deep search, contatto ex-clienti, etc.)\n2. Chiedi CHI contattare — usa i dati reali del database. Se l'utente dice un paese/regione, cerca i numeri reali.\n3. Quando devi far selezionare i paesi, includi nel messaggio: [WIDGET:country_select]\n4. Quando devi far scegliere il canale, includi: [WIDGET:channel_select]\n5. Per regolare i batch per paese: [WIDGET:slider_batch]\n6. Per opzioni deep search: [WIDGET:toggle_group]\n7. Per il riepilogo finale con lancio: [WIDGET:confirm_summary]\n\nIMPORTANTE:\n- NON assumere che sia sempre per-paese. Potrebbe essere per tipo azienda, rating, ex-clienti, biglietti da visita.\n- Usa i dati reali: interroga il database per dare numeri precisi.\n- Rispondi in modo SINTETICO — massimo 2-3 frasi + il widget. La voce leggerà solo le prime 2 frasi.\n- Conferma ogni scelta prima di procedere al passo successivo.\n- Se l'utente fornisce più info in una volta, elaborale tutte e proponi il widget appropriato.\n\nDATI DISPONIBILI:`;
    if ((context.countryStats as Record<string, unknown>[] | undefined)?.length) {
      const topCountries = (context.countryStats as Record<string, unknown>[])
        .slice(0, 10)
        .map((c) => `${c.name} (${c.count})`)
        .join(", ");
      prompt += `\nTop paesi nel DB: ${topCountries}. Totale paesi: ${(context.countryStats as Record<string, unknown>[]).length}.`;
    }
    if (context.missionData) {
      const md = context.missionData as Record<string, unknown>;
      const tgtCountries = ((md.targets as Record<string, unknown> | undefined)?.countries) as string[] | undefined;
      if (tgtCountries?.length) {
        prompt += `\nPaesi già selezionati: ${tgtCountries.join(", ")}.`;
      }
      if (md.channel) prompt += `\nCanale scelto: ${md.channel}.`;
      if ((md.deepSearch as Record<string, unknown> | undefined)?.enabled) prompt += `\nDeep Search attivo.`;
    }
  }

  return prompt;
}

/**
 * Main assembly function: loads all context, applies token budget, returns assembled system prompt
 */
export async function assembleSystemPrompt(
  supabase: SupabaseClient,
  baseSystemPrompt: string,
  provider: { model: string },
  userId: string,
  isConversational: boolean,
  context: Record<string, unknown> | undefined,
  messages: Record<string, unknown>[] | undefined
): Promise<ContextAssemblyResult> {
  // Extract last user message
  const lastUserMsg: string | undefined = Array.isArray(messages)
    ? [...messages]
        .reverse()
        .find(
          (m: Record<string, unknown>) =>
            m?.role === "user" && typeof m.content === "string"
        )?.content as string | undefined
    : undefined;

  // Build conversation context
  const conversationContext: ConversationContext = {
    scope: (context?.scope as string | undefined) || undefined,
    page: (context?.currentPage || context?.page) as string | undefined,
    partner_country:
      (context?.partner_country ||
        context?.country ||
        context?.selectedCountry) as string | undefined,
    channel: (context?.channel as string | undefined) || undefined,
    email_type: (context?.email_type as string | undefined) || undefined,
    partner_id:
      (context?.partnerId || context?.partner_id) as string | undefined,
    relationship_stage:
      (context?.relationship_stage as string | undefined) || undefined,
    last_user_message: lastUserMsg,
  };
  const ctxTags = extractContextTags(conversationContext);

  // Load workflow and holding state in parallel
  const [activeWorkflow, holdingState] = await Promise.all([
    loadActiveWorkflow(supabase, conversationContext.partner_id),
    loadHoldingState(supabase, conversationContext.partner_id),
  ]);

  // Load all context
  const contextData = await loadContextParallel(
    supabase,
    userId,
    isConversational,
    lastUserMsg,
    ctxTags
  );

  // Assemble context blocks with priority
  const contextBudget = getContextBudget(provider.model);
  const basePromptTokens = estimateTokens(baseSystemPrompt);
  const availableBudget = Math.max(2000, contextBudget - basePromptTokens);

  const contextBlocks = [
    { key: "doctrine", content: contextData.doctrineContext, priority: 100, minTokens: 0 },
    { key: "holding_state", content: holdingState, priority: 95, minTokens: 0 },
    { key: "active_workflow", content: activeWorkflow, priority: 92, minTokens: 0 },
    { key: "profile", content: contextData.userProfile, priority: 90, minTokens: 100 },
    { key: "memory", content: contextData.memoryContext, priority: 80, minTokens: 200 },
    { key: "kb", content: contextData.kbContext, priority: 70, minTokens: 200 },
    { key: "email_context", content: contextData.emailContext, priority: 65, minTokens: 100 },
    { key: "operative_prompts", content: contextData.opPrompts, priority: 60, minTokens: 100 },
    { key: "mission_history", content: contextData.missionHistory, priority: 50, minTokens: 0 },
  ].filter((b) => b.content?.trim());

  const { text: assembledContext, stats: budgetStats } = assembleContext(
    contextBlocks,
    availableBudget
  );

  let systemPrompt = baseSystemPrompt;
  if (assembledContext) systemPrompt += assembledContext;

  if (budgetStats.dropped.length > 0 || budgetStats.truncated.length > 0) {
    
  }

  // Inject page context
  if (context) {
    systemPrompt = injectPageContext(systemPrompt, context);
  }

  return {
    systemPrompt,
    budgetStats,
  };
}
