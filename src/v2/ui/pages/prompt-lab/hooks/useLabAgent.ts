/**
 * useLabAgent — wrapper unified-assistant scope kb-supervisor con briefing Prompt Lab.
 */
import { useCallback, useState } from "react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Block, BlockSource } from "../types";
import { findKbEntries } from "@/data/kbEntries";
import { resolveRubric, rubricToPromptSection, validateAgainstRubric, isVoiceBlock } from "../promptRubrics";
import { parseArchitectDiagnostics, type ArchitectDiagnostic } from "./diagnostics";
import { useArchitectKb } from "./useArchitectKb";
import { AGENT_REGISTRY, type AgentRegistryEntry } from "@/data/agentPrompts";
import { resolveBlockAgent } from "./agentMapping";

const PROMPT_LAB_BRIEFING = `Sei il Prompt Lab Architect. Migliori prompt, KB e configurazioni AI per WCA Network Navigator.

REGOLE:
- System Prompt: max 2000 chars, struttura RUOLO/REGOLE/DOTTRINA/OUTPUT
- KB Entry: max 800 chars, struttura REGOLA/PROCEDURA/ESEMPIO
- Email Prompt: max 500 chars, struttura TIPO/TONO/STRUTTURA/CTA
- Voice Prompt: linguaggio naturale conversazionale, no markdown, no bullet
- Playbook: max 600 chars, TRIGGER/STRATEGIA/AZIONI/VINCOLI

QUANDO MIGLIORI: elimina ridondanze, sostituisci frasi vaghe con istruzioni precise, aggiungi vincoli (cosa NON fare), verifica coerenza con dottrina commerciale (9 stati).

CONTESTO RUNTIME: ogni richiesta include "Dove si attiva" (in quali pagine/edge function viene eseguito il blocco), "Sorgente" (tabella/campo DB), "Blocchi vicini" (altri blocchi dello stesso tab — NON contraddirli) e "KB doctrine rilevante" (regole già scritte in KB — rispettale, non duplicarle). Se l'operatore ha dichiarato un OBIETTIVO, ottimizza esplicitamente per quello.

IMPORTANTE: rispondi SOLO con il testo migliorato del blocco richiesto, senza intro né commenti. Mantieni la struttura originale a meno che non sia esplicitamente sbagliata.`;

export interface LabChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface UnifiedAssistantResponse {
  content?: string;
  structured?: Record<string, unknown>;
}

interface ImproveOptions {
  block: Block;
  instruction?: string;
  tabLabel?: string;
  /** Stringa "Dove si attiva" del tab (PROMPT_LAB_TABS[].activation). */
  tabActivation?: string;
  /** Altri blocchi dello stesso tab (per evitare contraddizioni). */
  nearbyBlocks?: ReadonlyArray<Block>;
  /** Obiettivo dichiarato dall'utente per questa specifica iterazione. */
  goal?: string;
  /** Briefing strutturato dalla checklist guidata (override su goal libero). */
  briefing?: BriefingPayload;
}

/**
 * Payload della checklist guidata pre-generazione.
 * Raccoglie obiettivo + contesto + target + vincoli per ancorare il modello
 * a contenuti coerenti con lo scopo dichiarato (no derive generaliste).
 */
export interface BriefingPayload {
  /** Obiettivo concreto del blocco (cosa deve ottenere quando eseguito). */
  goal: string;
  /** Quando/dove viene attivato nel runtime. */
  contextOfUse: string;
  /** Canale target: voice_agent | email | whatsapp | linkedin | internal_ai | kb_governance | multi_channel. */
  targetChannel: string;
  /** Audience: cold_lead | warm_lead | holding_pattern | existing_partner | internal_team | system_actor. */
  audience: string;
  /** Lingua output: it | en | auto. */
  language: string;
  /** Tipo CTA: none | meeting | reply | info | qualify | close. */
  ctaType: string;
  /** Cosa il blocco DEVE includere. */
  mustHave: string;
  /** Cosa il blocco non deve mai includere. */
  mustNotHave: string;
  /** Vincoli extra (lunghezza, tono, formato). */
  extraConstraints: string;
}

