/**
 * localResultFormatter — Template-based response builder for SIMPLE results.
 *
 * Goal: skip the final LLM commenting hop (~6s) when the result is trivial:
 *   • count puro (single number) → "Abbiamo X partner in [paesi]"
 *   • lista corta (<5 righe)     → riepilogo template
 *
 * Returns null when the result needs full AI commentary (analysis, complex
 * data, explicit user request like "spiegami / analizza / perché").
 */
import type { ToolResult } from "../tools/types";
import type { QueryPlan } from "./safeQueryExecutor";
import type { SuggestedAction } from "../aiBridge";

const ANALYSIS_KEYWORDS = /\b(analizza|analisi|spiegami|spiega|perch[éè]|perche|come mai|valuta|consiglia|suggerisci|approfond|opinione|raccomanda)\b/i;

const COUNTRY_LABELS: Record<string, string> = {
  US: "Stati Uniti",
  IT: "Italia",
  DE: "Germania",
  FR: "Francia",
  ES: "Spagna",
  CN: "Cina",
  GB: "Regno Unito",
  UK: "Regno Unito",
  NL: "Olanda",
  BE: "Belgio",
  CH: "Svizzera",
  AT: "Austria",
  PT: "Portogallo",
  PL: "Polonia",
  GR: "Grecia",
  TR: "Turchia",
  AE: "Emirati Arabi",
  IN: "India",
  JP: "Giappone",
  BR: "Brasile",
  MX: "Messico",
  CA: "Canada",
  AU: "Australia",
};

const TABLE_NOUN_SINGULAR: Record<string, string> = {
  partners: "partner",
  imported_contacts: "contatto",
  outreach_queue: "messaggio in coda",
  activities: "attività",
  channel_messages: "messaggio",
  agents: "agente",
  agent_tasks: "task agente",
  kb_entries: "voce KB",
  business_cards: "biglietto da visita",
  download_jobs: "job",
  campaign_jobs: "campagna",
};

const TABLE_NOUN_PLURAL: Record<string, string> = {
  partners: "partner",
  imported_contacts: "contatti",
  outreach_queue: "messaggi in coda",
  activities: "attività",
  channel_messages: "messaggi",
  agents: "agenti",
  agent_tasks: "task agente",
  kb_entries: "voci KB",
  business_cards: "biglietti da visita",
  download_jobs: "job",
  campaign_jobs: "campagne",
};

function noun(table: string, plural: boolean): string {
  return (plural ? TABLE_NOUN_PLURAL : TABLE_NOUN_SINGULAR)[table] ?? table;
}

interface FilterShape {
  readonly column: string;
  readonly op: string;
  readonly value: unknown;
}

function describeFilters(filters: readonly FilterShape[]): string {
  const parts: string[] = [];
  for (const f of filters) {
    if (f.column === "country_code") {
      if (f.op === "eq" && typeof f.value === "string") {
        parts.push(`in ${COUNTRY_LABELS[f.value] ?? f.value}`);
      } else if (f.op === "in" && Array.isArray(f.value)) {
        const labels = f.value.map((v) => COUNTRY_LABELS[String(v)] ?? String(v));
        parts.push(`in ${labels.join(" e ")}`);
      }
    } else if (f.column === "city" && typeof f.value === "string") {
      parts.push(`a ${f.value}`);
    } else if (f.column === "is_active" && f.value === true) {
      parts.push("attivi");
    } else if (f.column === "lead_status" && typeof f.value === "string") {
      parts.push(`con stato "${f.value}"`);
    } else if (f.column === "status") {
      if (f.op === "in" && Array.isArray(f.value)) {
        parts.push(`con stato ${f.value.map((v) => `"${String(v)}"`).join(" o ")}`);
      } else if (typeof f.value === "string") {
        parts.push(`con stato "${f.value}"`);
      }
    } else if (f.column === "office_type" && typeof f.value === "string") {
      parts.push(`tipo ${f.value}`);
    }
  }
  return parts.join(" ");
}

