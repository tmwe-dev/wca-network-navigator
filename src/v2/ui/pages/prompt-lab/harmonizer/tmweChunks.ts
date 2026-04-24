/**
 * tmweChunks — mappa dichiarativa dei 7 chunk in cui viene spezzata la
 * libreria TMWE (~5.708 righe / ~81K token) per l'ingestione armonizzata.
 *
 * I confini di riga sono indicativi e basati sulla struttura standard
 * della libreria TMWE. Lo slicing avviene client-side: niente parsing AI
 * per delimitare i chunk.
 *
 * `executionOrder` definisce l'ordine OTTIMALE di processamento:
 * - prima KB Core (foundation),
 * - poi Doctrine commerciale (linguaggio comune),
 * - poi Agenti (che la usano),
 * - poi Procedure runtime (che usano gli agenti),
 * - infine Personas e Cross-cutting.
 */
import type { ConflictEntry } from "@/data/harmonizerSessions";

export interface TmweChunkDef {
  index: number;
  name: string;
  description: string;
  /** Range di righe nel file sorgente (start, end inclusivi, 1-based). */
  sourceLines: [number, number];
  /** Conflitti già noti che il modello deve considerare risolti / da segnalare. */
  preloadedConflicts: ConflictEntry[];
  /** Titoli/topic da skippare automaticamente perché duplicati noti. */
  preloadedDuplicates: Array<{ title: string; reason: string }>;
  /** Tabelle target principali per questo chunk (filtra inventario reale). */
  targetTables: string[];
  /** Istruzioni dettagliate per il modello su questo specifico chunk. */
  contractGuidance: string;
}

export const TMWE_CHUNKS: TmweChunkDef[] = [
  {
    index: 0,
    name: "KB Core / Foundation",
    description: "Definizioni canoniche TMWE, mission, glossario, identità aziendale.",
    sourceLines: [1, 800],
    preloadedConflicts: [],
    preloadedDuplicates: [],
    targetTables: ["kb_entries", "app_settings"],
    contractGuidance:
      "Estrai SOLO definizioni canoniche e fatti numerici stabili. Tutto va in kb_entries category=doctrine, tranne mission/identità aziendale che vanno in app_settings (system_mission_text, ai_company_name, ai_company_alias).",
  },
  {
    index: 1,
    name: "Doctrine commerciale",
    description: "9 lead status, gate transizioni, regole holding pattern, dottrina outreach.",
    sourceLines: [801, 1700],
    preloadedConflicts: [],
    preloadedDuplicates: [],
    targetTables: ["kb_entries", "commercial_playbooks"],
    contractGuidance:
      "Le regole di transizione lead status vanno in kb_entries category=doctrine chapter=lead_lifecycle. I playbook strutturati (sequenze multi-step) vanno in commercial_playbooks. Mai duplicare: se un fatto è già in KB, segnala come cross-reference.",
  },
  {
    index: 2,
    name: "Agenti Doer",
    description: "Definizione dei 7 agenti operativi (scope, responsabilità, KPI).",
    sourceLines: [1701, 2700],
    preloadedConflicts: [],
    preloadedDuplicates: [],
    targetTables: ["agents", "agent_personas"],
    contractGuidance:
      "Ogni agente identificato deve produrre UNA sola entry agents + UNA sola agent_personas. Verifica entities_created prima di proporre INSERT. Per persona: tono, regole stile, esempi. Per agent: scope operativo, KPI, trigger.",
  },
  {
    index: 3,
    name: "Procedure runtime / Operative",
    description: "Procedure step-by-step, prompt operativi, briefing per scope.",
    sourceLines: [2701, 3600],
    preloadedConflicts: [],
    preloadedDuplicates: [],
    targetTables: ["operative_prompts", "kb_entries"],
    contractGuidance:
      "Procedure → operative_prompts (con scope esplicito). KB di supporto → kb_entries category=procedure. Se la procedura richiede un contratto/payload runtime non esistente, marca resolution_layer=contract.",
  },
  {
    index: 4,
    name: "Email Intelligence",
    description: "Template email, regole sender classification, address rules.",
    sourceLines: [3601, 4400],
    preloadedConflicts: [],
    preloadedDuplicates: [],
    targetTables: ["email_prompts", "email_address_rules", "kb_entries"],
    contractGuidance:
      "Template email → email_prompts (con scope+stage). Regole indirizzi/whitelist → email_address_rules. Strategie → kb_entries category=email_strategy.",
  },
  {
    index: 5,
    name: "Brain & Skin / Cross-cutting",
    description: "Logiche di consapevolezza contestuale, governance KB, rubric prompt.",
    sourceLines: [4401, 5200],
    preloadedConflicts: [],
    preloadedDuplicates: [],
    targetTables: ["kb_entries", "app_settings"],
    contractGuidance:
      "Tutto in kb_entries (category=system_doctrine o governance). Se richiede policy hard nel codice (cap, blacklist, guard), marca resolution_layer=code_policy.",
  },
  {
    index: 6,
    name: "FindAIr 2026 / Roadmap",
    description: "Iniziative speciali, roadmap, claim commerciali, KPI 2026.",
    sourceLines: [5201, 5708],
    preloadedConflicts: [],
    preloadedDuplicates: [],
    targetTables: ["kb_entries", "commercial_playbooks"],
    contractGuidance:
      "Claim commerciali e KPI vanno in kb_entries category=marketing. Verifica conflitti con dottrina già caricata (es. percentuali supplementi, frequenze monitoraggio): se diverso, NON sovrascrivere — registra come ConflictEntry per Luca.",
  },
];

/**
 * Ordine di esecuzione raccomandato. Si parte dai foundation e si finisce
 * dai chunk che dipendono da tutti gli altri (FindAIr 2026, cross-cutting).
 * L'ordine 1→3→2→5→4→6→7 (zero-based: 0→2→1→4→3→5→6) garantisce che
 * agenti vengano definiti dopo la KB Core ma prima delle procedure che li
 * referenziano.
 */
export const TMWE_EXECUTION_ORDER: number[] = [0, 2, 1, 4, 3, 5, 6];

/** Slicing client-side delle righe di un chunk dal sorgente intero. */
export function sliceChunkLines(sourceText: string, def: TmweChunkDef): string {
  const lines = sourceText.split("\n");
  const [start, end] = def.sourceLines;
  // Clamp: il file potrebbe essere più corto di quanto previsto.
  const safeStart = Math.max(0, start - 1);
  const safeEnd = Math.min(lines.length, end);
  return lines.slice(safeStart, safeEnd).join("\n");
}