/** Serializza il briefing in una sezione prompt prioritaria. */
function briefingToPromptSection(b: BriefingPayload | undefined): string {
  if (!b || !b.goal.trim()) return "";
  const lines: string[] = [
    "=== ⚡ BRIEFING OPERATIVO (PRIORITÀ MASSIMA — vincola tutto l'output) ===",
    `OBIETTIVO: ${b.goal.trim()}`,
  ];
  if (b.contextOfUse.trim()) lines.push(`CONTESTO D'USO: ${b.contextOfUse.trim()}`);
  if (b.targetChannel) lines.push(`CANALE TARGET: ${b.targetChannel}`);
  if (b.audience) lines.push(`AUDIENCE: ${b.audience}`);
  if (b.language && b.language !== "auto") lines.push(`LINGUA OUTPUT: ${b.language}`);
  if (b.ctaType && b.ctaType !== "none") lines.push(`CTA RICHIESTA: ${b.ctaType}`);
  if (b.ctaType === "none") lines.push(`CTA: nessuna (blocco informativo)`);
  if (b.mustHave.trim()) lines.push(`DEVI INCLUDERE: ${b.mustHave.trim()}`);
  if (b.mustNotHave.trim()) lines.push(`NON DEVI MAI: ${b.mustNotHave.trim()}`);
  if (b.extraConstraints.trim()) lines.push(`VINCOLI EXTRA: ${b.extraConstraints.trim()}`);
  lines.push("Se l'output non rispetta TUTTI questi punti, è invalido. Adatta la rubrica e la struttura a questo briefing.");
  lines.push("=== FINE BRIEFING ===");
  return lines.join("\n");
}

function describeSource(src: BlockSource): string {
  switch (src.kind) {
    case "app_setting":
      return `app_settings.value (key="${src.key}") — letto a runtime dall'assembler globale del system prompt.`;
    case "kb_entry":
      return `kb_entries (id=${src.id ?? "n/d"}) — caricato dall'assembler KB in tutti gli agenti come regola di governo.`;
    case "operative_prompt":
      return `operative_prompts.${src.field} (id=${src.id}) — usato in Email Composer/Cockpit/Outreach come step strutturato.`;
    case "email_prompt":
      return `email_prompts.${src.field} (id=${src.id}) — usato dalla edge function di composizione email per il tipo specifico.`;
    case "email_address_rule":
      return `email_address_rules.${src.field} (id=${src.id}) — applicato quando il mittente/destinatario corrisponde alla regola.`;
    case "playbook":
      return `commercial_playbooks.${src.field} (id=${src.id}) — caricato quando le trigger_conditions matchano il contesto del lead.`;
    case "agent_persona":
      return `agent_personas.${src.field} (id=${src.id}) — applicato a tutte le generazioni dell'agente collegato (testo + voce).`;
    case "agent":
      return `agents.${src.field} (id=${src.id}) — system prompt specifico dell'agente, prevale sul globale per quell'agente.`;
    case "ephemeral":
      return "blocco effimero (non persistito).";
    default:
      return "sorgente sconosciuta.";
  }
}

function summarizeNearby(nearby: ReadonlyArray<Block>, currentId: string): string {
  const others = nearby.filter((b) => b.id !== currentId);
  if (others.length === 0) return "(nessun altro blocco nel tab)";
  return others
    .slice(0, 8)
    .map((b) => `• ${b.label}: ${b.content.slice(0, 180).replace(/\s+/g, " ").trim()}${b.content.length > 180 ? "…" : ""}`)
    .join("\n");
}