function suggestedActionsFor(table: string, filters: readonly FilterShape[]): SuggestedAction[] {
  const filtersDesc = describeFilters(filters);
  if (table === "partners") {
    const country = filters.find((f) => f.column === "country_code");
    const countryRef = country
      ? country.op === "eq"
        ? COUNTRY_LABELS[String(country.value)] ?? String(country.value)
        : Array.isArray(country.value)
          ? country.value.map((v) => COUNTRY_LABELS[String(v)] ?? String(v)).join(" e ")
          : ""
      : "";
    return [
      { label: `🔍 Mostra i top rated`, prompt: `mostra i top 20 partner ${filtersDesc} per rating` },
      { label: `🌐 Avvia deep search`, prompt: `avvia una deep search sui partner ${filtersDesc}` },
      { label: `🏢 Arricchisci i siti web`, prompt: `arricchisci i siti web dei partner ${filtersDesc}` },
    ];
  }
  if (table === "imported_contacts") {
    return [
      { label: `📋 Mostra elenco`, prompt: `mostra l'elenco dei contatti ${filtersDesc}` },
      { label: `📧 Verifica email`, prompt: `quanti di questi contatti hanno email valida ${filtersDesc}` },
    ];
  }
  if (table === "activities") {
    return [
      { label: `📅 Mostra le prossime`, prompt: `mostra le prossime 10 attività ${filtersDesc}` },
      { label: `⚠️ Solo urgenti`, prompt: `mostra le attività urgenti ${filtersDesc}` },
    ];
  }
  if (table === "outreach_queue") {
    return [
      { label: `📤 Mostra in coda`, prompt: `mostra i prossimi 20 outreach in coda` },
      { label: `❌ Solo falliti`, prompt: `mostra gli outreach falliti recenti` },
    ];
  }
  if (table === "campaign_jobs") {
    return [
      { label: `📋 Mostra tutte`, prompt: `mostra tutte le campagne` },
      { label: `⏳ Solo in coda`, prompt: `mostra campagne in stato pending` },
      { label: `✅ Solo completate`, prompt: `mostra campagne completate` },
    ];
  }
  return [];
}

export interface LocalComment {
  readonly message: string;
  readonly spokenSummary: string;
  readonly suggestedActions: SuggestedAction[];
}

