import type { Block, BlockSource } from "../../types";
import { CONTRACT_VARIABLES, IMMUTABLE_RULES_BY_LEVEL } from "../../contracts";
import type { BriefingPayload } from "./types";

/** Serializza il briefing in una sezione prompt prioritaria. */
export function briefingToPromptSection(b: BriefingPayload | undefined): string {
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

export function describeSource(src: BlockSource): string {
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

export function summarizeNearby(nearby: ReadonlyArray<Block>, currentId: string): string {
  const others = nearby.filter((b) => b.id !== currentId);
  if (others.length === 0) return "(nessun altro blocco nel tab)";
  return others
    .slice(0, 8)
    .map((b) => `• ${b.label}: ${b.content.slice(0, 180).replace(/\s+/g, " ").trim()}${b.content.length > 180 ? "…" : ""}`)
    .join("\n");
}

/** Genera la sezione "Contratti Supremi" per il prompt architect. */
export function buildContractReferenceSection(): string {
  const parts: string[] = [
    "=== CONTRATTI SUPREMI DEL SISTEMA (variabili lecite per contratto) ===",
    "Se un prompt usa una variabile NON presente in questi contratti, è una GHOST VARIABLE.",
    "",
  ];
  for (const [contract, vars] of Object.entries(CONTRACT_VARIABLES)) {
    parts.push(`## ${contract}`);
    parts.push(vars.join(", "));
    parts.push("");
  }
  parts.push("## REGOLE IMMUTABILI PER LIVELLO GERARCHIA");
  for (const [level, rules] of Object.entries(IMMUTABLE_RULES_BY_LEVEL)) {
    parts.push(`Livello ${level}: ${rules.join(" | ")}`);
  }
  parts.push("=== FINE CONTRATTI SUPREMI ===");
  return parts.join("\n");
}

/**
 * buildRetryPrompt — costruisce un prompt retry COMPATTO dopo violazione rubrica.
 */
export function buildRetryPrompt(args: {
  blockLabel: string;
  blockContent: string;
  violations: ReadonlyArray<string>;
  contextHint?: string;
}): string {
  const { blockLabel, blockContent, violations, contextHint } = args;
  const hint = contextHint ? `Contesto: ${contextHint}\n\n` : "";
  return `Riscrittura ulteriore necessaria — il tuo primo tentativo per il blocco "${blockLabel}" ha violato la rubrica.

${hint}--- TESTO ORIGINALE DEL BLOCCO ---
${blockContent}
--- FINE TESTO ORIGINALE ---

--- VIOLAZIONI DA CORREGGERE ---
${violations.map((i) => `✗ ${i}`).join("\n")}
--- FINE VIOLAZIONI ---

Riscrivi il blocco correggendo TUTTE le violazioni sopra, mantenendo coerenza con la rubrica e i vincoli già forniti nel prompt iniziale di questa sessione. Restituisci SOLO il nuovo testo del blocco, niente preamboli, niente commenti.`;
}