/** Regole hard-coded che il modello DEVE rispettare per ogni blocco voce ElevenLabs. */
const VOICE_ENFORCEMENT_RULES = `=== REGOLE OBBLIGATORIE PER PROMPT VOCALE ELEVENLABS ===
Questo blocco verrà installato in un agente vocale ElevenLabs (TTS/ASR real-time).
Devi produrre un prompt che rispetti TUTTE le regole seguenti, senza eccezioni:

1. STRUTTURA — usa ESATTAMENTE queste 8 sezioni nell'ordine, con heading singolo "# Nome":
   # Personality
   # Environment
   # Tone
   # Goal
   # Tools
   # Guardrails
   # Pronunciation & Language
   # When to end the call

2. FORMATTAZIONE PROIBITA (degrada la prosodia TTS):
   - NIENTE bullet markdown ('- ' o '* '): scrivi in prose con frasi piene separate da punto.
   - NIENTE heading multi-livello (## o ###): solo "# " singolo per le 8 sezioni canoniche.
   - NIENTE tabelle markdown ('| ... |').
   - NIENTE blocchi di codice (\`\`\`).
   - NIENTE emoji nei testi parlati.

3. RITMO TTS:
   - Frasi MAX ~30-35 parole. Spezza con punti per dare respiro al sintetizzatore.
   - Volume e ritmo dichiarati come costanti nella sezione # Tone.

4. PRONUNCIA SIGLE (sezione # Pronunciation & Language):
   - "TMWE" → specifica "Ti Em dabliu i" (IT) e "T M W E" (EN).
   - "FIndAIr" → specifica "Faind eir" (IT) e "Find Air" (EN).
   - Numeri: cifra per cifra (es. 123 → "uno due tre").
   - Se compaiono altre sigle aziendali, foneticizzale.

5. END_CALL OBBLIGATORIO:
   - La sezione "# When to end the call" DEVE menzionare esplicitamente la chiamata al tool 'end_call'
     con i trigger linguistici tipici (es. "grazie arrivederci", "basta così", "non mi interessa").
   - Formula consigliata: "ALWAYS call end_call tool when ...".

6. TOOL:
   - Elenca i tool disponibili in # Tools come testo descrittivo, non come lista markdown.
   - Specifica priorità d'uso (interno prima, esterno fallback).

7. LINGUA:
   - Se l'originale è italiano, mantieni italiano. Default IT salvo richiesta esplicita.

VIOLARE ANCHE UNA DI QUESTE REGOLE invalida l'output e forza un retry.
=== FINE REGOLE OBBLIGATORIE ===`;

/** Carica fino a N voci KB doctrine/system_doctrine come riferimento. */
async function loadDoctrineSnippet(maxEntries = 5): Promise<string> {
  try {
    const all = await findKbEntries();
    const doctrine = all
      .filter((e) => ["doctrine", "system_doctrine", "sales_doctrine"].includes(e.category))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .slice(0, maxEntries);
    if (doctrine.length === 0) return "(nessuna voce doctrine disponibile)";
    return doctrine
      .map((d) => `• [${d.category}] ${d.title}: ${(d.content ?? "").slice(0, 220).replace(/\s+/g, " ").trim()}${(d.content ?? "").length > 220 ? "…" : ""}`)
      .join("\n");
  } catch {
    return "(impossibile caricare KB doctrine)";
  }
}

/**
 * Carica i template di prompt vocali ElevenLabs (Aurora/Bruce/Robin) dalla KB
 * come few-shot reference quando si migliora un blocco voce.
 * I template sono in kb_entries con category='prompt_template' e tag 'voice_template'.
 */
async function loadVoiceTemplatesFewShot(): Promise<string> {
  try {
    const all = await findKbEntries();
    const templates = all
      .filter(
        (e) =>
          e.category === "prompt_template" &&
          Array.isArray(e.tags) &&
          e.tags.includes("voice_template"),
      )
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (templates.length === 0) return "(nessun template voce disponibile in KB)";
    return templates
      .map(
        (t) =>
          `### ESEMPIO ${t.title}\n${(t.content ?? "").trim()}\n--- FINE ESEMPIO ---`,
      )
      .join("\n\n");
  } catch {
    return "(impossibile caricare i template voce)";
  }
}