/** Strip basic markdown so the spoken version sounds natural. */
function stripMarkdown(s: string): string {
  return s.replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Build a short conversational proposal from the suggested actions, e.g.:
 *   "Vuoi che ti mostri i top rated o che avvii una deep search?"
 */
function buildProposalSentence(actions: SuggestedAction[]): string {
  if (!actions || actions.length === 0) return "";
  // Strip leading emojis/symbols from labels for a cleaner sentence.
  const clean = actions
    .slice(0, 3)
    .map((a) => a.label.replace(/^[\p{Extended_Pictographic}\p{S}\p{P}\s]+/u, "").trim())
    .map((s) => s.charAt(0).toLowerCase() + s.slice(1))
    .filter((s) => s.length > 0);
  if (clean.length === 0) return "";
  if (clean.length === 1) return `Vuoi che ${clean[0]}?`;
  const head = clean.slice(0, -1).join(", ");
  const tail = clean[clean.length - 1];
  return `Vuoi che ${head} o ${tail}?`;
}

/**
 * Decide if a result can be commented locally (skip LLM).
 * Returns the comment, or null if AI is needed.
 */
export function tryLocalComment(
  userPrompt: string,
  result: ToolResult,
  plan: QueryPlan | null,
): LocalComment | null {
  // User explicitly asked for analysis/explanation → use AI
  if (ANALYSIS_KEYWORDS.test(userPrompt)) return null;

  // Only handle simple "table" results from ai-query
  if (result.kind !== "table") return null;
  if (!plan) return null;

  const count = result.meta?.count ?? result.rows.length;
  const filters = plan.filters as FilterShape[];
  const table = plan.table;

  // The user explicitly asked for an ENUMERATION (list/elenco/mostra/dammi/vedi).
  // In that case we MUST render the table, never collapse to a count message —
  // even if the planner reduced the columns to ["id"].
  const isListMode = /\b(elenco|elenc|lista|liste|mostra|mostrami|dammi|vedi|visualizza|fammi vedere|fai vedere)\b/i.test(userPrompt);

  // ── COUNT MODE ──
  // Only when the user really asked "how many" — never auto-trigger from the
  // planner having reduced columns to ["id"], that is a planner heuristic, not
  // user intent.
  const isCountMode =
    !isListMode &&
    /\b(quanti|quante|conteggio|totale|numero)\b/i.test(userPrompt);

  // ── ZERO RESULTS (any mode) ──
  // Handle this BEFORE falling through to AI commentary, otherwise the LLM
  // tends to hallucinate "errore tecnico nel filtro" when it just got 0 rows.
  if (count === 0) {
    const filtersDesc = describeFilters(filters);
    const word = noun(table, true);
    const base = table === "campaign_jobs" && filters.some((f) => f.column === "status")
      ? `Non ci sono ${word} ${filtersDesc}.`
      : filtersDesc
        ? `Non ho trovato ${word} ${filtersDesc}.`
        : `Non ho trovato ${word} che corrispondano alla richiesta.`;
    // Build alternative actions: drop the most specific filter (last one) and
    // offer the broader query, plus a "show all" fallback.
    const altActions: SuggestedAction[] = [];
    if (filters.length > 0) {
      const broader = filters.slice(0, -1);
      const broaderDesc = describeFilters(broader);
      altActions.push({
        label: `🔁 Riprova senza l'ultimo filtro`,
        prompt: `mostra ${word} ${broaderDesc}`.trim(),
      });
    }
    altActions.push({
      label: table === "campaign_jobs" ? `📋 Mostra tutte` : `📋 Mostra tutti i ${word}`,
      prompt: table === "campaign_jobs" ? `mostra tutte le campagne` : `mostra tutti i ${word}`,
    });
    const proposal = buildProposalSentence(altActions);
    return {
      message: proposal ? `${base} ${proposal}` : base,
      spokenSummary: stripMarkdown(proposal ? `${base} ${proposal}` : base),
      suggestedActions: altActions,
    };
  }

  if (isCountMode) {
    const filtersDesc = describeFilters(filters);
    const word = noun(table, count !== 1);
    const countFmt = count.toLocaleString("it-IT");
    const actions = suggestedActionsFor(table, filters);
    const proposal = buildProposalSentence(actions);
    const base =
      count === 0
        ? `Non risultano ${word} ${filtersDesc}.`.trim().replace(/\s+/g, " ")
        : `Abbiamo **${countFmt}** ${word}${filtersDesc ? " " + filtersDesc : ""}.`;
    const baseSpoken =
      count === 0
        ? `Nessun ${word} ${filtersDesc}`
        : `Abbiamo ${countFmt} ${word} ${filtersDesc}`.trim();
    return {
      message: proposal ? `${base} ${proposal}` : base,
      spokenSummary: proposal ? `${baseSpoken}. ${stripMarkdown(proposal)}` : baseSpoken,
      suggestedActions: actions,
    };
  }

  // ── SHORT LIST MODE (≤ 5 rows) ──
  if (count > 0 && count <= 5) {
    const filtersDesc = describeFilters(filters);
    const word = noun(table, count !== 1);
    const sampleNames = result.rows
      .slice(0, 5)
      .map((r) => {
        const v =
          (r["company_name"] as string | undefined) ??
          (r["name"] as string | undefined) ??
          (r["title"] as string | undefined) ??
          (r["subject"] as string | undefined);
        return v ? `• ${v}` : null;
      })
      .filter((x): x is string => x !== null);
    const actions = suggestedActionsFor(table, filters);
    const proposal = buildProposalSentence(actions);
    const message = `Trovati **${count}** ${word}${filtersDesc ? " " + filtersDesc : ""}:\n${sampleNames.join("\n")}${proposal ? `\n\n${proposal}` : ""}`;
    const baseSpoken = `${count} ${word} ${filtersDesc}`.trim();
    const spokenSummary = proposal ? `${baseSpoken}. ${stripMarkdown(proposal)}` : baseSpoken;
    return {
      message,
      spokenSummary,
      suggestedActions: actions,
    };
  }

  // Otherwise → fallback to AI commentary
  return null;
}
