/**
 * useLabAgent — wrapper unified-assistant scope kb-supervisor con briefing Prompt Lab.
 */
import { useCallback, useState } from "react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Block, BlockSource } from "../types";
import { findKbEntries } from "@/data/kbEntries";
import { resolveRubric, rubricToPromptSection, validateAgainstRubric, isVoiceBlock } from "../promptRubrics";

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

export function useLabAgent() {
  const [messages, setMessages] = useState<LabChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const appendMessage = useCallback((m: Omit<LabChatMessage, "id" | "timestamp">) => {
    setMessages((prev) => [
      ...prev,
      { ...m, id: crypto.randomUUID(), timestamp: Date.now() },
    ]);
  }, []);

  const callAgent = useCallback(async (userPrompt: string, extraContext: Record<string, unknown> = {}) => {
    const result = await invokeEdge<UnifiedAssistantResponse>("unified-assistant", {
      body: {
        scope: "kb-supervisor",
        mode: "conversational",
        messages: [{ role: "user", content: userPrompt }],
        pageContext: "prompt-lab",
        operatorBriefing: PROMPT_LAB_BRIEFING,
        extra_context: extraContext,
      },
      context: "promptLabAgent",
    });
    return (result.content ?? "").trim();
  }, []);

  const improveBlock = useCallback(
    async ({ block, instruction, tabLabel, tabActivation, nearbyBlocks, goal }: ImproveOptions): Promise<string> => {
      const guidance = instruction?.trim() ?? "Migliora questo blocco mantenendo il senso ma rendendolo più chiaro, conciso e operativo.";
      const sourceDesc = describeSource(block.source);
      const nearbySummary = summarizeNearby(nearbyBlocks ?? [], block.id);
      const doctrineSnippet = await loadDoctrineSnippet();
      const rubric = resolveRubric(block.source, {
        forceVoice: isVoiceBlock({ tabLabel, source: block.source, label: block.label }),
      });
      const rubricSection = rubricToPromptSection(rubric);

      const userPrompt = `Tab: ${tabLabel ?? "n/d"}
Dove si attiva (runtime): ${tabActivation ?? "n/d"}
Sorgente DB: ${sourceDesc}
Blocco da migliorare: ${block.label} (${block.id})
${goal?.trim() ? `\nOBIETTIVO dichiarato dall'operatore: ${goal.trim()}\n` : ""}
Istruzione operativa: ${guidance}

--- BLOCCHI VICINI nello stesso tab (NON contraddirli) ---
${nearbySummary}
--- FINE BLOCCHI VICINI ---

--- KB DOCTRINE rilevante (regole già scritte, rispettale) ---
${doctrineSnippet}
--- FINE KB DOCTRINE ---

${rubricSection}

--- TESTO ATTUALE DEL BLOCCO ---
${block.content}
--- FINE TESTO ---

Restituisci SOLO il testo migliorato del blocco, niente commenti. Rispetta la RUBRICA sopra (must-have, must-not, lunghezza, struttura).`;

      const first = await callAgent(userPrompt, {
        block_id: block.id,
        block_label: block.label,
        block_source: block.source,
        tab: tabLabel,
        tab_activation: tabActivation,
        goal: goal ?? null,
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
    }): Promise<string> => {
      const { block, tabLabel, tabActivation, systemMap, doctrineFull, systemMission, goal } = params;
      const sourceDesc = describeSource(block.source);
      const rubric = resolveRubric(block.source, {
        forceVoice: isVoiceBlock({ tabLabel, source: block.source, label: block.label }),
      });
      const rubricSection = rubricToPromptSection(rubric);

      const userPrompt = `=== SYSTEM MISSION ===
${systemMission}

=== KB DOCTRINE COMPLETA (regole già scritte — NON contraddirle, completale) ===
${doctrineFull}

=== MAPPA COMPLETA DEL SISTEMA AI (tutti i prompt configurati e dove vengono eseguiti) ===
${systemMap}

${rubricSection}

=== BLOCCO DA MIGLIORARE ===
Tab: ${tabLabel}
Dove si attiva (runtime): ${tabActivation ?? "n/d"}
Sorgente DB: ${sourceDesc}
Etichetta: ${block.label}
ID: ${block.id}
${goal?.trim() ? `\nObiettivo dichiarato: ${goal.trim()}\n` : ""}
--- TESTO ATTUALE ---
${block.content}
--- FINE TESTO ---

ISTRUZIONI:
- Riscrivi il blocco perché serva meglio l'obiettivo del sistema, in coerenza con TUTTO il resto.
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
    clearMessages: () => setMessages([]),
  };
}