import { useCallback } from "react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { PROMPT_LAB_BRIEFING } from "./briefings";
import type { UnifiedAssistantResponse } from "./types";

/**
 * useCallAgent — invoca unified-assistant scope kb-supervisor con retry/backoff
 * resiliente a errori transienti (FunctionsFetchError, 502/503/504, 429).
 */
export function useCallAgent() {
  return useCallback(
    async (userPrompt: string, extraContext: Record<string, unknown> = {}): Promise<string> => {
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

          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error("promptLabAgent: retry exhausted");
    },
    [],
  );
}