export function useLabAgent() {
  const [messages, setMessages] = useState<LabChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  /**
   * mode — Fase 4 dell'evoluzione Atlas/Architect.
   *  - "standard" (default): comportamento storico, miglioramento blocco-per-blocco.
   *  - "architect": il Lab Agent NON riscrive ma diagnostica strutturalmente,
   *     usando la procedura KB isolata (`lab_architect_procedure`).
   * Lo stato vive nel hook: ogni consumer (Lab Agent UI, GlobalImproverDialog…)
   * può leggerlo/cambiarlo. La modalità Architect carica una KB extra che
   * NESSUN agente di produzione vede mai.
   */
  const [mode, setMode] = useState<"standard" | "architect">("standard");
  const { loadProcedure: loadArchitectProcedure } = useArchitectKb();

  const appendMessage = useCallback((m: Omit<LabChatMessage, "id" | "timestamp">) => {
    setMessages((prev) => [
      ...prev,
      { ...m, id: crypto.randomUUID(), timestamp: Date.now() },
    ]);
  }, []);

  /**
   * callAgent — invoca unified-assistant scope kb-supervisor con retry/backoff
   * resiliente agli errori transienti (FunctionsFetchError, 502/503/504, 429).
   *
   * Necessario per il "Migliora tutto" che esegue 40+ chiamate sequenziali:
   * il pool di isolate Deno satura facilmente e supabase-js solleva
   * `FunctionsFetchError: Failed to send a request to the Edge Function`
   * quando la fetch verso il runtime fallisce a livello di trasporto.
   */
  const callAgent = useCallback(async (userPrompt: string, extraContext: Record<string, unknown> = {}) => {
    const MAX_ATTEMPTS = 4;
    const BASE_DELAY_MS = 600;

    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await invokeEdge<UnifiedAssistantResponse>("unified-assistant", {
          body: {
            scope: "kb-supervisor",
            mode: "conversational",
            messages: [{ role: "user", content: userPrompt }],
            context: {
              currentPage: "prompt-lab",
              page: "prompt-lab",
              operatorBriefing: PROMPT_LAB_BRIEFING,
              extra_context: extraContext,
            },
          },
          context: "promptLabAgent",
        });
        return (result.content ?? "").trim();
      } catch (e: unknown) {
        lastErr = e;
        // Identifica errori transienti: rete (FunctionsFetchError) o status retryable.
        const msg = e instanceof Error ? e.message : String(e);
        const errAny = e as { httpStatus?: number; code?: string };
        const status = errAny?.httpStatus;
        const isNetwork =
          /failed to send a request to the edge function/i.test(msg) ||
          /network|fetch|timeout|aborted|ECONN/i.test(msg);
        const isRetryableStatus =
          status === 408 || status === 425 || status === 429 ||
          status === 500 || status === 502 || status === 503 || status === 504;
        const retryable = isNetwork || isRetryableStatus;

        if (!retryable || attempt === MAX_ATTEMPTS) throw e;

        // Backoff esponenziale con jitter: 600ms, 1.2s, 2.4s
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("promptLabAgent: retry exhausted");
  }, []);

  const improveBlock = useCallback(
    async ({ block, instruction, tabLabel, tabActivation, nearbyBlocks, goal, briefing }: ImproveOptions): Promise<string> => {
      const guidance = instruction?.trim() ?? "Migliora questo blocco mantenendo il senso ma rendendolo più chiaro, conciso e operativo.";
      const sourceDesc = describeSource(block.source);
      const nearbySummary = summarizeNearby(nearbyBlocks ?? [], block.id);
      // Briefing.targetChannel = 'voice_agent' forza il riconoscimento voce.
      const briefingForcesVoice = briefing?.targetChannel === "voice_agent";
      const isVoice = briefingForcesVoice || isVoiceBlock({
        tabLabel,
        source: block.source,
        label: block.label,
        content: block.content,
      });
      const [doctrineSnippet, voiceFewShot] = await Promise.all([
        loadDoctrineSnippet(),
        isVoice ? loadVoiceTemplatesFewShot() : Promise.resolve(""),
      ]);
      const rubric = resolveRubric(block.source, { forceVoice: isVoice });
      const rubricSection = rubricToPromptSection(rubric);
      const voiceSection = isVoice
        ? `\n${VOICE_ENFORCEMENT_RULES}\n\n=== TEMPLATE VOCE DI RIFERIMENTO (few-shot — segui struttura, tono, sezioni canoniche) ===\n${voiceFewShot}\n=== FINE TEMPLATE VOCE ===\n`
        : "";
      const briefingSection = briefingToPromptSection(briefing);
      const briefingHeader = briefingSection ? `\n${briefingSection}\n` : "";
      // Fallback: se manca briefing strutturato ma c'è goal libero, usa goal.
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

      // Validazione + 1 retry se viola la rubrica
      const issues = validateAgainstRubric(first, rubric);
      if (issues.length === 0) return first;

      const retryPrompt = `${userPrompt}

--- VIOLAZIONI DEL TUO PRIMO TENTATIVO ---
${issues.map((i) => `✗ ${i}`).join("\n")}
--- FINE VIOLAZIONI ---

Riscrivi il blocco correggendo TUTTE le violazioni sopra. Restituisci SOLO il nuovo testo.`;
      const second = await callAgent(retryPrompt, {
        block_id: block.id,
        retry: true,
        violations: issues,
      });
      return second || first;
    },
    [callAgent],
  );

  /**
   * improveBlockGlobal — variante usata dal "Migliora tutto":
   * riceve un systemMap già preparato (descrizione completa di TUTTI i prompt/KB del sistema)
   * e una doctrine completa, niente vincoli di forma fissi: solo guard-rail.
   * Massima libertà al modello, ma con contesto totale per scelte coerenti.
   */
  const improveBlockGlobal = useCallback(
    async (params: {
      block: Block;
      tabLabel: string;
      tabActivation?: string;
      systemMap: string;
      doctrineFull: string;
      systemMission: string;
      goal?: string;
      briefing?: BriefingPayload;
    }): Promise<string> => {
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

      const retryPrompt = `${userPrompt}

--- VIOLAZIONI DEL TUO PRIMO TENTATIVO ---
${issues.map((i) => `✗ ${i}`).join("\n")}
--- FINE VIOLAZIONI ---

Riscrivi correggendo TUTTE le violazioni. SOLO il nuovo testo.`;
      const second = await callAgent(retryPrompt, {
        mode: "global_improve_retry",
        block_id: block.id,
        violations: issues,
      });
      return second || first;
    },
    [callAgent],
  );

  /**
   * analyzeBlockArchitect — modalità Lab Agent Architect (Fase 3).
   *
   * NON riscrive il blocco. Restituisce una diagnostica strutturata
   * (severity / why / destination / proposal / test) per aiutare
   * l'operatore a decidere se il blocco va spostato/fuso/eliminato.
   *
   * Il prompt forza un output a campi e parsiamo lato client con
   * `parseArchitectDiagnostics`. Il modello sa che è in modalità "review",
   * non "rewrite": vincoli espliciti nel prompt.
   */
  const analyzeBlockArchitect = useCallback(
    async (params: {
      block: Block;
      tabLabel?: string;
      tabActivation?: string;
      nearbyBlocks?: ReadonlyArray<Block>;
      systemMap?: string;
      doctrineFull?: string;
      goal?: string;
    }): Promise<ArchitectDiagnostic[]> => {
      const { block, tabLabel, tabActivation, nearbyBlocks, systemMap, doctrineFull, goal } = params;
      const sourceDesc = describeSource(block.source);
      const nearbySummary = summarizeNearby(nearbyBlocks ?? [], block.id);
      const doctrineSnippet = doctrineFull ?? (await loadDoctrineSnippet(8));
      const mapSection = systemMap
        ? `\n--- MAPPA AGENTI/PROMPT (per identificare ridondanze e destinazioni) ---\n${systemMap}\n--- FINE MAPPA ---\n`
        : "";
      // Inietta la procedura Architect SOLO se la modalità è attiva.
      // Categoria KB isolata: nessun runtime di produzione la vede mai.
      const architectProcedure = mode === "architect" ? await loadArchitectProcedure() : "";
      const procedureSection = architectProcedure
        ? `\n=== PROCEDURA LAB ARCHITECT (vincolante per questa risposta) ===\n${architectProcedure}\n=== FINE PROCEDURA ===\n`
        : "";

      const prompt = `Sei il LAB AGENT ARCHITECT. NON riscrivere il blocco. Analizzalo e produci un REPORT STRUTTURATO.
${procedureSection}

OBIETTIVO: capire se questo blocco è al posto giusto, se va spostato in un altro contratto/dottrina, se duplica un altro blocco, o se va eliminato.

FORMATO OBBLIGATORIO (rispetta esattamente le etichette in maiuscolo, una per riga):

BLOCK: ${block.id}
SEVERITY: low | medium | high | critical
WHY: <una sola frase, max 200 caratteri>
DESTINATION: keep-here | move-to-doctrine | move-to-procedure | move-to-contract | merge-with:<block_id> | delete
PROPOSAL: <opzionale, testo proposto se SEVERITY ≥ medium>
TEST: <opzionale, scenario operativo per verificare la modifica>

Se identifichi PIÙ blocchi vicini problematici, ripeti l'intero schema (BLOCK/SEVERITY/...) per ognuno, separato da una riga vuota.

REGOLE:
- "keep-here" se il blocco è ben collocato, anche se migliorabile (severity low/medium ammessa).
- "move-to-doctrine" se è una regola fondamentale che dovrebbe vivere in kb_entries (categoria doctrine/system_doctrine/sales_doctrine).
- "move-to-procedure" se è una procedura operativa lunga che dovrebbe vivere in kb_entries (categoria procedures).
- "move-to-contract" se descrive struttura I/O di un agente che dovrebbe vivere come AgentContract nel registry.
- "merge-with:<block_id>" se è duplicato/ridondante con un altro blocco visibile in mappa.
- "delete" se è obsoleto o contraddittorio rispetto alla dottrina.

NIENTE preamboli, niente commenti fuori formato, niente markdown extra.

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
--- BLOCCHI VICINI (per cercare duplicati/contraddizioni) ---
${nearbySummary}
--- FINE BLOCCHI VICINI ---

--- KB DOCTRINE rilevante (per valutare se va promossa a doctrine) ---
${doctrineSnippet}
--- FINE KB DOCTRINE ---`;

      const raw = await callAgent(prompt, {
        mode: "architect_diagnose",
        agent_mode: mode,
        block_id: block.id,
        block_source: block.source,
      });
      return parseArchitectDiagnostics(raw);
    },
    [callAgent, mode, loadArchitectProcedure],
  );

  const sendChatMessage = useCallback(
    async (
      content: string,
      ctx: { tabLabel: string; blocks: ReadonlyArray<Block>; tabActivation?: string },
    ): Promise<{ targetBlockId?: string; improvedText?: string; chat: string }> => {
      appendMessage({ role: "user", content });
      setLoading(true);
      try {
        // Prova a identificare il blocco target dal messaggio
        const lower = content.toLowerCase();
        const target = ctx.blocks.find(
          (b) =>
            lower.includes(b.label.toLowerCase()) ||
            lower.includes(b.id.toLowerCase()),
        );

        if (target) {
          const improved = await improveBlock({
            block: target,
            instruction: content,
            tabLabel: ctx.tabLabel,
            tabActivation: ctx.tabActivation,
            nearbyBlocks: ctx.blocks,
            goal: content,
          });
          appendMessage({
            role: "assistant",
            content: `Ho proposto un miglioramento per **${target.label}**. Verifica nella colonna destra.`,
          });
          return { targetBlockId: target.id, improvedText: improved, chat: improved };
        }

        // Fallback: chat libera
        const reply = await callAgent(content, {
          tab: ctx.tabLabel,
          tab_activation: ctx.tabActivation,
          blocks: ctx.blocks.map((b) => ({ id: b.id, label: b.label })),
        });
        appendMessage({ role: "assistant", content: reply });
        return { chat: reply };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Errore Lab Agent";
        appendMessage({ role: "assistant", content: `❌ ${msg}` });
        return { chat: msg };
      } finally {
        setLoading(false);
      }
    },
    [appendMessage, callAgent, improveBlock],
  );

  return {
    messages,
    loading,
    sendChatMessage,
    improveBlock,
    improveBlockGlobal,
    analyzeBlockArchitect,
    mode,
    setMode,
    clearMessages: () => setMessages([]),
  };
}