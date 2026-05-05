import type { Block } from "../../types";
import { resolveRubric, rubricToPromptSection, validateAgainstRubric, isVoiceBlock } from "../../promptRubrics";
import { parseArchitectDiagnostics, type ArchitectDiagnosticV2 } from "../diagnostics";
import { AGENT_REGISTRY, type AgentRegistryEntry } from "@/data/agentPrompts";
import { resolveBlockAgent } from "../agentMapping";
import { VOICE_ENFORCEMENT_RULES } from "./briefings";
import {
  briefingToPromptSection,
  describeSource,
  summarizeNearby,
  buildContractReferenceSection,
  buildRetryPrompt,
} from "./promptHelpers";
import { loadDoctrineForBlock, loadVoiceTemplatesFewShot } from "./loaders";
import type { BriefingPayload, ImproveOptions } from "./types";

type CallAgent = (userPrompt: string, extraContext?: Record<string, unknown>) => Promise<string>;

export async function improveBlock(
  callAgent: CallAgent,
  { block, instruction, tabLabel, tabActivation, nearbyBlocks, goal, briefing }: ImproveOptions,
): Promise<string> {
  const guidance = instruction?.trim() ?? "Migliora questo blocco mantenendo il senso ma rendendolo più chiaro, conciso e operativo.";
  const sourceDesc = describeSource(block.source);
  const nearbySummary = summarizeNearby(nearbyBlocks ?? [], block.id);
  const briefingForcesVoice = briefing?.targetChannel === "voice_agent";
  const isVoice = briefingForcesVoice || isVoiceBlock({
    tabLabel,
    source: block.source,
    label: block.label,
    content: block.content,
  });
  const [doctrineSnippet, voiceFewShot] = await Promise.all([
    loadDoctrineForBlock(block, tabLabel ?? "n/d"),
    isVoice ? loadVoiceTemplatesFewShot() : Promise.resolve(""),
  ]);
  const rubric = resolveRubric(block.source, { forceVoice: isVoice });
  const rubricSection = rubricToPromptSection(rubric);
  const voiceSection = isVoice
    ? `\n${VOICE_ENFORCEMENT_RULES}\n\n=== TEMPLATE VOCE DI RIFERIMENTO (few-shot — segui struttura, tono, sezioni canoniche) ===\n${voiceFewShot}\n=== FINE TEMPLATE VOCE ===\n`
    : "";
  const briefingSection = briefingToPromptSection(briefing);
  const briefingHeader = briefingSection ? `\n${briefingSection}\n` : "";
  const effectiveGoal = briefing?.goal?.trim() || goal?.trim() || "";

  const userPrompt = `Tab: ${tabLabel ?? "n/d"}
Dove si attiva (runtime): ${tabActivation ?? "n/d"}
Sorgente DB: ${sourceDesc}
Blocco da migliorare: ${block.label} (${block.id})
${!briefing && effectiveGoal ? `\nOBIETTIVO dichiarato dall'operatore: ${effectiveGoal}\n` : ""}
${briefingHeader}
Istruzione operativa: ${guidance}

--- BLOCCHI VICINI nello stesso tab (NON contraddirli) ---
${nearbySummary}
--- FINE BLOCCHI VICINI ---

--- KB DOCTRINE rilevante (regole già scritte, rispettale) ---
${doctrineSnippet}
--- FINE KB DOCTRINE ---
${voiceSection}
${rubricSection}

--- TESTO ATTUALE DEL BLOCCO ---
${block.content}
--- FINE TESTO ---

Restituisci SOLO il testo migliorato del blocco, niente commenti. Rispetta IN ORDINE: (1) BRIEFING OPERATIVO se presente, (2) RUBRICA, (3) regole voce se applicabili.`;

  const first = await callAgent(userPrompt, {
    block_id: block.id,
    block_label: block.label,
    block_source: block.source,
    tab: tabLabel,
    tab_activation: tabActivation,
    goal: effectiveGoal || null,
    briefing: briefing ?? null,
    nearby_block_ids: (nearbyBlocks ?? []).map((b) => b.id),
  });

  const issues = validateAgainstRubric(first, rubric);
  if (issues.length === 0) return first;

  const retryPrompt = buildRetryPrompt({
    blockLabel: block.label,
    blockContent: block.content,
    violations: issues,
    contextHint: `tab=${tabLabel ?? "n/d"}, sorgente=${block.source.kind}`,
  });
  const second = await callAgent(retryPrompt, {
    block_id: block.id,
    retry: true,
    violations: issues,
  });
  return second || first;
}

export interface ImproveBlockGlobalParams {
  block: Block;
  tabLabel: string;
  tabActivation?: string;
  systemMap: string;
  doctrineFull: string;
  systemMission: string;
  goal?: string;
  briefing?: BriefingPayload;
}

export async function improveBlockGlobal(
  callAgent: CallAgent,
  params: ImproveBlockGlobalParams,
): Promise<string> {
  const { block, tabLabel, tabActivation, systemMap, doctrineFull, systemMission, goal, briefing } = params;
  const sourceDesc = describeSource(block.source);
  const briefingForcesVoice = briefing?.targetChannel === "voice_agent";
  const isVoice = briefingForcesVoice || isVoiceBlock({
    tabLabel,
    source: block.source,
    label: block.label,
    content: block.content,
  });
  const rubric = resolveRubric(block.source, { forceVoice: isVoice });
  const rubricSection = rubricToPromptSection(rubric);
  const voiceFewShot = isVoice ? await loadVoiceTemplatesFewShot() : "";
  const voiceSection = isVoice
    ? `\n${VOICE_ENFORCEMENT_RULES}\n\n=== TEMPLATE VOCE DI RIFERIMENTO (few-shot — segui struttura, tono, sezioni canoniche) ===\n${voiceFewShot}\n=== FINE TEMPLATE VOCE ===\n`
    : "";
  const briefingSection = briefingToPromptSection(briefing);
  const briefingHeader = briefingSection ? `\n${briefingSection}\n` : "";
  const effectiveGoal = briefing?.goal?.trim() || goal?.trim() || "";

  const userPrompt = `=== SYSTEM MISSION ===
${systemMission}

=== KB DOCTRINE COMPLETA (regole già scritte — NON contraddirle, completale) ===
${doctrineFull}

=== MAPPA COMPLETA DEL SISTEMA AI (tutti i prompt configurati e dove vengono eseguiti) ===
${systemMap}

${buildContractReferenceSection()}
${voiceSection}
${rubricSection}
${briefingHeader}

=== BLOCCO DA MIGLIORARE ===
Tab: ${tabLabel}
Dove si attiva (runtime): ${tabActivation ?? "n/d"}
Sorgente DB: ${sourceDesc}
Etichetta: ${block.label}
ID: ${block.id}
${!briefing && effectiveGoal ? `\nObiettivo dichiarato: ${effectiveGoal}\n` : ""}
--- TESTO ATTUALE ---
${block.content}
--- FINE TESTO ---

ISTRUZIONI:
- Priorità ASSOLUTA al BRIEFING OPERATIVO se presente, poi RUBRICA, poi mission di sistema.
- Riscrivi il blocco perché serva meglio l'obiettivo dichiarato nel briefing, in coerenza con TUTTO il resto.
- Rispetta la RUBRICA sopra: must-have, must-not, lunghezza, struttura.
- Guard-rail obbligatori: dottrina commerciale 9 stati, mai inventare dati o azioni, mai contraddire altri blocchi visibili nella mappa, mantieni l'italiano se il testo originale è in italiano.
- Non usare variabili o campi che non esistono nei contratti runtime del sistema (LifecycleBrief, EmailBrief, OutreachBrief, VoiceBrief). Se il blocco ne usa, segnalalo come ARCHITECTURAL_NOTE.
- Se il blocco è già ottimo, restituiscilo invariato.
- Restituisci SOLO il testo del blocco migliorato, senza preamboli né commenti.`;

  const first = await callAgent(userPrompt, {
    mode: "global_improve",
    block_id: block.id,
    block_source: block.source,
    tab: tabLabel,
  });

  const issues = validateAgainstRubric(first, rubric);
  if (issues.length === 0) return first;

  const retryPrompt = buildRetryPrompt({
    blockLabel: block.label,
    blockContent: block.content,
    violations: issues,
    contextHint: `tab=${tabLabel}, sorgente=${block.source.kind}`,
  });
  const second = await callAgent(retryPrompt, {
    mode: "global_improve_retry",
    block_id: block.id,
    violations: issues,
  });
  return second || first;
}

export interface AnalyzeBlockArchitectParams {
  block: Block;
  tabLabel?: string;
  tabActivation?: string;
  nearbyBlocks?: ReadonlyArray<Block>;
  systemMap?: string;
  doctrineFull?: string;
  goal?: string;
  agent?: AgentRegistryEntry;
  mode: "standard" | "architect";
  loadArchitectProcedure: () => Promise<string>;
}

export async function analyzeBlockArchitect(
  callAgent: CallAgent,
  params: AnalyzeBlockArchitectParams,
): Promise<ArchitectDiagnosticV2[]> {
  const { block, tabLabel, tabActivation, nearbyBlocks, systemMap, doctrineFull, goal, mode, loadArchitectProcedure } = params;
  const sourceDesc = describeSource(block.source);
  const nearbySummary = summarizeNearby(nearbyBlocks ?? [], block.id);
  const doctrineSnippet = doctrineFull ?? (await loadDoctrineForBlock(block, tabLabel ?? "n/d"));
  const mapSection = systemMap
    ? `\n--- MAPPA AGENTI/PROMPT (per identificare ridondanze e destinazioni) ---\n${systemMap}\n--- FINE MAPPA ---\n`
    : "";
  const architectProcedure = mode === "architect" ? await loadArchitectProcedure() : "";
  const procedureSection = architectProcedure
    ? `\n=== PROCEDURA LAB ARCHITECT (vincolante per questa risposta) ===\n${architectProcedure}\n=== FINE PROCEDURA ===\n`
    : "";

  const ownerAgent: AgentRegistryEntry | undefined =
    params.agent ?? AGENT_REGISTRY[resolveBlockAgent(block).agentId];
  const contractSection =
    mode === "architect" && ownerAgent
      ? `\n=== CONTRATTI RUNTIME DELL'AGENTE PROPRIETARIO ===
Agente: ${ownerAgent.displayName} (${ownerAgent.id})
Edge function: ${ownerAgent.runtime.edgeFunction}
Modello default: ${ownerAgent.runtime.modelDefault}
INPUT CONTRACT:
${ownerAgent.contract.input}
OUTPUT CONTRACT:
${ownerAgent.contract.output}
TOOLS DISPONIBILI: ${ownerAgent.tools.join(", ") || "(nessuno)"}
=== FINE CONTRATTI ===`
      : "";

  const supremeContracts = buildContractReferenceSection();

  const prompt = `Sei il LAB AGENT ARCHITECT. NON riscrivere il blocco. Analizzalo e produci un REPORT JSON STRUTTURATO.
${procedureSection}
${contractSection}

${supremeContracts}

=== OBIETTIVO ===
Capire se questo blocco è al posto giusto, se va spostato, se duplica un altro blocco, se usa variabili fantasma, o se va eliminato. Non sei un correttore di bozze: sei un ingegnere di sistema che valuta l'impatto strutturale.

=== FORMATO OUTPUT OBBLIGATORIO ===
Rispondi con un JSON array. Per ogni problema trovato, emetti un oggetto con TUTTI questi campi:

\`\`\`json
[{
  "block_id": "${block.id}",
  "block_type": "<prompt_core | kb_doctrine | kb_procedure | operative | email | playbook | persona | voice | contract>",
  "problem_class": "<duplication | entropy | ghost_variable | misplaced_logic | inconsistency | hardcoded | missing_contract | format_violation | obsolete>",
  "severity": "<low | medium | high | critical>",
  "impact_score": <1-10>,
  "destination": "<keep-here | prompt_core | kb_doctrine | kb_procedure | contract_backend | policy_hard | voice | editor | delete | merge_with:BLOCK_ID>",
  "current_issue": "<descrizione del problema in max 200 char>",
  "proposed_text": "<testo proposto se text_fix, altrimenti null>",
  "required_variables": ["lista variabili usate nel blocco"],
  "missing_contracts": ["contratti backend mancanti che servirebbero"],
  "tests_required": ["scenari di test per verificare il fix"],
  "affected_surfaces": ["Composer | improve-email | voice | outreach | command | cockpit | etc."],
  "apply_recommended": <true | false>
}]
\`\`\`

=== CALCOLO IMPACT SCORE (1-10) ===
Deriva il punteggio da 4 fattori:
1. SUPERFICI TOCCATE: quanti agenti/funzioni usano questo blocco (1 = solo locale, 10 = globale)
2. TIPO DI CAMBIO: solo testo (1-3) | cambia contratti/routing (4-6) | cambia policy/gerarchia (7-10)
3. CANALI IMPATTATI: solo editor (basso) | solo voce (medio) | entrambi (alto)
4. RISCHIO SILENTE: l'utente se ne accorgerebbe subito? Sì (basso) | No (alto)
Score finale = max dei 4 fattori.

=== RILEVAMENTO PROBLEMI ===

ENTROPY: se la stessa regola è ripetuta in 2+ blocchi visibili nella mappa, segnala problem_class: "entropy" e proponi centralizzazione.

GHOST VARIABLES: se il blocco usa {{variabili}} o riferimenti a campi che NON compaiono nel contratto I/O dell'agente proprietario, segnala problem_class: "ghost_variable" e listale in required_variables.

MISPLACED LOGIC: se una regola di business vive in un prompt ma dovrebbe stare in KB doctrine o in policy hard (codice), segnala problem_class: "misplaced_logic" con la destination corretta.

MISSING CONTRACT: se il blocco assume dati strutturati che nessun contratto backend dichiara, segnala problem_class: "missing_contract" e specifica in missing_contracts quale serve (es. "EmailBrief", "VoiceBrief", "LifecycleBrief").

=== REGOLE ===
- Se il blocco è già ottimo: un singolo oggetto con severity: "low", impact_score: 1, apply_recommended: false.
- Se trovi PIÙ problemi nello stesso blocco: emetti PIÙ oggetti nell'array.
- NIENTE preamboli, NIENTE commenti fuori dal JSON, NIENTE markdown extra (solo il JSON).
- Quando proponi destination: "contract_backend", includi in proposed_text la FIRMA TypeScript del contratto (es. \`type EmailBrief = { goal: string; audience: 'cold'|'warm'; cta?: string }\`).

--- BLOCCO ANALIZZATO ---
Tab: ${tabLabel ?? "n/d"}
Runtime: ${tabActivation ?? "n/d"}
Sorgente DB: ${sourceDesc}
Etichetta: ${block.label}
ID: ${block.id}
${goal?.trim() ? `\nObiettivo dichiarato: ${goal.trim()}\n` : ""}
--- TESTO ATTUALE ---
${block.content}
--- FINE TESTO ---
${mapSection}
--- BLOCCHI VICINI (per cercare duplicati/contraddizioni/entropy) ---
${nearbySummary}
--- FINE BLOCCHI VICINI ---

--- KB DOCTRINE (per valutare coerenza e duplicazioni) ---
${doctrineSnippet}
--- FINE KB DOCTRINE ---`;

  const raw = await callAgent(prompt, {
    mode: "architect_diagnose_v2",
    agent_mode: mode,
    block_id: block.id,
    block_source: block.source,
    owner_agent_id: ownerAgent?.id,
  });
  return parseArchitectDiagnostics(raw);
}