/**
 * _shared/edgeFnPromptRegistry.ts
 *
 * "Pseudo-agent" registry: maps each AI edge function to the scope/tag it
 * loads from the Prompt Lab + a static copy of its base system prompt.
 * Used by `agent-simulate` so that edge functions can be inspected from
 * the Prompt Lab Simulator without changing their production code.
 *
 * Contract:
 *   - `id` is the synthetic agent id used in Simulator UI: `fn:<edge-name>`
 *   - `basePrompt` is a STATIC COPY of what the edge hardcodes in its
 *     `index.ts`. If the production edge changes its base prompt, update
 *     this copy as well — the simulator otherwise shows a stale view.
 *   - `loaderOptions` MUST mirror the exact options passed to
 *     `loadOperativePrompts` inside the production edge.
 */

import type { PromptScope } from "./operativePromptsLoader.ts";

export interface EdgeFnPromptSpec {
  /** Synthetic agent id, prefixed with `fn:`. */
  id: string;
  /** Edge function name (folder under supabase/functions/). */
  edgeFunction: string;
  /** Human-readable label shown in the Simulator dropdown. */
  label: string;
  /** Short description for the UI. */
  description: string;
  /** Default model used by the edge in production. Informational only. */
  defaultModel: string;
  /** Whether the edge advertises tool-calling. */
  hasTools: boolean;
  /** Static copy of the base system prompt hardcoded in the edge. */
  basePrompt: string;
  /** Exact options the edge passes to `loadOperativePrompts`. */
  loaderOptions: {
    scope: PromptScope;
    extraTags?: string[];
    extraContexts?: string[];
    channel?: "email" | "whatsapp" | "linkedin";
    includeUniversal?: boolean;
    limit?: number;
  };
}

