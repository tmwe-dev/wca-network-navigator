/**
 * superMario.ts — Client front-end per l'AI Gateway unificato.
 *
 * Tutte le invocazioni AI del Command DEVONO passare da qui (via invokeAi,
 * conforme a AI Invocation Charter R1+R2).
 *
 * NB: la sostituzione dei silos legacy (aiBridge / useResultCommentary)
 * avviene incrementalmente: useCommandSubmit potra' chiamare superMario.invoke
 * dietro feature flag prima di rimuovere il vecchio percorso.
 */
import { invokeAi, type AiContext, type AiScope } from "@/lib/ai/invokeAi";

export interface SuperMarioTurn {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_id?: string;
  tool_result?: unknown;
  index: number;
}

export interface SuperMarioToolCall {
  tool_name: string;
  arguments: Record<string, unknown>;
}

export interface SuperMarioResponse {
  message: string;
  tool_calls: SuperMarioToolCall[];
  reasoning_summary: string;
  needs_user_confirmation: boolean;
  warnings: string[];
}

export interface SuperMarioMeta {
  latency_ms: number;
  kb_cards: number;
  violations: Array<{ code: string; message: string; severity: string }>;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface SuperMarioInvokeResult {
  trace_id: string;
  domain: string;
  response: SuperMarioResponse;
  meta: SuperMarioMeta;
}

export interface SuperMarioInvokeOptions {
  source: string;
  scope?: AiScope;
  conversationId?: string | null;
  userMessage: string;
  turns?: SuperMarioTurn[];
  operatorMemory?: string;
  model?: string;
  route?: string;
}

export async function invokeSuperMario(
  opts: SuperMarioInvokeOptions,
): Promise<SuperMarioInvokeResult> {
  const context: AiContext = {
    source: opts.source,
    route: opts.route,
    mode: "super-mario.invoke",
  };

  const body = {
    scope: opts.scope ?? "command",
    conversation_id: opts.conversationId ?? null,
    user_message: opts.userMessage,
    turns: opts.turns ?? [],
    operator_memory: opts.operatorMemory,
    model: opts.model,
  };

  return await invokeAi<SuperMarioInvokeResult>("super-mario", {
    scope: opts.scope ?? "command",
    context,
    body,
  });
}

export const superMario = { invoke: invokeSuperMario };
