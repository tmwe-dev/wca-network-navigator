/**
 * directRouter — routing deterministico verso i tool specifici PRIMA del
 * fast-lane generico `ai-query`.
 *
 * Problema risolto (test fisico Command 2026-09-02): il fast-lane di lettura
 * (`shouldForceAiQuery`) intercettava quasi tutto perché bastava un sostantivo
 * di dominio ("contatti", "outreach", "email", "kb") per dirottare il prompt su
 * `ai-query`. Risultato: navigazione, posta in arrivo, coda outreach, agenda e
 * ricerca KB finivano tutte sul planner SQL generico invece dei loro tool.
 *
 * Qui usiamo i `match()` già esistenti nel registry (selettivi per costruzione)
 * e instradiamo SOLO verso tool a rischio "read" — le scritture continuano a
 * passare dal planner, che estrae i parametri e attiva l'approvazione umana.
 */
import { TOOLS, TOOL_METADATA } from "../tools/registry";
import { buildPlanState } from "./buildPlanState";
import type { PlanExecutionState } from "../planRunner";

/** Tool generici gestiti altrove nel dispatch (fast-lane dedicati). */
const GENERIC_TOOL_IDS = new Set<string>(["ai-query", "compose-email"]);

const RISK_BY_ID = new Map(TOOL_METADATA.map((t) => [t.id, t.riskLevel]));

/**
 * Ritorna l'id del tool specifico che copre il prompt, oppure null.
 * Solo tool di lettura (nessun side-effect): sicuro da eseguire senza approvazione.
 */
export function resolveDirectTool(text: string): string | null {
  const tool = TOOLS.find((t) => !GENERIC_TOOL_IDS.has(t.id) && RISK_BY_ID.get(t.id) === "read" && t.match(text));
  return tool?.id ?? null;
}

/** Piano sintetico a 1 step su un tool specifico. */
export function buildSingleToolPlan(toolId: string): PlanExecutionState {
  const label = TOOL_METADATA.find((t) => t.id === toolId)?.label ?? toolId;
  return buildPlanState([{ stepNumber: 1, toolId, reasoning: label, params: {} }], label);
}