export const EDGE_FN_REGISTRY: ReadonlyArray<EdgeFnPromptSpec> = [
  {
    id: "fn:suggest-email-groups",
    edgeFunction: "suggest-email-groups",
    label: "Email Groups Classifier",
    description: "Classifica indirizzi mittente nei gruppi email esistenti dell'operatore.",
    defaultModel: "google/gemini-2.5-flash",
    hasTools: true,
    basePrompt: [
      "Sei il classificatore degli indirizzi email mittente per TMWE / Find Air, azienda di freight forwarding e logistica internazionale.",
      "Devi assegnare ogni address a UNO dei gruppi esistenti dell'operatore (mai inventarne di nuovi).",
      "Distingui sempre i mittenti REALI con cui abbiamo rapporto operativo dai COLD OUTREACH / pitch commerciali non richiesti.",
    ].join("\n\n"),
    loaderOptions: {
      scope: "classification",
      extraTags: ["email-groups-classifier"],
      includeUniversal: true,
      limit: 6,
    },
  },
  {
    id: "fn:classify-email-response",
    edgeFunction: "classify-email-response",
    label: "Email Response Classifier",
    description: "Classifica risposte commerciali (categoria, fiducia, urgenza) e fa progredire il lead status.",
    defaultModel: "claude-opus-4-1-20250805",
    hasTools: false,
    basePrompt:
      "Ti specializzi nella classificazione di email commerciali. Analizza con cura il dominio, la categoria, la fiducia e l'urgenza. Rispondi SOLO con JSON valido, no markdown, no code fences.",
    loaderOptions: {
      scope: "classification",
      includeUniversal: true,
      limit: 4,
    },
  },
  {
    id: "fn:classify-inbound-message",
    edgeFunction: "classify-inbound-message",
    label: "Inbound Message Classifier (multi-canale)",
    description: "Classifica inbound email/WA/LinkedIn (positive/negative/neutral/needs_human/spam) ed estrae metadati.",
    defaultModel: "google/gemini-2.5-flash",
    hasTools: true,
    basePrompt:
      "You are a B2B inbound message classifier for a logistics CRM.\n\nClassify the message and extract structured metadata using the provided tool.\nConsider the channel context when evaluating tone and intent.",
    loaderOptions: {
      scope: "classification",
      includeUniversal: true,
      limit: 5,
    },
  },
  {
    id: "fn:classify-inbound-content",
    edgeFunction: "classify-inbound-content",
    label: "Inbound Content Reader",
    description: "Legge il contenuto della mail in arrivo e propone lettura + azioni (sobrio, no claim falsi).",
    defaultModel: "google/gemini-3-flash-preview",
    hasTools: true,
    basePrompt: [
      "Sei il Content Intelligence Reader del CRM Funnemail.",
      "Leggi il CONTENUTO di una mail in arrivo con il contesto fornito e produci una proposta di lettura + azioni.",
      "NON eseguire nulla. NON inventare partner. Sii sobrio: meglio confidence bassa che claim falsi.",
    ].join("\n\n"),
    loaderOptions: {
      scope: "general",
      extraContexts: ["content-intelligence"],
      extraTags: ["content", "inbound"],
      includeUniversal: true,
      limit: 4,
    },
  },
  {
    id: "fn:funnemail-classify",
    edgeFunction: "funnemail-classify",
    label: "Funnemail Folder Classifier",
    description: "Smista la mail in una cartella esistente e decide azione/agenda/handoff commerciale.",
    defaultModel: "google/gemini-3-flash-preview",
    hasTools: true,
    basePrompt: [
      "Sei Funnemail, il classificatore inbound del client di posta.",
      "Devi smistare la mail in UNA cartella esistente e decidere azione/agenda/handoff commerciale.",
    ].join("\n\n"),
    loaderOptions: {
      scope: "funnemail_classifier",
      includeUniversal: true,
      limit: 3,
    },
  },
  {
    id: "fn:improve-email",
    edgeFunction: "improve-email",
    label: "Email Improver (B2B Editor)",
    description: "Migliora email B2B mantenendo voce/intento dell'utente, rispetto identità mittente.",
    defaultModel: "google/gemini-2.5-pro",
    hasTools: false,
    basePrompt:
      "Sei un editor di email B2B al servizio ESCLUSIVO dell'azienda mittente.\n" +
      "REGOLA IDENTITÀ NON NEGOZIABILE: il messaggio deve risultare inviato dall'azienda mittente. MAI sostituire l'identità del mittente con altri brand, network o alleanze, anche se compaiono nel testo originale o nella KB.\n" +
      "Migliori l'email che l'utente ha scritto: alzi la qualità mantenendo la sua voce e il suo intento. Non riscrivi da zero.",
    loaderOptions: {
      scope: "email-quality",
      includeUniversal: true,
      limit: 5,
    },
  },
  {
    id: "fn:generate-outreach",
    edgeFunction: "generate-outreach",
    label: "Outreach Generator (multi-canale)",
    description: "Produce messaggi outreach (email/WA/LI) con cadenze, holding pattern, identità mittente.",
    defaultModel: "google/gemini-2.5-pro",
    hasTools: false,
    basePrompt:
      "[Base prompt dinamico per canale — vedi generate-outreach/index.ts. " +
      "L'edge costruisce il prompt di sistema in funzione del canale (email/WA/LI), del partner e del contesto. " +
      "Il blocco caricato dal Prompt Lab arriva PRIMA del corpo dinamico.]",
    loaderOptions: {
      scope: "outreach",
      includeUniversal: true,
      limit: 6,
    },
  },
  {
    id: "fn:generate-aliases",
    edgeFunction: "generate-aliases",
    label: "Alias Generator (copywriting)",
    description: "Genera varianti/aliases per nomi/slug evitando duplicati.",
    defaultModel: "google/gemini-2.5-flash",
    hasTools: false,
    basePrompt: "[Base prompt dinamico — vedi generate-aliases/index.ts. Tag: aliases, copywriting.]",
    loaderOptions: {
      scope: "general",
      extraTags: ["aliases", "copywriting"],
      includeUniversal: true,
      limit: 4,
    },
  },
  {
    id: "fn:refresh-conversation-context",
    edgeFunction: "refresh-conversation-context",
    label: "Conversation Context Refresher",
    description: "Riassume e aggiorna il contesto conversazione (debounce 5min).",
    defaultModel: "google/gemini-2.5-flash",
    hasTools: false,
    basePrompt: "[Base prompt dinamico — vedi refresh-conversation-context/index.ts. Tag: conversation-summary, context.]",
    loaderOptions: {
      scope: "general",
      extraContexts: ["conversation-summary"],
      extraTags: ["conversation-summary", "context"],
      includeUniversal: true,
      limit: 2,
    },
  },
];

export function getEdgeFnSpec(id: string): EdgeFnPromptSpec | null {
  return EDGE_FN_REGISTRY.find((s) => s.id === id) ?? null;
}

export function isEdgeFnAgentId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("fn:");
}