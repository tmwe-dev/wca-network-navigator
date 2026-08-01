/**
 * useBrain — read-only hooks for the unified Brain page (/v2/brain).
 *
 * F5 2026-05-23: no writes, no mutations. The page is a configuratore
 * visivo che oggi mostra agenti, persona, capabilities, prompt vivi per
 * canale. Le scritture verranno aggiunte in una fase successiva.
 */
import { useQuery } from "@tanstack/react-query";
import { listBrainAgents, listBrainPrompts, type BrainAgentRow, type BrainPromptRow } from "@/data/brain";
import { queryKeys } from "@/lib/queryKeys";

export type BrainChannelId = "email" | "whatsapp" | "linkedin" | "voice" | "command";

export interface BrainChannelDef {
  id: BrainChannelId;
  label: string;
  emoji: string;
  /** context values used to filter operative_prompts for this channel */
  contexts: readonly string[];
  /** sostantivi che individuano un agente assegnabile a questo canale (match case-insensitive su name/role) */
  agentHints: readonly string[];
}

export const BRAIN_CHANNELS: readonly BrainChannelDef[] = [
  { id: "email",    label: "Email",     emoji: "✉️", contexts: ["email", "email-quality", "post-send", "outreach"], agentHints: ["email", "mail", "outreach"] },
  { id: "whatsapp", label: "WhatsApp",  emoji: "💬", contexts: ["whatsapp", "multi-channel"], agentHints: ["whatsapp", "wa "] },
  { id: "linkedin", label: "LinkedIn",  emoji: "🔗", contexts: ["linkedin", "multi-channel"], agentHints: ["linkedin", "li "] },
  { id: "voice",    label: "Voce",      emoji: "🎙", contexts: ["general", "conversation-summary"], agentHints: ["voice", "vocal", "aurora", "robin"] },
  { id: "command",  label: "Command",   emoji: "🧭", contexts: ["command", "agent-loop", "general", "classification"], agentHints: ["luca", "director", "command", "assistant"] },
] as const;

export type BrainToneId = "formale" | "cordiale" | "diretto" | "caloroso" | "tecnico";

export interface BrainToneDef {
  id: BrainToneId;
  label: string;
  emoji: string;
  /** valori tone (case-insensitive) che mappiamo su questa icona */
  match: readonly string[];
}

export const BRAIN_TONES: readonly BrainToneDef[] = [
  { id: "formale",  label: "Formale",   emoji: "🎩", match: ["formal", "formale", "professional", "professionale"] },
  { id: "cordiale", label: "Cordiale",  emoji: "🤝", match: ["cordial", "cordiale", "friendly", "amichevole"] },
  { id: "diretto",  label: "Diretto",   emoji: "🎯", match: ["direct", "diretto", "concise", "sintetico", "decisivo"] },
  { id: "caloroso", label: "Caloroso",  emoji: "🔥", match: ["warm", "caloroso", "empathetic", "empatico"] },
  { id: "tecnico",  label: "Tecnico",   emoji: "🔧", match: ["technical", "tecnico", "expert", "esperto"] },
] as const;

export function useBrainAgents() {
  return useQuery<BrainAgentRow[]>({
    queryKey: queryKeys.brain.agents,
    queryFn: listBrainAgents,
    staleTime: 60_000,
  });
}

export function useBrainPrompts(contexts: readonly string[]) {
  return useQuery<BrainPromptRow[]>({
    queryKey: queryKeys.brain.prompts(contexts),
    queryFn: () => listBrainPrompts(contexts),
    enabled: contexts.length > 0,
    staleTime: 60_000,
  });
}

/** Restituisce l'agente "rappresentativo" del canale (match agentHints sui campi name/role). */
export function agentsForChannel(agents: BrainAgentRow[], channel: BrainChannelDef): BrainAgentRow[] {
  const hints = channel.agentHints.map((h) => h.toLowerCase());
  return agents.filter((a) => {
    const hay = `${a.name ?? ""} ${a.role ?? ""}`.toLowerCase();
    return hints.some((h) => hay.includes(h));
  });
}

/** Mappa una stringa di tono libero su una BrainToneDef (o null se non riconosciuta). */
export function classifyTone(tone: string | null | undefined): BrainToneDef | null {
  if (!tone) return null;
  const t = tone.toLowerCase();
  return BRAIN_TONES.find((td) => td.match.some((m) => t.includes(m))) ?? null;
}