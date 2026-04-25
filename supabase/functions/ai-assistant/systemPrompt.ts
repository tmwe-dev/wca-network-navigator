/**
 * systemPrompt.ts — Assembler-driven, KB-first.
 *
 * Identità minima nel codice. Tutte le procedure dettagliate (golden rules,
 * dottrina commerciale, regole ingaggio scope) vivono ora in `kb_entries`
 * (categoria `doctrine` e `procedures`) e sono iniettate da assemblePrompt.
 */
import { assemblePrompt } from "../_shared/prompts/assembler.ts";

export interface ComposeSystemPromptOptions {
  operatorBriefing?: string;
  activeWorkflow?: string;
  /** Scope corrente (cockpit/contacts/outreach/strategic/command/extension). */
  scope?: string;
  /** true → modalità voce (LUCA conversazionale, no tool di scrittura). */
  conversational?: boolean;
}

const CONVERSATIONAL_CORE = `Sei LUCA in modalità VOCE. Tono professionale, amichevole, italiano.
Rispondi in 3-4 frasi MAX (TTS), niente markdown/tabelle/emoji.
Discuti strategie e priorità. NON leggere email/messaggi ad alta voce. NON eseguire tool di scrittura.`;

export async function composeSystemPrompt(opts: ComposeSystemPromptOptions): Promise<string> {
  // Se un briefing operatore è presente in modalità conversational, è un system
  // prompt self-contained (Harmonizer, ingestion TMWE, Prompt Lab): non va
  // contaminato dal core voce LUCA né dalla dottrina generalista.
  if (opts.conversational && opts.operatorBriefing?.trim()) {
    return opts.operatorBriefing.trim();
  }

  if (opts.conversational) {
    const parts: string[] = [CONVERSATIONAL_CORE];
    return parts.join("\n\n---\n\n");
  }

  const base = await assemblePrompt({
    agentId: "luca",
    variables: {
      available_tools: "(iniettati a runtime nel context loader)",
    },
    kbCategories: ["procedures", "doctrine"],
    injectExcerpts: ["doctrine/safety-guardrails", "doctrine/anti-hallucination"],
  });

  const parts: string[] = [base];

  if (opts.scope) {
    parts.push(`🎯 SCOPE ATTIVO: ${opts.scope}\nApplica le regole d'ingaggio specifiche per questo scope (consulta KB doctrine/tone-and-format se serve).`);
  }
  if (opts.operatorBriefing?.trim()) {
    parts.push(`⚡ BRIEFING OPERATORE (PRIORITÀ MASSIMA)\n\n${opts.operatorBriefing.trim()}`);
  }
  if (opts.activeWorkflow?.trim()) {
    parts.push(`🚦 WORKFLOW ATTIVO\n\n${opts.activeWorkflow.trim()}`);
  }

  return parts.join("\n\n---\n\n");
}
