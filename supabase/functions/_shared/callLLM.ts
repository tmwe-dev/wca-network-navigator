/**
 * callLLM — Thin alias di `aiChat` con logging garantito.
 *
 * Wrapper che impone i campi obbligatori per l'instrumentation:
 *  - functionName (richiesto)
 *  - userId (opzionale ma raccomandato)
 *
 * Usage:
 *   import { callLLM } from "../_shared/callLLM.ts";
 *   const r = await callLLM({
 *     functionName: "my-function",
 *     models: ["google/gemini-2.5-flash"],
 *     messages: [...],
 *     userId,
 *   });
 *
 * Restituisce lo stesso `AiChatResult` di `aiChat`.
 * Tutte le chiamate sono auto-loggate in `ai_prompt_log` con costo stimato.
 */

import { aiChat, type AiChatOptions, type AiChatResult } from "./aiGateway.ts";

export interface CallLLMOptions extends Omit<AiChatOptions, "functionName"> {
  /** OBBLIGATORIO — nome dell'edge function chiamante. Usato per ai_prompt_log. */
  functionName: string;
}

export async function callLLM(opts: CallLLMOptions): Promise<AiChatResult> {
  return aiChat({
    ...opts,
    context: opts.context ?? opts.functionName,
  });
}

export type { AiChatResult, AiMessage, AiTool } from "./aiGatewayTypes.ts";
